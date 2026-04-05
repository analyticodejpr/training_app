/**
 * PerformanceTrendChart — Weekly performance trend for runs and rides.
 *
 * For runs: weekly avg pace (min/km). Lower = faster = better.
 * For rides: weekly avg speed (km/h). Higher = better.
 *
 * Fallback: if only one sport has data, show only that sport's chart.
 * If neither has data, show empty state.
 *
 * NOTE: Pace derived from (moving_time / distance). Activities with
 * distance < 500m are excluded as outliers.
 */
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { computeWeeklyRunPace, computeWeeklyRideEfficiency, rollingAvg } from '../utils/metrics'
import { shortDate, formatPaceMinKm } from '../utils/format'

function RunTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const avg = payload.find(p => p.name === 'avgPace')?.value
  const best = payload.find(p => p.name === 'bestPace')?.value
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {avg  != null && <p>Avg pace: <strong style={{ color: 'var(--accent)' }}>{formatPaceMinKm(avg)}</strong></p>}
      {best != null && <p>Best pace: <strong style={{ color: 'var(--good)' }}>{formatPaceMinKm(best)}</strong></p>}
      {payload.find(p => p.name === 'count') && <p>Runs: {payload.find(p => p.name === 'count').value}</p>}
    </div>
  )
}

function RideTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const avg  = payload.find(p => p.name === 'avgEff')?.value
  const best = payload.find(p => p.name === 'bestEff')?.value
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {avg  != null && <p>Avg speed: <strong style={{ color: 'var(--warn)' }}>{avg.toFixed(1)} km/h</strong></p>}
      {best != null && <p>Best speed: <strong style={{ color: 'var(--good)' }}>{best.toFixed(1)} km/h</strong></p>}
    </div>
  )
}

export default function PerformanceTrendChart({ activities = [] }) {
  const runWeeks  = computeWeeklyRunPace(activities)
  const rideWeeks = computeWeeklyRideEfficiency(activities)

  const hasRuns  = runWeeks.length > 1
  const hasRides = rideWeeks.length > 1

  if (!hasRuns && !hasRides) {
    return <EmptyState message="Need run or ride activities with distance + time data." />
  }

  const runData = runWeeks.map(w => ({
    week: shortDate(w.week), avgPace: w.avgPace, bestPace: w.bestPace, count: w.count,
  }))

  const rideData = rideWeeks.map(w => ({
    week: shortDate(w.week), avgEff: w.avgEff, bestEff: w.bestEff, count: w.count,
  }))

  // Rolling 4-week trend line for smoothing
  const runTrend  = rollingAvg(runWeeks,  'avgPace', 4)
  const rideTrend = rollingAvg(rideWeeks, 'avgEff',  4)
  runWeeks.forEach((w, i)  => runData[i]  && (runData[i].trend4  = runTrend[i]  != null ? +runTrend[i].toFixed(2)  : null))
  rideWeeks.forEach((w, i) => rideData[i] && (rideData[i].trend4 = rideTrend[i] != null ? +rideTrend[i].toFixed(2) : null))

  return (
    <div>
      <div style={titleRow}>
        <span style={title}>Performance Trend</span>
        <span style={subtitle}>Weekly averages · 4-week rolling trend · lower pace = faster</span>
      </div>

      <div className="perf-trend-grid" style={{ display: 'grid', gridTemplateColumns: hasRuns && hasRides ? '1fr 1fr' : '1fr', gap: 20 }}>
        {hasRuns && (
          <div>
            <div style={subTitle}>Run pace (min/km)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={runData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => formatPaceMinKm(v)} width={46} reversed />
                <Tooltip content={<RunTooltip />} />
                <Area type="monotone" dataKey="avgPace" fill="rgba(252,76,2,0.08)" stroke="none" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="avgPace"  name="avgPace"  stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="bestPace" name="bestPace" stroke="var(--good)"   strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="trend4"   name="trend4"   stroke="rgba(252,76,2,0.4)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {hasRides && (
          <div>
            <div style={subTitle}>Ride speed (km/h)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={rideData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<RideTooltip />} />
                <Area type="monotone" dataKey="avgEff" fill="rgba(251,191,36,0.08)" stroke="none" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="avgEff"  name="avgEff"  stroke="var(--warn)"  strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="bestEff" name="bestEff" stroke="var(--good)"  strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="trend4"  name="trend4"  stroke="rgba(251,191,36,0.4)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
        Pace derived from moving_time ÷ distance. Swim data not shown: unreliable distance from open-water sessions.
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{message}</div>
}

const titleRow = { marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const title    = { fontSize: 13, fontWeight: 700, color: 'var(--text)' }
const subtitle = { fontSize: 11, color: 'var(--text-muted)' }
const subTitle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }
