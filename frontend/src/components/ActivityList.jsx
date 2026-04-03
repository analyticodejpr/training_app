import { activityIcon, metersToKm, secToHHMM, paceMilesPerMin, shortDate } from '../utils/format'

export default function ActivityList({ activities = [] }) {
  if (!activities.length) {
    return <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No recent activities.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {activities.slice(0, 20).map(act => {
        const distKm  = metersToKm(act.distance)
        const distMi  = (act.distance / 1609.34).toFixed(2)
        const dur     = secToHHMM(act.moving_time)
        const pace    = act.type === 'Run' ? paceMilesPerMin(act.distance, act.moving_time) + ' /mi' : null
        const avgHr   = act.average_heartrate
        const elev    = act.total_elevation_gain ? `${Math.round(act.total_elevation_gain)}m ↑` : null

        return (
          <div key={act.id} style={row}>
            <div style={icon}>{activityIcon(act.type)}</div>
            <div style={info}>
              <div style={name}>{act.name}</div>
              <div style={meta}>{shortDate(act.start_date_local || act.start_date)} · {act.type}</div>
            </div>
            <div style={metrics}>
              {distKm > 0 && <Metric label="Dist" value={`${distKm} km`} />}
              <Metric label="Time" value={dur} />
              {pace && <Metric label="Pace" value={pace} />}
              {avgHr && <Metric label="HR" value={`${Math.round(avgHr)} bpm`} />}
              {elev && <Metric label="Elev" value={elev} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 56 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  )
}

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  background: 'var(--surface-2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
}

const icon = { fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }
const info = { flex: 1, minWidth: 0 }
const name = { fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const meta = { fontSize: 11, color: 'var(--text-muted)' }
const metrics = { display: 'flex', gap: 12, flexShrink: 0 }
