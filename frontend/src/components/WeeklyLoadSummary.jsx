/**
 * WeeklyLoadSummary — Weekly Load Structure (Training page, middle-left)
 *
 * Answers: "How much total load am I carrying each week?"
 *
 * Top stat strip: period totals (sessions, hours, km)
 * Chart: bars = weekly session count, line = weekly total hours (secondary axis)
 *
 * Data: built from Strava activities only via buildWeeklyByType().
 * Does NOT mix in sport breakdown (WeeklyCompositionChart handles that).
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { buildWeeklyByType } from '../utils/metrics'
import { shortDate } from '../utils/format'
import { EmptyNote, TOOLTIP_STYLE, GRID_STYLE } from './ui'

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const sessions = payload.find(p => p.dataKey === 'sessions')?.value
  const hours    = payload.find(p => p.dataKey === 'hours')?.value

  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 150 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', fontSize: 11 }}>{label}</p>
      {sessions != null && (
        <p style={{ marginBottom: 3 }}>Sessions: <strong style={{ color: 'var(--accent)' }}>{sessions}</strong></p>
      )}
      {hours != null && (
        <p>Hours: <strong style={{ color: 'rgba(129,140,248,0.9)' }}>{hours.toFixed(1)}h</strong></p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeeklyLoadSummary({ activities = [], label = '' }) {
  const weeklyData = useMemo(() => buildWeeklyByType(activities), [activities])

  const chartData = useMemo(() =>
    weeklyData.map(w => ({
      week:     shortDate(w.week),
      sessions: w.total.count,
      hours:    +(w.total.time / 3600).toFixed(1),
      distKm:   +(w.total.dist / 1000).toFixed(1),
    })),
    [weeklyData]
  )

  // Period-level totals for the summary strip
  const totals = useMemo(() => {
    const sessions = activities.length
    const hours    = +(activities.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600).toFixed(1)
    const km       = +(activities.reduce((s, a) => s + (a.distance    || 0), 0) / 1000).toFixed(0)
    return { sessions, hours, km }
  }, [activities])

  if (!activities.length) {
    return <EmptyNote>No activities in this period.</EmptyNote>
  }

  return (
    <div>
      <div style={titleRow}>
        <span style={titleStyle}>Weekly Load</span>
        {label && <span style={subtitleStyle}>{label}</span>}
      </div>

      {/* Period summary strip */}
      <div style={statStrip}>
        <StatCell value={totals.sessions} label="Sessions" color="var(--accent)" />
        <StatCell value={`${totals.hours}h`} label="Total Hours" color="rgba(129,140,248,0.9)" />
        <StatCell value={`${totals.km} km`} label="Total Distance" color="var(--text-muted)" />
      </div>

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />

            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />

            {/* Session count axis (left) */}
            <YAxis
              yAxisId="cnt"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              width={24}
              tickCount={4}
              allowDecimals={false}
            />

            {/* Hours axis (right) */}
            <YAxis
              yAxisId="hrs"
              orientation="right"
              tick={{ fill: 'var(--text-dim)', fontSize: 9 }}
              axisLine={false} tickLine={false}
              width={26}
              tickCount={4}
              tickFormatter={v => `${v}h`}
            />

            <Tooltip content={<TooltipContent />} isAnimationActive={false}
              cursor={{ stroke: 'var(--border-hi)', strokeWidth: 1, strokeDasharray: '3 3' }} />

            <Bar
              yAxisId="cnt"
              dataKey="sessions"
              fill="rgba(255,85,0,0.35)"
              stroke="rgba(255,85,0,0.55)"
              strokeWidth={0.5}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />

            <Line
              yAxisId="hrs"
              dataKey="hours"
              stroke="rgba(129,140,248,0.85)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'rgba(129,140,248,0.85)', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <EmptyNote>Not enough weeks to chart. Widen the date range.</EmptyNote>
      )}

      {/* Axis legend */}
      <div style={legendRow}>
        <LegendBar  color="rgba(255,85,0,0.45)"     label="Sessions" />
        <LegendLine color="rgba(129,140,248,0.85)"  label="Hours" />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({ value, label, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      flex: 1,
    }}>
      <span className="metric-mono" style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.5px' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  )
}

function LegendBar({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function LegendLine({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2" /></svg>
      {label}
    </span>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const titleRow     = { marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }
const titleStyle   = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitleStyle = { fontSize: 11, color: 'var(--text-muted)' }
const statStrip    = { display: 'flex', gap: 8, marginBottom: 14 }
const legendRow    = { display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }
