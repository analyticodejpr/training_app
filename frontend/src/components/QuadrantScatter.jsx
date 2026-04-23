/**
 * QuadrantScatter — Readiness vs Load quadrant chart (homepage Chart B)
 *
 * Answers: "When am I training at the right intensity for my recovery state?"
 *
 * X axis: recovery_score (0–100)
 * Y axis: strain (0–21)
 * One point per day where BOTH recovery and strain are available.
 *
 * Dot color = sleep quality bucket (green ≥70 / amber 50–69 / red <50 / gray = no sleep data)
 * Dot size  = proportional to that day's total Strava moving time (from dailyGrain); fixed if unavailable
 *
 * Quadrant labels:
 *   high recovery + high strain  → Productive
 *   low  recovery + high strain  → Risk Zone
 *   high recovery + low  strain  → Unused Opportunity
 *   low  recovery + low  strain  → Recovery Day
 */
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { shortDate, recoveryColor } from '../utils/format'
import { EmptyNote, TOOLTIP_STYLE } from './ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleepBucket(score) {
  if (score == null) return { color: 'var(--text-dim)', label: '—' }
  if (score >= 70)  return { color: 'var(--good)',      label: 'Good sleep' }
  if (score >= 50)  return { color: 'var(--warn)',      label: 'OK sleep' }
  return              { color: 'var(--bad)',             label: 'Poor sleep' }
}

// Dot radius: scale totalTime (seconds) to 4–12px range, fallback to 6
function dotRadius(totalTimeSec) {
  if (!totalTimeSec) return 6
  // 30 min = r4, 180 min = r10
  const clamped = Math.min(Math.max(totalTimeSec / 60, 30), 180)
  return 4 + ((clamped - 30) / 150) * 6
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  const sports = d.types ? Object.keys(d.types).join(', ') : '—'
  const durH   = d.totalTime ? `${Math.round(d.totalTime / 60)} min` : null

  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 190 }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', fontSize: 11 }}>{d.date}</p>
      <p style={{ marginBottom: 3 }}>
        Recovery: <strong style={{ color: recoveryColor(d.recovery) }}>{d.recovery}%</strong>
      </p>
      <p style={{ marginBottom: 3 }}>
        Strain: <strong style={{ color: 'var(--accent)' }}>{d.strain}</strong>
      </p>
      {d.sleep != null && (
        <p style={{ marginBottom: 3 }}>
          Sleep: <strong style={{ color: sleepBucket(d.sleep).color }}>{Math.round(d.sleep)}%</strong>
        </p>
      )}
      {sports !== '—' && (
        <p style={{ marginBottom: 3, color: 'var(--text-muted)', fontSize: 11 }}>
          Training: {sports}
        </p>
      )}
      {durH && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          Volume: {durH}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuadrantScatter({ daily = [], dailyGrain = [] }) {
  // Build a map from date → dailyGrain for fast lookup of totalTime + types
  const grainMap = {}
  for (const g of dailyGrain) grainMap[g.date] = g

  const points = daily
    .filter(d => d.recovery_score != null && d.strain != null)
    .map(d => {
      const grain = grainMap[d.date] || {}
      return {
        date:      shortDate(d.date),
        recovery:  +d.recovery_score.toFixed(1),
        strain:    +d.strain.toFixed(1),
        sleep:     d.sleep_performance ?? null,
        totalTime: grain.totalTime ?? 0,
        types:     grain.types ?? {},
      }
    })

  if (points.length < 5) {
    return (
      <EmptyNote>
        Need at least 5 days with both recovery and strain data to show this chart.
      </EmptyNote>
    )
  }

  // Quadrant label config
  const QL = [
    { label: 'Productive',          x: 76, y: 17.5, color: 'var(--good)' },
    { label: 'Risk Zone',           x: 5,  y: 17.5, color: 'var(--bad)' },
    { label: 'Unused Opportunity',  x: 67, y: 1.5,  color: 'var(--warn)' },
    { label: 'Recovery Day',        x: 5,  y: 1.5,  color: 'var(--text-dim)' },
  ]

  return (
    <div>
      <div style={titleRow}>
        <span style={titleStyle}>Readiness vs Load</span>
        <span style={subtitleStyle}>dot size = session volume · dot color = sleep quality</span>
      </div>

      {/* Legend */}
      <div style={legendRow}>
        <LegendDot color="var(--good)" label="Good sleep (≥70%)" />
        <LegendDot color="var(--warn)" label="OK sleep" />
        <LegendDot color="var(--bad)"  label="Poor sleep" />
        <LegendDot color="var(--text-dim)" label="No sleep data" />
      </div>

      {/* Chart wrapper — position relative so we can overlay quadrant labels */}
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 4" stroke="var(--chart-grid)" />

            <XAxis
              type="number"
              dataKey="recovery"
              domain={[0, 100]}
              name="Recovery %"
              label={{ value: 'Recovery %', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'var(--text-muted)' }}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickCount={6}
            />

            <YAxis
              type="number"
              dataKey="strain"
              domain={[0, 21]}
              name="Strain"
              label={{ value: 'Strain', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: 'var(--text-muted)' }}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              width={28}
              tickCount={5}
            />

            {/* Quadrant dividers */}
            <ReferenceLine x={50}   stroke="var(--border-hi)" strokeDasharray="3 3" strokeWidth={1} />
            <ReferenceLine y={10.5} stroke="var(--border-hi)" strokeDasharray="3 3" strokeWidth={1} />

            <Tooltip content={<TooltipContent />} cursor={{ strokeDasharray: '3 3' }} />

            <Scatter data={points} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell
                  key={i}
                  fill={sleepBucket(p.sleep).color}
                  fillOpacity={0.75}
                  r={dotRadius(p.totalTime)}
                  stroke={sleepBucket(p.sleep).color}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant labels — overlay on top of chart */}
        {QL.map(q => (
          <QuadrantLabel key={q.label} {...q} />
        ))}
      </div>
    </div>
  )
}

// ── Quadrant label overlaid on chart ─────────────────────────────────────────

function QuadrantLabel({ label, x, y, color }) {
  // x/y are in data space (recovery 0-100, strain 0-21).
  // Map to % positions inside the chart area (approx, accounting for margins).
  // Chart margin: top 16, right 16, left ~28 (yAxis width), bottom ~20 (xAxis)
  // Inner width ≈ 100% − 44px, inner height ≈ 300 − 36px = 264px
  const left = `calc(${x}% + 14px)`
  const top  = `calc(${(1 - y / 21) * 100}% - 16px)`

  return (
    <div style={{
      position: 'absolute',
      left,
      top,
      fontSize: 9,
      fontWeight: 700,
      color,
      opacity: 0.6,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </div>
  )
}

// ── Legend helpers ────────────────────────────────────────────────────────────

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const titleRow    = { marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const titleStyle  = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitleStyle = { fontSize: 11, color: 'var(--text-muted)' }
const legendRow   = { display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }
