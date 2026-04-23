/**
 * ProgressPage — Route: /progress
 * "Am I improving over time?"
 *
 * Data sources (Supabase only — no live provider fetches):
 *   Strava activities → useSupabaseActivities() → activities table
 *   WHOOP metrics     → useSupabaseMetrics()     → daily_metrics table
 *
 * NOTE: Data limited to the 200 most recent stored activities.
 */
import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useSupabaseMetrics }    from '../hooks/useSupabaseMetrics'
import { useSupabaseActivities } from '../hooks/useSupabaseActivities'
import { useDateRange } from '../context/DateRangeContext'
import {
  computeCumulative, buildMonthlyGrain, buildWeeklyConsistency,
  computeWeeklyRunPace, computeWeeklyRideEfficiency, rollingAvg,
  SPORT_COLORS,
} from '../utils/metrics'
import { shortDate, formatPaceMinKm } from '../utils/format'
import {
  PageWrapper, Card, SectionTitle, TwoCol,
  EmptyNote, Loader, PillBtn, TOOLTIP_STYLE, GRID_STYLE,
} from '../components/ui'
import ConnectCard      from '../components/ConnectCard'

export default function ProgressPage({ authStatus }) {
  const { filterActivities, filterByDate } = useDateRange()
  const [cumulMetric, setCumulMetric] = useState('distance')
  const [sportToggle, setSportToggle] = useState('All')

  const { daily: whoopAll, loading: wl } = useSupabaseMetrics(!!authStatus?.whoop, 90)
  const { activities: actsAll, loading: sl } = useSupabaseActivities(!!authStatus?.strava, 200)

  const loading = wl || sl

  const whoopFiltered = useMemo(() => filterByDate(whoopAll),    [whoopAll, filterByDate])
  const actsFiltered  = useMemo(() => filterActivities(actsAll), [actsAll, filterActivities])

  const sportTypes = useMemo(() => ['All', ...new Set(actsAll.map(a => a.type || 'Other'))], [actsAll])

  const cumulData = useMemo(() => {
    const acts = sportToggle === 'All' ? actsAll : actsAll.filter(a => a.type === sportToggle)
    return computeCumulative(acts, cumulMetric).map(d => ({
      date:  shortDate(d.date),
      value: cumulMetric === 'distance' ? +(d.value / 1000).toFixed(1)
           : cumulMetric === 'time'     ? +(d.value / 3600).toFixed(1)
           : +d.value.toFixed(0),
    }))
  }, [actsAll, cumulMetric, sportToggle])

  const cumulUnit = { distance: 'km', time: 'h', elevation: 'm' }[cumulMetric]

  const topSports   = useMemo(() => [...new Set(actsAll.map(a => a.type || 'Other'))].slice(0, 5), [actsAll])
  const monthlyData = useMemo(() => {
    const grain = buildMonthlyGrain(actsAll, whoopAll)
    return grain.map(m => {
      const row = { month: m.month.slice(5), avgRec: m.avgRecovery }
      let totalTime = 0
      for (const sport of topSports) {
        const val = m.byType[sport]?.time || 0
        row[sport] = +(val / 3600).toFixed(1)
        totalTime += val
      }
      row.totalH = +(totalTime / 3600).toFixed(1)
      return row
    })
  }, [actsAll, whoopAll, topSports])

  const consistencyData = useMemo(() => {
    const weeks = buildWeeklyConsistency(actsFiltered, whoopFiltered)
    return weeks.map(w => ({ ...w, week: shortDate(w.week) }))
  }, [actsFiltered, whoopFiltered])

  const recVsVolData = useMemo(() =>
    buildMonthlyGrain(actsFiltered, whoopFiltered).map(m => ({
      month: m.month.slice(5),
      volH:  +(m.totalTime / 3600).toFixed(1),
      rec:   m.avgRecovery,
    })), [actsFiltered, whoopFiltered])

  const runPaceData = useMemo(() => {
    const weeks = computeWeeklyRunPace(actsAll)
    const trend = rollingAvg(weeks, 'avgPace', 4)
    return weeks.map((w, i) => ({
      week: shortDate(w.week),
      avgPace: w.avgPace,
      trend: trend[i] != null ? +trend[i].toFixed(2) : null,
    }))
  }, [actsAll])

  const rideEffData = useMemo(() => {
    const weeks = computeWeeklyRideEfficiency(actsAll)
    const trend = rollingAvg(weeks, 'avgEff', 4)
    return weeks.map((w, i) => ({
      week: shortDate(w.week),
      avgEff: w.avgEff,
      trend: trend[i] != null ? +trend[i].toFixed(2) : null,
    }))
  }, [actsAll])

  if (!authStatus?.strava && !authStatus?.whoop) {
    return (
      <PageWrapper>
        <ConnectCard platform="Strava" message="Connect Strava to see your long-term progress, cumulative stats, and performance trajectory." />
      </PageWrapper>
    )
  }

  if (loading) return <Loader />

  return (
    <PageWrapper>

      {/* ── Cumulative fitness ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SectionTitle title="Cumulative Fitness" note="Full history · up to 200 recent activities" style={{ marginBottom: 0 }} />
          <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {(['distance', 'time', 'elevation']).map(m => (
              <PillBtn key={m} active={cumulMetric === m} onClick={() => setCumulMetric(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </PillBtn>
            ))}
            {sportTypes.map(s => (
              <PillBtn key={s} active={sportToggle === s} onClick={() => setSportToggle(s)} color="var(--whoop)">
                {s}
              </PillBtn>
            ))}
          </div>
        </div>
        {cumulData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-cumul" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                label={{ value: cumulUnit, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip
                formatter={v => [`${v} ${cumulUnit}`, 'Cumulative']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Area type="monotone" dataKey="value"
                fill="url(#grad-cumul)" stroke="var(--accent)" strokeWidth={2}
                dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyNote>No activities to show cumulative trend.</EmptyNote>}
      </Card>

      {/* ── Monthly sport balance ── */}
      <Card>
        <SectionTitle title="Monthly Sport Balance" note="Hours per sport" />
        {monthlyData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="h"   tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rec" orientation="right" domain={[0, 100]}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {topSports.map((s, i) => (
                <Bar key={s} yAxisId="h" dataKey={s} stackId="a"
                  fill={SPORT_COLORS[s] || `hsl(${i * 47}, 60%, 55%)`}
                  radius={i === topSports.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  isAnimationActive={false} />
              ))}
              {authStatus?.whoop && (
                <Line yAxisId="rec" type="monotone" dataKey="avgRec" name="Avg Recovery"
                  stroke="var(--good)" strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--good)', strokeWidth: 0 }}
                  connectNulls isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : <EmptyNote>Need multiple months of data.</EmptyNote>}
      </Card>

      {/* ── Consistency + Recovery vs Volume ── */}
      <TwoCol>
        <Card>
          <SectionTitle title="Weekly Consistency" />
          {consistencyData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={consistencyData} margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="days" domain={[0, 7]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rec" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar yAxisId="days" dataKey="activeDays" name="Active days"
                  fill="rgba(255,85,0,0.55)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="days" type="monotone" dataKey="sessions" name="Sessions"
                  stroke="var(--warn)" strokeWidth={1.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                {authStatus?.whoop && (
                  <Line yAxisId="rec" type="monotone" dataKey="avgRecovery" name="Avg Recovery"
                    stroke="var(--good)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyNote>Not enough data.</EmptyNote>}
        </Card>

        <Card>
          <SectionTitle title="Recovery vs Volume" note="Monthly" />
          {recVsVolData.length > 1 && authStatus?.whoop ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={recVsVolData} margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="vol" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis yAxisId="rec" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  label={{ value: 'Recovery %', angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar yAxisId="vol" dataKey="volH" name="Volume (h)"
                  fill="rgba(255,85,0,0.45)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="rec" type="monotone" dataKey="rec" name="Avg Recovery"
                  stroke="var(--good)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--good)', strokeWidth: 0 }}
                  connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyNote>{!authStatus?.whoop ? 'Connect WHOOP to see recovery trend.' : 'Not enough data.'}</EmptyNote>}
        </Card>
      </TwoCol>

      {/* ── Performance trajectory ── */}
      <TwoCol>
        {runPaceData.length > 1 && (
          <Card>
            <SectionTitle title="Run Pace Trajectory" note="Weekly avg + 4-week trend" />
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={runPaceData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-run" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => formatPaceMinKm(v)} width={48} reversed />
                <Tooltip
                  formatter={(v, n) => [formatPaceMinKm(v), n]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="monotone" dataKey="avgPace"
                  fill="url(#grad-run)" stroke="none" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="avgPace" name="Weekly avg"
                  stroke="var(--accent)" strokeWidth={1.8} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="trend" name="4-week trend"
                  stroke="rgba(255,85,0,0.45)" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
              Y-axis reversed: lower = faster. Pace = moving_time ÷ distance.
            </p>
          </Card>
        )}

        {rideEffData.length > 1 && (
          <Card>
            <SectionTitle title="Ride Speed Trajectory" note="Weekly avg km/h + 4-week trend" accentColor="var(--warn)" />
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={rideEffData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-ride" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--warn)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--warn)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, n) => [`${v?.toFixed(1)} km/h`, n]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="monotone" dataKey="avgEff"
                  fill="url(#grad-ride)" stroke="none" connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="avgEff" name="Weekly avg"
                  stroke="var(--warn)" strokeWidth={1.8} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="trend" name="4-week trend"
                  stroke="rgba(245,166,35,0.45)" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        {runPaceData.length <= 1 && rideEffData.length <= 1 && (
          <Card>
            <EmptyNote>No run or ride data to show performance trajectory.</EmptyNote>
          </Card>
        )}
      </TwoCol>

    </PageWrapper>
  )
}
