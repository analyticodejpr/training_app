import axios from 'axios'

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

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getAuthStatus = () => api.get('/auth/status').then(r => r.data)

export const disconnectStrava = () =>
  api.delete('/auth/strava/disconnect').then(r => { if (r.data.token) saveToken(r.data.token) })

export const disconnectWhoop = () =>
  api.delete('/auth/whoop/disconnect').then(r => { if (r.data.token) saveToken(r.data.token) })

// Direct navigation to backend /connect — no CORS, no cookies needed
export const connectStrava = () => {
  if (!BASE) { alert('VITE_API_URL is not set in the frontend Vercel project env vars.'); return }
  window.location.href = `${BASE}/api/auth/strava/connect`
}
export const connectWhoop = () => {
  if (!BASE) { alert('VITE_API_URL is not set in the frontend Vercel project env vars.'); return }
  window.location.href = `${BASE}/api/auth/whoop/connect`
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
