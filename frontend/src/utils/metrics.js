/**
 * metrics.js — Centralized analytics layer
 *
 * All derived formulas live here. Functions are pure (no side-effects).
 * Only uses fields confirmed in the current WHOOP + Strava API integration.
 *
 * WHOOP daily fields available:
 *   date, recovery_score, hrv_rmssd, resting_hr, spo2, skin_temp,
 *   strain, kilojoules, avg_hr, max_hr,
 *   sleep_performance, sleep_duration_ms, sleep_rem_ms, sleep_slow_wave,
 *   sleep_awake_ms, disturbances, respiratory_rate
 *
 * Strava activity fields available:
 *   id, name, type, distance, moving_time, total_elevation_gain,
 *   start_date, start_date_local, average_heartrate
 */

// ── Date helpers ──────────────────────────────────────────────────────────────

export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export function activityDate(a) {
  return (a.start_date_local || a.start_date || '').split('T')[0]
}

// ── Rolling statistics ────────────────────────────────────────────────────────

/** Rolling N-day average of `key` across a sorted daily array. Returns array aligned to input. */
export function rollingAvg(arr, key, windowDays) {
  return arr.map((_, i) => {
    const slice = arr
      .slice(Math.max(0, i - windowDays + 1), i + 1)
      .filter(d => d[key] != null)
    if (!slice.length) return null
    return slice.reduce((s, d) => s + d[key], 0) / slice.length
  })
}

/** Annotate each daily record with its rolling baseline value (28d default). */
export function addBaseline(daily, key, windowDays = 28) {
  const avgs = rollingAvg(daily, key, windowDays)
  return daily.map((d, i) => ({ ...d, [`${key}_base`]: avgs[i] != null ? +avgs[i].toFixed(2) : null }))
}

/** Annotate each daily record with delta from its 28-day baseline. */
export function addDelta(daily, key, windowDays = 28) {
  const withBase = addBaseline(daily, key, windowDays)
  return withBase.map(d => {
    const delta = (d[key] != null && d[`${key}_base`] != null)
      ? +(d[key] - d[`${key}_base`]).toFixed(2) : null
    return { ...d, [`${key}_delta`]: delta }
  })
}

// ── Load balance ──────────────────────────────────────────────────────────────

/**
 * Compute acute (7-day) vs chronic (28-day) strain load and their ratio.
 * If WHOOP strain is missing for a period, falls back to null (no fabrication).
 *
 * Fallback note: If strain is sparse, derived Strava load proxy can replace it
 * by setting each day's strain = (moving_time_minutes / 60) * 10 before passing in.
 */
export function computeAcuteChronic(daily) {
  const acute7  = rollingAvg(daily, 'strain', 7)
  const chronic28 = rollingAvg(daily, 'strain', 28)
  return daily.map((d, i) => ({
    date:     d.date,
    strain:   d.strain,
    acute:    acute7[i]   != null ? +acute7[i].toFixed(2)   : null,
    chronic:  chronic28[i] != null ? +chronic28[i].toFixed(2) : null,
    ratio:    (acute7[i] != null && chronic28[i] > 0)
      ? +(acute7[i] / chronic28[i]).toFixed(2) : null,
    recovery: d.recovery_score,
  }))
}

// ── Daily grain (merged WHOOP + Strava) ──────────────────────────────────────

/** Merge WHOOP daily snapshots and Strava activities into one record per day. */
export function buildDailyGrain(whoopDaily, activities) {
  const grain = {}

  for (const d of whoopDaily) {
    grain[d.date] = {
      ...d,
      activities:    [],
      activityCount: 0,
      totalDist:     0,
      totalTime:     0,
      totalElev:     0,
      types:         {},
    }
  }

  for (const a of activities) {
    const date = activityDate(a)
    if (!date) continue
    if (!grain[date]) {
      grain[date] = { date, activities: [], activityCount: 0, totalDist: 0, totalTime: 0, totalElev: 0, types: {} }
    }
    const g = grain[date]
    g.activities.push(a)
    g.activityCount++
    g.totalDist += a.distance || 0
    g.totalTime += a.moving_time || 0
    g.totalElev += a.total_elevation_gain || 0
    g.types[a.type || 'Other'] = (g.types[a.type || 'Other'] || 0) + 1
  }

  return Object.values(grain).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Weekly breakdown by sport ─────────────────────────────────────────────────

const SPORT_COLORS = {
  Run:          '#fc4c02',
  Ride:         '#f59e0b',
  Swim:         '#38bdf8',
  Walk:         '#a3e635',
  Hike:         '#86efac',
  WeightTraining:'#c084fc',
  Workout:      '#e879f9',
  Yoga:         '#67e8f9',
  Other:        '#64748b',
}

export { SPORT_COLORS }

export function buildWeeklyByType(activities) {
  const weeks = {}
  for (const a of activities) {
    const date = new Date(activityDate(a) + 'T12:00:00')
    if (isNaN(date)) continue
    const weekStart = getMonday(date).toISOString().split('T')[0]
    if (!weeks[weekStart]) weeks[weekStart] = { week: weekStart, total: { count: 0, dist: 0, time: 0, elev: 0 }, byType: {} }
    const w = weeks[weekStart]
    const t = a.type || 'Other'
    w.total.count++
    w.total.dist += a.distance || 0
    w.total.time += a.moving_time || 0
    w.total.elev += a.total_elevation_gain || 0
    if (!w.byType[t]) w.byType[t] = { count: 0, dist: 0, time: 0, elev: 0 }
    w.byType[t].count++
    w.byType[t].dist += a.distance || 0
    w.byType[t].time += a.moving_time || 0
    w.byType[t].elev += a.total_elevation_gain || 0
  }
  return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week))
}

// ── Session recovery cost ─────────────────────────────────────────────────────

/**
 * For each Strava activity, find the *next day's* WHOOP recovery/HRV and compute the delta.
 * This is the core WHOOP × Strava insight chart.
 */
export function sessionRecoveryCost(activities, whoopDaily) {
  const dailyMap = {}
  for (const d of whoopDaily) dailyMap[d.date] = d

  return activities
    .filter(a => (a.distance > 200 || a.moving_time > 120)) // exclude micro-activities
    .map(a => {
      const date = activityDate(a)
      if (!date) return null
      const today   = dailyMap[date]
      const nextD   = new Date(date + 'T12:00:00')
      nextD.setDate(nextD.getDate() + 1)
      const nextDay = dailyMap[nextD.toISOString().split('T')[0]]

      const recDelta = (nextDay?.recovery_score != null)
        ? nextDay.recovery_score - (today?.recovery_score ?? nextDay.recovery_score) : null
      const hrvDelta = (nextDay?.hrv_rmssd != null)
        ? nextDay.hrv_rmssd - (today?.hrv_rmssd ?? nextDay.hrv_rmssd) : null

      return {
        date,
        name:           a.name || a.type,
        type:           a.type || 'Other',
        distKm:         +(a.distance / 1000).toFixed(2),
        durMin:         +(a.moving_time / 60).toFixed(1),
        elevM:          +(a.total_elevation_gain || 0).toFixed(0),
        avgHR:          a.average_heartrate || null,
        recDelta:       recDelta != null ? +recDelta.toFixed(1) : null,
        hrvDelta:       hrvDelta != null ? +hrvDelta.toFixed(1) : null,
        recoveryBefore: today?.recovery_score ?? null,
        recoveryAfter:  nextDay?.recovery_score ?? null,
      }
    })
    .filter(Boolean)
    .filter(d => d.recDelta !== null || d.hrvDelta !== null)
}

// ── Pace & efficiency ─────────────────────────────────────────────────────────

/** Returns min/km as a decimal number. */
export function computePaceMinKm(distM, durSec) {
  if (!distM || !durSec || distM < 10) return null
  return (durSec / 60) / (distM / 1000)
}

/** Formats decimal min/km as "M:SS /km". */
export function formatPaceMinKm(minPerKm) {
  if (minPerKm == null || !isFinite(minPerKm)) return '—'
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60).toString().padStart(2, '0')
  return `${m}:${s} /km`
}

/** Returns km/h for rides/swims. */
export function computeEfficiencyKmH(distM, durSec) {
  if (!distM || !durSec) return null
  return +((distM / 1000) / (durSec / 3600)).toFixed(2)
}

// ── Performance trend ─────────────────────────────────────────────────────────

/**
 * Weekly best pace (lowest min/km) for runs.
 * Falls back to weekly avg pace if best-per-week is unreliable.
 */
export function computeWeeklyRunPace(activities) {
  const byWeek = {}
  for (const a of activities) {
    if (a.type !== 'Run' || !a.distance || !a.moving_time) continue
    const pace = computePaceMinKm(a.distance, a.moving_time)
    if (!pace || pace > 20 || pace < 2) continue // sanity filter
    const weekStart = getMonday(new Date(activityDate(a) + 'T12:00:00')).toISOString().split('T')[0]
    if (!byWeek[weekStart]) byWeek[weekStart] = { week: weekStart, paces: [], totalDist: 0, count: 0 }
    byWeek[weekStart].paces.push(pace)
    byWeek[weekStart].totalDist += a.distance
    byWeek[weekStart].count++
  }
  return Object.values(byWeek)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week:      w.week,
      bestPace:  +Math.min(...w.paces).toFixed(2),
      avgPace:   +(w.paces.reduce((s, p) => s + p, 0) / w.paces.length).toFixed(2),
      totalDistKm: +(w.totalDist / 1000).toFixed(1),
      count:     w.count,
    }))
}

/** Weekly best km/h for rides. */
export function computeWeeklyRideEfficiency(activities) {
  const byWeek = {}
  for (const a of activities) {
    if (a.type !== 'Ride' && a.type !== 'VirtualRide' && a.type !== 'EBikeRide') continue
    if (!a.distance || !a.moving_time) continue
    const eff = computeEfficiencyKmH(a.distance, a.moving_time)
    if (!eff || eff > 80 || eff < 5) continue
    const weekStart = getMonday(new Date(activityDate(a) + 'T12:00:00')).toISOString().split('T')[0]
    if (!byWeek[weekStart]) byWeek[weekStart] = { week: weekStart, effs: [], count: 0 }
    byWeek[weekStart].effs.push(eff)
    byWeek[weekStart].count++
  }
  return Object.values(byWeek)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week:    w.week,
      bestEff: +Math.max(...w.effs).toFixed(1),
      avgEff:  +(w.effs.reduce((s, e) => s + e, 0) / w.effs.length).toFixed(1),
      count:   w.count,
    }))
}

// ── Cumulative progress ───────────────────────────────────────────────────────

export function computeCumulative(activities, metric = 'distance') {
  const sorted = [...activities].sort((a, b) => activityDate(a).localeCompare(activityDate(b)))
  let running = 0
  return sorted.map(a => {
    running += a[metric] || 0
    return { date: activityDate(a), value: running, type: a.type }
  })
}

// ── Monthly grain ─────────────────────────────────────────────────────────────

export function buildMonthlyGrain(activities, whoopDaily) {
  const months = {}

  for (const a of activities) {
    const monthKey = activityDate(a).slice(0, 7)
    if (!months[monthKey]) months[monthKey] = { month: monthKey, acts: [], whoopDays: [] }
    months[monthKey].acts.push(a)
  }
  for (const d of whoopDaily) {
    const monthKey = d.date.slice(0, 7)
    if (!months[monthKey]) months[monthKey] = { month: monthKey, acts: [], whoopDays: [] }
    months[monthKey].whoopDays.push(d)
  }

  return Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => {
      const byType = {}
      for (const a of m.acts) {
        const t = a.type || 'Other'
        if (!byType[t]) byType[t] = { count: 0, dist: 0, time: 0 }
        byType[t].count++
        byType[t].dist += a.distance || 0
        byType[t].time += a.moving_time || 0
      }
      const recs = m.whoopDays.filter(d => d.recovery_score != null)
      return {
        month:       m.month,
        totalDist:   m.acts.reduce((s, a) => s + (a.distance || 0), 0),
        totalTime:   m.acts.reduce((s, a) => s + (a.moving_time || 0), 0),
        totalElev:   m.acts.reduce((s, a) => s + (a.total_elevation_gain || 0), 0),
        count:       m.acts.length,
        activeDays:  new Set(m.acts.map(activityDate)).size,
        byType,
        avgRecovery: recs.length ? +(recs.reduce((s, d) => s + d.recovery_score, 0) / recs.length).toFixed(1) : null,
        avgHrv:      (() => { const h = m.whoopDays.filter(d => d.hrv_rmssd != null); return h.length ? +(h.reduce((s, d) => s + d.hrv_rmssd, 0) / h.length).toFixed(1) : null })(),
      }
    })
}

// ── Weekly consistency ────────────────────────────────────────────────────────

export function buildWeeklyConsistency(activities, whoopDaily) {
  const weeks = {}

  for (const a of activities) {
    const date  = activityDate(a)
    const wDate = new Date(date + 'T12:00:00')
    if (isNaN(wDate)) continue
    const wk = getMonday(wDate).toISOString().split('T')[0]
    if (!weeks[wk]) weeks[wk] = { week: wk, activeDates: new Set(), count: 0, recVals: [] }
    weeks[wk].activeDates.add(date)
    weeks[wk].count++
  }

  for (const d of whoopDaily) {
    const wDate = new Date(d.date + 'T12:00:00')
    if (isNaN(wDate)) continue
    const wk = getMonday(wDate).toISOString().split('T')[0]
    if (!weeks[wk]) weeks[wk] = { week: wk, activeDates: new Set(), count: 0, recVals: [] }
    if (d.recovery_score != null) weeks[wk].recVals.push(d.recovery_score)
  }

  return Object.values(weeks)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week:        w.week,
      activeDays:  w.activeDates.size,
      sessions:    w.count,
      avgRecovery: w.recVals.length ? Math.round(w.recVals.reduce((s, r) => s + r, 0) / w.recVals.length) : null,
    }))
}

// ── Sport mix ─────────────────────────────────────────────────────────────────

export function computeSportMix(activities) {
  const byType = {}
  for (const a of activities) {
    const t = a.type || 'Other'
    if (!byType[t]) byType[t] = { type: t, count: 0, dist: 0, time: 0 }
    byType[t].count++
    byType[t].dist += a.distance || 0
    byType[t].time += a.moving_time || 0
  }
  const total = activities.length || 1
  return Object.values(byType)
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      ...s,
      pct:       Math.round(s.count / total * 100),
      distKm:    +(s.dist / 1000).toFixed(1),
      avgDurMin: Math.round(s.time / s.count / 60),
    }))
}

// ── Session density ───────────────────────────────────────────────────────────

/**
 * Returns sessions-per-week and avg session duration (minutes) for each sport type.
 * Divides total sessions by the number of distinct weeks that have any activity.
 */
export function computeSessionDensity(activities) {
  if (!activities.length) return []
  const byType = {}
  const allWeeks = new Set()

  for (const a of activities) {
    const date = activityDate(a)
    if (!date) continue
    const wk = getMonday(new Date(date + 'T12:00:00')).toISOString().split('T')[0]
    allWeeks.add(wk)
    const t = a.type || 'Other'
    if (!byType[t]) byType[t] = { count: 0, totalTime: 0 }
    byType[t].count++
    byType[t].totalTime += a.moving_time || 0
  }

  const weekCount = Math.max(allWeeks.size, 1)
  return Object.entries(byType).map(([type, d]) => ({
    type,
    sessionsPerWeek: +(d.count / weekCount).toFixed(1),
    avgDurMin:       Math.round(d.totalTime / d.count / 60),
  }))
}

// ── Recovery drivers (app-defined decomposition, NOT WHOOP internals) ─────────

/**
 * Produces a visible, app-defined decomposition of recovery for a single day.
 * Uses only fields available in the WHOOP daily summary.
 * Does NOT replicate WHOOP's proprietary algorithm — this is our own heuristic.
 *
 * Each driver shows: which field it uses, the raw value, and a signed contribution
 * (positive = helps recovery, negative = hurts recovery).
 */
export function computeRecoveryDrivers(today, prevDay, baseline) {
  if (!today) return []
  const drivers = []

  // Sleep score (strongest driver per public WHOOP research)
  if (today.sleep_performance != null) {
    // Normalise around 50: good sleep adds up to +20, poor subtracts
    const contrib = (today.sleep_performance - 50) * 0.3
    drivers.push({
      label:  'Sleep Score',
      value:  `${Math.round(today.sleep_performance)}%`,
      contrib: +contrib.toFixed(1),
      color:  today.sleep_performance >= 70 ? 'var(--good)' : today.sleep_performance >= 50 ? 'var(--warn)' : 'var(--bad)',
    })
  }

  // HRV vs 28-day baseline (positive delta = more recovered)
  if (today.hrv_rmssd != null && baseline?.hrv_rmssd != null) {
    const delta  = today.hrv_rmssd - baseline.hrv_rmssd
    const contrib = +(delta * 0.6).toFixed(1)
    drivers.push({
      label:  'HRV vs Baseline',
      value:  `${Math.round(today.hrv_rmssd)} ms (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`,
      contrib,
      color:  delta >= 0 ? 'var(--good)' : 'var(--bad)',
    })
  }

  // RHR vs baseline (lower RHR = better; positive delta is bad)
  if (today.resting_hr != null && baseline?.resting_hr != null) {
    const delta  = today.resting_hr - baseline.resting_hr // positive = elevated (bad)
    const contrib = +(-delta * 0.8).toFixed(1)
    drivers.push({
      label:  'Resting HR vs Baseline',
      value:  `${Math.round(today.resting_hr)} bpm (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`,
      contrib,
      color:  delta <= 0 ? 'var(--good)' : delta < 3 ? 'var(--warn)' : 'var(--bad)',
    })
  }

  // Previous-day strain
  if (prevDay?.strain != null) {
    const contrib = +((10 - prevDay.strain) * 0.5).toFixed(1)
    drivers.push({
      label:  'Yesterday Strain',
      value:  prevDay.strain.toFixed(1),
      contrib,
      color:  prevDay.strain <= 10 ? 'var(--good)' : prevDay.strain <= 16 ? 'var(--warn)' : 'var(--bad)',
    })
  }

  // Respiratory rate anomaly (elevated resp = stress/illness signal)
  if (today.respiratory_rate != null && baseline?.respiratory_rate != null) {
    const delta  = today.respiratory_rate - baseline.respiratory_rate
    const contrib = +(-delta * 1.5).toFixed(1)
    drivers.push({
      label:  'Resp Rate',
      value:  `${today.respiratory_rate.toFixed(1)} /min`,
      contrib,
      color:  Math.abs(delta) < 1 ? 'var(--good)' : 'var(--warn)',
    })
  }

  return drivers
}

// ── Recovery lag after hard sessions ─────────────────────────────────────────

/**
 * Identifies hard sessions (top 25% by moving_time) then tracks
 * recovery_score and hrv_rmssd for 0–3 days after.
 */
export function recoveryLagAfterHard(activities, whoopDaily) {
  const dailyMap = {}
  for (const d of whoopDaily) dailyMap[d.date] = d

  if (!activities.length) return []

  // Threshold = 75th percentile of moving_time
  const times = activities.map(a => a.moving_time || 0).sort((a, b) => a - b)
  const p75 = times[Math.floor(times.length * 0.75)]

  const hard = activities.filter(a => (a.moving_time || 0) >= p75)

  // For each hard session, collect D+0, D+1, D+2, D+3 recovery
  const records = { 0: [], 1: [], 2: [], 3: [] }
  for (const a of hard) {
    const d0 = new Date(activityDate(a) + 'T12:00:00')
    for (let offset = 0; offset <= 3; offset++) {
      const d = new Date(d0)
      d.setDate(d.getDate() + offset)
      const key = d.toISOString().split('T')[0]
      const day = dailyMap[key]
      if (day?.recovery_score != null) records[offset].push(day.recovery_score)
    }
  }

  return [0, 1, 2, 3].map(offset => {
    const arr = records[offset]
    if (!arr.length) return null
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length
    return { day: `D+${offset}`, avgRecovery: +avg.toFixed(1), n: arr.length }
  }).filter(Boolean)
}
