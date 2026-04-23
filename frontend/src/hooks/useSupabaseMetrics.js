import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches daily WHOOP metrics from Supabase (daily_metrics table).
 * Uses the browser client + active session — RLS automatically scopes to the
 * signed-in user's rows. No backend request needed.
 *
 * Returns records translated to the field names expected by existing components
 * (SmallMultiplesPanel, DashboardPage KPI cards, metrics.js helpers):
 *   date, recovery_score, hrv_rmssd, resting_hr, sleep_performance,
 *   sleep_duration_ms, strain
 *
 * @param {boolean} enabled  - skip fetch when WHOOP is not connected
 * @param {number}  days     - how many days back to fetch (default 90)
 */
export function useSupabaseMetrics(enabled = true, days = 90) {
  const [daily,   setDaily]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)
      .toISOString()
      .split('T')[0]

    supabase
      .from('daily_metrics')
      .select('day, recovery_score, hrv, resting_hr, sleep_score, sleep_seconds, strain_score')
      .gte('day', cutoff)
      .order('day', { ascending: true })
      .then(({ data, error: dbErr }) => {
        if (cancelled) return
        if (dbErr) { setError(dbErr.message); return }

        // Translate DB column names → field names expected by all existing components
        const adapted = (data || []).map(d => ({
          date:              d.day,
          recovery_score:    d.recovery_score  != null ? Number(d.recovery_score)  : null,
          hrv_rmssd:         d.hrv             != null ? Number(d.hrv)             : null,
          resting_hr:        d.resting_hr      != null ? Number(d.resting_hr)      : null,
          sleep_performance: d.sleep_score     != null ? Number(d.sleep_score)     : null,
          sleep_duration_ms: d.sleep_seconds   != null ? d.sleep_seconds * 1000    : null,
          strain:            d.strain_score    != null ? Number(d.strain_score)    : null,
        }))

        setDaily(adapted)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [enabled, days])

  return { daily, loading, error }
}
