import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches activities directly from Supabase (activities table).
 * Uses the browser Supabase client + the user's active session — RLS ensures
 * the query is automatically scoped to the signed-in user's rows.
 *
 * Returns activities with Strava-compatible field names so all existing
 * chart components work with zero changes.
 *
 * @param {boolean} enabled  - skip fetch when user is not connected (default true)
 * @param {number}  limit    - max rows to fetch (default 200)
 */
export function useSupabaseActivities(enabled = true, limit = 200) {
  const [activities, setActivities] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('activities')
      .select('*')
      .order('starts_at', { ascending: false })
      .limit(limit)
      .then(({ data, error: dbErr }) => {
        if (cancelled) return
        if (dbErr) {
          setError(dbErr.message)
          return
        }
        // Translate DB column names → Strava API field names so all existing
        // components (ActivityList, WeeklyCompositionChart, metrics.js, etc.)
        // keep working unchanged.
        const adapted = (data || []).map(a => ({
          id:                   a.provider_activity_id || a.id,
          name:                 a.title,
          type:                 a.sport_type,
          start_date:           a.starts_at,
          start_date_local:     a.starts_at,
          distance:             a.distance_m,
          moving_time:          a.moving_time_s,
          elapsed_time:         a.elapsed_time_s,
          total_elevation_gain: a.elevation_gain_m,
          average_heartrate:    a.avg_hr,
          max_heartrate:        a.max_hr,
          average_speed:        a.avg_speed_mps,
          _db_id:               a.id,
          source_primary:       a.source_primary,
        }))
        setActivities(adapted)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [enabled, limit])

  return { activities, loading, error }
}
