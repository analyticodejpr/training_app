/**
 * AcuteChronicChart — 7-day (acute) vs 28-day (chronic) strain load + ratio.
 * Shaded "balanced zone" at ratio 0.8–1.3.
 *
 * Primary load = WHOOP strain. If strain is sparse, a Strava-derived load proxy
 * (totalTime minutes / 6 ≈ rough strain equivalent) can be passed in via `fallbackLoad`.
 * The fallback is documented inline.
 */
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceArea, ReferenceLine,
} from 'recharts'
import { computeAcuteChronic } from '../utils/metrics'
import { shortDate } from '../utils/format'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const get = (name) => payload.find(p => p.name === name)?.value
  const ratio = get('ratio')
  const ratioColor = !ratio ? 'var(--text-muted)'
    : ratio >= 0.8 && ratio <= 1.3 ? 'var(--good)'
    : ratio > 1.3 ? 'var(--bad)' : 'var(--warn)'
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)', minWidth: 190,
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {get('acute')   != null && <p>Acute (7d): <strong style={{ color: 'var(--accent)' }}>{get('acute')?.toFixed(1)}</strong></p>}
      {get('chronic') != null && <p>Chronic (28d): <strong style={{ color: '#818cf8' }}>{get('chronic')?.toFixed(1)}</strong></p>}
      {ratio != null && (
        <p>Ratio: <strong style={{ color: ratioColor }}>{ratio.toFixed(2)}</strong>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
            {ratio < 0.8 ? '↓ under-trained' : ratio > 1.3 ? '↑ risk zone' : '✓ balanced'}
          </span>
        </p>
      )}
      {get('recovery') != null && <p style={{ marginTop: 4, color: 'var(--good)' }}>Recovery: {get('recovery')?.toFixed(0)}%</p>}
    </div>
  )
}

export default function AcuteChronicChart({ daily = [], dailyGrain = [] }) {
  // Build effective strain: use WHOOP strain if available, else derive from Strava time
  // Fallback note: if WHOOP strain is null, we use (totalTime / 360) as a rough proxy
  // where 6 hours of training ≈ strain 10. This is a simplification.
  const grainMap = {}
  for (const g of dailyGrain) grainMap[g.date] = g

  const merged = daily.map(d => ({
    ...d,
    strain: d.strain ?? (grainMap[d.date]?.totalTime > 0
      ? +(grainMap[d.date].totalTime / 360).toFixed(2)
      : null),
    _isFallback: d.strain == null && grainMap[d.date]?.totalTime > 0,
  }))

  const acData = computeAcuteChronic(merged)

  // Need ≥28 days for chronic to stabilise; show note if shorter
  const hasChronic = acData.some(d => d.chronic != null)

  if (!acData.length) {
    return <EmptyState message="No strain data available for load analysis." />
  }

  const chartData = acData.map(d => ({
    date:     shortDate(d.date),
    acute:    d.acute,
    chronic:  d.chronic,
    ratio:    d.ratio,
    recovery: d.recovery,
  }))

  const hasFallback = merged.some(d => d._isFallback)

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Acute vs Chronic Load</span>
        <span style={subtitle}>
          7-day acute · 28-day chronic · ratio right axis · balanced zone: 0.8–1.3
          {hasFallback && ' · * some load estimated from Strava session time'}
        </span>
      </div>

      {!hasChronic && (
        <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 8 }}>
          Chronic average needs 28+ days of data to stabilise.
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

          {/* Balanced zone band on ratio axis */}
          <ReferenceArea yAxisId="ratio" y1={0.8} y2={1.3}
            fill="rgba(34,211,160,0.07)" stroke="rgba(34,211,160,0.25)" strokeDasharray="4 3" />
          <ReferenceLine yAxisId="ratio" y={1.0}
            stroke="rgba(34,211,160,0.4)" strokeWidth={1} strokeDasharray="4 3" />

          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="load" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 21]} label={{ value: 'Strain', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10, offset: 10 }} />
          <YAxis yAxisId="ratio" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 2.5]} label={{ value: 'Ratio', angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 10 }} />

          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />

          {/* Recovery faint area */}
          <Area yAxisId="load" type="monotone" dataKey="recovery" name="recovery"
            fill="rgba(34,211,160,0.06)" stroke="rgba(34,211,160,0.25)" strokeWidth={1}
            dot={false} connectNulls isAnimationActive={false} legendType="none" />

          {/* Chronic load */}
          <Line yAxisId="load" type="monotone" dataKey="chronic" name="chronic"
            stroke="#818cf8" strokeWidth={2} dot={false} connectNulls isAnimationActive={false}
            strokeDasharray="6 3" />

          {/* Acute load */}
          <Line yAxisId="load" type="monotone" dataKey="acute" name="acute"
            stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />

          {/* Ratio */}
          <Line yAxisId="ratio" type="monotone" dataKey="ratio" name="ratio"
            stroke="rgba(34,211,160,0.7)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {message}
    </div>
  )
}

const titleRow = { marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }
