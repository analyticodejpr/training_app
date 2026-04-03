import { useState, useEffect } from 'react'
import {
  getStravaAthlete,
  getStravaActivities,
  getStravaStats,
  getStravaWeekly,
} from '../utils/api'

export function useStrava(enabled = true, perPage = 100) {
  const [athlete,    setAthlete]    = useState(null)
  const [activities, setActivities] = useState([])
  const [stats,      setStats]      = useState(null)
  const [weekly,     setWeekly]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [a, acts, st, wk] = await Promise.all([
          getStravaAthlete(),
          getStravaActivities({ perPage }),
          getStravaStats(),
          getStravaWeekly(),
        ])
        if (cancelled) return
        setAthlete(a)
        setActivities(acts)
        setStats(st)
        setWeekly(wk)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [enabled, perPage])

  return { athlete, activities, stats, weekly, loading, error }
}
