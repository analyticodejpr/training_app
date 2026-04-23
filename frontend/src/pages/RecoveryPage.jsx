/**
 * RecoveryPage — Route: /recovery
 * "Why am I fresh or tired?"
 *
 * Data sources (Supabase only — no live provider fetches):
 *   WHOOP metrics  → useSupabaseMetrics()  → daily_metrics table
 *   Strava activities → useSupabaseActivities() → activities table
 *
 * Sections:
 *  1. WhoopImportPanel (sync status + manual trigger)
 *  2. Recovery Drivers  |  WHOOP Trends (SmallMultiplesPanel)
 *  3. Sleep Consistency & Debt (inline chart)
 *  4. Sleep Score → Next-Day Performance scatter  |  Recovery After Hard Sessions
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter, Cell,
} from 'recharts'
import { useSupabaseMetrics }     from '../hooks/useSupabaseMetrics'
import { useSupabaseActivities }  from '../hooks/useSupabaseActivities'
import { useDateRange } from '../context/DateRangeContext'
import { sessionRecoveryCost, rollingAvg, SPORT_COLORS } from '../utils/metrics'
import { msToHHMM, shortDate, recoveryColor } from '../utils/format'
import {
  PageWrapper, Card, SectionTitle, PanelHeader, TwoCol,
  EmptyNote, Loader, TOOLTIP_STYLE, GRID_STYLE,
} from '../components/ui'
import RecoveryDriversChart from '../components/RecoveryDriversChart'
import SmallMultiplesPanel  from '../components/SmallMultiplesPanel'
import RecoveryLagChart     from '../components/RecoveryLagChart'
import ConnectCard          from '../components/ConnectCard'
import WhoopImportPanel     from '../components/WhoopImportPanel'

export default function RecoveryPage({ authStatus }) {
  const { filterByDate, filterActivities, label } = useDateRange()

  // ── Data from Supabase (no live API calls) ────────────────────────────────
  const { daily: whoopAll, loading: wl } = useSupabaseMetrics(!!authStatus?.whoop, 90)
  const { activities: actsAll, loading: sl } = useSupabaseActivities(!!authStatus?.strava, 200)

  const loading = wl || sl

  const whoopFiltered = useMemo(() => filterByDate(whoopAll),    [whoopAll, filterByDate])
  const actsFiltered  = useMemo(() => filterActivities(actsAll), [actsAll, filterActivities])

  // Latest two WHOOP days for RecoveryDriversChart
  const latest  = whoopAll.length ? whoopAll[whoopAll.length - 1] : null
  const prevDay = whoopAll.length > 1 ? whoopAll[whoopAll.length - 2] : null

  // 28-day baseline for drivers (respiratory_rate omitted — not in daily_metrics yet)
  const baseline = useMemo(() => {
    const w28 = whoopAll.slice(-28)
    const avg  = (key) => {
      const v = w28.filter(d => d[key] != null)
      return v.length ? v.reduce((s, d) => s + d[key], 0) / v.length : null
    }
    return { hrv_rmssd: avg('hrv_rmssd'), resting_hr: avg('resting_hr') }
  }, [whoopAll])

  // Sleep consistency chart data
  const sleepTrendData = useMemo(() => {
    const avgs7       = rollingAvg(whoopFiltered, 'sleep_duration_ms', 7)
    const TARGET_MS   = 8 * 3600 * 1000
    return whoopFiltered.map((d, i) => ({
      date:  shortDate(d.date),
      durH:  d.sleep_duration_ms != null ? +(d.sleep_duration_ms / 3600000).toFixed(2) : null,
      score: d.sleep_performance,
      avg7H: avgs7[i] != null ? +(avgs7[i] / 3600000).toFixed(2) : null,
      debtH: d.sleep_duration_ms != null
        ? +Math.max(0, (TARGET_MS - d.sleep_duration_ms) / 3600000).toFixed(2)
        : null,
    }))
  }, [whoopFiltered])

  // Sleep → next-day performance scatter (uses DB-backed Strava activities)
  const sleepTrainingPoints = useMemo(() => {
    const dailyMap = {}
    for (const d of whoopAll) dailyMap[d.date] = d
    return actsAll
      .filter(a => a.distance > 200 || a.moving_time > 120)
      .map(a => {
        const date = (a.start_date_local || a.start_date || '').split('T')[0]
        if (!date) return null
        const prevD = new Date(date + 'T12:00:00')
        prevD.setDate(prevD.getDate() - 1)
        const prev = dailyMap[prevD.toISOString().split('T')[0]]
        if (!prev?.sleep_performance) return null
        const kmh = a.distance > 0 && a.moving_time > 0
          ? +((a.distance / 1000) / (a.moving_time / 3600)).toFixed(2) : null
        return { date, type: a.type, sleep: prev.sleep_performance, kmh, name: a.name }
      })
      .filter(p => p && p.kmh > 0.5)
  }, [whoopAll, actsAll])

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!authStatus?.whoop) {
    return (
      <PageWrapper>
        <ConnectCard platform="WHOOP" message="Connect WHOOP to analyse your recovery, sleep patterns, and recovery lag." />
      </PageWrapper>
    )
  }

  if (loading) return <Loader />

  return (
    <PageWrapper>

      {/* ── Sync status + manual import trigger ── */}
      <WhoopImportPanel />

      {/* ── Recovery drivers + WHOOP trend lines ── */}
      <TwoCol>
        <Card>
          <RecoveryDriversChart today={latest} prevDay={prevDay} baseline={baseline} />
        </Card>
        <Card noPad>
          <div style={{ padding: '20px 24px 14px' }}>
            <PanelHeader label={label} title="WHOOP Trends" bottom={0} />
          </div>
          {whoopFiltered.length > 1
            ? <SmallMultiplesPanel data={whoopFiltered} />
            : <div style={{ padding: '0 24px 20px' }}>
                <EmptyNote>No WHOOP data for this period. Try widening the date range or importing.</EmptyNote>
              </div>}
        </Card>
      </TwoCol>

      {/* ── Sleep consistency & debt ── */}
      <Card>
        <SectionTitle title="Sleep Consistency & Debt" note={label} />
        {sleepTrendData.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={sleepTrendData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="h"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis yAxisId="pct" orientation="right"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                label={{ value: 'Score %', angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip
                formatter={(v, n) => n === 'sleep score' ? [`${v?.toFixed(0)}%`, n] : [`${v?.toFixed(1)}h`, n]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Area yAxisId="h" type="monotone" dataKey="debtH" name="sleep debt (est.)"
                fill="rgba(240,84,106,0.1)" stroke="rgba(240,84,106,0.35)" strokeWidth={1}
                dot={false} connectNulls isAnimationActive={false} />
              <Bar yAxisId="h" dataKey="durH" name="duration"
                fill="rgba(129,140,248,0.3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="h" type="monotone" dataKey="avg7H" name="7d avg"
                stroke="#818cf8" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              <Line yAxisId="pct" type="monotone" dataKey="score" name="sleep score"
                stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <EmptyNote>No sleep data for this period.</EmptyNote>}
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
          Sleep debt estimated using an 8h target. WHOOP does not expose individual sleep need.
        </p>
      </Card>

      {/* ── Sleep → next-day performance scatter  |  Recovery lag ── */}
      <TwoCol>
        <Card>
          <SectionTitle title="Sleep Score → Next-Day Performance" note="km/h proxy" />
          {sleepTrainingPoints.length > 3 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" dataKey="sleep" name="Sleep Score" domain={[0, 100]}
                  label={{ value: 'Prior night sleep score %', position: 'insideBottom', offset: -8, fill: 'var(--text-muted)', fontSize: 10 }}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="kmh" name="Speed"
                  label={{ value: 'Speed km/h', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px' }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d?.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{d?.date} · {d?.type}</p>
                        <p>Sleep <strong>{d?.sleep?.toFixed(0)}%</strong></p>
                        <p>Speed <strong>{d?.kmh?.toFixed(1)} km/h</strong></p>
                      </div>
                    )
                  }}
                  cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-hi)' }}
                />
                <Scatter data={sleepTrainingPoints} isAnimationActive={false}>
                  {sleepTrainingPoints.map((p, i) => (
                    <Cell key={i}
                      fill={SPORT_COLORS[p.type] || 'var(--text-muted)'}
                      fillOpacity={0.75}
                      stroke="var(--surface)"
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote>
              {authStatus?.strava
                ? 'Need overlapping sleep + activity data to show this chart.'
                : 'Connect Strava to compare sleep scores with next-day performance.'}
            </EmptyNote>
          )}
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
            Speed proxy = distance ÷ moving time. Most meaningful within a single sport.
          </p>
        </Card>

        <Card>
          <RecoveryLagChart activities={actsAll} whoopDaily={whoopAll} />
        </Card>
      </TwoCol>

    </PageWrapper>
  )
}
