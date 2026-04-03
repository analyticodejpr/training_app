/**
 * TrainingPage — Route: /training
 * "How am I training, and is the structure effective?"
 */
import { useState, useMemo } from 'react'
import { useWhoop }  from '../hooks/useWhoop'
import { useStrava } from '../hooks/useStrava'
import { useDateRange } from '../context/DateRangeContext'
import { computeSportMix, SPORT_COLORS } from '../utils/metrics'
import { activityIcon } from '../utils/format'
import {
  PageWrapper, Card, SectionTitle, TwoCol,
  EmptyNote, Loader, PillBtn,
} from '../components/ui'
import WeeklyCompositionChart from '../components/WeeklyCompositionChart'
import SessionCostScatter     from '../components/SessionCostScatter'
import PerformanceTrendChart  from '../components/PerformanceTrendChart'
import ActivityList           from '../components/ActivityList'
import ConnectCard            from '../components/ConnectCard'

export default function TrainingPage({ authStatus }) {
  const { filterActivities, filterByDate, label } = useDateRange()
  const [sportFilter, setSportFilter] = useState('All')

  const { daily: whoopAll, loading: wl } = useWhoop(authStatus?.whoop, 90)
  const { activities: actsAll, loading: sl } = useStrava(authStatus?.strava, 200)

  const loading = wl || sl

  const actsFiltered  = useMemo(() => filterActivities(actsAll), [actsAll, filterActivities])
  const whoopFiltered = useMemo(() => filterByDate(whoopAll),    [whoopAll, filterByDate])

  const sports = useMemo(() => ['All', ...new Set(actsFiltered.map(a => a.type || 'Other'))], [actsFiltered])

  const actsByType = useMemo(() =>
    sportFilter === 'All' ? actsFiltered : actsFiltered.filter(a => a.type === sportFilter),
    [actsFiltered, sportFilter])

  const sportMix = useMemo(() => computeSportMix(actsFiltered), [actsFiltered])

  if (!authStatus?.strava) {
    return (
      <PageWrapper>
        <ConnectCard platform="Strava" message="Connect Strava to analyse your training composition, load, and performance trends." />
      </PageWrapper>
    )
  }

  if (loading) return <Loader />

  return (
    <PageWrapper>

      {/* ── Weekly composition ── */}
      <Card>
        <WeeklyCompositionChart activities={actsFiltered} />
      </Card>

      {/* ── Session cost + Performance ── */}
      <TwoCol>
        <Card>
          <SessionCostScatter activities={actsFiltered} whoopDaily={whoopFiltered} />
          {!authStatus?.whoop && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
              Connect WHOOP to see how each session impacts next-day recovery.
            </p>
          )}
        </Card>
        <Card>
          <PerformanceTrendChart activities={actsFiltered} />
        </Card>
      </TwoCol>

      {/* ── Sport mix ── */}
      <Card>
        <SectionTitle title="Sport Mix" note={label} />
        {sportMix.length ? (
          <div style={sportGrid}>
            {sportMix.map(s => (
              <SportMixCard key={s.type} sport={s} />
            ))}
          </div>
        ) : <EmptyNote>No activities in this period.</EmptyNote>}
      </Card>

      {/* ── Activity table ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SectionTitle title="Activities" note={`${actsByType.length} sessions`} style={{ marginBottom: 0 }} />
          <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {sports.map(s => (
              <PillBtn key={s} active={sportFilter === s} onClick={() => setSportFilter(s)}>
                {s === 'All' ? 'All' : activityIcon(s) + ' ' + s}
              </PillBtn>
            ))}
          </div>
        </div>
        <ActivityList activities={actsByType} />
      </Card>

    </PageWrapper>
  )
}

function SportMixCard({ sport }) {
  const color = SPORT_COLORS[sport.type] || 'var(--text-muted)'
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: `1px solid ${color}28`,
      borderRadius: 'var(--radius-sm)',
      padding: '14px 16px',
      borderLeft: `3px solid ${color}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{activityIcon(sport.type)}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color }}>{sport.type}</span>
        <span className="metric-mono" style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color }}>
          {sport.pct}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{sport.count} sessions</span>
        <span>{sport.distKm} km</span>
        <span>~{sport.avgDurMin} min avg</span>
      </div>
    </div>
  )
}

const sportGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 10,
}
