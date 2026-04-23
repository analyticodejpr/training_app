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
import { useNavigate } from 'react-router-dom'
import { useCurrentWeekSchedule } from '../hooks/usePlanner'
import { NumberTicker } from '../components/ui/number-ticker'
import { AnimatedCircularProgressBar } from '../components/ui/animated-circular-progress-bar'
import { useSupabaseMetrics }    from '../hooks/useSupabaseMetrics'
import { useDateRange } from '../context/DateRangeContext'
import { recoveryColor, strainColor, msToHHMM } from '../utils/format'
import {
  PageWrapper, Panel, PanelHeader,
  EmptyNote, Loader,
} from '../components/ui'
import SmallMultiplesPanel    from '../components/SmallMultiplesPanel'
import RecoveryDriversChart   from '../components/RecoveryDriversChart'

export default function DashboardPage({ authStatus }) {
  const { filterByDate, label: periodLabel } = useDateRange()

  // Reads from Supabase daily_metrics — not live WHOOP API
  const { daily: whoopAll, loading } = useSupabaseMetrics(!!authStatus?.whoop, 90)

  const whoopFiltered = useMemo(() => filterByDate(whoopAll), [whoopAll, filterByDate])

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

      {/* ── Zone 1: KPI row ── */}
      {authStatus?.whoop && (
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

      {/* ── Zone 2: Trends ── */}
      {authStatus?.whoop && (
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
      )}

      {/* ── Zone 3: Recovery Drivers ── */}
      {authStatus?.whoop && latest && (
        <Panel>
          <RecoveryDriversChart
            today={latest}
            prevDay={prev}
            baseline={{ hrv_rmssd: base28.hrv, resting_hr: base28.rhr }}
          />
        </Panel>
      )}

      {/* ── Zone 4: Weekly Schedule ── */}
      <Panel>
        <PanelHeader title="This Week" note="Training Schedule" />
        <WeekScheduleWidget />
      </Panel>

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

// ── Weekly schedule widget ────────────────────────────────────────────────────

function WeekScheduleWidget() {
  const navigate = useNavigate()
  const { lifecycle, days, sessions, loading } = useCurrentWeekSchedule()
  const today = new Date().toISOString().slice(0, 10)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <Loader />
      </div>
    )
  }

  const hasDays = days.length > 0

  if (lifecycle === 'pre_start') {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.35 }}>⏳</div>
        <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Plan hasn't started yet
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, fontWeight: 450, maxWidth: 280, margin: '0 auto' }}>
          Your training plan starts soon. Check the Planner for details.
        </p>
      </div>
    )
  }

  if (!lifecycle || lifecycle === 'no_plan' || (!hasDays && lifecycle !== 'active')) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.35 }}>📅</div>
        <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
          No training plan yet
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55, fontWeight: 450, maxWidth: 280, margin: '0 auto 18px' }}>
          Build a personalised weekly schedule tailored to your fitness level and goals.
        </p>
        <button
          onClick={() => navigate('/planner')}
          style={{
            padding: '9px 22px',
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 650,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
        >
          Create a Plan →
        </button>
      </div>
    )
  }

  if (hasDays) {
    return (
      <div className="schedule-scroll">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          minWidth: 420,
        }}>
          {days.map(day => {
            const session = sessions.find(s => s.day_id === day.id)
            const isToday = day.day_date === today
            const isPast  = day.day_date < today
            return (
              <MiniDayCard
                key={day.id}
                day={day}
                session={session}
                isToday={isToday}
                isPast={isPast}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Active plan but schedule not generated yet
  return (
    <div style={{ textAlign: 'center', padding: '22px 20px' }}>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 450 }}>
        Your plan is ready — generate this week's schedule in the Planner.
      </p>
      <button
        onClick={() => navigate('/planner')}
        style={{
          padding: '8px 20px',
          borderRadius: 10,
          background: 'var(--accent)',
          color: '#fff',
          fontWeight: 650,
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Go to Planner →
      </button>
    </div>
  )
}

function MiniDayCard({ day, session, isToday, isPast }) {
  const d        = new Date(day.day_date + 'T12:00:00')
  const dayLabel = d.toLocaleDateString('en', { weekday: 'short' })
  const dateNum  = d.getDate()

  const dotColor = session?.is_key_session
    ? '#ef4444'
    : session
      ? 'var(--accent)'
      : 'var(--border-hi)'

  const sessionLabel = session
    ? (session.session_name || session.session_type || 'Train').slice(0, 9)
    : 'Rest'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '10px 4px',
      borderRadius: 10,
      background: isToday ? 'var(--accent-dim)' : 'var(--surface-2)',
      border: `1px solid ${isToday
        ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
        : 'var(--border)'}`,
      opacity: isPast ? 0.5 : 1,
      transition: 'opacity 0.15s',
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', lineHeight: 1,
        color: isToday ? 'var(--accent)' : 'var(--text-dim)',
      }}>
        {dayLabel}
      </span>
      <span style={{
        fontSize: 15, fontWeight: 800, lineHeight: 1.1,
        color: isToday ? 'var(--accent)' : 'var(--text)',
      }}>
        {dateNum}
      </span>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: dotColor,
        margin: '1px 0',
        boxShadow: session?.is_key_session ? `0 0 5px ${dotColor}` : 'none',
      }} />
      <span style={{
        fontSize: 8, color: 'var(--text-muted)', fontWeight: 500,
        textAlign: 'center', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100%', paddingInline: 2,
      }}>
        {sessionLabel}
      </span>
    </div>
  )
}

