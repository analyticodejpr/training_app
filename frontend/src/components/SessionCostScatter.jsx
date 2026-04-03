/**
 * SessionCostScatter — Session size (x) vs next-day recovery delta (y).
 * This is the core WHOOP × Strava relationship chart.
 *
 * x = session duration (minutes) — most reliable common metric across sports.
 * y = next-day recovery delta (next_recovery - this_day_recovery).
 * color = sport type. size = elevation gain (scaled).
 *
 * Fallback: if elevation is 0 (e.g., swim/treadmill), dot size = fixed medium.
 */
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { sessionRecoveryCost, SPORT_COLORS } from '../utils/metrics'

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)', minWidth: 200,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{d.name}</p>
      <p style={{ color: 'var(--text-muted)' }}>{d.date} · {d.type}</p>
      <p>Duration: <strong>{Math.round(d.durMin)} min</strong></p>
      <p>Distance: <strong>{d.distKm.toFixed(1)} km</strong></p>
      {d.elevM > 0 && <p>Elevation: <strong>{Math.round(d.elevM)} m</strong></p>}
      {d.avgHR  && <p>Avg HR: <strong>{Math.round(d.avgHR)} bpm</strong></p>}
      <p style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        Recovery before: <strong>{d.recoveryBefore != null ? `${Math.round(d.recoveryBefore)}%` : '—'}</strong>
      </p>
      <p>
        Next-day recovery: <strong>{d.recoveryAfter != null ? `${Math.round(d.recoveryAfter)}%` : '—'}</strong>
      </p>
      <p style={{ color: d.recDelta >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
        Delta: {d.recDelta >= 0 ? '+' : ''}{d.recDelta?.toFixed(1)} pts
      </p>
    </div>
  )
}

export default function SessionCostScatter({ activities = [], whoopDaily = [] }) {
  const points = sessionRecoveryCost(activities, whoopDaily)

  if (!points.length) {
    return <EmptyState message="Need overlapping Strava activities + WHOOP data to compute recovery cost." />
  }

  const maxElev = Math.max(...points.map(p => p.elevM), 1)

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Session Recovery Cost</span>
        <span style={subtitle}>Session duration · next-day recovery delta · dot size = elevation</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

          {/* Zero line: no recovery impact */}
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} strokeDasharray="6 3"
            label={{ value: 'No impact', fill: 'var(--text-muted)', fontSize: 10, position: 'right' }} />

          <XAxis type="number" dataKey="durMin" name="Duration"
            domain={[0, 'dataMax + 10']}
            label={{ value: 'Session duration (min)', position: 'insideBottom', offset: -8, fill: 'var(--text-muted)', fontSize: 11 }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="recDelta" name="Recovery Δ"
            label={{ value: 'Recovery Δ (pts)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />

          <Tooltip content={<TooltipContent />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }} />

          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={SPORT_COLORS[p.type] || 'var(--text-muted)'}
                fillOpacity={0.75}
                r={4 + (p.elevM / maxElev) * 5}
                stroke="var(--surface)"
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Sport legend */}
      <div style={legendRow}>
        {[...new Set(points.map(p => p.type))].map(type => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: SPORT_COLORS[type] || 'var(--text-muted)', display: 'inline-block' }} />
            {type}
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>Larger dot = more elevation</span>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 24px' }}>{message}</div>
}

const titleRow  = { marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title     = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle  = { fontSize: 11, color: 'var(--text-muted)' }
const legendRow = { display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }
