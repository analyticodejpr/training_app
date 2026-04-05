/**
 * DashboardPage — Daily decision dashboard (route: /)
 *
 * Answers: "What is my current state and what should I understand today?"
 *
 * Sections:
 * 1. Recovery hero + companion metrics (emotional focal point)
 * 2. Small multiples — aligned time series (recovery, HRV, RHR, sleep, strain)
 * 3. Readiness vs Load — quadrant scatter
 * 4. Acute vs Chronic load
 * 5. Training + Recovery heatmap calendar
 */
import { useMemo } from 'react'
import { useWhoop }  from '../hooks/useWhoop'
import { useStrava } from '../hooks/useStrava'
import { useDateRange } from '../context/DateRangeContext'
import { buildDailyGrain } from '../utils/metrics'
import { recoveryColor, strainColor, msToHHMM } from '../utils/format'
import {
  PageWrapper, Card, SectionTitle,
  EmptyNote, Loader,
} from '../components/ui'
import SmallMultiplesPanel from '../components/SmallMultiplesPanel'
import ReadinessScatter    from '../components/ReadinessScatter'
import AcuteChronicChart   from '../components/AcuteChronicChart'
import HeatmapCalendar     from '../components/HeatmapCalendar'
import ConnectCard         from '../components/ConnectCard'

export default function DashboardPage({ authStatus }) {
  const { filterByDate, filterActivities, label: periodLabel } = useDateRange()

  const { daily: whoopAll, loading: wLoading } = useWhoop(authStatus?.whoop, 90)
  const { activities: actsAll, loading: sLoading } = useStrava(authStatus?.strava, 150)

  const loading = wLoading || sLoading

  const whoopFiltered = useMemo(() => filterByDate(whoopAll),    [whoopAll, filterByDate])
  const actsFiltered  = useMemo(() => filterActivities(actsAll), [actsAll, filterActivities])

  const dailyGrain          = useMemo(() => buildDailyGrain(whoopAll, actsAll),               [whoopAll, actsAll])
  const dailyGrainFiltered  = useMemo(() => buildDailyGrain(whoopFiltered, actsFiltered),     [whoopFiltered, actsFiltered])

  const latest = whoopAll.length ? whoopAll[whoopAll.length - 1] : null
  const prev   = whoopAll.length > 1 ? whoopAll[whoopAll.length - 2] : null

  const base28 = useMemo(() => {
    if (!whoopAll.length) return {}
    const window28 = whoopAll.slice(-28)
    const avg = (key) => {
      const vals = window28.filter(d => d[key] != null).map(d => d[key])
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    return { hrv: avg('hrv_rmssd'), rhr: avg('resting_hr'), recovery: avg('recovery_score') }
  }, [whoopAll])

  if (loading) return <Loader />

  return (
    <PageWrapper>

      {/* ── 1. Recovery hero ── */}
      {authStatus?.whoop
        ? <RecoveryHero latest={latest} prev={prev} base28={base28} />
        : authStatus?.strava
          ? <ConnectCard platform="WHOOP" message="Connect WHOOP to see your recovery, HRV, sleep and strain." />
          : <BothConnectCard />
      }

      {/* ── 2. Trends ── */}
      {authStatus?.whoop && (
        <Card>
          <SectionTitle title="Trends" note={periodLabel} />
          {whoopFiltered.length > 1
            ? <SmallMultiplesPanel data={whoopFiltered} />
            : <EmptyNote>No WHOOP data for this period. Try a wider range.</EmptyNote>}
        </Card>
      )}

      {/* ── 3. Readiness vs Load scatter ── */}
      {authStatus?.whoop && (
        <Card>
          <ReadinessScatter daily={whoopFiltered} dailyGrain={dailyGrainFiltered} />
        </Card>
      )}

      {/* ── 4. Acute vs Chronic load ── */}
      {authStatus?.whoop && (
        <Card>
          <AcuteChronicChart daily={whoopAll} dailyGrain={dailyGrain} />
        </Card>
      )}

      {/* ── 5. Heatmap calendar ── */}
      <Card>
        <HeatmapCalendar whoopDaily={whoopAll} activities={actsAll} />
        {!authStatus?.whoop && !authStatus?.strava && (
          <EmptyNote>Connect Strava or WHOOP to populate the calendar.</EmptyNote>
        )}
      </Card>

    </PageWrapper>
  )
}

// ── Recovery Hero ─────────────────────────────────────────────────────────────

function RecoveryHero({ latest, prev, base28 }) {
  const rec   = latest?.recovery_score
  const hrv   = latest?.hrv_rmssd
  const rhr   = latest?.resting_hr
  const slp   = latest?.sleep_performance
  const slpMs = latest?.sleep_duration_ms
  const str   = prev?.strain

  const recColor  = recoveryColor(rec)
  const recDelta  = rec != null && base28.recovery != null ? +(rec - base28.recovery).toFixed(1) : null
  const hrvDelta  = hrv != null && base28.hrv     != null ? +(hrv - base28.hrv).toFixed(1)       : null
  const rhrDelta  = rhr != null && base28.rhr     != null ? +(rhr - base28.rhr).toFixed(1)       : null

  const trend = recDelta == null ? null : recDelta > 3 ? '↑' : recDelta < -3 ? '↓' : '→'
  const trendColor = recDelta == null ? 'var(--text-muted)'
                   : recDelta > 3    ? 'var(--good)'
                   : recDelta < -3   ? 'var(--bad)'
                   : 'var(--warn)'

  // Choose readiness label
  const readinessLabel = rec == null ? 'No data'
    : rec >= 67 ? 'Ready to perform'
    : rec >= 34 ? 'Moderate readiness'
    : 'Prioritise recovery'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: `var(--shadow-sm), var(--inset-hi)${recColor !== 'var(--text-muted)' ? `, 0 0 60px ${recColor}14` : ''}`,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient radial glow tied to recovery score */}
      <div style={{
        position: 'absolute', top: -60, left: -60,
        width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${recColor}1a 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', gap: 0,
        flexWrap: 'wrap',
      }}>
        {/* ── Left: recovery focal point ── */}
        <div style={{
          padding: 'clamp(16px, 4vw, 28px) clamp(16px, 5vw, 36px)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 160,
          flex: '1 1 160px',
          position: 'relative',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
          }}>
            Recovery · Today
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, lineHeight: 1 }}>
            <span className="metric-mono" style={{
              fontSize: 'clamp(52px, 12vw, 80px)', fontWeight: 800,
              color: recColor, lineHeight: 1,
              letterSpacing: '-4px',
            }}>
              {rec != null ? Math.round(rec) : '—'}
            </span>
            {rec != null && (
              <span style={{ fontSize: 28, color: recColor, fontWeight: 600, paddingBottom: 6 }}>
                %
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 12, color: 'var(--text-muted)',
              fontWeight: 500,
            }}>
              {readinessLabel}
            </span>
            {trend && (
              <span style={{
                fontSize: 13, fontWeight: 800, color: trendColor,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                {trend}
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>
                  {recDelta != null ? `${recDelta > 0 ? '+' : ''}${recDelta} vs 28d` : ''}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{
          width: 1, background: 'var(--border)',
          margin: '20px 0', flexShrink: 0,
          alignSelf: 'stretch',
        }} />

        {/* ── Right: 2×2 companion metrics ── */}
        <div style={{
          flex: '1 1 200px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          background: 'var(--border)',
          overflow: 'hidden',
        }}>
          <CompanionCell
            label="HRV"
            value={hrv != null ? Math.round(hrv) : '—'}
            unit="ms"
            color="#818cf8"
            delta={hrvDelta != null ? `${hrvDelta >= 0 ? '+' : ''}${hrvDelta} vs 28d` : null}
            deltaGood={hrvDelta >= 0}
          />
          <CompanionCell
            label="Resting HR"
            value={rhr != null ? Math.round(rhr) : '—'}
            unit="bpm"
            color="var(--bad)"
            delta={rhrDelta != null ? `${rhrDelta >= 0 ? '+' : ''}${rhrDelta} vs 28d` : null}
            deltaGood={rhrDelta <= 0}
          />
          <CompanionCell
            label="Sleep"
            value={slp != null ? `${Math.round(slp)}` : '—'}
            unit="%"
            color="var(--warn)"
            sub={slpMs ? msToHHMM(slpMs) : null}
          />
          <CompanionCell
            label="Yesterday Strain"
            value={str != null ? str.toFixed(1) : '—'}
            unit=""
            color={strainColor(str)}
          />
        </div>
      </div>
    </div>
  )
}

function CompanionCell({ label, value, unit, color, delta, deltaGood, sub }) {
  return (
    <div style={{
      background: 'var(--surface)',
      padding: 'clamp(12px, 3vw, 18px) clamp(12px, 4vw, 22px)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-mono" style={{
          fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 800,
          color: color || 'var(--text)',
          lineHeight: 1, letterSpacing: '-0.5px',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div style={{ fontSize: 10, marginTop: 5, color: deltaGood ? 'var(--good)' : 'var(--bad)' }}>
          {delta}
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function BothConnectCard() {
  return (
    <Card>
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Connect your platforms
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto' }}>
          Link Strava and WHOOP to see your recovery, training load, and performance data.
        </p>
      </div>
    </Card>
  )
}
