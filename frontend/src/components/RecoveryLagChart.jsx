/**
 * RecoveryLagChart — Average recovery score D+0 through D+3 after hard sessions.
 * Hard sessions = top 25th percentile by moving_time.
 *
 * Uses: recoveryLagAfterHard() from metrics.js
 * Fields: Strava moving_time, WHOOP recovery_score by date.
 */
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { recoveryLagAfterHard } from '../utils/metrics'
import { recoveryColor } from '../utils/format'

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p>Avg recovery: <strong style={{ color: recoveryColor(v) }}>{v?.toFixed(1)}%</strong></p>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>n = {payload[0]?.payload?.n} sessions</p>
    </div>
  )
}

export default function RecoveryLagChart({ activities = [], whoopDaily = [] }) {
  const data = recoveryLagAfterHard(activities, whoopDaily)

  if (!data.length) {
    return <EmptyState message="Need hard sessions + matching WHOOP data to build recovery lag chart." />
  }

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Recovery After Hard Sessions</span>
        <span style={subtitle}>Avg recovery score D+0 → D+3 · hard = top 25% by duration</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<TooltipContent />} />
          <ReferenceLine y={67} stroke="rgba(34,211,160,0.35)" strokeDasharray="4 3"
            label={{ value: 'Good', position: 'right', fill: 'var(--good)', fontSize: 10 }} />
          <ReferenceLine y={34} stroke="rgba(248,113,113,0.35)" strokeDasharray="4 3"
            label={{ value: 'Low', position: 'right', fill: 'var(--bad)', fontSize: 10 }} />
          <Line
            type="monotone" dataKey="avgRecovery"
            stroke="var(--whoop)" strokeWidth={2.5}
            dot={{ r: 6, fill: 'var(--whoop)', strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>{message}</div>
}

const titleRow = { marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }
