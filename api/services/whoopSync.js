/**
 * whoopSync.js — server-side WHOOP data import service.
 *
 * Mirrors stravaSync.js in pattern and responsibilities:
 *  1. Load the user's WHOOP connection from provider_connections
 *  2. Refresh the access token if close to expiring
 *  3. Fetch last 90 days of cycles, recoveries, and sleeps from WHOOP API
 *  4. Upsert raw payloads into source_records
 *  5. Aggregate cycles + recoveries + sleeps into one row per date
 *  6. Normalize and upsert into daily_metrics (onConflict: user_id,day)
 *  7. Update last_synced_at on the connection row
 *
 * Import is idempotent — safe to re-run; upsert overwrites same rows.
 * All writes are scoped to the verified user_id from the caller's JWT.
 */

const axios = require('axios');
const { supabase } = require('../db/supabase');

const BASE_URL    = 'https://api.prod.whoop.com/developer/v2';
const TOKEN_URL   = 'https://api.prod.whoop.com/oauth/oauth2/token';
const DAYS_BACK   = 90;
const BUFFER_SECS = 300; // refresh 5 min before actual expiry

// ── Token management ──────────────────────────────────────────────────────────

async function ensureFreshToken(userId, conn) {
  const expiresAt = Math.floor(new Date(conn.token_expires_at).getTime() / 1000);
  const now       = Math.floor(Date.now() / 1000);

  if (expiresAt > now + BUFFER_SECS) {
    return conn.access_token_encrypted; // still valid
  }

  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: conn.refresh_token_encrypted,
    client_id:     process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
  });

  const { data } = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const newExpiresAt = new Date(
    (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)) * 1000
  ).toISOString();

  const { error } = await supabase
    .from('provider_connections')
    .update({
      access_token_encrypted:  data.access_token,
      refresh_token_encrypted: data.refresh_token,
      token_expires_at:        newExpiresAt,
      updated_at:              new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'whoop');

  if (error) console.error('[whoopSync] token refresh persist error:', error.message);

  return data.access_token;
}

// ── WHOOP API helpers ─────────────────────────────────────────────────────────

/** Fetch all pages of a paginated WHOOP endpoint. */
async function fetchAllPages(accessToken, endpoint, params = {}) {
  const records   = [];
  let nextToken   = null;

  do {
    const p = { limit: 25, ...params };
    if (nextToken) p.nextToken = nextToken;

    const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params:  p,
    });

    records.push(...(data.records || []));
    nextToken = data.next_token || null;
  } while (nextToken);

  return records;
}

// ── Normalize ─────────────────────────────────────────────────────────────────

/**
 * Map an aggregated per-day object to the daily_metrics table schema.
 * Only writes columns that exist in the current schema.
 */
function normalizeRow(row, userId) {
  return {
    user_id:        userId,
    day:            row.date,
    recovery_score: row.recovery_score ?? null,
    hrv:            row.hrv_rmssd      ?? null,
    resting_hr:     row.resting_hr     ?? null,
    sleep_score:    row.sleep_performance ?? null,
    sleep_seconds:  row.sleep_duration_ms != null
                      ? Math.round(row.sleep_duration_ms / 1000)
                      : null,
    strain_score:   row.strain ?? null,
    updated_at:     new Date().toISOString(),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

async function importLast90Days(userId) {
  // 1. Load connection
  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'whoop')
    .maybeSingle();

  if (connErr) throw new Error(`DB error loading WHOOP connection: ${connErr.message}`);
  if (!conn)   throw new Error('WHOOP not connected');
  if (conn.status !== 'active') throw new Error('WHOOP connection is not active');

  // 2. Refresh token if needed
  const accessToken = await ensureFreshToken(userId, conn);

  // 3. Fetch last 90 days from WHOOP API
  const start = new Date(Date.now() - DAYS_BACK * 24 * 3600 * 1000).toISOString();
  const end   = new Date().toISOString();

  const [cycles, recoveries, sleeps] = await Promise.all([
    fetchAllPages(accessToken, '/cycle',          { start, end }),
    fetchAllPages(accessToken, '/recovery',       { start, end }),
    fetchAllPages(accessToken, '/activity/sleep', { start, end }),
  ]);

  // 4. Upsert raw payloads into source_records
  const sourceRows = [
    ...cycles.map(c => ({
      user_id:            userId,
      provider:           'whoop',
      entity_type:        'cycle',
      provider_object_id: String(c.id),
      payload:            c,
      fetched_at:         new Date().toISOString(),
    })),
    ...recoveries.map(r => ({
      user_id:            userId,
      provider:           'whoop',
      entity_type:        'recovery',
      provider_object_id: String(r.id),
      payload:            r,
      fetched_at:         new Date().toISOString(),
    })),
    ...sleeps.map(s => ({
      user_id:            userId,
      provider:           'whoop',
      entity_type:        'sleep',
      provider_object_id: String(s.id),
      payload:            s,
      fetched_at:         new Date().toISOString(),
    })),
  ];

  if (sourceRows.length) {
    const { error: srcErr } = await supabase
      .from('source_records')
      .upsert(sourceRows, {
        onConflict: 'user_id,provider,entity_type,provider_object_id',
      });
    if (srcErr) console.error('[whoopSync] source_records upsert error:', srcErr.message);
  }

  // 5. Aggregate: join cycles + recoveries + sleeps by date
  const cycleIdToDate = {};
  const byDate        = {};

  for (const cycle of cycles) {
    const date = cycle.start?.split('T')[0];
    if (!date) continue;
    cycleIdToDate[cycle.id] = date;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].strain = cycle.score?.strain ?? null;
  }

  for (const rec of recoveries) {
    const date = cycleIdToDate[rec.cycle_id] || rec.created_at?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].recovery_score = rec.score?.recovery_score        ?? null;
    byDate[date].hrv_rmssd      = rec.score?.hrv_rmssd_milli       ?? null;
    byDate[date].resting_hr     = rec.score?.resting_heart_rate    ?? null;
  }

  for (const sleep of sleeps) {
    const date = cycleIdToDate[sleep.cycle_id] || sleep.start?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].sleep_performance = sleep.score?.sleep_performance_percentage        ?? null;
    byDate[date].sleep_duration_ms = sleep.score?.stage_summary?.total_in_bed_time_milli ?? null;
  }

  // 6. Normalize and upsert into daily_metrics
  const metricsRows = Object.values(byDate)
    .filter(r => r.date)
    .map(r => normalizeRow(r, userId));

  if (metricsRows.length) {
    const { error: metricsErr } = await supabase
      .from('daily_metrics')
      .upsert(metricsRows, { onConflict: 'user_id,day' });

    if (metricsErr) throw new Error(`daily_metrics upsert failed: ${metricsErr.message}`);
  }

  // 7. Mark last successful sync
  await supabase
    .from('provider_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'whoop');

  return { imported: metricsRows.length };
}

// ── Incremental helpers (used by webhook handler) ─────────────────────────────

/**
 * Fetch and upsert WHOOP data for a narrow time window (cycles + recoveries + sleeps).
 * Called by the webhook handler to refresh only the affected date(s) rather than
 * re-running a full 90-day import.
 *
 * @param {string} userId  - Supabase user ID (verified by caller)
 * @param {string} start   - ISO timestamp, window start
 * @param {string} end     - ISO timestamp, window end
 */
async function importDateWindow(userId, start, end) {
  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'whoop')
    .maybeSingle();

  if (connErr) throw new Error(`DB error: ${connErr.message}`);
  if (!conn || conn.status !== 'active') throw new Error('WHOOP not connected');

  const accessToken = await ensureFreshToken(userId, conn);

  const [cycles, recoveries, sleeps] = await Promise.all([
    fetchAllPages(accessToken, '/cycle',          { start, end }),
    fetchAllPages(accessToken, '/recovery',       { start, end }),
    fetchAllPages(accessToken, '/activity/sleep', { start, end }),
  ]);

  // Upsert raw payloads
  const sourceRows = [
    ...cycles.map(c => ({
      user_id: userId, provider: 'whoop', entity_type: 'cycle',
      provider_object_id: String(c.id), payload: c, fetched_at: new Date().toISOString(),
    })),
    ...recoveries.map(r => ({
      user_id: userId, provider: 'whoop', entity_type: 'recovery',
      provider_object_id: String(r.id), payload: r, fetched_at: new Date().toISOString(),
    })),
    ...sleeps.map(s => ({
      user_id: userId, provider: 'whoop', entity_type: 'sleep',
      provider_object_id: String(s.id), payload: s, fetched_at: new Date().toISOString(),
    })),
  ];

  if (sourceRows.length) {
    const { error: srcErr } = await supabase
      .from('source_records')
      .upsert(sourceRows, { onConflict: 'user_id,provider,entity_type,provider_object_id' });
    if (srcErr) console.error('[whoopSync] window source_records upsert error:', srcErr.message);
  }

  // Aggregate by date and upsert daily_metrics (same logic as importLast90Days)
  const cycleIdToDate = {};
  const byDate        = {};

  for (const cycle of cycles) {
    const date = cycle.start?.split('T')[0];
    if (!date) continue;
    cycleIdToDate[cycle.id] = date;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].strain = cycle.score?.strain ?? null;
  }
  for (const rec of recoveries) {
    const date = cycleIdToDate[rec.cycle_id] || rec.created_at?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].recovery_score = rec.score?.recovery_score     ?? null;
    byDate[date].hrv_rmssd      = rec.score?.hrv_rmssd_milli    ?? null;
    byDate[date].resting_hr     = rec.score?.resting_heart_rate ?? null;
  }
  for (const sleep of sleeps) {
    const date = cycleIdToDate[sleep.cycle_id] || sleep.start?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].sleep_performance = sleep.score?.sleep_performance_percentage           ?? null;
    byDate[date].sleep_duration_ms = sleep.score?.stage_summary?.total_in_bed_time_milli ?? null;
  }

  const metricsRows = Object.values(byDate).filter(r => r.date).map(r => normalizeRow(r, userId));

  if (metricsRows.length) {
    const { error: metricsErr } = await supabase
      .from('daily_metrics')
      .upsert(metricsRows, { onConflict: 'user_id,day' });
    if (metricsErr) throw new Error(`daily_metrics upsert failed: ${metricsErr.message}`);
  }

  return { imported: metricsRows.length };
}

module.exports = { importLast90Days, ensureFreshToken, importDateWindow };
