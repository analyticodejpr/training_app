import { useState, useEffect } from 'react'
import { getWhoopProfile, getWhoopDaily } from '../utils/api'

export function useWhoop(enabled = true, days = 60) {
  const [profile, setProfile] = useState(null)
  const [daily,   setDaily]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Derived: most recent day's snapshot
  const latest = daily.length ? daily[daily.length - 1] : null

  useEffect(() => {
    if (!enabled) { setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [prof, d] = await Promise.all([
          getWhoopProfile(),
          getWhoopDaily(days),
        ])
        if (cancelled) return
        setProfile(prof)
        setDaily(d)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [enabled, days])

  return { profile, daily, latest, loading, error }
}
