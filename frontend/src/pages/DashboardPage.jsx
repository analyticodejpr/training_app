/**
 * DashboardPage — Home tab (route: /)
 *
 * Mobile design:
 * 1. Race countdown banner (if active goal with event date)
 * 2. Recovery donut hero + quick stats strip
 * 3. This week — training hours bar chart
 * 4. Today's workout gradient card
 * 5. Recent activities list
 * 6. 7-day recovery trend bubbles
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabaseMetrics }  from '../hooks/useSupabaseMetrics'
import { useSupabaseActivities } from '../hooks/useSupabaseActivities'
import { usePlannerGoal, useCurrentWeekSchedule } from '../hooks/usePlanner'
import { msToHHMM, activityIcon } from '../utils/format'

// ── Design helpers ─────────────────────────────────────────────────────────────

function recoveryColor(score) {
  if (score == null) return '#9CA3AF'
  if (score >= 67)   return '#34D399'
  if (score >= 34)   return '#FBBF24'
  return '#FB7185'
}

const SESSION_COLORS = {
  easy:          '#e04e1f',
  tempo:         '#FB923C',
  interval:      '#FBBF24',
  long:          '#059669',
  rest:          '#E5E7EB',
  cross_training:'#C084FC',
  strength:      '#C084FC',
  recovery:      '#94A3B8',
  default:       '#e04e1f',
}

function sessionColor(type) {
  return SESSION_COLORS[type] || SESSION_COLORS.default
}

const GOAL_LABELS = {
  base_fitness:        'Base Fitness',
  race_5k:             '5K Race',
  race_10k:            '10K Race',
  race_half_marathon:  'Half Marathon',
  race_marathon:       'Marathon',
  triathlon:           'Triathlon',
  weight_loss:         'Weight Loss',
  general_performance: 'General Performance',
}

function goalIcon(type) {
  if (!type) return '🎯'
  if (type.includes('marathon') || type.includes('5k') || type.includes('10k')) return '🏃'
  if (type === 'triathlon') return '🏊'
  if (type === 'weight_loss') return '⚡'
  return '🎯'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / 86400000)
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDistanceKm(meters) {
  if (!meters) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── SVG donut ring ─────────────────────────────────────────────────────────────

function DonutRing({ value, color, size = 140, stroke = 12 }) {
  const r   = (size / 2) - stroke
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(100, value || 0)) / 100)
  const cx = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EAECF0" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

// ── Mini bar chart for weekly hours ───────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function WeekBarChart({ dayHours }) {
  const maxH = Math.max(...dayHours.map(d => d.hours), 0.5)
  const today = new Date().getDay() // 0=Sun, 1=Mon...
  // convert to 0=Mon index
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
      {dayHours.map((d, i) => {
        const barH = Math.max(4, (d.hours / maxH) * 48)
        const isToday = i === todayIdx
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', height: barH,
              background: isToday ? '#e04e1f' : d.hours > 0 ? '#f9a87a' : '#EAECF0',
              borderRadius: 4,
              transition: 'height 0.5s cubic-bezier(0.4,0,0.2,1)',
            }} />
            <span style={{ fontSize: 10, color: isToday ? '#e04e1f' : '#9CA3AF', fontWeight: isToday ? 700 : 500 }}>
              {DAY_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage({ authStatus }) {
  const navigate = useNavigate()

  const { daily: whoopAll, loading: whoopLoading } = useSupabaseMetrics(!!authStatus?.whoop, 90)
  const { activities, loading: actsLoading }        = useSupabaseActivities(!!authStatus?.strava, 20)
  const { goal }                                    = usePlannerGoal()
  const { lifecycle, week: schedWeek, days: schedDays, sessions: schedSessions } =
    useCurrentWeekSchedule()

  const latest = whoopAll.length ? whoopAll[whoopAll.length - 1] : null
  const prev   = whoopAll.length > 1 ? whoopAll[whoopAll.length - 2] : null

  // 7-day recovery trend
  const trend7 = useMemo(() => {
    const slice = whoopAll.slice(-7)
    const days  = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    // Pad left if we have fewer than 7 days
    const padded = Array(Math.max(0, 7 - slice.length)).fill(null).concat(slice)
    return padded.map((d, i) => ({ label: days[i], score: d?.recovery_score ?? null }))
  }, [whoopAll])

  // Weekly training hours from schedule
  const dayHours = useMemo(() => {
    if (!schedDays.length) return Array(7).fill({ hours: 0 })
    return schedDays.map(day => {
      const daySessions = schedSessions.filter(s => s.day_id === day.id)
      const mins = daySessions.reduce((sum, s) => sum + (s.prescribed_minutes || 0), 0)
      return { hours: mins / 60, date: day.day_date }
    })
  }, [schedDays, schedSessions])

  // Total weekly hours
  const totalWeekHours = useMemo(
    () => dayHours.reduce((sum, d) => sum + d.hours, 0).toFixed(1),
    [dayHours]
  )

  // Today's sessions — and next upcoming session if today is a rest day
  const { todaySessions, nextSession } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const sortedDays = [...schedDays].sort((a, b) =>
      (a.day_date || '').localeCompare(b.day_date || '')
    )
    const todayDay = sortedDays.find(d => d.day_date?.slice(0, 10) === todayStr)
    const todaySess = todayDay
      ? schedSessions.filter(s => s.day_id === todayDay.id && s.session_type !== 'rest')
      : []

    // Find the next day after today that has sessions
    let nextSess = null
    let nextDayLabel = null
    if (!todaySess.length) {
      for (const day of sortedDays) {
        if ((day.day_date || '') <= todayStr) continue
        const sess = schedSessions.filter(s => s.day_id === day.id && s.session_type !== 'rest')
        if (sess.length) {
          nextSess = sess[0]
          const diffDays = Math.round(
            (new Date(day.day_date + 'T00:00:00Z') - new Date(todayStr + 'T00:00:00Z'))
            / 86400000
          )
          nextDayLabel = diffDays === 1
            ? 'Tomorrow'
            : day.day_of_week.charAt(0).toUpperCase() + day.day_of_week.slice(1)
          break
        }
      }
    }

    return {
      todaySessions: todaySess,
      nextSession:   nextSess ? { ...nextSess, dayLabel: nextDayLabel } : null,
    }
  }, [schedDays, schedSessions])

  const firstSession = todaySessions[0] || null

  // Race countdown
  const eventDate = goal?.event_date
  const daysLeft  = daysUntil(eventDate)

  // Loading state
  const loading = whoopLoading || actsLoading

  const rec  = latest?.recovery_score
  const hrv  = latest?.hrv_rmssd
  const slp  = latest?.sleep_performance
  const str  = prev?.strain

  const recColor = recoveryColor(rec)
  const readinessLabel =
    rec == null  ? 'No recovery data'
    : rec >= 67  ? 'Ready to perform'
    : rec >= 34  ? 'Moderate readiness'
    : 'Prioritise recovery'

  return (
    <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Race countdown ── */}
      {goal && eventDate && daysLeft != null && daysLeft >= 0 && (
        <div style={{
          background: 'linear-gradient(135deg,#1A1B23,#2D2E3D)',
          borderRadius: 20, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{goalIcon(goal.goal_type)}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                {GOAL_LABELS[goal.goal_type] || goal.goal_type}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                {formatDate(eventDate)}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#e04e1f', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {daysLeft}
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
              {daysLeft === 1 ? 'day left' : 'days left'}
            </div>
          </div>
        </div>
      )}

      {/* ── Recovery hero ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={eyebrow}>Recovery</div>
            <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{readinessLabel}</div>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Today</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <DonutRing value={rec ?? 0} color={recColor} size={120} stroke={11} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: recColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {rec != null ? Math.round(rec) : '—'}
              </span>
              {rec != null && <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>%</span>}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <StatPill label="HRV" value={hrv != null ? `${Math.round(hrv)} ms` : '—'} color="#e04e1f" />
            <StatPill label="Sleep" value={slp != null ? `${Math.round(slp)}%` : '—'} color="#22D3EE" />
            <StatPill label="Strain" value={str != null ? str.toFixed(1) : '—'} color="#FB923C" />
          </div>
        </div>
      </div>

      {/* ── This week ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={eyebrow}>This Week</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              {totalWeekHours}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginLeft: 4 }}>hrs</span>
            </div>
          </div>
          {lifecycle === 'no_plan' && (
            <button
              onClick={() => navigate('/training')}
              style={pillLink}
            >
              Get a plan →
            </button>
          )}
        </div>
        <WeekBarChart dayHours={
          dayHours.length === 7 ? dayHours :
          Array.from({ length: 7 }, (_, i) => dayHours[i] || { hours: 0 })
        } />
      </div>

      {/* ── Today's workout ── */}
      {firstSession ? (
        <div
          onClick={() => navigate('/training')}
          style={{
            background: 'linear-gradient(135deg,#e04e1f,#f47c20)',
            borderRadius: 20, padding: '18px 20px', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
            Today's Workout
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: 10 }}>
            {firstSession.sport || ''} {firstSession.session_type || ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {firstSession.prescribed_minutes && (
              <span style={workoutPill}>{firstSession.prescribed_minutes} min</span>
            )}
            {firstSession.session_type && (
              <span style={workoutPill}>{firstSession.session_type}</span>
            )}
            {firstSession.sport && (
              <span style={workoutPill}>{firstSession.sport}</span>
            )}
          </div>
        </div>
      ) : nextSession ? (
        <div
          onClick={() => navigate('/training')}
          style={{
            background: 'linear-gradient(135deg,#1A1B23,#2D2E3D)',
            borderRadius: 20, padding: '18px 20px', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
            Rest Day · Next: {nextSession.dayLabel}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: 10 }}>
            {nextSession.sport || ''} {nextSession.session_type || ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextSession.prescribed_minutes && (
              <span style={{ ...workoutPill, background: 'rgba(255,255,255,0.1)' }}>{nextSession.prescribed_minutes} min</span>
            )}
            {nextSession.session_type && (
              <span style={{ ...workoutPill, background: 'rgba(255,255,255,0.1)' }}>{nextSession.session_type}</span>
            )}
            {nextSession.sport && (
              <span style={{ ...workoutPill, background: 'rgba(255,255,255,0.1)' }}>{nextSession.sport}</span>
            )}
          </div>
        </div>
      ) : lifecycle === 'active' ? (
        <div style={{ ...card, background: '#F9FAFB' }}>
          <div style={eyebrow}>Today's Workout</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4 }}>Rest day — recovery is training too.</div>
        </div>
      ) : lifecycle === 'no_plan' ? (
        <div
          onClick={() => navigate('/training')}
          style={{ ...card, background: 'linear-gradient(135deg,#e04e1f,#f47c20)', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
            Training Plan
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Create your personalised plan →
          </div>
        </div>
      ) : null}

      {/* ── Recent activities ── */}
      {authStatus?.strava && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={eyebrow}>Recent Activities</div>
            <button onClick={() => navigate('/activities')} style={pillLink}>See all →</button>
          </div>
          {loading ? (
            <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
          ) : activities.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13 }}>No activities yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activities.slice(0, 5).map(a => (
                <ActivityRow key={a.id} activity={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 7-day recovery trend ── */}
      {authStatus?.whoop && (
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>7-Day Recovery Trend</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {trend7.map((d, i) => {
              const c = recoveryColor(d.score)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: d.score != null ? `${c}22` : '#F3F4F6',
                    border: `2px solid ${d.score != null ? c : '#E5E7EB'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.score != null ? c : '#D1D5DB' }}>
                      {d.score != null ? Math.round(d.score) : '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No connections — nudge */}
      {!authStatus?.strava && !authStatus?.whoop && (
        <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1B23', marginBottom: 6 }}>
            Connect your providers
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 16 }}>
            Connect Strava and WHOOP to see your recovery scores, training load, and personalised insights.
          </div>
          <button
            onClick={() => navigate('/account')}
            style={{
              background: '#e04e1f', color: '#fff',
              border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Go to Profile
          </button>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: color || '#1A1B23', letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  )
}

function ActivityRow({ activity }) {
  const icon = activityIcon(activity.type) || '🏃'
  const date = activity.start_date
    ? new Date(activity.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid #F3F4F6',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: '#F5F6FA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activity.name || activity.type}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{date}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23' }}>
          {activity.distance ? formatDistanceKm(activity.distance) : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
          {activity.moving_time ? formatDuration(activity.moving_time) : ''}
        </div>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const card = {
  background: '#fff',
  borderRadius: 20,
  border: '1px solid #EAECF0',
  padding: '18px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const eyebrow = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4,
}

const pillLink = {
  fontSize: 12, fontWeight: 700, color: '#e04e1f',
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', padding: 0,
}

const workoutPill = {
  background: 'rgba(255,255,255,0.2)',
  borderRadius: 20, padding: '4px 10px',
  fontSize: 11, fontWeight: 700, color: '#fff',
  backdropFilter: 'blur(4px)',
}
