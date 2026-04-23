/**
 * schedulerOrchestrator.js
 *
 * Orchestrates the full current-week schedule generation flow:
 *   1. Find the current active plan cycle
 *   2. Compute lifecycle state: pre_start | active | completed
 *   3. If active — find the current week, load block/goal/features
 *   4. Build deterministic schedule (days + sessions)
 *   5. Validate output
 *   6. Delete any existing schedule for this week (idempotent)
 *   7. Persist days and sessions
 *   8. Return the schedule with lifecycle state
 *
 * Only this module writes to training_plan_days and training_plan_sessions.
 *
 * Lifecycle states
 * ─────────────────
 *   pre_start  — cycle exists but today < start_date
 *   active     — today is within start_date..end_date (inclusive)
 *   completed  — cycle exists but today > end_date
 *   no_plan    — no active cycle at all
 */
'use strict';

const { supabase }           = require('../db/supabase');
const { buildSchedule, validateSchedule } = require('./scheduler');
const { loadSlugMap }        = require('./workoutLibrary');
const { computeSchedulingContext } = require('./plannerScoring');

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

/**
 * Compute the lifecycle state of a plan cycle relative to today.
 *
 * @param {object} cycle — training_plan_cycles row (must have start_date, end_date)
 * @returns {'pre_start'|'active'|'completed'}
 */
function getCycleLifecycle(cycle) {
  const today = new Date().toISOString().split('T')[0];
  if (today < cycle.start_date) return 'pre_start';
  if (today > cycle.end_date)   return 'completed';
  return 'active';
}

// ── Schedule generation ───────────────────────────────────────────────────────

/**
 * Generate and persist the current-week schedule for the given user.
 *
 * @param {string} userId
 * @returns {{ lifecycle, week, days, sessions, cycle }}
 * @throws if no active cycle, lifecycle is not 'active', or validation fails
 */
async function generateAndPersistSchedule(userId) {
  // ── 1. Load active cycle ──────────────────────────────────────────────────
  const { data: cycle, error: cycleErr } = await supabase
    .from('training_plan_cycles')
    .select('id, goal_id, features_id, start_date, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cycleErr) throw new Error(`cycle fetch: ${cycleErr.message}`);
  if (!cycle)   throw new Error('No active training plan. Generate a plan first.');

  // ── 2. Lifecycle check ────────────────────────────────────────────────────
  const lifecycle = getCycleLifecycle(cycle);

  if (lifecycle === 'pre_start') {
    throw Object.assign(
      new Error(`Plan has not started yet. It begins on ${cycle.start_date}.`),
      { lifecycle, cycle, code: 'PRE_START' },
    );
  }

  if (lifecycle === 'completed') {
    throw Object.assign(
      new Error(`Plan ended on ${cycle.end_date}. No new schedule rows will be generated.`),
      { lifecycle, cycle, code: 'COMPLETED' },
    );
  }

  // ── 3. Find current week (today falls within week_start_date..week_end_date)
  const today = new Date().toISOString().split('T')[0];

  const { data: weekRow, error: weekErr } = await supabase
    .from('training_plan_weeks')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', userId)
    .lte('week_start_date', today)
    .gte('week_end_date',   today)
    .limit(1)
    .maybeSingle();

  if (weekErr) throw new Error(`week fetch: ${weekErr.message}`);
  if (!weekRow) throw new Error(
    'No current week found in your plan. Your plan may not have started yet or may have ended.'
  );

  // ── 4. Load block ─────────────────────────────────────────────────────────
  const { data: blockRow, error: blockErr } = await supabase
    .from('training_plan_blocks')
    .select('*')
    .eq('id', weekRow.block_id)
    .maybeSingle();

  if (blockErr) throw new Error(`block fetch: ${blockErr.message}`);
  if (!blockRow) throw new Error('Block not found for current week.');

  // ── 5. Load goal ──────────────────────────────────────────────────────────
  const { data: goal, error: goalErr } = await supabase
    .from('training_goals')
    .select('*')
    .eq('id', cycle.goal_id)
    .maybeSingle();

  if (goalErr) throw new Error(`goal fetch: ${goalErr.message}`);
  if (!goal) throw new Error('Goal not found for active cycle.');

  // ── 6. Load features (may be null for low-data users) ────────────────────
  let features = null;
  if (cycle.features_id) {
    const { data: featRow } = await supabase
      .from('derived_training_features')
      .select(
        'primary_sport, has_strava, has_whoop,' +
        'avg_recovery_28d, hrv_trend, recovery_trend,' +
        'consistency_score, active_weeks_of_last_4,' +
        'sessions_per_week, volume_28d_hours'
      )
      .eq('id', cycle.features_id)
      .maybeSingle();
    features = featRow || null;
  }

  // ── 7. Compute scheduling context (readiness + load tolerance) ────────────
  const scoringCtx = computeSchedulingContext(features);

  if (scoringCtx.intensityCapReason) {
    console.log(
      `[scheduler] Intensity cap applied for user ${userId}: ${scoringCtx.intensityCapReason}`
    );
  }

  // ── 8. Build schedule ─────────────────────────────────────────────────────
  const { days, sessions } = buildSchedule(weekRow, blockRow, goal, features, scoringCtx);

  // ── 9. Validate ───────────────────────────────────────────────────────────
  const { valid, errors } = validateSchedule(days, sessions, weekRow);
  if (!valid) {
    throw new Error(`Schedule validation failed:\n${errors.join('\n')}`);
  }

  // ── 9. Load workout slug → DB id map for FK references ───────────────────
  const slugMap = await loadSlugMap(supabase);

  // ── 10. Delete existing schedule for this week (idempotent regeneration) ──
  //
  // Delete by date range rather than week_id so that leftover days from a
  // previous plan cycle (which had different week_ids but the same dates)
  // are also removed — preventing the (user_id, day_date) unique constraint
  // violation on re-insert.
  const { error: delErr } = await supabase
    .from('training_plan_days')
    .delete()
    .eq('user_id', userId)
    .gte('day_date', weekRow.week_start_date)
    .lte('day_date', weekRow.week_end_date);
  if (delErr) throw new Error(`delete existing days: ${delErr.message}`);

  // ── 11. Persist days ──────────────────────────────────────────────────────
  const daysPayload = days.map(d => ({
    user_id:     userId,
    cycle_id:    cycle.id,
    week_id:     weekRow.id,
    day_date:    d.day_date,
    day_of_week: d.day_of_week,
    slot_type:   d.slot_type,
  }));

  const { data: dayRows, error: dayErr } = await supabase
    .from('training_plan_days')
    .insert(daysPayload)
    .select('id, day_of_week, day_date, slot_type');
  if (dayErr) throw new Error(`days insert: ${dayErr.message}`);

  // Build a day_of_week → persisted id map
  const dayIdMap = {};
  for (const d of dayRows) dayIdMap[d.day_of_week] = d.id;

  // ── 12. Persist sessions ──────────────────────────────────────────────────
  const sessionsPayload = sessions.map(s => ({
    user_id:            userId,
    day_id:             dayIdMap[s.day_of_week],
    workout_id:         slugMap[s.workout_slug] || null,
    sport:              s.sport,
    session_type:       s.session_type,
    prescribed_minutes: s.prescribed_minutes,
    intensity_zone:     s.intensity_zone,
    instructions:       s.instructions,
    rationale:          s.rationale,
    is_key_session:     s.is_key_session,
    status:             'planned',
  }));

  const { data: sessionRows, error: sessErr } = await supabase
    .from('training_plan_sessions')
    .insert(sessionsPayload)
    .select('*');
  if (sessErr) throw new Error(`sessions insert: ${sessErr.message}`);

  console.log(
    `[scheduler] Generated week ${weekRow.week_number} schedule for user ${userId}: ` +
    `${sessions.length} sessions, block=${blockRow.block_type}, recovery=${weekRow.is_recovery_week}`
  );

  return {
    lifecycle,
    cycle,
    week:     weekRow,
    days:     dayRows,
    sessions: sessionRows,
  };
}

// ── Schedule read ─────────────────────────────────────────────────────────────

/**
 * Load the current-week schedule for a user (read path).
 *
 * Always returns a lifecycle state. Returns null days/sessions when:
 *   - no plan exists (no_plan)
 *   - plan hasn't started (pre_start)
 *   - plan has ended (completed)
 *   - plan is active but no schedule generated yet (active, days=[])
 *
 * @param {string} userId
 * @returns {{ lifecycle, cycle, week, days, sessions }}
 */
async function getCurrentWeekSchedule(userId) {
  const today = new Date().toISOString().split('T')[0];

  // Find active cycle
  const { data: cycle, error: cycleErr } = await supabase
    .from('training_plan_cycles')
    .select('id, start_date, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cycleErr) throw new Error(cycleErr.message);

  if (!cycle) {
    return { lifecycle: 'no_plan', cycle: null, week: null, days: [], sessions: [] };
  }

  const lifecycle = getCycleLifecycle(cycle);

  if (lifecycle !== 'active') {
    return { lifecycle, cycle, week: null, days: [], sessions: [] };
  }

  // Find current week
  const { data: weekRow, error: weekErr } = await supabase
    .from('training_plan_weeks')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', userId)
    .lte('week_start_date', today)
    .gte('week_end_date',   today)
    .limit(1)
    .maybeSingle();

  if (weekErr) throw new Error(weekErr.message);
  if (!weekRow) {
    return { lifecycle, cycle, week: null, days: [], sessions: [] };
  }

  // Fetch days for this week
  const { data: days, error: daysErr } = await supabase
    .from('training_plan_days')
    .select('*')
    .eq('week_id', weekRow.id)
    .eq('user_id', userId)
    .order('day_date', { ascending: true });

  if (daysErr) throw new Error(daysErr.message);

  if (!days || days.length === 0) {
    // Plan is active but schedule not yet generated
    return { lifecycle, cycle, week: weekRow, days: [], sessions: [] };
  }

  // Fetch sessions for all these days
  const dayIds = days.map(d => d.id);
  const { data: sessions, error: sessErr } = await supabase
    .from('training_plan_sessions')
    .select('*')
    .in('day_id', dayIds)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (sessErr) throw new Error(sessErr.message);

  return { lifecycle, cycle, week: weekRow, days: days || [], sessions: sessions || [] };
}

module.exports = { generateAndPersistSchedule, getCurrentWeekSchedule, getCycleLifecycle };
