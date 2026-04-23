import { useState } from 'react'
import { activityIcon, metersToKm, secToHHMM, formatPaceMinKm, shortDate } from '../utils/format'

export default function ActivityList({ activities = [] }) {
  const [expanded, setExpanded] = useState(null)

  if (!activities.length) {
    return (
      <p style={{ color: 'var(--text-muted)', padding: '16px 0', fontSize: 13 }}>
        No recent activities.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {activities.slice(0, 20).map(act => {
        const isOpen  = expanded === act.id
        const distKm  = metersToKm(act.distance)
        const dur     = secToHHMM(act.moving_time)
        const pace    = act.type === 'Run' && act.distance > 0 && act.moving_time > 0
          ? formatPaceMinKm((act.moving_time / 60) / (act.distance / 1000))
          : null
        const speed   = act.type === 'Ride' && act.distance > 0 && act.moving_time > 0
          ? `${((act.distance / 1000) / (act.moving_time / 3600)).toFixed(1)} km/h`
          : null
        const swimPace = (act.type === 'Swim' || act.sport_type === 'Swim') && act.distance > 0 && act.moving_time > 0
          ? (() => {
              const secPer100m = (act.moving_time / act.distance) * 100
              const mins = Math.floor(secPer100m / 60)
              const secs = Math.round(secPer100m % 60)
              return `${mins}:${String(secs).padStart(2, '0')} /100m`
            })()
          : null
        const avgHr   = act.average_heartrate ? `${Math.round(act.average_heartrate)} bpm` : null
        const elev    = act.total_elevation_gain ? `${Math.round(act.total_elevation_gain)}m ↑` : null

        const metrics = [
          distKm > 0 && { label: 'Distance', value: `${distKm} km` },
          { label: 'Time',       value: dur },
          pace      && { label: 'Pace',  value: pace },
          speed     && { label: 'Speed', value: speed },
          swimPace  && { label: 'Pace',  value: swimPace },
          avgHr && { label: 'Heart Rate', value: avgHr },
          elev  && { label: 'Elevation',  value: elev },
        ].filter(Boolean)

        return (
          <div
            key={act.id}
            onClick={() => setExpanded(isOpen ? null : act.id)}
            style={{
              background: isOpen ? 'var(--surface)' : 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isOpen ? 'var(--border-hi)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              overflow: 'hidden',
              boxShadow: isOpen ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {/* ── Row ── */}
            <div style={row}>
              <div style={iconWrap}>{activityIcon(act.type)}</div>
              <div style={info}>
                <div style={nameStyle}>{act.name}</div>
                <div style={meta}>
                  {shortDate(act.start_date_local || act.start_date)}
                  <span style={metaDot} />
                  {act.type}
                  {distKm > 0 && (
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}> · {distKm} km</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={durBadge}>{dur}</span>
                <ChevronIcon open={isOpen} />
              </div>
            </div>

            {/* ── Expanded metrics ── */}
            {isOpen && (
              <div style={detailGrid}>
                {metrics.map(m => (
                  <div key={m.label} style={detailCell}>
                    <div style={detailLabel}>{m.label}</div>
                    <div style={detailValue}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 14 14" fill="none"
      stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round"
      style={{
        transition: 'transform 0.18s ease',
        transform: open ? 'rotate(180deg)' : 'none',
        flexShrink: 0,
      }}
    >
      <polyline points="2,4 7,10 12,4"/>
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
}

const iconWrap = {
  fontSize: 18,
  flexShrink: 0,
  width: 24,
  textAlign: 'center',
  lineHeight: 1,
}

const info = { flex: 1, minWidth: 0 }

const nameStyle = {
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '-0.01em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: 'var(--text)',
}

const meta = {
  fontSize: 11,
  color: 'var(--text-muted)',
  marginTop: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const metaDot = {
  display: 'inline-block',
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: 'var(--border-hi)',
}

const durBadge = {
  fontSize: 11.5,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-muted)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xs)',
  padding: '2px 7px',
  flexShrink: 0,
  letterSpacing: '0.01em',
}

const detailGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
  borderTop: '1px solid var(--border)',
  background: 'var(--surface-2)',
}

const detailCell = {
  padding: '10px 14px',
  borderRight: '1px solid var(--border)',
}

const detailLabel = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
}

const detailValue = {
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text)',
  letterSpacing: '-0.02em',
}
