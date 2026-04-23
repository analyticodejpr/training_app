import axios from 'axios'
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

// ── Session token (stored in localStorage, sent as Bearer header) ─────────────

export function getStoredToken() {
  return localStorage.getItem('th_session') || ''
}

export function saveToken(token) {
  if (token) localStorage.setItem('th_session', token)
}

export function clearToken() {
  localStorage.removeItem('th_session')
}

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({ baseURL: `${BASE}/api` })

api.interceptors.request.use(config => {
  const token = getStoredToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

api.interceptors.response.use(response => {
  const newToken = response.headers['x-session-token']
  if (newToken) saveToken(newToken)
  return response
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getAuthStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const sbToken = session?.access_token || ''
  return api.get('/auth/status', {
    headers: sbToken ? { 'x-sb-token': sbToken } : {},
  }).then(r => r.data)
}

export const disconnectStrava = () =>
  api.delete('/auth/strava/disconnect').then(r => { if (r.data.token) saveToken(r.data.token) })

export const disconnectWhoop = () =>
  api.delete('/auth/whoop/disconnect').then(r => { if (r.data.token) saveToken(r.data.token) })

// Pass the Supabase access token to the connect endpoint so the backend can
// verify the user's identity before building the OAuth redirect URL.
export const connectStrava = async () => {
  if (!BASE) { alert('VITE_API_URL is not set in the frontend Vercel project env vars.'); return }
  const { data: { session } } = await supabase.auth.getSession()
  const sbToken = session?.access_token || ''
  const t = getStoredToken()
  const params = new URLSearchParams()
  if (t) params.set('t', t)
  if (sbToken) params.set('sbToken', sbToken)
  window.location.href = `${BASE}/api/auth/strava/connect?${params}`
}

export const connectWhoop = async () => {
  if (!BASE) { alert('VITE_API_URL is not set in the frontend Vercel project env vars.'); return }
  const { data: { session } } = await supabase.auth.getSession()
  const sbToken = session?.access_token || ''
  const t = getStoredToken()
  const params = new URLSearchParams()
  if (t) params.set('t', t)
  if (sbToken) params.set('sbToken', sbToken)
  window.location.href = `${BASE}/api/auth/whoop/connect?${params}`
}

// ── Supabase-authenticated API helpers ────────────────────────────────────────

/** Returns a header object with the current Supabase JWT. Throws if not signed in. */
async function supabaseAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')
  return { 'X-Supabase-Token': session.access_token }
}

/**
 * Fetch the Strava connection status for the current user from Supabase.
 * Returns { connected, lastSyncedAt, athleteId, connectedAt } or null.
 */
export const getStravaConnection = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get('/strava/connection', { headers })
  return r.data
}

/**
 * Trigger a fast import of the last 7 days of Strava activities.
 * Used as the default import button — catches missed webhook events quickly.
 * Returns { ok: true, imported: number }.
 */
export const importStravaRecent = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/strava/import-recent', null, { headers })
  return r.data
}

/**
 * Trigger a full 90-day backfill of Strava activities.
 * Use this once after first connecting, or to recover from a long gap.
 * Returns { ok: true, imported: number }.
 */
export const importStrava90Days = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/strava/import-90', null, { headers })
  return r.data
}

/**
 * Disconnect Strava and delete all synced Strava data for the current user.
 * Server-side: removes activities, source_records, and provider_connections row.
 */
export const disconnectStravaData = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.delete('/strava/disconnect', { headers })
  return r.data
}

/**
 * Fetch the WHOOP connection status for the current user.
 */
export const getWhoopConnection = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get('/whoop/connection', { headers })
  return r.data
}

/**
 * Disconnect WHOOP and delete all synced WHOOP data for the current user.
 * Server-side: removes daily_metrics, source_records, and provider_connections row.
 */
export const disconnectWhoopData = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.delete('/whoop/disconnect', { headers })
  return r.data
}

/**
 * Trigger a manual import of the last 90 days of WHOOP data.
 * Idempotent — safe to call multiple times.
 */
export const importWhoop90Days = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/whoop/import-90', null, { headers })
  return r.data
}

// ── Planner ───────────────────────────────────────────────────────────────────

/**
 * Create (or replace) the user's active training goal.
 * Any existing active goal is cancelled server-side.
 */
export const createGoal = async (goalData) => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/planner/goals', goalData, { headers })
  return r.data
}

/**
 * Fetch the user's current active training goal. Returns { goal } (goal may be null).
 */
export const getActiveGoal = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get('/planner/goals/active', { headers })
  return r.data
}

/**
 * Trigger full plan generation from the user's active goal.
 * Returns { cycleId, blockCount, weekCount, dataMode, totalWeeks, peakHours, startDate, endDate }.
 */
export const generatePlan = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/planner/generate', null, { headers })
  return r.data
}

/**
 * Fetch the user's current active plan cycle. Returns { cycle } (may be null).
 */
export const getActiveCycle = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get('/planner/cycles/active', { headers })
  return r.data
}

/**
 * Fetch all blocks for a given cycle id. Returns { blocks }.
 */
export const getCycleBlocks = async (cycleId) => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get(`/planner/cycles/${cycleId}/blocks`, { headers })
  return r.data
}

/**
 * Fetch all weeks for a given cycle id. Returns { weeks }.
 */
export const getCycleWeeks = async (cycleId) => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get(`/planner/cycles/${cycleId}/weeks`, { headers })
  return r.data
}

/**
 * Generate (or regenerate) the current-week session schedule.
 * Returns { week, days, sessions }.
 */
export const generateSchedule = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.post('/planner/schedule/generate', null, { headers })
  return r.data
}

/**
 * Fetch the current-week schedule if one exists.
 * Returns { week, days, sessions } — sessions/days may be empty.
 */
export const getCurrentSchedule = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.get('/planner/schedule/current', { headers })
  return r.data
}

/**
 * Delete the active training plan cycle and all associated data.
 * The goal is preserved for regeneration.
 */
export const deletePlan = async () => {
  const headers = await supabaseAuthHeaders()
  const r = await api.delete('/planner/cycles/active', { headers })
  return r.data
}

// ── Strava ────────────────────────────────────────────────────────────────────
export const getStravaAthlete    = () => api.get('/strava/athlete').then(r => r.data)
export const getStravaActivities = (params = {}) => api.get('/strava/activities', { params }).then(r => r.data)
export const getStravaStats      = () => api.get('/strava/stats').then(r => r.data)
export const getStravaWeekly     = () => api.get('/strava/weekly').then(r => r.data)



// ── WHOOP ─────────────────────────────────────────────────────────────────────
export const getWhoopProfile         = () => api.get('/whoop/profile').then(r => r.data)
export const getWhoopBodyMeasurement = () => api.get('/whoop/body').then(r => r.data)
export const getWhoopDaily           = (days = 60) => api.get('/whoop/daily', { params: { days } }).then(r => r.data)
export const getWhoopRecoveries      = (params = {}) => api.get('/whoop/recoveries', { params }).then(r => r.data)
export const getWhoopSleep           = (params = {}) => api.get('/whoop/sleep', { params }).then(r => r.data)
export const getWhoopWorkouts        = (params = {}) => api.get('/whoop/workouts', { params }).then(r => r.data)
