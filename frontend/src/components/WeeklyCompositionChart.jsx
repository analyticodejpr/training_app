/**
 * WeeklyCompositionChart — Stacked bar by sport type, session count line overlay.
 * Toggle: time (minutes) or distance (km).
 * Uses: Strava activity type, moving_time, distance from buildWeeklyByType.
 */
import { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { buildWeeklyByType, SPORT_COLORS } from '../utils/metrics'
import { shortDate } from '../utils/format'

const MAIN_SPORTS = ['Run', 'Ride', 'Swim', 'Walk', 'WeightTraining', 'Workout', 'Hike']

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  const unit = metric === 'time' ? 'min' : 'km'
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)', minWidth: 160,
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => p.name !== 'Sessions' && p.value > 0 && (
        <p key={p.name} style={{ color: p.fill || p.stroke }}>
          {p.name}: <strong>{metric === 'time' ? Math.round(p.value) : p.value.toFixed(1)} {unit}</strong>
        </p>
      ))}
      {payload.find(p => p.name === 'Sessions') && (
        <p style={{ color: 'var(--whoop)', marginTop: 4 }}>
          Sessions: <strong>{payload.find(p => p.name === 'Sessions').value}</strong>
        </p>
      )}
    </div>
  )
}

export default function WeeklyCompositionChart({ activities = [] }) {
  const [metric, setMetric] = useState('time') // 'time' | 'distance'

  const raw = buildWeeklyByType(activities)
  if (!raw.length) return <EmptyState />

  // Collect all sport types seen
  const sports = [...new Set(activities.map(a => a.type || 'Other'))].filter(Boolean)

  const chartData = raw.slice(-16).map(w => {
    const row = {
      week:     shortDate(w.week),
      Sessions: w.total.count,
    }
    for (const sport of sports) {
      const bt = w.byType[sport]
      if (bt) {
        row[sport] = metric === 'time'
          ? +(bt.time / 60).toFixed(1)
          : +(bt.dist / 1000).toFixed(1)
      } else {
        row[sport] = 0
      }
    }
    return row
  })

  const unit = metric === 'time' ? 'min' : 'km'

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Weekly Training Composition</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['time', 'distance']).map(m => (
            <button key={m} onClick={() => setMetric(m)} style={toggleBtn(metric === m)}>
              {m === 'time' ? 'Time' : 'Distance'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="vol"  tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
            label={{ value: unit, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
          <YAxis yAxisId="cnt" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
            label={{ value: 'sessions', angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          {sports.map((sport, i) => (
            <Bar key={sport} yAxisId="vol" dataKey={sport} stackId="a"
              fill={SPORT_COLORS[sport] || `hsl(${i * 47}, 65%, 55%)`}
              radius={i === sports.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false} />
          ))}

          <Line yAxisId="cnt" dataKey="Sessions" stroke="var(--whoop)" strokeWidth={2}
            dot={{ r: 3, fill: 'var(--whoop)', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyState() {
  return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activity data available.</div>
}

const titleRow = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const toggleBtn = (active) => ({
  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s',
})
