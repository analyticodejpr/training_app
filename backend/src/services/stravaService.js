const axios = require('axios');
const { saveTokens, getTokens, setCache, getCache } = require('../db/database');

const BASE_URL = 'https://www.strava.com/api/v3';
const TOKEN_URL = 'https://www.strava.com/oauth/token';

// ── token management ──────────────────────────────────────────────────────────

async function refreshAccessToken() {
  const stored = getTokens('strava');
  if (!stored) throw new Error('Strava not connected');

  // If still valid (5-min buffer), return existing
  if (stored.expires_at > Math.floor(Date.now() / 1000) + 300) {
    return stored.access_token;
  }

  const { data } = await axios.post(TOKEN_URL, {
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: stored.refresh_token,
  });

  saveTokens('strava', {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    athlete_id:    stored.athlete_id,
    scope:         stored.scope,
  });

  return data.access_token;
}

// ── api client ────────────────────────────────────────────────────────────────

async function stravaGet(endpoint, params = {}, cacheTTL = 300) {
  const cacheKey = `strava:${endpoint}:${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const token = await refreshAccessToken();
  const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  setCache(cacheKey, data, cacheTTL);
  return data;
}

// ── public API ────────────────────────────────────────────────────────────────

async function getAthlete() {
  return stravaGet('/athlete', {}, 3600);
}

async function getActivities({ page = 1, perPage = 30, before, after } = {}) {
  const params = { page, per_page: perPage };
  if (before) params.before = before;
  if (after)  params.after  = after;
  return stravaGet('/athlete/activities', params, 300);
}

async function getActivityDetail(id) {
  return stravaGet(`/activities/${id}`, {}, 1800);
}

async function getAthleteStats(athleteId) {
  return stravaGet(`/athletes/${athleteId}/stats`, {}, 1800);
}

// Build a 8-week summary grouped by week
async function getWeeklySummary() {
  const eightWeeksAgo = Math.floor(Date.now() / 1000) - 8 * 7 * 24 * 3600;
  const activities = await getActivities({ perPage: 200, after: eightWeeksAgo });

  const weeks = {};
  for (const act of activities) {
    const date = new Date(act.start_date);
    // ISO week key: YYYY-WNN
    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString().split('T')[0];
    if (!weeks[key]) weeks[key] = { week: key, count: 0, distance: 0, moving_time: 0, elevation: 0, types: {} };
    const w = weeks[key];
    w.count++;
    w.distance    += act.distance;
    w.moving_time += act.moving_time;
    w.elevation   += act.total_elevation_gain;
    w.types[act.type] = (w.types[act.type] || 0) + 1;
  }

  return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon-start
  return new Date(d.setDate(diff));
}

module.exports = { getAthlete, getActivities, getActivityDetail, getAthleteStats, getWeeklySummary };
