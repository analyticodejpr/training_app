export function metersToMiles(m)  { return (m / 1609.34).toFixed(2) }
export function metersToKm(m)     { return (m / 1000).toFixed(2) }
export function secToHHMM(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
export function msToHHMM(ms) { return secToHHMM(ms / 1000) }

export function paceMilesPerMin(distM, durSec) {
  if (!distM || !durSec) return '--'
  const miles   = distM / 1609.34
  const minPerMi = durSec / 60 / miles
  const mins    = Math.floor(minPerMi)
  const secs    = Math.round((minPerMi - mins) * 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

export function recoveryColor(score) {
  if (score == null) return 'var(--text-muted)'
  if (score >= 67) return 'var(--good)'
  if (score >= 34) return 'var(--warn)'
  return 'var(--bad)'
}

export function strainColor(score) {
  if (score == null) return 'var(--text-muted)'
  if (score >= 18) return 'var(--bad)'
  if (score >= 14) return 'var(--warn)'
  return 'var(--whoop)'
}

export function shortDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Format decimal min/km as "M:SS /km" string. */
export function formatPaceMinKm(minPerKm) {
  if (minPerKm == null || !isFinite(minPerKm)) return '—'
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60).toString().padStart(2, '0')
  return `${m}:${s} /km`
}

export function activityIcon(type) {
  const map = {
    Run: '🏃', Ride: '🚴', Swim: '🏊', Walk: '🚶',
    Hike: '🥾', WeightTraining: '🏋️', Workout: '💪',
    Yoga: '🧘', EBikeRide: '⚡', VirtualRide: '🖥️',
  }
  return map[type] || '⚡'
}
