/**
 * plannerOrchestrator.js
 *
 * Orchestrates the full plan generation flow:
 *   1. Load active goal
 *   2. Build athlete context snapshot
 *   3. Compute derived training features
 *   4. Generate deterministic cycle, blocks, weeks
 *   5. Cancel previous active cycle (if any)
 *   6. Persist snapshot, features, cycle, blocks, weeks
 *   7. Return the new plan IDs
 *
 * This module is the only place that writes planner data to Supabase.
 * All business logic lives in the specialist service files.
 */
'use strict';

const { supabase }            = require('../db/supabase');
const { buildAthleteContext } = require('./athleteContext');
const { computeFeatures }     = require('./featureGenerator');
const { deriveAthleteState }  = require('./athleteState');
const { generatePlan }        = require('./planner');

/**
 * Generate and persist a full training plan for the given user and goal.
 *
 * @param {string} userId  - Supabase auth user ID
 * @param {string} goalId  - training_goals.id to plan for
 * @returns {object}       - { cycleId, blockCount, weekCount, dataMode }
 */
async function generateAndPersistPlan(userId, goalId) {
  // ── 1. Load goal ─────────────────────────────────────────────────────────
  const { data: goal, error: goalErr } = await supabase
    .from('training_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (goalErr) throw new Error(`goal fetch: ${goalErr.message}`);
  if (!goal)   throw new Error('Goal not found or not active.');

  // ── 2. Athlete context ────────────────────────────────────────────────────
  const context = await buildAthleteContext(userId);

  // ── 3. Feature generation ─────────────────────────────────────────────────
  const features = computeFeatures(context);

  // ── 4. Derived athlete state (rich planning inputs) ───────────────────────
  const athleteState = deriveAthleteState(goal, features);

  // ── 5. Plan generation (deterministic, throws on validation failure) ──────
  const { cycleParams, blocks, weeks } = generatePlan(goal, features, athleteState);

  // ── 6. Persist snapshot ───────────────────────────────────────────────────
  const snapshotPayload = {
    user_id:   userId,
    goal_id:   goalId,
    data_mode: context.dataMode,
    snapshot: {
      has_strava:     context.hasStrava,
      has_whoop:      context.hasWhoop,
      data_mode:      context.dataMode,
      activity_count: context.activities.length,
      metric_days:    context.dailyMetrics.length,
      window_days:    context.windowDays,
      snapshot_at:    context.snapshotAt,
      // Rich planning context derived from athlete state
      athlete_state_summary: {
        primary_goal_family:     athleteState.primary_goal_family,
        training_age_proxy:      athleteState.training_age_proxy,
        effective_level:         athleteState.effective_level,
        readiness_tier:          athleteState.readiness_tier,
        adherence_risk:          athleteState.adherence_risk,
        recovery_wave_pattern:   athleteState.recovery_wave_pattern,
        needs_readiness_block:   athleteState.needs_readiness_block,
        readiness_lead_in_weeks: athleteState.readiness_lead_in_weeks,
        chronic_load_28d:        athleteState.chronic_load_28d,
        acute_to_chronic_ratio:  athleteState.acute_to_chronic_ratio,
        max_single_session_28d:  athleteState.max_single_session_28d,
        sport_readiness_notes:   athleteState.sport_readiness?.notes || [],
      },
    },
  };

  const { data: snapshot, error: snapErr } = await supabase
    .from('athlete_context_snapshots')
    .insert(snapshotPayload)
    .select('id')
    .single();
  if (snapErr) throw new Error(`snapshot insert: ${snapErr.message}`);

  // ── 7. Persist features ───────────────────────────────────────────────────
  const featuresPayload = {
    user_id:     userId,
    snapshot_id: snapshot.id,
    ...features,
  };

  const { data: featuresRow, error: featErr } = await supabase
    .from('derived_training_features')
    .insert(featuresPayload)
    .select('id')
    .single();
  if (featErr) throw new Error(`features insert: ${featErr.message}`);

  // ── 8. Cancel any existing active cycle for this user ────────────────────
  const { error: cancelErr } = await supabase
    .from('training_plan_cycles')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (cancelErr) throw new Error(`cancel existing cycle: ${cancelErr.message}`);

  // ── 9. Persist cycle ──────────────────────────────────────────────────────
  const cyclePayload = {
    user_id:                userId,
    goal_id:                goalId,
    snapshot_id:            snapshot.id,
    features_id:            featuresRow.id,
    status:                 'active',
    total_weeks:            cycleParams.totalWeeks,
    start_date:             cycleParams.startDate,
    end_date:               cycleParams.endDate,
    target_peak_week_hours: cycleParams.targetPeakWeekHours,
    ai_summary:             null,
  };

  const { data: cycle, error: cycleErr } = await supabase
    .from('training_plan_cycles')
    .insert(cyclePayload)
    .select('id')
    .single();
  if (cycleErr) throw new Error(`cycle insert: ${cycleErr.message}`);

  // ── 10. Persist blocks (strip private _-prefixed planning fields) ──────────
  const blocksPayload = blocks.map(b => {
    // eslint-disable-next-line no-unused-vars
    const { _blueprint, ...rest } = b;
    return { user_id: userId, cycle_id: cycle.id, ...rest };
  });

  const { data: blockRows, error: blockErr } = await supabase
    .from('training_plan_blocks')
    .insert(blocksPayload)
    .select('id, block_number');
  if (blockErr) throw new Error(`blocks insert: ${blockErr.message}`);

  // Build a lookup map: block_number → persisted id
  const blockIdMap = {};
  for (const b of blockRows) blockIdMap[b.block_number] = b.id;

  // ── 11. Persist weeks (strip private _-prefixed planning fields) ────────────
  const weeksPayload = weeks.map(w => {
    // eslint-disable-next-line no-unused-vars
    const { _block_number, _meta, ...rest } = w;
    return {
      user_id:  userId,
      cycle_id: cycle.id,
      block_id: blockIdMap[_block_number],
      ...rest,
    };
  });

  const { error: weekErr } = await supabase
    .from('training_plan_weeks')
    .insert(weeksPayload);
  if (weekErr) throw new Error(`weeks insert: ${weekErr.message}`);

  console.log(
    `[planner] Generated plan for user ${userId}: ` +
    `${cycleParams.totalWeeks}w cycle, ${blocks.length} blocks, ${weeks.length} weeks, ` +
    `data_mode=${context.dataMode}`
  );

  return {
    cycleId:    cycle.id,
    blockCount: blocks.length,
    weekCount:  weeks.length,
    dataMode:   context.dataMode,
    totalWeeks: cycleParams.totalWeeks,
    peakHours:  cycleParams.targetPeakWeekHours,
    startDate:  cycleParams.startDate,
    endDate:    cycleParams.endDate,
  };
}

module.exports = { generateAndPersistPlan };
