/**
 * ReadinessScatter — Quadrant scatter: Recovery % (x) vs Strain (y).
 * Color encodes sleep score bucket; size encodes daily training time.
 * Uses confirmed WHOOP daily fields: recovery_score, strain, sleep_performance.
 * Strava total session time is from buildDailyGrain (totalTime field).
 */
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, Cell,
} from 'recharts'

function sleepColor(score) {
  if (score == null) return 'var(--text-muted)'
  if (score >= 70)   return 'var(--good)'
  if (score >= 50)   return 'var(--warn)'
  return 'var(--bad)'
}

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)',
      minWidth: 180,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{d.date}</p>
      <p>Recovery: <strong style={{ color: 'var(--good)' }}>{d.recovery?.toFixed(0)}%</strong></p>
      <p>Strain: <strong style={{ color: 'var(--accent)' }}>{d.strain?.toFixed(1)}</strong></p>
      {d.sleep != null && <p>Sleep score: <strong>{d.sleep?.toFixed(0)}%</strong></p>}
      {d.trainMin > 0 && <p>Training: <strong>{Math.round(d.trainMin)} min</strong></p>}
    </div>
  )
}

const QUADRANT_LABEL = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fill: 'var(--text-muted)', opacity: 0.8 }

export default function ReadinessScatter({ daily = [], dailyGrain = [] }) {
  // Build daily grain map for session time
  const grainMap = {}
  for (const g of dailyGrain) grainMap[g.date] = g

  const points = daily
    .filter(d => d.recovery_score != null && d.strain != null)
    .map(d => ({
      date:     d.date,
      recovery: d.recovery_score,
      strain:   d.strain,
      sleep:    d.sleep_performance,
      trainMin: (grainMap[d.date]?.totalTime || 0) / 60,
    }))

  if (!points.length) {
    return <EmptyState message="Need both recovery and strain data to build this chart." />
  }

  // Point radius: scaled by training time (0 if rest day, max ~8px)
  const maxMin = Math.max(...points.map(p => p.trainMin), 1)
  const dotR = (trainMin) => 4 + (trainMin / maxMin) * 6

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Readiness vs Load</span>
        <span style={subtitle}>Recovery % · Strain · dot size = training time · color = sleep quality</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

          {/* Quadrant backgrounds */}
          <ReferenceArea x1={0}  x2={50} y1={0}    y2={10.5} fill="rgba(248,113,113,0.05)"  />  {/* low rec, low strain */}
          <ReferenceArea x1={50} x2={100} y1={0}   y2={10.5} fill="rgba(34,211,160,0.05)"   />  {/* high rec, low strain */}
          <ReferenceArea x1={0}  x2={50} y1={10.5} y2={21}   fill="rgba(248,113,113,0.10)"  />  {/* low rec, high strain — risk */}
          <ReferenceArea x1={50} x2={100} y1={10.5} y2={21}  fill="rgba(252,76,2,0.05)"     />  {/* high rec, high strain — productive */}

          {/* Quadrant dividers */}
          <ReferenceLine x={50}   stroke="var(--border)" strokeWidth={1.5} strokeDasharray="6 3" />
          <ReferenceLine y={10.5} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="6 3" />

          <XAxis
            type="number" dataKey="recovery" name="Recovery"
            domain={[0, 100]}
            label={{ value: 'Recovery %', position: 'insideBottom', offset: -8, fill: 'var(--text-muted)', fontSize: 11 }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            type="number" dataKey="strain" name="Strain"
            domain={[0, 21]}
            label={{ value: 'Strain', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false} tickLine={false}
          />

          <Tooltip content={<TooltipContent />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }} />

          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={sleepColor(p.sleep)}
                fillOpacity={0.75}
                r={dotR(p.trainMin)}
                stroke="var(--surface)"
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant labels */}
      <div style={quadGrid}>
        <QuadLabel color="var(--good)"        text="Productive"           sub="High rec + high load" />
        <QuadLabel color="var(--bad)"         text="Risk"                 sub="Low rec + high load"  />
        <QuadLabel color="var(--whoop)"       text="Unused opportunity"   sub="High rec + low load"  />
        <QuadLabel color="var(--text-muted)"  text="Recovery day"         sub="Low rec + low load"   />
      </div>

      <div style={legendRow}>
        <LegendDot color="var(--good)"  label="Good sleep (≥70%)" />
        <LegendDot color="var(--warn)"  label="OK sleep (50–69%)" />
        <LegendDot color="var(--bad)"   label="Poor sleep (<50%)" />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>
          Larger dot = more training time
        </span>
      </div>
    </div>
  )
}

function QuadLabel({ color, text, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{text}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {message}
    </div>
  )
}

const titleRow = { marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }
const quadGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8, padding: '0 24px' }
const legendRow = { display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', padding: '0 4px' }
