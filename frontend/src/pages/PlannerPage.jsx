/**
 * PlannerPage — Route: /planner
 *
 * Minimal V1 UI for the AI training planner. Allows a user to:
 *   1. Create a training goal (intake form)
 *   2. Generate a plan from that goal
 *   3. View the full plan at week level (blocks + weeks)
 *
 * Layout:
 *   - If no goal: goal intake form
 *   - If goal but no plan: summary of goal + Generate Plan button
 *   - If plan active: plan overview (blocks list + weeks grid)
 *   - Current week is highlighted
 *   - Clear empty states for missing provider data
 */
import { useState } from 'react'
import { usePlanner, usePlannerGoal, useCurrentWeekSchedule } from '../hooks/usePlanner'
import { createGoal, generatePlan, generateSchedule, deletePlan } from '../utils/api'
import {
  PageWrapper, Card, Panel, PanelHeader, SectionTitle,
  Loader, EmptyNote, PillBtn, Inset, MetricBlock,
} from '../components/ui'
import { BorderBeam } from '../components/ui/border-beam'
import { ShimmerButton } from '../components/ui/shimmer-button'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS = {
  base_fitness:        'Base Fitness',
  race_5k:             '5K Race',
  race_10k:            '10K Race',
  race_half_marathon:  'Half Marathon',
  race_marathon:       'Marathon',
  triathlon:           'Triathlon',
  weight_loss:         'Weight Loss',
  general_performance: 'General Performance',
}

const BLOCK_TYPE_COLORS = {
  base:     '#6366f1',
  build:    '#f59e0b',
  peak:     '#ef4444',
  taper:    '#10b981',
  recovery: '#64748b',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlannerPage({ authStatus }) {
  const [refetchKey, setRefetchKey] = useState(0)
  const { goal, loading: goalLoading, error: goalError } = usePlannerGoal(refetchKey)
  const { cycle, blocks, weeks, loading: planLoading, error: planError, refetch: refetchPlan } = usePlanner(refetchKey)

  const [scheduleRefetchKey, setScheduleRefetchKey] = useState(0)
  const { lifecycle: schedLifecycle, scheduleCycle, week: schedWeek, days: schedDays,
          sessions: schedSessions, loading: schedLoading,
          error: schedError } = useCurrentWeekSchedule(scheduleRefetchKey)

  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState(null)
  const [showForm,      setShowForm]      = useState(false)
  const [genSched,      setGenSched]      = useState(false)
  const [genSchedError, setGenSchedError] = useState(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError,   setDeleteError]   = useState(null)

  const loading = goalLoading || planLoading

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      await generatePlan()
      setRefetchKey(k => k + 1)
      setScheduleRefetchKey(k => k + 1) // schedule may be invalidated
    } catch (err) {
      setGenError(err?.response?.data?.error || err.message || 'Plan generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateSchedule() {
    setGenSched(true)
    setGenSchedError(null)
    try {
      await generateSchedule()
      setScheduleRefetchKey(k => k + 1)
    } catch (err) {
      setGenSchedError(err?.response?.data?.error || err.message || 'Schedule generation failed.')
    } finally {
      setGenSched(false)
    }
  }

  async function handleDeletePlan() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePlan()
      setDeleteConfirm(false)
      setRefetchKey(k => k + 1)
      setScheduleRefetchKey(k => k + 1)
    } catch (err) {
      setDeleteError(err?.response?.data?.error || err.message || 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleGoalSaved() {
    setShowForm(false)
    if (cycle) {
      // Existing plan is now stale — regenerate it with the updated goal
      await handleGenerate()
    } else {
      setRefetchKey(k => k + 1)
    }
  }

  if (loading) return <Loader />

  return (
    <PageWrapper>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>
            Training Planner
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1.15 }}>
            {cycle ? 'Your Training Plan' : 'Plan Your Training'}
          </h1>
          {goal && (
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 450 }}>
              Goal: {GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}
              {goal.event_date ? ` · ${formatDate(goal.event_date)}` : ''}
              {' · '}{goal.level}
              {' · '}{goal.days_per_week}d/wk
            </p>
          )}
        </div>
        {goal && !showForm && (
          <PillBtn onClick={() => setShowForm(true)}>
            Change Goal
          </PillBtn>
        )}
      </div>

      {/* ── Data mode notice ── */}
      <DataModeNotice authStatus={authStatus} cycle={cycle} />

      {/* ── Goal form ── */}
      {(!goal || showForm) && (
        <GoalForm
          existing={goal}
          onSaved={handleGoalSaved}
          onCancel={goal ? () => setShowForm(false) : null}
        />
      )}

      {/* ── No goal yet, no form ── */}
      {!goal && !showForm && (
        <Card>
          <EmptyNote>Set a training goal above to generate your plan.</EmptyNote>
        </Card>
      )}

      {/* ── Goal exists, no plan yet ── */}
      {goal && !cycle && !showForm && (
        <Card>
          <SectionTitle title="Ready to Generate" />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.55 }}>
            Your goal is set. Click below to generate a personalised{' '}
            {!authStatus?.strava && !authStatus?.whoop
              ? 'starter plan based on your goal and experience level'
              : authStatus?.strava && authStatus?.whoop
                ? 'plan using your Strava training history and WHOOP recovery data'
                : authStatus?.strava
                  ? 'plan using your Strava training history'
                  : 'plan using your WHOOP recovery data'
            }.
          </p>
          {genError && (
            <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              {genError}
            </div>
          )}
          <ShimmerButton
            onClick={handleGenerate}
            disabled={generating}
            background={generating ? 'var(--surface-2)' : 'var(--accent)'}
            borderRadius="8px"
            style={{
              padding: '11px 22px',
              fontSize: 13,
              fontWeight: 650,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              opacity: generating ? 0.6 : 1,
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : 'Generate Training Plan'}
          </ShimmerButton>
        </Card>
      )}

      {/* ── Plan overview ── */}
      {goal && cycle && !showForm && (
        <>
          {/* Cycle meta grid */}
          <div style={cycleMetaGrid}>
            <StatCell label="Total Weeks"  value={cycle.total_weeks} />
            <StatCell label="Starts"       value={formatDate(cycle.start_date)} />
            <StatCell label="Ends"         value={formatDate(cycle.end_date)} />
            <StatCell label="Peak Volume"  value={`${cycle.target_peak_week_hours}h`} unit="/wk" />
            <StatCell label="Blocks"       value={blocks.length} />
          </div>

          {/* ── Current week schedule ── */}
          <CurrentWeekSchedule
            lifecycle={schedLifecycle}
            scheduleCycle={scheduleCycle || cycle}
            week={schedWeek}
            days={schedDays}
            sessions={schedSessions}
            loading={schedLoading}
            error={schedError}
            generating={genSched}
            genError={genSchedError}
            onGenerate={handleGenerateSchedule}
          />

          {/* Block summary */}
          {blocks.length > 0 && <BlockList blocks={blocks} weeks={weeks} />}

          {/* Week-level plan grid */}
          {weeks.length > 0 && <WeekGrid weeks={weeks} blocks={blocks} />}

          {/* Regenerate + Delete actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ ...generateBtnStyle(generating), padding: '8px 18px', fontSize: 12 }}
            >
              {generating ? 'Regenerating…' : 'Regenerate Plan'}
            </button>
            <button
              onClick={handleDeletePlan}
              disabled={deleting}
              style={{
                background: deleteConfirm ? 'var(--bad)' : 'var(--surface-2)',
                color: deleteConfirm ? '#fff' : 'var(--bad)',
                border: `1px solid ${deleteConfirm ? 'var(--bad)' : 'color-mix(in srgb, var(--bad) 35%, transparent)'}`,
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 650,
                cursor: deleting ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.18s',
                opacity: deleting ? 0.6 : 1,
              }}
              onMouseLeave={() => { if (!deleting) setDeleteConfirm(false) }}
            >
              {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm Delete' : 'Delete Plan'}
            </button>
            {!deleteConfirm && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Regenerating will create a new plan from the same goal.
              </span>
            )}
            {deleteConfirm && (
              <span style={{ fontSize: 11, color: 'var(--bad)' }}>
                This will permanently delete the plan and all sessions.
              </span>
            )}
          </div>
          {genError && (
            <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px' }}>
              {genError}
            </div>
          )}
          {deleteError && (
            <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px' }}>
              {deleteError}
            </div>
          )}
        </>
      )}
    </PageWrapper>
  )
}

// ── CurrentWeekSchedule ───────────────────────────────────────────────────────

const INTENSITY_COLORS = {
  easy:     '#10b981',
  moderate: '#f59e0b',
  hard:     '#ef4444',
}

const SPORT_ICONS = {
  Run:      '🏃',
  Ride:     '🚴',
  Swim:     '🏊',
  Strength: '🏋️',
  Any:      '⚡',
}

const DAY_LABELS = {
  monday:    'Mon',
  tuesday:   'Tue',
  wednesday: 'Wed',
  thursday:  'Thu',
  friday:    'Fri',
  saturday:  'Sat',
  sunday:    'Sun',
}

function CurrentWeekSchedule({ lifecycle, scheduleCycle, week, days, sessions, loading, error, generating, genError, onGenerate }) {
  const today = new Date().toISOString().split('T')[0]
  const hasSchedule = days.length > 0

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <SectionTitle title="This Week's Schedule" style={{ marginBottom: 0 }} />
        {hasSchedule && lifecycle === 'active' && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            style={{ ...generateBtnStyle(generating), padding: '6px 14px', fontSize: 11 }}
          >
            {generating ? 'Rebuilding…' : 'Rebuild Schedule'}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ padding: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>Loading schedule…</div>
      )}

      {!loading && error && (
        <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px' }}>
          {error}
        </div>
      )}

      {/* ── Pre-start state ── */}
      {!loading && !error && lifecycle === 'pre_start' && (
        <LifecycleNotice
          icon="⏳"
          color="var(--accent)"
          title="Plan hasn't started yet"
          message={`Your plan begins on ${formatDate(scheduleCycle?.start_date)}. Come back then to generate your first week's detailed schedule.`}
        />
      )}

      {/* ── Completed state ── */}
      {!loading && !error && lifecycle === 'completed' && (
        <LifecycleNotice
          icon="✅"
          color="#10b981"
          title="Plan complete"
          message={`This training plan ended on ${formatDate(scheduleCycle?.end_date)}. Generate a new goal and plan to keep training.`}
        />
      )}

      {/* ── Active, no schedule yet ── */}
      {!loading && !error && lifecycle === 'active' && !hasSchedule && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 420 }}>
            Generate a detailed session-by-session schedule for the current 7 days.
            Sessions are assigned based on your week targets, block phase, and experience level.
          </div>
          {genError && (
            <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px', width: '100%' }}>
              {genError}
            </div>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            style={generateBtnStyle(generating)}
          >
            {generating ? 'Generating…' : "Generate This Week's Schedule"}
          </button>
        </div>
      )}

      {/* ── Active, schedule exists ── */}
      {!loading && !error && hasSchedule && (
        <>
          {week && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
              Week {week.week_number} · {shortDate(week.week_start_date)} – {shortDate(week.week_end_date)}
              {week.is_recovery_week && (
                <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 600 }}>· Recovery Week</span>
              )}
            </div>
          )}
          {genError && (
            <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              {genError}
            </div>
          )}
          <div className="schedule-scroll">
            <div style={scheduleGridStyle}>
              {days.map(day => {
                const session = sessions.find(s => s.day_id === day.id)
                const isToday = day.day_date === today
                const isPast  = day.day_date < today
                return (
                  <DayCard
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
        </>
      )}
    </Card>
  )
}

function LifecycleNotice({ icon, color, title, message }) {
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
      padding: '14px 16px',
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 650, color, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 420 }}>{message}</div>
      </div>
    </div>
  )
}

function DayCard({ day, session, isToday, isPast }) {
  const color = session ? (INTENSITY_COLORS[session.intensity_zone] || 'var(--accent)') : 'var(--border)'
  const isRest = day.slot_type === 'rest'

  return (
    <div style={{
      border: isToday
        ? `1.5px solid ${color}`
        : `1px solid ${isRest ? 'var(--border)' : color + '40'}`,
      borderRadius: 'var(--radius-sm)',
      background: isToday ? `${color}08` : isPast ? 'transparent' : 'var(--surface-2)',
      padding: '12px 13px',
      opacity: isPast ? 0.55 : 1,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {session?.is_key_session && !isPast && (
        <BorderBeam colorFrom={color} colorTo={`${color}30`} duration={3} size={50} borderWidth={1.5} />
      )}
      {/* Today badge */}
      {isToday && (
        <div style={{
          position: 'absolute', top: -1, right: -1,
          background: color, color: '#fff',
          fontSize: 8, fontWeight: 800, letterSpacing: '0.05em',
          textTransform: 'uppercase', padding: '2px 7px',
          borderRadius: '0 var(--radius-sm) 0 6px',
        }}>
          Today
        </div>
      )}

      {/* Day label + date */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? color : 'var(--text-dim)', letterSpacing: '0.04em' }}>
          {DAY_LABELS[day.day_of_week] || day.day_of_week}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>
          {shortDate(day.day_date)}
        </span>
      </div>

      {/* Rest day */}
      {isRest && (
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 450 }}>Rest</div>
      )}

      {/* Session */}
      {session && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14 }}>{SPORT_ICONS[session.sport] || '⚡'}</span>
            <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)', lineHeight: 1.2 }}>
              {session.sport}
            </span>
            {session.is_key_session && (
              <span style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.05em',
                textTransform: 'uppercase', color: color,
                background: `${color}18`, padding: '1px 5px', borderRadius: 4,
              }}>
                Key
              </span>
            )}
          </div>

          {/* Duration + intensity */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="metric-mono" style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {session.prescribed_minutes}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>min</span>
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color,
              background: `${color}15`, padding: '2px 6px', borderRadius: 4,
            }}>
              {session.intensity_zone}
            </span>
          </div>

          {/* Session type label */}
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>
            {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)}
          </div>

          {/* Instructions (collapsed, first sentence only) */}
          <div style={{
            fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45,
            borderTop: `1px solid ${color}20`, paddingTop: 7, marginTop: 2,
          }}>
            {firstSentence(session.instructions)}
          </div>
        </>
      )}
    </div>
  )
}

function firstSentence(text) {
  if (!text) return ''
  const match = text.match(/^[^.!?]+[.!?]/)
  return match ? match[0] : text.slice(0, 90) + (text.length > 90 ? '…' : '')
}

const scheduleGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 8,
}

// ── GoalForm ──────────────────────────────────────────────────────────────────

const GOAL_TYPES = [
  { value: 'base_fitness',        label: 'Base Fitness' },
  { value: 'race_5k',             label: '5K Race' },
  { value: 'race_10k',            label: '10K Race' },
  { value: 'race_half_marathon',  label: 'Half Marathon' },
  { value: 'race_marathon',       label: 'Marathon' },
  { value: 'triathlon',           label: 'Triathlon' },
  { value: 'weight_loss',         label: 'Weight Loss' },
  { value: 'general_performance', label: 'General Performance' },
]

const LEVELS = [
  { value: 'beginner',     label: 'Beginner',     note: '< 1 year consistent training' },
  { value: 'intermediate', label: 'Intermediate', note: '1–3 years consistent training' },
  { value: 'advanced',     label: 'Advanced',     note: '3+ years consistent training' },
]

const DAYS = [1, 2, 3, 4, 5, 6, 7]

function GoalForm({ existing, onSaved, onCancel }) {
  const [form, setForm] = useState({
    goal_type:     existing?.goal_type     || 'base_fitness',
    level:         existing?.level         || 'intermediate',
    days_per_week: existing?.days_per_week || 4,
    event_date:    existing?.event_date    || '',
    event_name:    existing?.event_name    || '',
    primary_sport: existing?.primary_sport || '',
    notes:         existing?.notes         || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const needsEventDate = ['race_5k','race_10k','race_half_marathon','race_marathon','triathlon'].includes(form.goal_type)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createGoal({
        ...form,
        days_per_week: Number(form.days_per_week),
        event_date:    form.event_date || null,
        event_name:    form.event_name || null,
        primary_sport: form.primary_sport || null,
        notes:         form.notes || null,
      })
      onSaved()
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <SectionTitle title={existing ? 'Update Goal' : 'Set Your Training Goal'} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Goal type */}
        <FormField label="What are you training for?">
          <div style={pillGrid}>
            {GOAL_TYPES.map(g => (
              <PillBtn
                key={g.value}
                active={form.goal_type === g.value}
                onClick={() => set('goal_type', g.value)}
              >
                {g.label}
              </PillBtn>
            ))}
          </div>
        </FormField>

        {/* Event date (conditional) */}
        {needsEventDate && (
          <FormField label="Race / event date" hint="When is your target event?">
            <input
              type="date"
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
              style={inputStyle}
              min={new Date().toISOString().split('T')[0]}
            />
          </FormField>
        )}

        {/* Level */}
        <FormField label="Experience level">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LEVELS.map(l => (
              <label key={l.value} style={levelRowStyle(form.level === l.value)}>
                <input
                  type="radio"
                  name="level"
                  value={l.value}
                  checked={form.level === l.value}
                  onChange={() => set('level', l.value)}
                  style={{ accentColor: 'var(--accent)', marginRight: 10 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{l.note}</div>
                </div>
              </label>
            ))}
          </div>
        </FormField>

        {/* Days per week */}
        <FormField label="Training days per week">
          <div style={pillGrid}>
            {DAYS.map(d => (
              <PillBtn
                key={d}
                active={form.days_per_week === d}
                onClick={() => set('days_per_week', d)}
              >
                {d}d
              </PillBtn>
            ))}
          </div>
        </FormField>

        {/* Optional notes */}
        <FormField label="Notes (optional)" hint="Injuries, constraints, priorities — anything helpful.">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="e.g. Prefer running over cycling, right knee niggle…"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </FormField>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-dim)', borderRadius: 8, padding: '10px 14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving}
            style={generateBtnStyle(saving)}
          >
            {saving ? 'Saving…' : existing ? 'Update Goal' : 'Save Goal'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          )}
        </div>

      </form>
    </Card>
  )
}

// ── BlockList ─────────────────────────────────────────────────────────────────

function BlockList({ blocks, weeks }) {
  const [openBlock, setOpenBlock] = useState(null)
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <SectionTitle title="Training Blocks" note={`${blocks.length} blocks`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {blocks.map(block => {
          const blockWeeks    = weeks.filter(w => w.block_id === block.id)
          const recoveryWeeks = blockWeeks.filter(w => w.is_recovery_week).length
          const color         = BLOCK_TYPE_COLORS[block.block_type] || 'var(--accent)'
          const isOpen        = openBlock === block.id

          return (
            <Inset key={block.id} style={{ borderLeft: `3px solid ${color}`, padding: 0 }}>
              {/* ── Block header (clickable) ── */}
              <button
                onClick={() => setOpenBlock(isOpen ? null : block.id)}
                style={{
                  all: 'unset', display: 'block', width: '100%', cursor: 'pointer',
                  padding: '12px 14px', boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Block {block.block_number} · {block.block_type}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)', marginBottom: 3 }}>
                      {block.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {block.objective}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {block.total_weeks} weeks
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      wk {block.start_week}–{block.end_week}
                    </span>
                    {recoveryWeeks > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {recoveryWeeks} recovery
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                      {isOpen ? '▲ hide weeks' : '▼ show weeks'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge label="Volume" value={block.volume_trend} />
                  <Badge label="Intensity" value={block.intensity_trend} />
                  <Badge label="Load" value={`${block.target_load_pct}% of peak`} />
                </div>
              </button>

              {/* ── Expanded weeks ── */}
              {isOpen && blockWeeks.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                }}>
                  {blockWeeks.map(week => {
                    const isCurrent = todayStr >= week.week_start_date && todayStr <= week.week_end_date
                    const isPast    = todayStr > week.week_end_date
                    return (
                      <WeekCard
                        key={week.id}
                        week={week}
                        color={color}
                        blockType={block.block_type}
                        isCurrent={isCurrent}
                        isPast={isPast}
                      />
                    )
                  })}
                </div>
              )}
            </Inset>
          )
        })}
      </div>
    </Card>
  )
}

// ── WeekGrid ──────────────────────────────────────────────────────────────────

function WeekGrid({ weeks, blocks }) {
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <SectionTitle title="Week-by-Week Plan" note={`${weeks.length} weeks`} />
      <div style={weekGridStyle}>
        {weeks.map(week => {
          const block = blocks.find(b => b.id === week.block_id)
          const color = BLOCK_TYPE_COLORS[block?.block_type] || 'var(--accent)'
          const isCurrent = todayStr >= week.week_start_date && todayStr <= week.week_end_date
          const isPast    = todayStr > week.week_end_date

          return (
            <WeekCard
              key={week.id}
              week={week}
              color={color}
              blockType={block?.block_type}
              isCurrent={isCurrent}
              isPast={isPast}
            />
          )
        })}
      </div>
    </Card>
  )
}

function WeekCard({ week, color, blockType, isCurrent, isPast }) {
  return (
    <div style={{
      background: isCurrent ? `${color}10` : isPast ? 'var(--surface-2)' : 'var(--surface-2)',
      border: isCurrent
        ? `1.5px solid ${color}60`
        : week.is_recovery_week
          ? '1px dashed var(--border)'
          : '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 14px',
      position: 'relative',
      opacity: isPast ? 0.6 : 1,
    }}>
      {/* Current week badge */}
      {isCurrent && (
        <div style={{
          position: 'absolute', top: -1, right: -1,
          background: color, color: '#fff',
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '2px 7px',
          borderRadius: '0 var(--radius-sm) 0 6px',
        }}>
          Current
        </div>
      )}

      {/* Week header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          WK {week.week_number}
        </span>
        {week.is_recovery_week && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Recovery
          </span>
        )}
        {!week.is_recovery_week && blockType && (
          <span style={{ fontSize: 9, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {blockType}
          </span>
        )}
      </div>

      {/* Theme */}
      <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)', marginBottom: 6, lineHeight: 1.2 }}>
        {week.theme}
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <WeekStat label="Vol" value={`${week.target_volume_hours}h`} color={color} />
        <WeekStat label="Sessions" value={week.target_sessions} />
        <WeekStat label="Long" value={`${week.target_long_session_hours}h`} />
        {week.target_hard_sessions > 0 && (
          <WeekStat label="Hard" value={week.target_hard_sessions} color="var(--bad)" />
        )}
      </div>

      {/* Date range */}
      <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 7 }}>
        {shortDate(week.week_start_date)} – {shortDate(week.week_end_date)}
      </div>
    </div>
  )
}

function WeekStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className="metric-mono" style={{ fontSize: 14, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  )
}

// ── DataModeNotice ────────────────────────────────────────────────────────────

function DataModeNotice({ authStatus, cycle }) {
  if (!cycle) return null // Only show when a plan exists
  const hasStrava = authStatus?.strava
  const hasWhoop  = authStatus?.whoop

  if (hasStrava && hasWhoop) return null // Full data — no notice needed

  const msg = !hasStrava && !hasWhoop
    ? 'No provider data connected. Your plan uses conservative defaults based on your goal and experience level. Connect Strava or WHOOP for a more personalised plan.'
    : !hasStrava
      ? 'Strava not connected. Volume targets are estimated from your WHOOP data and experience level. Connect Strava for activity-based planning.'
      : 'WHOOP not connected. Recovery data is unavailable. Connect WHOOP to factor readiness into your plan.'

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 16px',
      fontSize: 12,
      color: 'var(--text-dim)',
      lineHeight: 1.5,
    }}>
      <span style={{ fontWeight: 650, color: 'var(--text-muted)' }}>
        {!hasStrava && !hasWhoop ? 'Low-data mode: ' : 'Partial-data mode: '}
      </span>
      {msg}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function FormField({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Badge({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function StatCell({ label, value, unit }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-dim)',
        lineHeight: 1,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, lineHeight: 1 }}>
        <span className="metric-mono" style={{
          fontSize: 22, fontWeight: 800,
          color: 'var(--text)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          wordBreak: 'break-word',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function shortDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// ── Style constants ───────────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--text)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
}

function levelRowStyle(active) {
  return {
    display: 'flex', alignItems: 'flex-start',
    cursor: 'pointer', padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)08' : 'var(--surface-2)',
  }
}

function generateBtnStyle(disabled) {
  return {
    background: disabled ? 'var(--surface-2)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px 22px',
    fontSize: 13,
    fontWeight: 650,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
  }
}

const pillGrid = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const weekGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
  gap: 10,
}

const cycleMetaGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gap: 10,
}
