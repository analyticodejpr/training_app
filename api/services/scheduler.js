/**
 * scheduler.js
 *
 * Deterministic current-week schedule generator.
 *
 * Code owns ALL scheduling decisions:
 *   - which days are training vs rest
 *   - which slot role goes on which day (long, quality, easy, recovery, support)
 *   - which workout template is selected (via slot_type + week_type + block_type + level)
 *   - how sessions are personalized (duration, intensity)
 *   - constraint enforcement (no back-to-back hard days)
 *   - safe defaults for all input combinations
 *
 * AI is not involved in any scheduling logic.
 * The output is a valid, deterministic schedule every time.
 */
'use strict';

const {
  pickWorkout,
  weekTypeFromRow,
  inferPrimarySport,
  triathlonSportForIndex,
} = require('./workoutLibrary');

// ── Day ordering and slot preferences ─────────────────────────────────────────

// All 7 days in week order (plan starts Monday)
const WEEK_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

// Priority order for assigning training days.
// Saturday = long session preferred; Tuesday/Thursday = quality days;
// Wednesday/Monday = aerobic days; Sunday/Friday = lowest priority.
const TRAINING_PRIORITY = ['saturday','tuesday','thursday','wednesday','monday','sunday','friday'];

// Days that are ideal for the long session (weekend preferred)
const LONG_PREFERRED_DAYS  = new Set(['saturday','sunday']);
// Days that are ideal for quality (hard/tempo) sessions
const QUALITY_PREFERRED_DAYS = new Set(['tuesday','thursday']);

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Compute prescribed session duration (minutes).
 * Distributes week volume across sessions respecting the long-session target.
 *
 * @param {string}  slotType            — 'long' | 'easy' | 'quality' | 'recovery' | 'strength' | 'support'
 * @param {string}  sessionType         — 'long' | 'easy' | 'tempo' | 'interval' | 'strength'
 * @param {number}  targetVolumeHours   — total week volume target
 * @param {number}  targetLongHours     — long session target
 * @param {number}  totalSessions       — sessions in this week
 * @param {object}  workout             — workout library entry (for duration bounds)
 * @param {boolean} isRecovery          — recovery week flag
 * @returns {number}                    — minutes (integer, within workout bounds)
 */
function prescribedMinutes(slotType, sessionType, targetVolumeHours, targetLongHours, totalSessions, workout, isRecovery) {
  let targetHours;

  if (slotType === 'long' || sessionType === 'long') {
    targetHours = isRecovery
      ? targetLongHours * 0.65           // recovery long = 65% of normal long
      : targetLongHours;
  } else {
    // Distribute remaining volume across non-long sessions
    const remaining  = Math.max(0, targetVolumeHours - targetLongHours);
    const otherCount = Math.max(1, totalSessions - 1);
    targetHours = remaining / otherCount;

    // Quality sessions get a small duration boost vs easy
    if (slotType === 'quality' && (sessionType === 'interval' || sessionType === 'tempo')) {
      targetHours *= 1.1;
    }
    if (isRecovery) {
      targetHours *= 0.8; // shorter in recovery week
    }
  }

  const raw = Math.round(targetHours * 60);
  return clamp(raw, workout.duration_min_minutes, workout.duration_max_minutes);
}

// ── Role → session type mapping ───────────────────────────────────────────────

/**
 * Map a slot role to a concrete session_type, respecting block type,
 * level, recovery status, and athlete readiness.
 *
 * @param {'long'|'quality'|'easy'} role
 * @param {string}  blockType      — 'base' | 'build' | 'peak' | 'taper' | 'recovery'
 * @param {string}  level          — 'beginner' | 'intermediate' | 'advanced'
 * @param {boolean} isRecovery
 * @param {boolean} isSecondQuality — alternate session type for second quality slot
 * @param {string}  readinessTier  — 'low'|'moderate'|'high' (default: 'moderate')
 * @returns {string}               — session_type for pickWorkout()
 */
function roleToSessionType(role, blockType, level, isRecovery, isSecondQuality = false, readinessTier = 'moderate') {
  if (isRecovery || blockType === 'recovery') return 'easy';

  if (role === 'long') return 'long';

  if (role === 'quality') {
    // Beginners never get hard sessions
    if (level === 'beginner') return 'easy';
    // Taper block: tempo only (no full intervals)
    if (blockType === 'taper') return 'tempo';
    // Base block: tempo intro
    if (blockType === 'base') return 'tempo';
    // Build / peak: low readiness → prefer tempo over interval (lower metabolic demand)
    if (readinessTier === 'low') return 'tempo';
    // Alternate interval and tempo otherwise
    return isSecondQuality ? 'tempo' : 'interval';
  }

  return 'easy';
}

// ── Main schedule builder ─────────────────────────────────────────────────────

/**
 * Build a deterministic current-week schedule.
 *
 * @param {object}      weekRow    — training_plan_weeks row (contains targets, dates)
 * @param {object}      blockRow   — training_plan_blocks row (block type, objective)
 * @param {object}      goal       — training_goals row
 * @param {object|null} features   — derived_training_features row (may be null for low-data)
 * @param {object|null} scoringCtx — output of computeSchedulingContext() (optional)
 *   Used to apply readiness / load-tolerance adjustments.
 *   Pass null or omit to get the same output as before (safe default).
 * @returns {{ days: object[], sessions: object[], scoringCtx: object|null }}
 *   days:       array of day specs (day_of_week, day_date, slot_type)
 *   sessions:   array of session specs with workout detail (keyed by day_of_week)
 *   scoringCtx: the scoring context that was applied (for logging / UI rationale)
 */
function buildSchedule(weekRow, blockRow, goal, features, scoringCtx = null) {
  const {
    week_start_date:    weekStart,
    target_sessions:    targetSessions,
    target_hard_sessions: targetHardSessions,
    target_volume_hours:  targetVolumeHours,
    target_long_session_hours: targetLongHours,
    is_recovery_week:   isRecovery,
  } = weekRow;

  const blockType  = blockRow.block_type;
  const level      = goal.level || 'intermediate';
  const isTriathlon = goal.goal_type === 'triathlon';
  const weekType   = weekTypeFromRow(weekRow, blockType);

  // ── 1. Build the 7 day date map ────────────────────────────────────────────
  const days = WEEK_DAYS.map((dayName, i) => ({
    day_of_week: dayName,
    day_date:    addDays(weekStart, i),
    slot_type:   'rest',
  }));

  // ── 2. Select training days from priority order ────────────────────────────
  const safeSessions  = clamp(targetSessions || goal.days_per_week, 1, 7);

  // Apply scoring context: reduce hard sessions when readiness or load tolerance is low.
  // hardSessionCapReduction is 0 by default (no change).
  const capReduction     = scoringCtx?.hardSessionCapReduction ?? 0;
  const plannedHard      = isRecovery ? 0 : clamp(targetHardSessions || 0, 0, safeSessions - 1);
  const safeHard         = Math.max(0, plannedHard - capReduction);

  // Readiness / load tolerance tiers passed into pickWorkout and roleToSessionType
  const readinessTier      = scoringCtx?.readinessTier      ?? 'moderate';
  const loadToleranceTier  = scoringCtx?.loadToleranceTier  ?? 'moderate';

  // Reduce long session target when load tolerance is low (athlete not yet adapted).
  // 15% reduction — keeps the long session present but shorter.
  const baseLongHours   = targetLongHours || 0;
  const effectiveLongHours = loadToleranceTier === 'low'
    ? baseLongHours * 0.85
    : baseLongHours;

  const trainingDays = [];
  for (const preferred of TRAINING_PRIORITY) {
    if (trainingDays.length >= safeSessions) break;
    const day = days.find(d => d.day_of_week === preferred);
    if (day && day.slot_type === 'rest') {
      day.slot_type = 'training';
      trainingDays.push(day);
    }
  }

  // ── 3. Assign roles to training days ──────────────────────────────────────
  // Slot roles: 'long', 'quality', 'easy'
  // Strategy:
  //   - First training day on a LONG_PREFERRED_DAYS → long
  //   - Up to safeHard training days on QUALITY_PREFERRED_DAYS → quality
  //   - Remaining → easy
  //   - Ensure no two hard/quality days are adjacent

  const roles = new Array(trainingDays.length).fill('easy');
  let longSet = false;
  let hardSet = 0;

  // Long slot: first training day on preferred long day, or last training day
  for (let i = 0; i < trainingDays.length; i++) {
    if (!longSet && LONG_PREFERRED_DAYS.has(trainingDays[i].day_of_week)) {
      roles[i] = 'long';
      longSet = true;
      break;
    }
  }
  if (!longSet && trainingDays.length > 0) {
    roles[trainingDays.length - 1] = 'long';
    longSet = true;
  }

  // Quality slots: on QUALITY_PREFERRED_DAYS, no adjacency to each other or long
  for (let i = 0; i < trainingDays.length && hardSet < safeHard; i++) {
    if (roles[i] !== 'easy') continue;
    if (!QUALITY_PREFERRED_DAYS.has(trainingDays[i].day_of_week)) continue;
    const prevRole = i > 0 ? roles[i - 1] : null;
    const nextRole = i < trainingDays.length - 1 ? roles[i + 1] : null;
    if (prevRole === 'quality' || prevRole === 'long') continue;
    if (nextRole === 'quality' || nextRole === 'long') continue;
    roles[i] = 'quality';
    hardSet++;
  }

  // If still under safeHard quota, use any non-adjacent easy slot
  for (let i = 0; i < trainingDays.length && hardSet < safeHard; i++) {
    if (roles[i] !== 'easy') continue;
    const prevRole = i > 0 ? roles[i - 1] : null;
    const nextRole = i < trainingDays.length - 1 ? roles[i + 1] : null;
    if (prevRole === 'quality' || prevRole === 'long') continue;
    if (nextRole === 'quality' || nextRole === 'long') continue;
    roles[i] = 'quality';
    hardSet++;
  }

  // ── 4. Build sessions from roles ─────────────────────────────────────────
  const sessions = [];
  let qualityCount = 0;
  // Track slugs and progression_families used this week — for variety scoring
  const usedSlugs    = [];
  const usedFamilies = [];

  for (let i = 0; i < trainingDays.length; i++) {
    const day  = trainingDays[i];
    const role = roles[i];

    // Determine slot_type and session_type from role
    let slotType;
    let sessionType;

    if (role === 'long') {
      slotType    = 'long';
      sessionType = 'long';
    } else if (role === 'quality') {
      slotType    = 'quality';
      // Pass readinessTier: low readiness in build/peak prefers tempo over interval
      sessionType = roleToSessionType('quality', blockType, level, isRecovery, qualityCount > 0, readinessTier);
      // Beginners: quality slot maps to easy
      if (level === 'beginner') slotType = 'easy';
      qualityCount++;
    } else {
      // Easy slot — use 'recovery' slot_type in recovery weeks for better workout matching
      slotType    = isRecovery ? 'recovery' : 'easy';
      sessionType = 'easy';
    }

    // Sport for this session
    let sport;
    if (isTriathlon) {
      sport = triathlonSportForIndex(i);
    } else {
      sport = inferPrimarySport(goal, features);
    }

    // Pick workout template — pass all scoring context
    const workout = pickWorkout(
      sport, slotType, sessionType, blockType, weekType, level,
      usedSlugs, readinessTier, usedFamilies, loadToleranceTier,
    );

    // Compute duration — use effectiveLongHours for long sessions (may be reduced by load tolerance)
    const minutes = prescribedMinutes(
      slotType,
      sessionType,
      targetVolumeHours || 0,
      slotType === 'long' ? effectiveLongHours : baseLongHours,
      safeSessions,
      workout,
      isRecovery,
    );

    usedSlugs.push(workout.slug);
    if (workout.progression_family) usedFamilies.push(workout.progression_family);

    sessions.push({
      day_of_week:       day.day_of_week,
      day_date:          day.day_date,
      workout_slug:      workout.slug,
      sport:             workout.sport === 'Any' ? sport : workout.sport,
      session_type:      sessionType,
      slot_type:         slotType,
      prescribed_minutes: minutes,
      intensity_zone:    workout.intensity_zone,
      recovery_cost:     workout.recovery_cost || 'low',
      instructions:      workout.instructions,
      rationale:         workout.rationale,
      is_key_session:    role === 'quality' || role === 'long',
      workout_name:      workout.name,
    });
  }

  return { days, sessions, scoringCtx };
}

// ── Plan validity check ───────────────────────────────────────────────────────

/**
 * Validate a built schedule. Returns { valid, errors }.
 */
function validateSchedule(days, sessions, weekRow) {
  const errors = [];

  if (!days || days.length !== 7) {
    errors.push('Schedule must have exactly 7 day slots.');
  }

  const trainDays = (days || []).filter(d => d.slot_type === 'training');
  if (sessions.length !== trainDays.length) {
    errors.push(`Session count (${sessions.length}) must match training day count (${trainDays.length}).`);
  }

  // No back-to-back hard sessions
  const ordered = [...sessions].sort((a, b) =>
    WEEK_DAYS.indexOf(a.day_of_week) - WEEK_DAYS.indexOf(b.day_of_week)
  );
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    const prevIdx = WEEK_DAYS.indexOf(prev.day_of_week);
    const currIdx = WEEK_DAYS.indexOf(curr.day_of_week);
    const adjacent = currIdx - prevIdx === 1;
    if (adjacent && prev.intensity_zone === 'hard' && curr.intensity_zone === 'hard') {
      errors.push(`Back-to-back hard sessions on ${prev.day_of_week} and ${curr.day_of_week}.`);
    }
  }

  // All sessions must have required fields
  for (const s of sessions) {
    if (!s.sport)          errors.push(`Session on ${s.day_of_week} missing sport.`);
    if (!s.session_type)   errors.push(`Session on ${s.day_of_week} missing session_type.`);
    if (!s.instructions)   errors.push(`Session on ${s.day_of_week} missing instructions.`);
    if (s.prescribed_minutes <= 0) errors.push(`Session on ${s.day_of_week} has zero duration.`);
  }

  // Recovery week: no hard sessions
  if (weekRow.is_recovery_week) {
    for (const s of sessions) {
      if (s.intensity_zone === 'hard') {
        errors.push(`Recovery week should not have hard sessions (found on ${s.day_of_week}).`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { buildSchedule, validateSchedule, WEEK_DAYS, TRAINING_PRIORITY };
