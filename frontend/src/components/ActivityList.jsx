import { useState } from 'react'
import { activityIcon, metersToKm, secToHHMM, paceMilesPerMin, shortDate } from '../utils/format'

export default function ActivityList({ activities = [] }) {
  const [expanded, setExpanded] = useState(null)

  if (!activities.length) {
    return <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No recent activities.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {activities.slice(0, 20).map(act => {
        const isOpen  = expanded === act.id
        const distKm  = metersToKm(act.distance)
        const dur     = secToHHMM(act.moving_time)
        const pace    = act.type === 'Run' ? paceMilesPerMin(act.distance, act.moving_time) + ' /mi' : null
        const avgHr   = act.average_heartrate ? `${Math.round(act.average_heartrate)} bpm` : null
        const elev    = act.total_elevation_gain ? `${Math.round(act.total_elevation_gain)}m ↑` : null

        const metrics = [
          distKm > 0 && { label: 'Distance', value: `${distKm} km` },
          { label: 'Time',     value: dur },
          pace  && { label: 'Pace',     value: pace },
          avgHr && { label: 'Heart Rate', value: avgHr },
          elev  && { label: 'Elevation', value: elev },
        ].filter(Boolean)

        return (
          <div
            key={act.id}
            onClick={() => setExpanded(isOpen ? null : act.id)}
            style={{
              background: 'var(--surface-2)',
              borderRadius: 10,
              border: `1px solid ${isOpen ? 'var(--border-hi)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              overflow: 'hidden',
            }}
          >
            {/* ── Collapsed row ── */}
            <div style={row}>
              <div style={iconStyle}>{activityIcon(act.type)}</div>
              <div style={info}>
                <div style={name}>{act.name}</div>
                <div style={meta}>
                  {shortDate(act.start_date_local || act.start_date)} · {act.type}
                  {distKm > 0 && <span style={{ color: 'var(--text)', fontWeight: 600 }}> · {distKm} km</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={durBadge}>{dur}</span>
                <svg
                  width="14" height="14" viewBox="0 0 14 14" fill="none"
                  stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"
                  style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
                >
                  <polyline points="2,4 7,10 12,4"/>
                </svg>
              </div>
            </div>

            {/* ── Expanded detail grid ── */}
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

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
}

const iconStyle = { fontSize: 20, flexShrink: 0, width: 26, textAlign: 'center' }
const info      = { flex: 1, minWidth: 0 }
const name      = { fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const meta      = { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }

const durBadge = {
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text)',
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '2px 7px',
  flexShrink: 0,
}

const detailGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
  gap: 1,
  background: 'var(--border)',
  borderTop: '1px solid var(--border)',
}

const detailCell = {
  background: 'var(--surface)',
  padding: '10px 14px',
}

const detailLabel = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
}

const detailValue = {
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text)',
}
