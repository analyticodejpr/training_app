const axios = require('axios');
const { saveTokens, getTokens, setCache, getCache } = require('../db/database');

const BASE_URL  = 'https://api.prod.whoop.com/developer/v2';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

// ── token management ──────────────────────────────────────────────────────────

async function refreshAccessToken() {
  const stored = getTokens('whoop');
  if (!stored) throw new Error('WHOOP not connected');

  if (stored.expires_at > Math.floor(Date.now() / 1000) + 300) {
    return stored.access_token;
  }

  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: stored.refresh_token,
    client_id:     process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
  });

  const { data } = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  saveTokens('whoop', {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Math.floor(Date.now() / 1000) + data.expires_in,
    athlete_id:    stored.athlete_id,
    scope:         stored.scope,
  });

  return data.access_token;
}

// ── api client with simple rate limiting ──────────────────────────────────────

let lastCallTime = 0;
const MIN_INTERVAL_MS = 200; // ~5 req/sec

async function whoopGet(endpoint, params = {}, cacheTTL = 300) {
  const cacheKey = `whoop:${endpoint}:${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Basic rate throttle
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();

  const token = await refreshAccessToken();
  const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  setCache(cacheKey, data, cacheTTL);
  return data;
}

// ── paginated helper ──────────────────────────────────────────────────────────

async function getAllPages(endpoint, params = {}, cacheTTL = 300) {
  const cacheKey = `whoop:pages:${endpoint}:${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let records = [];
  let nextToken = null;

  do {
    const p = { limit: 25, ...params };
    if (nextToken) p.nextToken = nextToken;
    const page = await whoopGet(endpoint, p, 0); // don't cache individual pages
    records = records.concat(page.records || []);
    nextToken = page.next_token || null;
  } while (nextToken);

  setCache(cacheKey, records, cacheTTL);
  return records;
}

// ── public API ────────────────────────────────────────────────────────────────

async function getProfile() {
  return whoopGet('/user/profile/basic', {}, 3600);
}

async function getBodyMeasurement() {
  return whoopGet('/user/measurement/body', {}, 3600);
}

// Cycles include strain + recovery for each day
async function getCycles({ start, end } = {}) {
  const params = {};
  if (start) params.start = start;
  if (end)   params.end   = end;
  return getAllPages('/cycle', params, 300);
}

async function getRecoveries({ start, end } = {}) {
  const params = {};
  if (start) params.start = start;
  if (end)   params.end   = end;
  return getAllPages('/recovery', params, 300);
}

async function getSleepData({ start, end } = {}) {
  const params = {};
  if (start) params.start = start;
  if (end)   params.end   = end;
  return getAllPages('/activity/sleep', params, 300);
}

async function getWorkouts({ start, end } = {}) {
  const params = {};
  if (start) params.start = start;
  if (end)   params.end   = end;
  return getAllPages('/activity/workout', params, 300);
}

// Build a unified daily summary for the last N days
async function getDailySummary(days = 60) {
  const end   = new Date();
  const start = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [cycles, recoveries, sleeps] = await Promise.all([
    getCycles({ start: start.toISOString(), end: end.toISOString() }),
    getRecoveries({ start: start.toISOString(), end: end.toISOString() }),
    getSleepData({ start: start.toISOString(), end: end.toISOString() }),
  ]);

  // Build cycle_id → date map so recovery & sleep align with their cycle day
  const cycleIdToDate = {};
  const byDate = {};

  for (const cycle of cycles) {
    const date = cycle.start.split('T')[0];
    cycleIdToDate[cycle.id] = date;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].strain     = cycle.score?.strain;
    byDate[date].kilojoules = cycle.score?.kilojoules;
    byDate[date].avg_hr     = cycle.score?.average_heart_rate;
    byDate[date].max_hr     = cycle.score?.max_heart_rate;
    byDate[date].cycle_id   = cycle.id;
  }

  for (const rec of recoveries) {
    const date = cycleIdToDate[rec.cycle_id] || rec.created_at?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].recovery_score = rec.score?.recovery_score;
    byDate[date].hrv_rmssd      = rec.score?.hrv_rmssd_milli;
    byDate[date].resting_hr     = rec.score?.resting_heart_rate;
    byDate[date].spo2           = rec.score?.spo2_percentage;
    byDate[date].skin_temp      = rec.score?.skin_temp_celsius;
  }

  for (const sleep of sleeps) {
    const date = cycleIdToDate[sleep.cycle_id] || sleep.start?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date].sleep_performance = sleep.score?.sleep_performance_percentage;
    byDate[date].sleep_duration_ms = sleep.score?.stage_summary?.total_in_bed_time_milli;
    byDate[date].sleep_rem_ms      = sleep.score?.stage_summary?.total_rem_sleep_time_milli;
    byDate[date].sleep_slow_wave   = sleep.score?.stage_summary?.total_slow_wave_sleep_time_milli;
    byDate[date].sleep_awake_ms    = sleep.score?.stage_summary?.total_awake_time_milli;
    byDate[date].disturbances      = sleep.score?.stage_summary?.disturbance_count;
    byDate[date].respiratory_rate  = sleep.score?.respiratory_rate;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  getProfile,
  getBodyMeasurement,
  getCycles,
  getRecoveries,
  getSleepData,
  getWorkouts,
  getDailySummary,
};
