/**
 * usePlanner.js
 *
 * Custom hook that reads the active plan cycle, blocks, and weeks
 * directly from Supabase using the browser client and user session.
 * RLS ensures all data is automatically scoped to the signed-in user.
 *
 * Reads from:
 *   training_plan_cycles  — active cycle
 *   training_plan_blocks  — ordered by block_number
 *   training_plan_weeks   — ordered by week_number
 *
 * The hook does NOT read goals — goals are fetched via usePlannerGoal.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentSchedule } from '../utils/api'

/**
 * Fetch the user's active plan (cycle + blocks + weeks) from Supabase.
 * Re-fetches when `refetchKey` changes (pass a counter to trigger refresh).
 *
 * Returns:
 *   {
 *     cycle:   object | null,
 *     blocks:  object[],
 *     weeks:   object[],
 *     loading: boolean,
 *     error:   string | null,
 *     refetch: () => void,
 *   }
 */
export function usePlanner(refetchKey = 0) {
  const [cycle,   setCycle]   = useState(null)
  const [blocks,  setBlocks]  = useState([])
  const [weeks,   setWeeks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tick,    setTick]    = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      // 1. Fetch active cycle
      const { data: cycleData, error: cycleErr } = await supabase
        .from('training_plan_cycles')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cycleErr) throw new Error(cycleErr.message)
      if (!cycleData) {
        // No active cycle — clear state and return
        if (!cancelled) {
          setCycle(null)
          setBlocks([])
          setWeeks([])
        }
        return
      }

      // 2. Fetch blocks + weeks in parallel
      const [blocksRes, weeksRes] = await Promise.all([
        supabase
          .from('training_plan_blocks')
          .select('*')
          .eq('cycle_id', cycleData.id)
          .order('block_number', { ascending: true }),
        supabase
          .from('training_plan_weeks')
          .select('*')
          .eq('cycle_id', cycleData.id)
          .order('week_number', { ascending: true }),
      ])

      if (blocksRes.error) throw new Error(blocksRes.error.message)
      if (weeksRes.error)  throw new Error(weeksRes.error.message)

      if (!cancelled) {
        setCycle(cycleData)
        setBlocks(blocksRes.data || [])
        setWeeks(weeksRes.data  || [])
      }
    }

    load()
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refetchKey, tick])

  return { cycle, blocks, weeks, loading, error, refetch }
}

/**
 * Fetch the user's active training goal from Supabase.
 * Lightweight — reads a single row from training_goals.
 *
 * Returns { goal, loading, error, refetch }
 */
export function usePlannerGoal(refetchKey = 0) {
  const [goal,    setGoal]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tick,    setTick]    = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('training_goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: dbErr }) => {
        if (cancelled) return
        if (dbErr) { setError(dbErr.message); return }
        setGoal(data || null)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refetchKey, tick])

  return { goal, loading, error, refetch }
}

/**
 * Fetch the current-week schedule via the backend API (needs Supabase JWT).
 * Returns { week, days, sessions, loading, error, refetch }.
 *
 * Uses the backend read endpoint rather than direct Supabase reads because
 * training_plan_sessions joins with workout_library (no user_id RLS on library).
 */
export function useCurrentWeekSchedule(refetchKey = 0) {
  const [lifecycle, setLifecycle] = useState(null)   // 'no_plan'|'pre_start'|'active'|'completed'
  const [scheduleCycle, setScheduleCycle] = useState(null)
  const [week,     setWeek]     = useState(null)
  const [days,     setDays]     = useState([])
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tick,     setTick]     = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getCurrentSchedule()
      .then(data => {
        if (cancelled) return
        setLifecycle(data?.lifecycle    || null)
        setScheduleCycle(data?.cycle    || null)
        setWeek(data?.week              || null)
        setDays(data?.days              || [])
        setSessions(data?.sessions      || [])
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.data?.error || err.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refetchKey, tick])

  return { lifecycle, scheduleCycle, week, days, sessions, loading, error, refetch }
}
