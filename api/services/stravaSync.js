/**
 * stravaSync.js — server-side Strava data import service.
 *
 * Responsibilities:
 *  1. Load a user's Strava connection from provider_connections
 *  2. Refresh the access token when it is close to expiring
 *  3. Fetch last 90 days of activities from the Strava API (paginated)
 *  4. Upsert raw payloads into source_records
 *  5. Normalize and upsert into activities
 *  6. Update last_synced_at on the connection row
 *
 * All writes are scoped to the verified user_id received from the caller.
 * This service never trusts user input for the user_id — callers must
 * supply the id from a verified JWT (see requireSupabaseUser middleware).
 */

const axios = require('axios');
const { supabase } = require('../db/supabase');

const STRAVA_API  = 'https://www.strava.com/api/v3';
const TOKEN_URL   = 'https://www.strava.com/oauth/token';
const PER_PAGE    = 200; // Strava's maximum per page
const DAYS_BACK   = 90;
const BUFFER_SECS = 300; // refresh 5 min before actual expiry

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the user's Strava connection.
 * Refreshes and persists the new token if the current one is about to expire.
 */
async function ensureFreshToken(userId, conn) {
  const expiresAt = Math.floor(new Date(conn.token_expires_at).getTime() / 1000);
  const now       = Math.floor(Date.now() / 1000);

  if (expiresAt > now + BUFFER_SECS) {
    return conn.access_token_encrypted; // still valid
  }

  // Refresh
  const { data } = await axios.post(TOKEN_URL, {
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: conn.refresh_token_encrypted,
  });

  // Persist refreshed tokens
  const { error } = await supabase
    .from('provider_connections')
    .update({
      access_token_encrypted:  data.access_token,
      refresh_token_encrypted: data.refresh_token,
      token_expires_at:        new Date(data.expires_at * 1000).toISOString(),
      updated_at:              new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava');

  if (error) console.error('[stravaSync] token refresh persist error:', error.message);

  return data.access_token;
}

// ── Strava API helpers ────────────────────────────────────────────────────────

/** Fetch a single page of activities with the given `after` Unix timestamp. */
async function fetchActivityPage(accessToken, after, page) {
  const { data } = await axios.get(`${STRAVA_API}/athlete/activities`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params:  { after, per_page: PER_PAGE, page },
  });
  return data; // array of summary activity objects
}

// ── Normalize ─────────────────────────────────────────────────────────────────

/** Map a Strava summary activity to the activities table schema. */
function normalizeActivity(act, userId) {
  return {
    user_id:              userId,
    source_primary:       'strava',
    provider_activity_id: String(act.id),
    starts_at:            act.start_date,
    title:                act.name         || null,
    sport_type:           act.sport_type   || act.type || null,
    distance_m:           act.distance     || null,
    moving_time_s:        act.moving_time  || null,
    elapsed_time_s:       act.elapsed_time || null,
    elevation_gain_m:     act.total_elevation_gain || null,
    avg_hr:               act.average_heartrate    || null,
    max_hr:               act.max_heartrate        || null,
    avg_speed_mps:        act.average_speed        || null,
    updated_at:           new Date().toISOString(),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Import the last N days of Strava activities for a verified user.
 * Returns { imported: number } on success.
 * Throws on connection missing, token refresh failure, or fatal DB error.
 */
async function importLast90Days(userId, daysBack = DAYS_BACK) {
  // 1. Load connection
  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .maybeSingle();

  if (connErr) throw new Error(`DB error loading connection: ${connErr.message}`);
  if (!conn)   throw new Error('Strava not connected');
  if (conn.status !== 'active') throw new Error('Strava connection is not active');

  // 2. Refresh token if needed
  const accessToken = await ensureFreshToken(userId, conn);

  // 3. Paginate activities — fetch until Strava returns fewer than PER_PAGE
  const after = Math.floor(Date.now() / 1000) - daysBack * 24 * 3600;
  const allActivities = [];
  let page = 1;

  while (true) {
    const batch = await fetchActivityPage(accessToken, after, page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allActivities.push(...batch);
    if (batch.length < PER_PAGE) break;
    page++;
  }

  if (allActivities.length === 0) {
    return { imported: 0 };
  }

  // 4. Upsert raw payloads into source_records
  // Unique constraint: (user_id, provider, entity_type, provider_object_id)
  const sourceRows = allActivities.map(act => ({
    user_id:            userId,
    provider:           'strava',
    entity_type:        'activity',
    provider_object_id: String(act.id),
    payload:            act,
    fetched_at:         new Date().toISOString(),
  }));

  const { error: srcErr } = await supabase
    .from('source_records')
    .upsert(sourceRows, {
      onConflict: 'user_id,provider,entity_type,provider_object_id',
    });

  if (srcErr) {
    // Log but don't abort — activities upsert is the critical path
    console.error('[stravaSync] source_records upsert error:', srcErr.message);
  }

  // 5. Normalize and upsert into activities
  // Unique index: activities_user_source_provider_id_key (user_id, source_primary, provider_activity_id)
  const activityRows = allActivities.map(act => normalizeActivity(act, userId));

  const { error: actErr } = await supabase
    .from('activities')
    .upsert(activityRows, {
      onConflict: 'user_id,source_primary,provider_activity_id',
    });

  if (actErr) throw new Error(`Activities upsert failed: ${actErr.message}`);

  // 6. Mark last successful sync
  await supabase
    .from('provider_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava');

  return { imported: allActivities.length };
}

// ── Incremental helpers (used by webhook handler) ─────────────────────────────

/**
 * Fetch a single Strava activity by ID and upsert into source_records + activities.
 * Called on webhook activity.create and activity.update events.
 * Idempotent — safe to call for the same activity multiple times.
 */
async function importSingleActivity(userId, activityId) {
  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .maybeSingle();

  if (connErr) throw new Error(`DB error: ${connErr.message}`);
  if (!conn || conn.status !== 'active') throw new Error('Strava not connected');

  const accessToken = await ensureFreshToken(userId, conn);

  const { data: act } = await axios.get(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Upsert raw payload
  await supabase
    .from('source_records')
    .upsert({
      user_id:            userId,
      provider:           'strava',
      entity_type:        'activity',
      provider_object_id: String(activityId),
      payload:            act,
      fetched_at:         new Date().toISOString(),
    }, { onConflict: 'user_id,provider,entity_type,provider_object_id' });

  // Upsert normalized row
  const { error } = await supabase
    .from('activities')
    .upsert(normalizeActivity(act, userId), {
      onConflict: 'user_id,source_primary,provider_activity_id',
    });

  if (error) throw new Error(`Activity upsert failed: ${error.message}`);
}

/**
 * Remove a Strava activity from activities and source_records.
 * Called on webhook activity.delete events.
 */
async function deleteActivity(userId, activityId) {
  const id = String(activityId);

  await supabase
    .from('activities')
    .delete()
    .eq('user_id', userId)
    .eq('source_primary', 'strava')
    .eq('provider_activity_id', id);

  await supabase
    .from('source_records')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .eq('entity_type', 'activity')
    .eq('provider_object_id', id);
}

/**
 * Import only the last N days (default 7) — used by the import button so users
 * don't need a full 90-day re-import just to catch recent missed activities.
 * Same logic as importLast90Days but with a short window.
 */
async function importRecent(userId, daysBack = 7) {
  return importLast90Days(userId, daysBack);
}

module.exports = { importLast90Days, importRecent, ensureFreshToken, importSingleActivity, deleteActivity };
