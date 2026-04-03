import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getAuthStatus  = () => api.get('/auth/status').then(r => r.data)
export const disconnectStrava = () => api.delete('/auth/strava/disconnect')
export const disconnectWhoop  = () => api.delete('/auth/whoop/disconnect')

// ── Strava ────────────────────────────────────────────────────────────────────
export const getStravaAthlete    = () => api.get('/strava/athlete').then(r => r.data)
export const getStravaActivities = (params = {}) => api.get('/strava/activities', { params }).then(r => r.data)
export const getStravaStats      = () => api.get('/strava/stats').then(r => r.data)
export const getStravaWeekly     = () => api.get('/strava/weekly').then(r => r.data)

// ── WHOOP ─────────────────────────────────────────────────────────────────────
export const getWhoopProfile        = () => api.get('/whoop/profile').then(r => r.data)
export const getWhoopBodyMeasurement = () => api.get('/whoop/body').then(r => r.data)
export const getWhoopDaily          = (days = 60) => api.get('/whoop/daily', { params: { days } }).then(r => r.data)
export const getWhoopRecoveries     = (params = {}) => api.get('/whoop/recoveries', { params }).then(r => r.data)
export const getWhoopSleep          = (params = {}) => api.get('/whoop/sleep', { params }).then(r => r.data)
export const getWhoopWorkouts       = (params = {}) => api.get('/whoop/workouts', { params }).then(r => r.data)
