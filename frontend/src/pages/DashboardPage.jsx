/**
 * DashboardPage — Today (route: /)
 *
 * Nexus-style layout:
 * 1. KPI row          — Recovery · Sleep · Strain (3 compact cards)
 * 2. Main + aside     — 30d Trends (2/3) · Readiness Scatter (1/3)
 * 3. Full width       — Acute vs Chronic Load
 * 4. Full width       — Training + Recovery Heatmap
 * 5. Full width       — Recent Activities
 */
import { useMemo } from 'react'
import { NumberTicker } from '../components/ui/number-ticker'
import { AnimatedCircularProgressBar } from '../components/ui/animated-circular-progress-bar'
import { useSupabaseMetrics }    from '../hooks/useSupabaseMetrics'
import { useSupabaseActivities } from '../hooks/useSupabaseActivities'
import { useDateRange } from '../context/DateRangeContext'
import { buildDailyGrain } from '../utils/metrics'
import { recoveryColor, strainColor, msToHHMM } from '../utils/format'
import {
  PageWrapper, Panel, PanelHeader, TwoCol,
  EmptyNote, Loader,
} from '../components/ui'
import SmallMultiplesPanel from '../components/SmallMultiplesPanel'
import QuadrantScatter     from '../components/QuadrantScatter'
import AcuteChronicChart   from '../components/AcuteChronicChart'
import HeatmapCalendar     from '../components/HeatmapCalendar'
import ActivityList        from '../components/ActivityList'
import ConnectCard         from '../components/ConnectCard'
import StravaImportPanel   from '../components/StravaImportPanel'
import WhoopImportPanel    from '../components/WhoopImportPanel'

export default function DashboardPage({ authStatus }) {
  const { filterByDate, filterActivities, label: periodLabel } = useDateRange()

  // Reads from Supabase daily_metrics — not live WHOOP API
  const { daily: whoopAll, loading: wLoading } = useSupabaseMetrics(!!authStatus?.whoop, 90)
  const { activities: actsAll, loading: sLoading } = useSupabaseActivities(!!authStatus?.strava, 150)

  const loading = wLoading || sLoading

  const whoopFiltered = useMemo(() => filterByDate(whoopAll),    [whoopAll, filterByDate])
  const actsFiltered  = useMemo(() => filterActivities(actsAll), [actsAll, filterActivities])

  const dailyGrain         = useMemo(() => buildDailyGrain(whoopAll, actsAll),           [whoopAll, actsAll])
  const dailyGrainFiltered = useMemo(() => buildDailyGrain(whoopFiltered, actsFiltered), [whoopFiltered, actsFiltered])

  const latest = whoopAll.length ? whoopAll[whoopAll.length - 1] : null
  const prev   = whoopAll.length > 1 ? whoopAll[whoopAll.length - 2] : null

  const base28 = useMemo(() => {
    if (!whoopAll.length) return {}
    const w = whoopAll.slice(-28)
    const avg = key => {
      const vals = w.filter(d => d[key] != null).map(d => d[key])
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    return { hrv: avg('hrv_rmssd'), rhr: avg('resting_hr'), recovery: avg('recovery_score') }
  }, [whoopAll])

  if (loading) return <Loader />

  const anyConnected = authStatus?.strava || authStatus?.whoop

  // ── Derived KPI values ─────────────────────────────────────────────────────
  const rec   = latest?.recovery_score
  const slp   = latest?.sleep_performance
  const slpMs = latest?.sleep_duration_ms
  const str   = prev?.strain
  const hrv   = latest?.hrv_rmssd
  const rhr   = latest?.resting_hr

  const recDelta = rec != null && base28.recovery != null
    ? +(rec - base28.recovery).toFixed(1) : null
  const hrvDelta = hrv != null && base28.hrv != null
    ? +(hrv - base28.hrv).toFixed(1) : null
  const rhrDelta = rhr != null && base28.rhr != null
    ? +(rhr - base28.rhr).toFixed(1) : null

  const readinessLabel =
    rec == null ? null
    : rec >= 67 ? 'Ready to perform'
    : rec >= 34 ? 'Moderate readiness'
    : 'Prioritise recovery'

  return (
    <PageWrapper>

      {/* ── Sync bars ── */}
      {authStatus?.whoop  && <WhoopImportPanel />}
      {authStatus?.strava && <StravaImportPanel />}

      {/* ── Zone 1: KPI row ── */}
      {!anyConnected ? (
        <BothConnectCard />
      ) : !authStatus?.whoop ? (
        <ConnectCard
          platform="WHOOP"
          message="Connect WHOOP to see your recovery, HRV, sleep and strain."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            eyebrow="Recovery"
            label="Today"
            value={rec != null ? Math.round(rec) : '—'}
            unit="%"
            color={recoveryColor(rec)}
            badge={readinessLabel}
            delta={recDelta}
            deltaUnit="pts vs 28d"
            gauge
          />
          <KPICard
            eyebrow="Sleep"
            label="Last Night"
            value={slp != null ? Math.round(slp) : '—'}
            unit="%"
            color="#818cf8"
            sub={slpMs ? msToHHMM(slpMs) + ' slept' : null}
          />
          <KPICard
            eyebrow="Strain"
            label="Yesterday"
            value={str != null ? str.toFixed(1) : '—'}
            color={strainColor(str)}
            sub={
              str == null ? null
              : str >= 18 ? 'All Out'
              : str >= 14 ? 'Strenuous'
              : str >= 10 ? 'Moderate'
              : 'Light'
            }
          />
        </div>
      )}

      {/* ── Zone 2: Trends (2/3) + Scatter (1/3) ── */}
      {authStatus?.whoop && (
        <TwoCol ratio="2:1">
          <Panel pad="flush">
            <div style={{ padding: '20px 24px 14px' }}>
              <PanelHeader label={periodLabel} title="Trends" bottom={0} />
            </div>
            {whoopFiltered.length > 1
              ? <SmallMultiplesPanel data={whoopFiltered} />
              : <div style={{ padding: '0 24px 20px' }}>
                  <EmptyNote>No WHOOP data for this period. Try a wider range.</EmptyNote>
                </div>}
          </Panel>
          <Panel>
            <QuadrantScatter
              daily={whoopFiltered}
              dailyGrain={dailyGrainFiltered}
            />
          </Panel>
        </TwoCol>
      )}

      {/* ── Zone 3: Acute vs Chronic ── */}
      {authStatus?.whoop && (
        <Panel>
          <AcuteChronicChart daily={whoopAll} dailyGrain={dailyGrain} />
        </Panel>
      )}

      {/* ── Zone 4: Heatmap Calendar ── */}
      <Panel>
        <HeatmapCalendar whoopDaily={whoopAll} activities={actsAll} />
        {!anyConnected && (
          <EmptyNote>Connect Strava or WHOOP to populate the calendar.</EmptyNote>
        )}
      </Panel>

      {/* ── Zone 5: Recent Activities ── */}
      {authStatus?.strava && actsAll.length > 0 && (
        <Panel>
          <PanelHeader
            title="Recent Activities"
            note={`${Math.min(actsAll.length, 10)} sessions`}
          />
          <ActivityList activities={actsAll.slice(0, 10)} />
        </Panel>
      )}

    </PageWrapper>
  )
}

// ── KPI Card — Nexus-style metric tile ────────────────────────────────────────

function KPICard({ eyebrow, label, value, unit, color = 'var(--text)', badge, delta, deltaUnit, sub, gauge }) {
  const deltaPos = delta != null && delta > 0
  const deltaNeg = delta != null && delta < 0
  const isNumeric = typeof value === 'number'

  return (
    <div
      className="panel-surface"
      style={{
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: 'var(--shadow-sm), var(--inset-hi)',
      }}
    >
      {/* ── Top: eyebrow + label ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          lineHeight: 1,
        }}>
          {eyebrow}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {label}
        </span>
      </div>

      {/* ── Middle: gauge or big value ── */}
      {gauge && isNumeric ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AnimatedCircularProgressBar
            value={value}
            max={100}
            gaugePrimaryColor={color}
            gaugeSecondaryColor={`${color}22`}
            className="size-20 text-base font-bold"
            style={{ color }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {unit && (
              <span style={{ fontSize: 13, fontWeight: 600, color, opacity: 0.7 }}>{unit}</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, lineHeight: 1 }}>
          <span
            className="metric-mono"
            style={{
              fontSize: 46, fontWeight: 800,
              color,
              lineHeight: 1,
              letterSpacing: '-2.5px',
            }}
          >
            {isNumeric
              ? <NumberTicker value={value} className="tabular-nums" style={{ color, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }} />
              : value
            }
          </span>
          {unit && !gauge && (
            <span style={{
              fontSize: 20, fontWeight: 600,
              color, opacity: 0.65,
              paddingBottom: 5,
            }}>
              {unit}
            </span>
          )}
        </div>
      )}

      {/* ── Bottom: badge / delta / sub ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {delta != null && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 650,
            background: deltaPos
              ? 'var(--good-dim)'
              : deltaNeg ? 'var(--bad-dim)' : 'var(--surface-2)',
            color: deltaPos
              ? 'var(--good)'
              : deltaNeg ? 'var(--bad)' : 'var(--text-muted)',
          }}>
            {deltaPos ? '↑' : deltaNeg ? '↓' : '→'}&nbsp;
            {delta > 0 ? '+' : ''}{delta}
            {deltaUnit ? ` ${deltaUnit}` : ''}
          </span>
        )}
        {badge && !delta && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px',
            borderRadius: 999,
            background: `${color}12`,
            border: `1px solid ${color}28`,
            fontSize: 11.5, fontWeight: 600,
            color,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 5px ${color}`,
              flexShrink: 0,
            }} className="glow-pulse" />
            {badge}
          </span>
        )}
        {sub && (
          <span style={{
            fontSize: 12, color: 'var(--text-muted)',
            fontWeight: 500, letterSpacing: '-0.01em',
          }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Both-connect placeholder ───────────────────────────────────────────────────

function BothConnectCard() {
  return (
    <Panel style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 28, marginBottom: 14, opacity: 0.4 }}>⚡</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
        Connect your platforms
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto', lineHeight: 1.65, fontWeight: 450 }}>
        Link Strava and WHOOP to unlock your recovery, training load, and performance data.
      </p>
    </Panel>
  )
}
