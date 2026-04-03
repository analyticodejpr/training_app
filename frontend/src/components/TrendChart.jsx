import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { shortDate } from '../utils/format'

const TOOLTIP_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 12px',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function TrendChart({ data }) {
  if (!data?.length) {
    return <EmptyState message="No trend data available" />
  }

  const chartData = data.map(d => ({
    date:     shortDate(d.date),
    Recovery: d.recovery_score != null ? Math.round(d.recovery_score) : null,
    HRV:      d.hrv_rmssd != null ? Math.round(d.hrv_rmssd) : null,
    Strain:   d.strain != null ? +d.strain.toFixed(1) : null,
    Sleep:    d.sleep_performance != null ? Math.round(d.sleep_performance) : null,
  }))

  // Show last 30 days
  const visible = chartData.slice(-30)

  return (
    <div>
      <h3 style={sectionTitle}>HRV &amp; Recovery Trends</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={visible} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="left"  tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar yAxisId="right" dataKey="Strain" fill="var(--whoop)" opacity={0.35} radius={[3, 3, 0, 0]} />
          <Line yAxisId="left" type="monotone" dataKey="Recovery" stroke="var(--good)"   strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="left" type="monotone" dataKey="HRV"      stroke="#818cf8"        strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="left" type="monotone" dataKey="Sleep"    stroke="var(--warn)"   strokeWidth={1.5} dot={false} strokeDasharray="4 3" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeeklyDistanceChart({ data }) {
  if (!data?.length) return <EmptyState message="No weekly activity data" />

  const chartData = data.map(w => ({
    week:     w.week.replace(/^\d{4}-/, ''),
    'Dist (km)': +(w.distance / 1000).toFixed(1),
    'Sessions':  w.count,
    'Elev (m)':  Math.round(w.elevation),
  }))

  return (
    <div>
      <h3 style={sectionTitle}>Weekly Training Load</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left"  tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar yAxisId="left"  dataKey="Dist (km)"  fill="var(--accent)"  opacity={0.8} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left"  dataKey="Elev (m)"   fill="var(--surface-2)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="Sessions" stroke="var(--whoop)" strokeWidth={2} dot={{ r: 4, fill: 'var(--whoop)' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

const sectionTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 16,
}

function EmptyState({ message }) {
  return (
    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      {message}
    </div>
  )
}
