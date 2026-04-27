/**
 * TrainingPage — Training tab (route: /training)
 *
 * Mobile planner UI:
 * 1. No goal → goal intake form
 * 2. Goal, no plan → generate plan CTA
 * 3. Plan active → week schedule with day cards + WorkoutSheet bottom sheet
 */
import { useState, useEffect, useRef } from 'react'
import { usePlanner, usePlannerGoal, useCurrentWeekSchedule } from '../hooks/usePlanner'
import { createGoal, generatePlan, generateSchedule, deletePlan } from '../utils/api'

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

const SESSION_COLORS = {
  easy:          '#6366F1',
  tempo:         '#FB923C',
  interval:      '#FBBF24',
  long:          '#059669',
  rest:          '#E5E7EB',
  cross_training:'#C084FC',
  strength:      '#C084FC',
  recovery:      '#94A3B8',
  default:       '#6366F1',
}

function sessionColor(type) { return SESSION_COLORS[type] || SESSION_COLORS.default }

const SESSION_EMOJIS = {
  easy: '🏃', tempo: '⚡', interval: '🔥', long: '🏔',
  rest: '😴', cross_training: '🚴', strength: '💪', recovery: '🧘',
}

function sessionEmoji(type) { return SESSION_EMOJIS[type] || '🏃' }

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatFullDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainingPage({ authStatus }) {
  const [refetchKey,         setRefetchKey]         = useState(0)
  const [scheduleRefetchKey, setScheduleRefetchKey] = useState(0)

  const { goal, loading: goalLoading } = usePlannerGoal(refetchKey)
  const { cycle, blocks, weeks, loading: planLoading } = usePlanner(refetchKey)
  const {
    lifecycle, week: schedWeek, days: schedDays, sessions: schedSessions,
    loading: schedLoading, error: schedError,
  } = useCurrentWeekSchedule(scheduleRefetchKey)

  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState(null)
  const [genSched,      setGenSched]      = useState(false)
  const [genSchedError, setGenSchedError] = useState(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError,   setDeleteError]   = useState(null)
  const [showForm,      setShowForm]      = useState(false)
  const [selectedDay,   setSelectedDay]   = useState(null) // day object for bottom sheet
  const [completedSessions, setCompletedSessions] = useState({})

  const loading = goalLoading || planLoading

  async function handleGenerate() {
    setGenerating(true); setGenError(null)
    try {
      await generatePlan()
      setRefetchKey(k => k + 1)
      setScheduleRefetchKey(k => k + 1)
    } catch (err) {
      setGenError(err?.response?.data?.error || err.message || 'Plan generation failed.')
    } finally { setGenerating(false) }
  }

  async function handleGenerateSchedule() {
    setGenSched(true); setGenSchedError(null)
    try {
      await generateSchedule()
      setScheduleRefetchKey(k => k + 1)
    } catch (err) {
      setGenSchedError(err?.response?.data?.error || err.message || 'Schedule generation failed.')
    } finally { setGenSched(false) }
  }

  async function handleDeletePlan() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true); setDeleteError(null)
    try {
      await deletePlan()
      setDeleteConfirm(false)
      setRefetchKey(k => k + 1)
      setScheduleRefetchKey(k => k + 1)
    } catch (err) {
      setDeleteError(err?.response?.data?.error || err.message || 'Delete failed.')
    } finally { setDeleting(false) }
  }

  async function handleGoalSaved() {
    setShowForm(false)
    if (cycle) { await handleGenerate() }
    else { setRefetchKey(k => k + 1) }
  }

  if (loading) return <PageLoader />

  // ── No goal yet ───────────────────────────────────────────────────────────
  if (!goal || showForm) {
    return (
      <div style={pageWrap}>
        {goal && (
          <button onClick={() => setShowForm(false)} style={backBtn}>← Back to plan</button>
        )}
        <GoalForm existing={goal} onSaved={handleGoalSaved} onCancel={goal ? () => setShowForm(false) : null} />
        <div style={{ height: 8 }} />
      </div>
    )
  }

  // ── Goal set, no plan ─────────────────────────────────────────────────────
  if (!cycle) {
    return (
      <div style={pageWrap}>
        <GoalSummary goal={goal} onEdit={() => setShowForm(true)} />
        {genError && <ErrorNote>{genError}</ErrorNote>}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={primaryBtn(generating)}
        >
          {generating ? 'Generating plan…' : 'Generate Training Plan ✦'}
        </button>
        <div style={{ height: 8 }} />
      </div>
    )
  }

  // ── Plan active ───────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div style={pageWrap}>
      {/* Plan header */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={eyebrow}>{GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.04em', lineHeight: 1.2 }}>
              {cycle.total_weeks}-Week Plan
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              {formatFullDate(cycle.start_date)} → {formatFullDate(cycle.end_date)}
            </div>
          </div>
          <button onClick={() => setShowForm(true)} style={editBtn}>Edit goal</button>
        </div>

        {/* Cycle meta strip */}
        <div style={{ display: 'flex', gap: 0, marginTop: 16, borderTop: '1px solid #F3F4F6', paddingTop: 14 }}>
          <MetaCell label="Weeks"  value={cycle.total_weeks} />
          <MetaCell label="Blocks" value={blocks.length} />
          <MetaCell label="Peak"   value={`${cycle.target_peak_week_hours}h/wk`} />
          <MetaCell label="Level"  value={goal.level} />
        </div>
      </div>

      {/* Current week schedule */}
      <WeekSchedule
        lifecycle={lifecycle}
        cycle={cycle}
        week={schedWeek}
        days={schedDays}
        sessions={schedSessions}
        loading={schedLoading}
        error={schedError}
        generating={genSched}
        genError={genSchedError}
        todayStr={todayStr}
        completedSessions={completedSessions}
        onSelectDay={setSelectedDay}
        onGenerate={handleGenerateSchedule}
      />

      {/* Blocks overview */}
      {blocks.length > 0 && (
        <div style={card}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Training Blocks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocks.map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: '#F9FAFB', borderRadius: 12,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: BLOCK_COLORS[b.block_type] || '#6366F1',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23' }}>
                    Block {b.block_number}: {b.block_type?.charAt(0).toUpperCase() + b.block_type?.slice(1)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    Wk {b.start_week}–{b.end_week} · {b.weeks_count} weeks
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ ...secondaryBtn, flex: 1, opacity: generating ? 0.5 : 1 }}
        >
          {generating ? 'Regenerating…' : 'Regenerate'}
        </button>
        <button
          onClick={handleDeletePlan}
          disabled={deleting}
          onMouseLeave={() => { if (!deleting) setDeleteConfirm(false) }}
          style={{
            flex: 1, padding: '12px', borderRadius: 12, border: 'none',
            cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700, transition: 'all 0.18s',
            background: deleteConfirm ? '#DC2626' : '#FEF2F2',
            color: deleteConfirm ? '#fff' : '#DC2626',
          }}
        >
          {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm?' : 'Delete Plan'}
        </button>
      </div>
      {deleteError && <ErrorNote>{deleteError}</ErrorNote>}

      {/* Workout bottom sheet */}
      {selectedDay && (
        <WorkoutSheet
          day={selectedDay}
          sessions={schedSessions.filter(s => s.day_id === selectedDay.id)}
          completed={completedSessions}
          onComplete={(sessionId) => setCompletedSessions(c => ({ ...c, [sessionId]: !c[sessionId] }))}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}

// ── Week schedule component ────────────────────────────────────────────────────

function WeekSchedule({ lifecycle, week, days, sessions, loading, error, generating, genError, todayStr, completedSessions, onSelectDay, onGenerate }) {
  if (loading) return <div style={{ ...card, color: '#9CA3AF', fontSize: 13 }}>Loading schedule…</div>

  if (lifecycle === 'no_plan') return null

  if (lifecycle === 'pre_start') {
    return (
      <div style={card}>
        <div style={eyebrow}>Current Week</div>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
          Your plan starts {week ? formatDate(week.start_date) : 'soon'}. Schedule will unlock then.
        </div>
      </div>
    )
  }

  if (!days.length) {
    return (
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>Current Week Schedule</div>
        {genError && <ErrorNote>{genError}</ErrorNote>}
        <button
          onClick={onGenerate}
          disabled={generating}
          style={primaryBtn(generating)}
        >
          {generating ? 'Building schedule…' : 'Build This Week\'s Schedule'}
        </button>
      </div>
    )
  }

  const currentWeekLabel = week
    ? `Week ${week.week_number} · ${formatDate(week.start_date)}–${formatDate(week.end_date)}`
    : 'Current Week'

  return (
    <div style={card}>
      <div style={{ ...eyebrow, marginBottom: 2 }}>Schedule</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 14 }}>{currentWeekLabel}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((day, i) => {
          const daySessions = sessions.filter(s => s.day_id === day.id)
          const isToday = day.date?.slice(0, 10) === todayStr
          const firstSession = daySessions[0]
          const isRest = !firstSession || firstSession.session_type === 'rest'
          const allCompleted = daySessions.length > 0 && daySessions.every(s => completedSessions[s.id])
          const type = firstSession?.session_type || 'rest'
          const color = sessionColor(type)
          const emoji = sessionEmoji(type)
          const dayName = DAY_NAMES[i] || `Day ${i + 1}`

          return (
            <button
              key={day.id}
              onClick={() => onSelectDay(day)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 14, border: 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                background: isToday ? '#F5F3FF' : allCompleted ? '#F0FDF4' : '#F9FAFB',
                borderWidth: 1, borderStyle: 'solid',
                borderColor: isToday ? '#C7D2FE' : allCompleted ? '#BBF7D0' : '#F3F4F6',
                fontFamily: 'inherit', transition: 'background 0.15s',
              }}
            >
              {/* Color dot */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: isRest ? '#F3F4F6' : `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>
                {allCompleted ? '✓' : emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? '#6366F1' : '#9CA3AF', letterSpacing: '-0.01em' }}>
                  {dayName}{isToday ? ' · Today' : ''}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B23', letterSpacing: '-0.02em', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isRest ? 'Rest Day' : firstSession.name || `${firstSession.sport || ''} ${type}`.trim()}
                </div>
                {firstSession?.duration_min > 0 && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {firstSession.duration_min} min
                    {daySessions.length > 1 ? ` · ${daySessions.length} sessions` : ''}
                  </div>
                )}
              </div>

              {!isRest && (
                <div style={{
                  flexShrink: 0, padding: '3px 8px', borderRadius: 8,
                  background: `${color}18`, fontSize: 11, fontWeight: 700, color: color,
                }}>
                  {type}
                </div>
              )}
              <span style={{ color: '#9CA3AF', fontSize: 16, flexShrink: 0 }}>›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Workout bottom sheet ──────────────────────────────────────────────────────

function WorkoutSheet({ day, sessions, completed, onComplete, onClose }) {
  const sheetRef = useRef(null)
  const firstSession = sessions[0]
  const isRest = !firstSession || firstSession.session_type === 'rest'

  // Close on backdrop click
  function handleBackdrop(e) {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose()
  }

  const type  = firstSession?.session_type || 'rest'
  const color = sessionColor(type)
  const emoji = sessionEmoji(type)

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%', maxHeight: '65vh',
          background: '#fff', borderRadius: '24px 24px 0 0',
          overflowY: 'auto',
          animation: 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E7EB' }} />
        </div>

        <div style={{ padding: '12px 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{emoji}</span>
                <span style={{
                  background: `${color}20`, color, borderRadius: 8,
                  padding: '2px 8px', fontSize: 11, fontWeight: 700,
                }}>
                  {type}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                {isRest ? 'Rest Day' : firstSession?.name || `${firstSession?.sport || ''} ${type}`.trim()}
              </div>
              {firstSession?.sport && !isRest && (
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>{firstSession.sport}</div>
              )}
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#F3F4F6', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#6B7280', fontFamily: 'inherit', flexShrink: 0,
            }}>×</button>
          </div>

          {/* Stat pills */}
          {!isRest && firstSession && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              <SheetStatPill label="Duration" value={firstSession.duration_min ? `${firstSession.duration_min}m` : '—'} />
              <SheetStatPill label="Type" value={type.charAt(0).toUpperCase() + type.slice(1)} />
              <SheetStatPill label="TSS" value={firstSession.tss_estimate ? Math.round(firstSession.tss_estimate) : '—'} />
              <SheetStatPill label="Cost" value={firstSession.recovery_cost ? `${firstSession.recovery_cost}/10` : '—'} />
            </div>
          )}

          {/* Multiple sessions */}
          {sessions.length > 1 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>All Sessions</div>
              {sessions.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#F9FAFB', borderRadius: 10, marginBottom: 6,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sessionColor(s.session_type), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23' }}>{s.name || s.session_type}</div>
                    {s.duration_min && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{s.duration_min} min</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {firstSession?.notes && !isRest && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                About this workout
              </div>
              <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
                {firstSession.notes}
              </p>
            </div>
          )}

          {/* Mark complete */}
          {!isRest && sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onComplete(s.id)}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 15, fontWeight: 700,
                background: completed[s.id] ? '#D1FAE5' : '#6366F1',
                color: completed[s.id] ? '#059669' : '#fff',
                marginTop: sessions.length > 1 ? 0 : 0,
                transition: 'all 0.2s',
              }}
            >
              {completed[s.id] ? '✓ Marked as Complete' : `Mark as Complete${sessions.length > 1 ? ` — ${s.session_type}` : ''}`}
            </button>
          ))}

          {isRest && (
            <div style={{ textAlign: 'center', padding: '16px 0 0', color: '#6B7280', fontSize: 14 }}>
              😴 Rest and recover. You've earned it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Goal form ─────────────────────────────────────────────────────────────────

function GoalForm({ existing, onSaved, onCancel }) {
  const [form, setForm] = useState({
    goal_type:    existing?.goal_type    || 'race_half_marathon',
    level:        existing?.level        || 'intermediate',
    days_per_week: existing?.days_per_week || 4,
    event_date:   existing?.event_date   || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await createGoal(form)
      onSaved()
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save goal.')
    } finally { setSaving(false) }
  }

  return (
    <div style={card}>
      <div style={eyebrow}>Training Goal</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.04em', marginBottom: 20 }}>
        {existing ? 'Update Your Goal' : 'Set Your Goal'}
      </div>

      <FormField label="Goal Type">
        <select value={form.goal_type} onChange={e => setForm(f => ({ ...f, goal_type: e.target.value }))} style={selectStyle}>
          {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FormField>

      <FormField label="Experience Level">
        <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} style={selectStyle}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </FormField>

      <FormField label="Days Per Week">
        <div style={{ display: 'flex', gap: 8 }}>
          {[2, 3, 4, 5, 6].map(d => (
            <button
              key={d}
              onClick={() => setForm(f => ({ ...f, days_per_week: d }))}
              style={{
                width: 40, height: 40, borderRadius: 10, border: 'none',
                cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                background: form.days_per_week === d ? '#6366F1' : '#F3F4F6',
                color: form.days_per_week === d ? '#fff' : '#6B7280',
                transition: 'all 0.15s',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Target Event Date (optional)">
        <input
          type="date"
          value={form.event_date}
          onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
          style={{ ...selectStyle, cursor: 'pointer' }}
        />
      </FormField>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
        )}
        <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn(saving), flex: 1 }}>
          {saving ? 'Saving…' : existing ? 'Update Goal' : 'Set Goal'}
        </button>
      </div>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function GoalSummary({ goal, onEdit }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={eyebrow}>Your Goal</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.04em', marginTop: 2 }}>
            {GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}
          </div>
        </div>
        <button onClick={onEdit} style={editBtn}>Edit</button>
      </div>
      <div style={{ display: 'flex', gap: 0, marginTop: 14, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
        <MetaCell label="Level"  value={goal.level} />
        <MetaCell label="Days/wk" value={goal.days_per_week} />
        {goal.event_date && <MetaCell label="Event" value={formatDate(goal.event_date)} />}
      </div>
    </div>
  )
}

function MetaCell({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #F3F4F6', padding: '0 8px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B23', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.02em', display: 'block', marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SheetStatPill({ label, value }) {
  return (
    <div style={{
      background: '#F9FAFB', borderRadius: 12, padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1B23', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ErrorNote({ children }) {
  return (
    <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
      {children}
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid #EAECF0', borderTopColor: '#6366F1',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const BLOCK_COLORS = {
  base: '#6366F1', build: '#F59E0B', peak: '#EF4444', taper: '#10B981', recovery: '#64748B',
}

const pageWrap = { padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }

const card = {
  background: '#fff', borderRadius: 20, border: '1px solid #EAECF0',
  padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const eyebrow = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4,
}

function primaryBtn(disabled) {
  return {
    width: '100%', padding: '14px', borderRadius: 14, border: 'none',
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    fontSize: 15, fontWeight: 700,
    background: disabled ? '#A5B4FC' : '#6366F1', color: '#fff',
    transition: 'opacity 0.15s',
  }
}

const secondaryBtn = {
  padding: '12px', borderRadius: 12, border: '1px solid #EAECF0',
  background: '#F9FAFB', color: '#6B7280',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
  transition: 'background 0.15s',
}

const editBtn = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #EAECF0',
  background: '#F9FAFB', color: '#6B7280', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, flexShrink: 0,
}

const backBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
  color: '#6366F1', padding: 0, textAlign: 'left',
}

const selectStyle = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #EAECF0', borderRadius: 12,
  background: '#F9FAFB', color: '#1A1B23',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  cursor: 'pointer',
}
