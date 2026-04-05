/**
 * RecoveryOverTime — Recovery % trend over time with strain bars.
 * Shows whether recovery is improving, declining, or stable.
 *
 * - Recovery % line (colored dots by sleep quality)
 * - 7-day rolling average line (shows direction of travel)
 * - Strain bars (secondary axis, muted)
 * - Zones: green ≥67, yellow 34–66, red <34
 */
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, Cell, Area,
} from 'recharts'
import { rollingAvg } from '../utils/metrics'
import { shortDate, recoveryColor } from '../utils/format'
import { TOOLTIP_STYLE } from './ui'

function sleepColor(score) {
  if (score == null) return 'var(--text-muted)'
  if (score >= 70)   return 'var(--good)'
  if (score >= 50)   return 'var(--warn)'
  return 'var(--bad)'
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rec    = payload.find(p => p.dataKey === 'recovery')?.value
  const strain = payload.find(p => p.dataKey === 'strain')?.value
  const avg7   = payload.find(p => p.dataKey === 'avg7')?.value
  const sleep  = payload[0]?.payload?.sleep

  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 180 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', fontSize: 11 }}>{label}</p>
      {rec    != null && <p style={{ marginBottom: 3 }}>Recovery: <strong style={{ color: recoveryColor(rec) }}>{Math.round(rec)}%</strong></p>}
      {avg7   != null && <p style={{ marginBottom: 3 }}>7-day avg: <strong style={{ color: 'rgba(129,140,248,0.9)' }}>{avg7.toFixed(1)}%</strong></p>}
      {strain != null && <p style={{ marginBottom: 3 }}>Strain: <strong style={{ color: 'var(--accent)' }}>{strain.toFixed(1)}</strong></p>}
      {sleep  != null && <p>Sleep: <strong style={{ color: sleepColor(sleep) }}>{Math.round(sleep)}%</strong></p>}
    </div>
  )
}

// Custom dot — color by sleep quality
function RecoveryDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || payload?.recovery == null) return null
  return (
    <circle
      cx={cx} cy={cy} r={4}
      fill={sleepColor(payload.sleep)}
      stroke="var(--surface)"
      strokeWidth={1.5}
    />
  )
}

export default function ReadinessScatter({ daily = [], dailyGrain = [] }) {
  const grainMap = {}
  for (const g of dailyGrain) grainMap[g.date] = g

  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))

  const avg7vals = rollingAvg(sorted, 'recovery_score', 7)

  const chartData = sorted
    .filter(d => d.recovery_score != null || d.strain != null)
    .map((d, i) => ({
      date:     shortDate(d.date),
      recovery: d.recovery_score != null ? +d.recovery_score.toFixed(1) : null,
      strain:   d.strain         != null ? +d.strain.toFixed(1)         : null,
      sleep:    d.sleep_performance,
      avg7:     avg7vals[i]      != null ? +avg7vals[i].toFixed(1)      : null,
    }))

  if (!chartData.length) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Need WHOOP data to show recovery trend.
      </div>
    )
  }

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Recovery Over Time</span>
        <span style={subtitle}>7-day avg · dot color = sleep quality · bars = strain</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>

          {/* Zone bands */}
          <ReferenceArea y1={67} y2={100} yAxisId="rec" fill="rgba(16,212,138,0.05)" ifOverflow="hidden" />
          <ReferenceArea y1={34} y2={67}  yAxisId="rec" fill="rgba(245,166,35,0.05)" ifOverflow="hidden" />
          <ReferenceArea y1={0}  y2={34}  yAxisId="rec" fill="rgba(240,84,106,0.05)" ifOverflow="hidden" />

          {/* Zone boundary lines */}
          <ReferenceLine y={67} yAxisId="rec" stroke="rgba(16,212,138,0.25)"  strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={34} yAxisId="rec" stroke="rgba(240,84,106,0.25)" strokeDasharray="4 4" strokeWidth={1} />

          <CartesianGrid strokeDasharray="1 4" stroke="var(--chart-grid)" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false} tickLine={false}
            interval="preserveStartEnd"
          />

          {/* Recovery % axis (left) */}
          <YAxis
            yAxisId="rec"
            domain={[0, 100]}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false} tickLine={false}
            width={28}
            tickCount={5}
          />

          {/* Strain axis (right, muted) */}
          <YAxis
            yAxisId="str"
            orientation="right"
            domain={[0, 21]}
            tick={{ fill: 'var(--text-dim)', fontSize: 9 }}
            axisLine={false} tickLine={false}
            width={22}
            tickCount={4}
          />

          <Tooltip content={<TooltipContent />} isAnimationActive={false}
            cursor={{ stroke: 'var(--border-hi)', strokeWidth: 1, strokeDasharray: '3 3' }} />

          {/* Strain bars — behind everything, muted */}
          <Bar
            yAxisId="str" dataKey="strain"
            fill="rgba(255,85,0,0.18)"
            stroke="rgba(255,85,0,0.3)"
            strokeWidth={0.5}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            maxBarSize={14}
          />

          {/* Recovery gradient fill */}
          <defs>
            <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--good)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--good)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            yAxisId="rec" dataKey="recovery"
            fill="url(#recGrad)" stroke="none"
            connectNulls dot={false} isAnimationActive={false}
          />

          {/* 7-day rolling average — shows direction of travel */}
          <Line
            yAxisId="rec" dataKey="avg7"
            stroke="rgba(129,140,248,0.85)"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
            strokeDasharray="none"
          />

          {/* Daily recovery — colored dots by sleep quality */}
          <Line
            yAxisId="rec" dataKey="recovery"
            stroke="rgba(16,212,138,0.5)"
            strokeWidth={1.5}
            dot={<RecoveryDot />}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />

        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={legendRow}>
        <LegendLine color="rgba(16,212,138,0.7)"  label="Daily recovery" />
        <LegendLine color="rgba(129,140,248,0.85)" label="7-day avg" />
        <LegendBar  color="rgba(255,85,0,0.4)"    label="Strain" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <LegendDot  color="var(--good)" label="Good sleep" />
        <LegendDot  color="var(--warn)" label="OK sleep" />
        <LegendDot  color="var(--bad)"  label="Poor sleep" />
      </div>
    </div>
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

function LegendBar({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

const titleRow  = { marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title     = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle  = { fontSize: 11, color: 'var(--text-muted)' }
const legendRow = { display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }
