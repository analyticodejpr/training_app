/**
 * ActivitiesPage — Activities tab (route: /activities)
 *
 * Mobile design:
 * 1. Summary stats pills
 * 2. Sport filter tabs
 * 3. Activity card list
 */
import { useState, useMemo } from 'react'
import { useSupabaseActivities } from '../hooks/useSupabaseActivities'
import { activityIcon } from '../utils/format'
import { connectStrava } from '../utils/api'

const SPORT_FILTERS = ['All', 'Run', 'Ride', 'Swim', 'Other']

function sportLabel(filter) {
  const map = { Run: 'Running', Ride: 'Cycling', Swim: 'Swimming' }
  return map[filter] || filter
}

function matchesFilter(activity, filter) {
  if (filter === 'All') return true
  if (filter === 'Other') {
    return !['Run', 'TrailRun', 'VirtualRun', 'Ride', 'VirtualRide', 'EBikeRide', 'Swim'].includes(activity.type)
  }
  const runTypes  = ['Run', 'TrailRun', 'VirtualRun']
  const rideTypes = ['Ride', 'VirtualRide', 'EBikeRide']
  const swimTypes = ['Swim', 'OpenWaterSwim']
  if (filter === 'Run')  return runTypes.includes(activity.type)
  if (filter === 'Ride') return rideTypes.includes(activity.type)
  if (filter === 'Swim') return swimTypes.includes(activity.type)
  return false
}

function formatKm(meters) {
  if (!meters) return '—'
  return `${(meters / 1000).toFixed(1)}`
}

function formatTime(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function formatPace(distM, secs) {
  if (!distM || !secs || distM < 100) return '—'
  const secPerKm = secs / (distM / 1000)
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ActivitiesPage({ authStatus }) {
  const [filter, setFilter] = useState('All')

  const { activities, loading } = useSupabaseActivities(!!authStatus?.strava, 200)

  const filtered = useMemo(
    () => activities.filter(a => matchesFilter(a, filter)),
    [activities, filter]
  )

  // Summary stats
  const stats = useMemo(() => {
    const totalDist = filtered.reduce((s, a) => s + (a.distance || 0), 0)
    const totalTime = filtered.reduce((s, a) => s + (a.moving_time || 0), 0)
    return {
      count:    filtered.length,
      distKm:   (totalDist / 1000).toFixed(1),
      timeHrs:  (totalTime / 3600).toFixed(1),
    }
  }, [filtered])

  if (!authStatus?.strava) {
    return (
      <div style={pageWrap}>
        <ConnectPrompt />
      </div>
    )
  }

  return (
    <div style={pageWrap}>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <SummaryPill label="Sessions" value={stats.count} />
        <SummaryPill label="Distance" value={`${stats.distKm} km`} />
        <SummaryPill label="Total time" value={`${stats.timeHrs} hrs`} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {SPORT_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              background: filter === f ? '#6366F1' : '#F3F4F6',
              color: filter === f ? '#fff' : '#6B7280',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {sportLabel(f)}
          </button>
        ))}
      </div>

      {/* Activity list */}
      {loading ? (
        <div style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
          No {filter === 'All' ? '' : sportLabel(filter).toLowerCase() + ' '}activities found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(a => <ActivityCard key={a.id} activity={a} />)}
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}

function SummaryPill({ label, value }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #EAECF0',
      borderRadius: 12, padding: '10px 14px',
      flexShrink: 0, minWidth: 88,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ActivityCard({ activity }) {
  const icon = activityIcon(activity.type) || '🏃'
  const date = formatDate(activity.start_date)
  const dist = formatKm(activity.distance)
  const time = formatTime(activity.moving_time)
  const pace = formatPace(activity.distance, activity.moving_time)
  const hr   = activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '—'

  return (
    <div style={{
      background: '#fff', border: '1px solid #EAECF0',
      borderRadius: 20, padding: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: '#F5F6FA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#1A1B23',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {activity.name || activity.type}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{date}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <StatCell label="Distance" value={`${dist} km`} />
        <StatCell label="Time" value={time} />
        <StatCell label="Pace" value={pace} />
        <StatCell label="Avg HR" value={hr} />
      </div>
    </div>
  )
}

function StatCell({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ConnectPrompt() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #EAECF0',
      borderRadius: 20, padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🟠</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1B23', marginBottom: 8 }}>
        Connect Strava
      </div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, marginBottom: 20 }}>
        Connect your Strava account to see your activities, training load, and performance trends.
      </div>
      <button
        onClick={connectStrava}
        style={{
          background: '#FC4C02', color: '#fff',
          border: 'none', borderRadius: 12,
          padding: '12px 24px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Connect Strava
      </button>
    </div>
  )
}

const pageWrap = {
  padding: '16px 16px 0',
  display: 'flex', flexDirection: 'column', gap: 12,
}
