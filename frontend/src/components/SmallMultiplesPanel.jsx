/**
 * SmallMultiplesPanel — Five aligned time-series mini-charts sharing the same x-axis.
 * Uses Recharts `syncId` for synchronized tooltip crosshair.
 *
 * Metrics: Recovery %, HRV (ms), Resting HR (bpm), Sleep Score %, Strain
 */
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { rollingAvg } from '../utils/metrics'
import { shortDate } from '../utils/format'
import { TOOLTIP_STYLE, GRID_STYLE } from './ui'

const SYNC_ID = 'perf-lab-small'

const PANELS = [
  { key: 'recovery_score',    label: 'Recovery',    color: '#10d48a', domain: [0, 100],        unit: '%',   baseline: true },
  { key: 'hrv_rmssd',         label: 'HRV',         color: '#818cf8', domain: ['auto','auto'],  unit: ' ms', baseline: true },
  { key: 'resting_hr',        label: 'Resting HR',  color: '#f0546a', domain: ['auto','auto'],  unit: ' bpm',baseline: true, invertGood: true },
  { key: 'sleep_performance', label: 'Sleep',       color: '#f5a623', domain: [0, 100],         unit: '%',   baseline: false },
  { key: 'strain',            label: 'Strain',      color: '#ff5500', domain: [0, 21],          unit: '',    baseline: false },
]

function CustomTooltip({ active, payload, label, unit, invertGood }) {
  if (!active || !payload?.length) return null
  const val   = payload.find(p => p.name === 'value')?.value
  const base  = payload.find(p => p.name === 'base')?.value
  const delta = val != null && base != null ? val - base : null
  const deltaGood = invertGood ? delta <= 0 : delta >= 0

  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 140 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 5 }}>{label}</p>
      {val != null && (
        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
          {typeof val === 'number' ? val.toFixed(1) : val}{unit}
          {delta != null && (
            <span style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 500,
              color: deltaGood ? 'var(--good)' : 'var(--bad)',
            }}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs avg
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function MiniChart({ data, panel, isLast }) {
  const avgs7  = rollingAvg(data, panel.key, 7)
  const avgs28 = rollingAvg(data, panel.key, 28)

  const chartData = data.map((d, i) => ({
    date:  shortDate(d.date),
    value: d[panel.key] != null ? +d[panel.key].toFixed(2) : null,
    avg7:  avgs7[i]  != null ? +avgs7[i].toFixed(2)  : null,
    base:  avgs28[i] != null ? +avgs28[i].toFixed(2) : null,
  }))

  // Gradient id must be unique per panel
  const gradId = `grad-${panel.key.replace(/_/g, '-')}`

  return (
    <div style={{ position: 'relative' }}>
      {/* Row label */}
      <div style={{
        position: 'absolute', left: 4, top: 6, zIndex: 1,
        fontSize: 9, fontWeight: 700,
        color: panel.color,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        opacity: 0.9,
      }}>
        {panel.label}
      </div>

      <ResponsiveContainer width="100%" height={isLast ? 88 : 74}>
        <ComposedChart data={chartData} syncId={SYNC_ID}
          margin={{ top: 18, right: 8, left: 28, bottom: isLast ? 4 : 0 }}>

          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={panel.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={panel.color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_STYLE} />

          <XAxis
            dataKey="date"
            hide={!isLast}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={panel.domain}
            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={26}
            tickCount={3}
          />

          <Tooltip
            content={<CustomTooltip unit={panel.unit} invertGood={panel.invertGood} />}
            isAnimationActive={false}
            cursor={{ stroke: 'var(--border-hi)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          {/* Gradient area fill under main series */}
          <Area
            dataKey="value"
            fill={`url(#${gradId})`}
            stroke="none"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* 28-day baseline */}
          {panel.baseline && (
            <Line
              dataKey="base"
              name="base"
              stroke="var(--border-hi)"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}

          {/* 7-day rolling avg */}
          <Line
            dataKey="avg7"
            name="avg7"
            stroke={panel.color}
            strokeWidth={1.5}
            strokeOpacity={0.4}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Daily values — primary line */}
          <Line
            dataKey="value"
            name="value"
            stroke={panel.color}
            strokeWidth={1.8}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: panel.color, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function SmallMultiplesPanel({ data = [] }) {
  if (!data.length) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No WHOOP data available for this period.
      </div>
    )
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
        <LegendItem color="var(--border-hi)" dash>28d avg</LegendItem>
        <LegendItem color="currentColor" opacity={0.4}>7d avg</LegendItem>
        <LegendItem color="currentColor">Daily</LegendItem>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {PANELS.map((panel, i) => (
          <MiniChart
            key={panel.key}
            data={data}
            panel={panel}
            isLast={i === PANELS.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function LegendItem({ color, dash, opacity, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
      <svg width="20" height="10" style={{ overflow: 'visible' }}>
        <line
          x1="0" y1="5" x2="20" y2="5"
          stroke={color}
          strokeWidth={dash ? 1 : 1.5}
          strokeDasharray={dash ? '4 3' : 'none'}
          strokeOpacity={opacity || 1}
        />
      </svg>
      {children}
    </div>
  )
}
