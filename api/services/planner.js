/**
 * planner.js
 *
 * Deterministic macro/block/week planner — policy-driven, not template-based.
 *
 * Design philosophy:
 *   - Code owns ALL structural decisions (phases, volume, intensity, scheduling).
 *   - Plan generation moves from "goal + level → generic template" to
 *     "derived athlete state + recent load + sport logic + preferences → personalized plan".
 *   - AI may optionally enrich labels and descriptions — the plan is valid without AI.
 *
 * Key changes vs. the prior template-based version:
 *
 *   1. Block blueprints replace static fraction tables.
 *      Each goal type has a sequence of block specs with ranges, not fixed fractions.
 *      Block selection responds to athlete state (readiness, time available, training age).
 *
 *   2. Macrocycle length uses readiness_lead_in + event_specific, not just weeks-to-event.
 *      Deconditioned or inconsistent athletes get a readiness block prepended.
 *
 *   3. Volume is anchored to actual completed load (chronic_load_28d) where available.
 *      Fallback to level-based defaults only when history is absent.
 *
 *   4. Recovery waves are adaptive (2:1, 3:1, or flexible 3:1) based on athlete state.
 *      Taper and deload are separate algorithms, not just recovery-tagged weeks.
 *
 *   5. Long session targets are goal- and block-specific ranges, not a single 28% constant.
 *      Recent max single-session exposure caps the target to prevent load spikes.
 *
 *   6. Intensity distribution responds to readiness tier and psychological signals
 *      (sleep quality, recovery quality) — not just block type.
 *
 *   7. Phase behavior is meaningfully different:
 *      readiness → rhythm/habit/conservative exposure
 *      base      → easy volume, movement economy, technique
 *      build     → controlled quality, event-specific work
 *      specific_build → race-specific sessions, discipline demands
 *      peak      → high specificity, fatigue control
 *      taper     → explicit volume reduction with maintained intensity/frequency
 *      deload    → lower stress, general movement
 *
 *   8. Session allocation is explicit (key sessions + support sessions + optional),
 *      not a simple ratio of days_per_week.
 *
 *   9. Strength, fitness, weight-loss, and triathlon plans are first-class citizens.
 */
'use strict';

const { deriveAthleteState } = require('./athleteState');

// ── Goal defaults (event-specific portion of the plan) ────────────────────────
//
// These apply to the event-specific weeks only.
// When a readiness lead-in is added, total weeks = lead-in + event-specific.

const GOAL_DEFAULTS = {
  base_fitness:        { minWeeks: 8,  maxWeeks: 16, defaultWeeks: 12 },
  general_performance: { minWeeks: 8,  maxWeeks: 16, defaultWeeks: 12 },
  weight_loss:         { minWeeks: 8,  maxWeeks: 16, defaultWeeks: 12 },
  race_5k:             { minWeeks: 6,  maxWeeks: 14, defaultWeeks: 10 },
  race_10k:            { minWeeks: 8,  maxWeeks: 16, defaultWeeks: 12 },
  race_half_marathon:  { minWeeks: 10, maxWeeks: 18, defaultWeeks: 14 },
  race_marathon:       { minWeeks: 14, maxWeeks: 22, defaultWeeks: 18 },
  triathlon:           { minWeeks: 14, maxWeeks: 22, defaultWeeks: 18 },
};

// ── Volume bounds per level (hours/week) ───────────────────────────────────────

const VOLUME_BOUNDS = {
  beginner:     { min: 2, max: 8  },
  intermediate: { min: 3, max: 15 },
  advanced:     { min: 5, max: 22 },
};

// Default baseline when no activity history exists
const LOW_DATA_BASELINE = {
  beginner:     2.5,
  intermediate: 4.0,
  advanced:     7.0,
};

// Peak volume multipliers — how far baseline can grow by plan end
// Anchored to actual chronic load, not level alone (but level caps the ceiling)
const LEVEL_PEAK_MULTIPLIER = {
  beginner:     1.3,
  intermediate: 1.55,
  advanced:     1.9,
};

// ── Block blueprints ──────────────────────────────────────────────────────────
//
// Each blueprint is an ordered array of block specs.
// `defaultFrac` is the fraction of event-specific weeks allocated to this block.
// Fractions are guides; actual allocation enforces minWeeks per block.
//
// Block types: 'readiness' | 'base' | 'build' | 'specific_build' | 'peak' | 'taper' | 'deload'
//
// Fields per spec:
//   type              block type label
//   defaultFrac       target fraction of event-specific weeks
//   minWeeks          hard minimum (never fewer than this)
//   maxWeeks          hard maximum (optional ceiling)
//   volumeBand        [min, max] load as fraction of peak week (e.g., [0.55, 0.80])
//   longSessionFrac   [min, max] long session as fraction of weekly volume
//   hardSessionsMax   max hard sessions per week in this block
//   recoveryEvery     loading weeks between recovery weeks (2 or 3)
//   label / objective / rationale  human-readable metadata

const BLOCK_BLUEPRINTS = {

  // ── Fitness (base_fitness, general_performance) ─────────────────────────────
  fitness: [
    {
      type:           'base',
      defaultFrac:    0.55,
      minWeeks:       3,
      maxWeeks:       8,
      volumeBand:     [0.55, 0.80],
      longSessionFrac:[0.22, 0.32],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build consistent aerobic foundation and movement habits.',
      rationale: 'High easy volume with technique and strength support. No hard sessions until aerobic base is established.',
    },
    {
      type:           'build',
      defaultFrac:    0.30,
      minWeeks:       2,
      maxWeeks:       6,
      volumeBand:     [0.70, 0.95],
      longSessionFrac:[0.25, 0.35],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Development Build',
      objective: 'Introduce progressive load and limited quality sessions.',
      rationale: 'Volume approaches peak with 1 quality session per week as fitness builds.',
    },
    {
      type:           'deload',
      defaultFrac:    0.15,
      minWeeks:       2,
      maxWeeks:       3,
      volumeBand:     [0.45, 0.60],
      longSessionFrac:[0.18, 0.25],
      hardSessionsMax: 0,
      recoveryEvery:  null, // entire block is a deload — no embedded recovery
      label:     'Consolidation',
      objective: 'Consolidate fitness gains and prepare for next cycle.',
      rationale: 'Reduced load allows super-compensation. Light work maintains movement quality.',
    },
  ],

  // ── Weight loss ─────────────────────────────────────────────────────────────
  weight_loss: [
    {
      type:           'readiness',
      defaultFrac:    0.25,
      minWeeks:       2,
      maxWeeks:       4,
      volumeBand:     [0.45, 0.65],
      longSessionFrac:[0.18, 0.28],
      hardSessionsMax: 0,
      recoveryEvery:  2, // more conservative for weight-loss beginners
      label:     'Foundation',
      objective: 'Establish sustainable movement habits and aerobic base.',
      rationale: 'Conservative entry with emphasis on consistency over intensity. Strength support included.',
    },
    {
      type:           'build',
      defaultFrac:    0.40,
      minWeeks:       3,
      maxWeeks:       7,
      volumeBand:     [0.65, 0.90],
      longSessionFrac:[0.22, 0.32],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Capacity Build',
      objective: 'Progressive volume with sustained energy expenditure.',
      rationale: 'Caloric demand increases with volume. Strength maintained to preserve muscle mass.',
    },
    {
      type:           'base',
      defaultFrac:    0.25,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.70, 0.95],
      longSessionFrac:[0.22, 0.30],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Lifestyle Momentum',
      objective: 'Sustain training frequency and routine at near-peak volume.',
      rationale: 'Consistency and routine matter most for long-term weight management.',
    },
    {
      type:           'deload',
      defaultFrac:    0.10,
      minWeeks:       2,
      maxWeeks:       2,
      volumeBand:     [0.45, 0.60],
      longSessionFrac:[0.18, 0.25],
      hardSessionsMax: 0,
      recoveryEvery:  null,
      label:     'Consolidation',
      objective: 'Consolidate habits and recover before restarting the cycle.',
      rationale: 'Regular deloads improve long-term adherence and prevent burnout.',
    },
  ],

  // ── 5k ─────────────────────────────────────────────────────────────────────
  race_5k: [
    {
      type:           'base',
      defaultFrac:    0.35,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.55, 0.80],
      longSessionFrac:[0.22, 0.32],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build aerobic base and establish consistent running routine.',
      rationale: 'Easy aerobic volume with strides. No hard sessions yet.',
    },
    {
      type:           'build',
      defaultFrac:    0.35,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.70, 0.95],
      longSessionFrac:[0.24, 0.34],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Build Phase',
      objective: 'Develop aerobic threshold and introduce race-specific effort.',
      rationale: 'Add tempo and threshold work alongside easy volume.',
    },
    {
      type:           'specific_build',
      defaultFrac:    0.20,
      minWeeks:       2,
      maxWeeks:       4,
      volumeBand:     [0.80, 1.00],
      longSessionFrac:[0.24, 0.34],
      hardSessionsMax: 2,
      recoveryEvery:  3,
      label:     'Specific Build',
      objective: 'Race-pace intervals and VO2max work.',
      rationale: 'Short, fast intervals tune the neuromuscular system for 5k pace.',
    },
    {
      type:           'taper',
      defaultFrac:    0.10,
      minWeeks:       2,
      maxWeeks:       2,
      volumeBand:     [0.45, 0.60],
      longSessionFrac:[0.18, 0.24],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Taper',
      objective: 'Reduce volume, maintain intensity, arrive fresh.',
      rationale: 'Short taper: 1–2 weeks. Keep some race-pace work to stay sharp.',
    },
  ],

  // ── 10k ────────────────────────────────────────────────────────────────────
  race_10k: [
    {
      type:           'base',
      defaultFrac:    0.30,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.55, 0.80],
      longSessionFrac:[0.23, 0.33],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build aerobic base and consistent volume.',
      rationale: 'High easy volume with progressive long run. Strides introduced late in block.',
    },
    {
      type:           'build',
      defaultFrac:    0.30,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.70, 0.92],
      longSessionFrac:[0.25, 0.35],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Build Phase',
      objective: 'Develop lactate threshold and aerobic capacity.',
      rationale: 'Tempo and threshold sessions with easy volume. Long run grows.',
    },
    {
      type:           'specific_build',
      defaultFrac:    0.25,
      minWeeks:       2,
      maxWeeks:       4,
      volumeBand:     [0.80, 1.00],
      longSessionFrac:[0.26, 0.36],
      hardSessionsMax: 2,
      recoveryEvery:  3,
      label:     'Specific Build',
      objective: 'Race-pace intervals and threshold sharpening.',
      rationale: '10k race pace and threshold intervals build race-specific fitness.',
    },
    {
      type:           'taper',
      defaultFrac:    0.15,
      minWeeks:       2,
      maxWeeks:       2,
      volumeBand:     [0.45, 0.62],
      longSessionFrac:[0.18, 0.26],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Taper',
      objective: 'Reduce load, maintain sharpness, prepare for race day.',
      rationale: 'Volume drops 30–40%. Keep some quality to preserve neuromuscular readiness.',
    },
  ],

  // ── Half marathon ───────────────────────────────────────────────────────────
  race_half_marathon: [
    {
      type:           'base',
      defaultFrac:    0.30,
      minWeeks:       3,
      maxWeeks:       6,
      volumeBand:     [0.55, 0.78],
      longSessionFrac:[0.24, 0.34],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build aerobic foundation and establish long run routine.',
      rationale: 'Most running should be easy. Long run is the primary weekly anchor.',
    },
    {
      type:           'build',
      defaultFrac:    0.28,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.68, 0.90],
      longSessionFrac:[0.27, 0.37],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Build Phase',
      objective: 'Develop threshold fitness and extend long run.',
      rationale: 'Introduce tempo work. Long run approaching race-specific demands.',
    },
    {
      type:           'specific_build',
      defaultFrac:    0.22,
      minWeeks:       2,
      maxWeeks:       4,
      volumeBand:     [0.80, 1.00],
      longSessionFrac:[0.28, 0.40],
      hardSessionsMax: 2,
      recoveryEvery:  3,
      label:     'Specific Build',
      objective: 'Half marathon race pace work and peak long run.',
      rationale: 'Race-pace tempo runs and long runs near target race distance.',
    },
    {
      type:           'peak',
      defaultFrac:    0.10,
      minWeeks:       1,
      maxWeeks:       2,
      volumeBand:     [0.85, 1.00],
      longSessionFrac:[0.28, 0.38],
      hardSessionsMax: 2,
      recoveryEvery:  null,
      label:     'Peak',
      objective: 'Final high-load week before taper.',
      rationale: 'Final peak effort before volume drops. Sharpening race-specific fitness.',
    },
    {
      type:           'taper',
      defaultFrac:    0.10,
      minWeeks:       2,
      maxWeeks:       2,
      volumeBand:     [0.45, 0.62],
      longSessionFrac:[0.20, 0.28],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Taper',
      objective: 'Reduce volume, maintain race-pace sharpness, arrive fresh.',
      rationale: '2-week taper: significant volume cut, one quality session to stay sharp.',
    },
  ],

  // ── Marathon ────────────────────────────────────────────────────────────────
  race_marathon: [
    {
      type:           'base',
      defaultFrac:    0.28,
      minWeeks:       4,
      maxWeeks:       8,
      volumeBand:     [0.52, 0.75],
      longSessionFrac:[0.25, 0.34],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build the aerobic engine and long-run foundation.',
      rationale: 'Aerobic development phase. Easy running + progressive long run. No hard work yet.',
    },
    {
      type:           'build',
      defaultFrac:    0.28,
      minWeeks:       3,
      maxWeeks:       6,
      volumeBand:     [0.68, 0.90],
      longSessionFrac:[0.27, 0.37],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Build Phase',
      objective: 'Develop marathon-specific endurance and introduce quality.',
      rationale: 'Volume grows. Long run extends. One quality session (marathon-pace tempo) per week.',
    },
    {
      type:           'specific_build',
      defaultFrac:    0.22,
      minWeeks:       2,
      maxWeeks:       5,
      volumeBand:     [0.80, 1.00],
      longSessionFrac:[0.28, 0.40],
      hardSessionsMax: 2,
      recoveryEvery:  3,
      label:     'Specific Build',
      objective: 'Marathon race pace and peak long runs.',
      rationale: 'Long runs at or near race pace. Tune race-day execution.',
    },
    {
      type:           'peak',
      defaultFrac:    0.12,
      minWeeks:       2,
      maxWeeks:       3,
      volumeBand:     [0.85, 1.00],
      longSessionFrac:[0.27, 0.38],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Peak Phase',
      objective: 'Sustain peak volume with race-pace sharpening.',
      rationale: 'Final hard block before taper. Confidence-building long runs and race simulations.',
    },
    {
      type:           'taper',
      defaultFrac:    0.10,
      minWeeks:       2,
      maxWeeks:       3,
      volumeBand:     [0.40, 0.60],
      longSessionFrac:[0.20, 0.28],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Taper',
      objective: 'Reduce load sharply, retain freshness and sharpness for race day.',
      rationale: '3-week taper: volume cuts 40–50%. One quality session each week at race pace.',
    },
  ],

  // ── Triathlon ───────────────────────────────────────────────────────────────
  triathlon: [
    {
      type:           'base',
      defaultFrac:    0.28,
      minWeeks:       3,
      maxWeeks:       6,
      volumeBand:     [0.52, 0.75],
      longSessionFrac:[0.22, 0.32],
      hardSessionsMax: 0,
      recoveryEvery:  3,
      label:     'Base Building',
      objective: 'Build multi-sport aerobic base and discipline consistency.',
      rationale: 'Even discipline distribution. Technique focus in swim. Easy volume in bike/run.',
    },
    {
      type:           'build',
      defaultFrac:    0.28,
      minWeeks:       3,
      maxWeeks:       6,
      volumeBand:     [0.68, 0.90],
      longSessionFrac:[0.24, 0.34],
      hardSessionsMax: 1,
      recoveryEvery:  3,
      label:     'Build Phase',
      objective: 'Develop multi-sport fitness and introduce brick sessions.',
      rationale: 'Brick sessions (bike → run) key for tri-specific conditioning. Discipline emphasis begins.',
    },
    {
      type:           'specific_build',
      defaultFrac:    0.22,
      minWeeks:       2,
      maxWeeks:       4,
      volumeBand:     [0.80, 1.00],
      longSessionFrac:[0.26, 0.36],
      hardSessionsMax: 2,
      recoveryEvery:  3,
      label:     'Specific Build',
      objective: 'Race-specific discipline demands and longer bricks.',
      rationale: 'Emphasize race-distance exposure across disciplines. Fatigue resistance is key.',
    },
    {
      type:           'peak',
      defaultFrac:    0.10,
      minWeeks:       1,
      maxWeeks:       2,
      volumeBand:     [0.85, 1.00],
      longSessionFrac:[0.24, 0.34],
      hardSessionsMax: 2,
      recoveryEvery:  null,
      label:     'Peak',
      objective: 'Final race-specific peak before taper.',
      rationale: 'Final confidence-building sessions simulating race day demands.',
    },
    {
      type:           'taper',
      defaultFrac:    0.12,
      minWeeks:       2,
      maxWeeks:       3,
      volumeBand:     [0.42, 0.60],
      longSessionFrac:[0.18, 0.26],
      hardSessionsMax: 1,
      recoveryEvery:  null,
      label:     'Taper',
      objective: 'Reduce load, maintain discipline sharpness, arrive race-ready.',
      rationale: 'All three disciplines taper together. Short quality efforts maintain feel.',
    },
  ],
};

// ── Block metadata (all known types) ─────────────────────────────────────────

const BLOCK_META = {
  readiness:      { volumeTrend: 'building',  intensityTrend: 'low',      targetLoadPct: 55  },
  base:           { volumeTrend: 'building',  intensityTrend: 'low',      targetLoadPct: 70  },
  build:          { volumeTrend: 'building',  intensityTrend: 'moderate', targetLoadPct: 85  },
  specific_build: { volumeTrend: 'steady',    intensityTrend: 'high',     targetLoadPct: 95  },
  peak:           { volumeTrend: 'steady',    intensityTrend: 'high',     targetLoadPct: 100 },
  taper:          { volumeTrend: 'reducing',  intensityTrend: 'reducing', targetLoadPct: 52  },
  deload:         { volumeTrend: 'reducing',  intensityTrend: 'low',      targetLoadPct: 50  },
};

// Default labels and objectives (AI may override at display time)
const BLOCK_LABELS = {
  readiness:      'Readiness Phase',
  base:           'Base Building',
  build:          'Build Phase',
  specific_build: 'Specific Build',
  peak:           'Peak Phase',
  taper:          'Taper',
  deload:         'Consolidation',
  recovery:       'Recovery',
};

const BLOCK_OBJECTIVES = {
  readiness:      'Establish training rhythm, movement quality, and conservative volume.',
  base:           'Build aerobic foundation and consistent volume.',
  build:          'Increase load and introduce event-specific intensity.',
  specific_build: 'Develop race-specific fitness at target demands.',
  peak:           'Sustain peak load with race-pace sharpening.',
  taper:          'Reduce load to arrive fresh and race-ready.',
  deload:         'Absorb training gains and reset for the next phase.',
  recovery:       'Active recovery — restore readiness for next block.',
};

// Intensity targets by block type (% easy / moderate / hard — midpoint values)
// Actual per-week values may shift based on athlete state signals.
const INTENSITY_TARGETS = {
  readiness:      { easy: 88, moderate: 10, hard: 2  },
  base:           { easy: 82, moderate: 14, hard: 4  },
  build:          { easy: 72, moderate: 20, hard: 8  },
  specific_build: { easy: 65, moderate: 20, hard: 15 },
  peak:           { easy: 60, moderate: 20, hard: 20 },
  taper:          { easy: 68, moderate: 22, hard: 10 },
  deload:         { easy: 88, moderate: 10, hard: 2  },
  recovery:       { easy: 92, moderate:  8, hard: 0  },
};

// Long session target range [min, max] as fraction of weekly volume by block type
const LONG_SESSION_TARGETS = {
  readiness:      { min: 0.20, max: 0.28 },
  base:           { min: 0.25, max: 0.34 },
  build:          { min: 0.27, max: 0.38 },
  specific_build: { min: 0.28, max: 0.40 },
  peak:           { min: 0.26, max: 0.38 },
  taper:          { min: 0.18, max: 0.26 },
  deload:         { min: 0.16, max: 0.24 },
  recovery:       { min: 0.18, max: 0.26 },
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function parseDate(s) {
  return new Date(s + 'T00:00:00Z');
}

function nextMonday(date) {
  const d   = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 1) ? 0 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// ── Default athlete state (backward-compat fallback) ──────────────────────────

/**
 * Minimal athlete state from a level string alone.
 * Used when planBlocks/planWeeks are called without a full derived state.
 */
function _defaultAthleteState(level) {
  return {
    primary_goal_family:      'fitness',
    effective_level:          level || 'intermediate',
    level:                    level || 'intermediate',
    days_per_week:            4,
    time_budget_minutes:      240,
    training_age_proxy:       'recreational',
    readiness_tier:           'moderate',
    adherence_risk:           'moderate',
    recovery_capacity_score:  50,
    recovery_wave_pattern:    '3:1',
    psychological_load_modifier: 0,
    chronic_load_28d:         null,
    max_single_session_28d:   0,
    max_long_run_28d:         null,
    needs_readiness_block:    false,
    readiness_lead_in_weeks:  0,
    sleep_quality:            null,
    recovery_quality:         null,
    environment_preference_profile: {
      prefers_routine:  false,
      prefers_variety:  false,
      prefers_indoor:   false,
      prefers_outdoor:  false,
    },
    sport_readiness: {
      notes: [],
      is_ready_for_event_specific_work: true,
    },
  };
}

// ── Plan duration logic ───────────────────────────────────────────────────────

/**
 * Compute the total cycle duration, splitting into event-specific and lead-in portions.
 *
 * If the athlete needs a readiness lead-in, those weeks are carved out of the
 * total available time, ensuring the event-specific plan still meets its minimum.
 *
 * @param {object} goal         - training_goals row
 * @param {object} athleteState - output of deriveAthleteState()
 * @returns {{ eventSpecificWeeks, readinessLeadInWeeks, totalWeeks }}
 */
function _computePlanDuration(goal, athleteState) {
  const defaults  = GOAL_DEFAULTS[goal.goal_type] || GOAL_DEFAULTS.base_fitness;
  const leadIn    = athleteState.readiness_lead_in_weeks || 0;

  if (goal.event_date) {
    const today        = new Date();
    const event        = parseDate(goal.event_date);
    const weeksToEvent = Math.max(0, Math.round((event - today) / (7 * 24 * 3600 * 1000)));

    // Event-specific portion = total available − lead-in, clamped to [min, max]
    const eventSpecificAvailable = Math.max(weeksToEvent - leadIn, defaults.minWeeks);
    const eventSpecificWeeks     = clamp(eventSpecificAvailable, defaults.minWeeks, defaults.maxWeeks);

    // Lead-in may be reduced if we don't have enough time
    const actualLeadIn = Math.max(0, Math.min(leadIn, weeksToEvent - eventSpecificWeeks));

    return {
      eventSpecificWeeks,
      readinessLeadInWeeks: actualLeadIn,
      totalWeeks:           actualLeadIn + eventSpecificWeeks,
    };
  }

  // No event date: default duration + lead-in
  return {
    eventSpecificWeeks:   defaults.defaultWeeks,
    readinessLeadInWeeks: leadIn,
    totalWeeks:           leadIn + defaults.defaultWeeks,
  };
}

// ── planCycle ─────────────────────────────────────────────────────────────────

/**
 * Generate top-level cycle parameters.
 *
 * @param {object}      goal         - training_goals row
 * @param {object}      features     - computeFeatures() output
 * @param {object|null} athleteState - optional; derived from goal+features if absent
 * @returns {object}                 - cycleParams (not persisted here)
 */
function planCycle(goal, features, athleteState) {
  const state = athleteState || deriveAthleteState(goal, features);

  const level  = state.effective_level || state.level || 'intermediate';
  const bounds = VOLUME_BOUNDS[level] || VOLUME_BOUNDS.intermediate;

  // ── Duration ────────────────────────────────────────────────────────────────

  const { eventSpecificWeeks, readinessLeadInWeeks, totalWeeks } =
    _computePlanDuration(goal, state);

  // ── Volume baseline ─────────────────────────────────────────────────────────
  //
  // Priority:
  //   1. Actual chronic load from activity history (most accurate anchor)
  //   2. Level-based low-data default (when history is absent)
  //
  // We always clamp to level-appropriate safety bounds.

  let baselineHours;
  if (state.chronic_load_28d && state.chronic_load_28d > 0.5) {
    // Use actual 28d average weekly volume — most personalized anchor
    baselineHours = clamp(state.chronic_load_28d, bounds.min * 0.7, bounds.max * 0.8);
  } else if (features && features.has_strava && features.volume_28d_hours > 0) {
    // Direct features fallback for callers not providing state
    baselineHours = clamp(features.volume_28d_hours / 4, bounds.min * 0.7, bounds.max * 0.8);
  } else {
    // No history: level-based default
    baselineHours = LOW_DATA_BASELINE[level] || LOW_DATA_BASELINE.intermediate;
  }
  baselineHours = parseFloat(baselineHours.toFixed(2));

  // ── Peak target ─────────────────────────────────────────────────────────────
  //
  // Baseline × level multiplier, clamped to level bounds.
  // Psychological modifier nudges peak down if sleep/recovery are poor.

  const psychMod      = 1 + state.psychological_load_modifier * 0.06;
  const peakMultiplier = LEVEL_PEAK_MULTIPLIER[level] || LEVEL_PEAK_MULTIPLIER.intermediate;
  const targetPeakWeekHours = parseFloat(
    clamp(baselineHours * peakMultiplier * psychMod, bounds.min, bounds.max).toFixed(2)
  );

  // ── Start / end dates ────────────────────────────────────────────────────────

  const startDate = new Date();
  const endDate   = addWeeks(startDate, totalWeeks);

  return {
    totalWeeks,
    eventSpecificWeeks,
    readinessLeadInWeeks,
    startDate:            toDateStr(startDate),
    endDate:              toDateStr(endDate),
    targetPeakWeekHours,
    baselineHours,
    level,
    // Pass state through for planBlocks / planWeeks without re-deriving
    _athleteState: state,
  };
}

// ── planBlocks ────────────────────────────────────────────────────────────────

/**
 * Generate block structure from cycle parameters.
 *
 * Uses BLOCK_BLUEPRINTS to select a phase sequence appropriate for the goal
 * and athlete state, rather than fixed fractions.
 *
 * @param {object}      cycleParams  - output of planCycle()
 * @param {object}      goal         - training_goals row
 * @param {object|null} athleteState - optional; falls back to cycleParams._athleteState
 * @returns {object[]}               - array of block specs
 */
function planBlocks(cycleParams, goal, athleteState) {
  const state = athleteState || cycleParams._athleteState || _defaultAthleteState(cycleParams.level);
  const {
    totalWeeks,
    eventSpecificWeeks,
    readinessLeadInWeeks,
  } = cycleParams;

  // ── Select blueprint ────────────────────────────────────────────────────────

  const goalType  = goal.goal_type || 'base_fitness';
  const blueprint = BLOCK_BLUEPRINTS[goalType] || BLOCK_BLUEPRINTS.fitness;

  // ── Build readiness block (if needed) ──────────────────────────────────────

  const blocks = [];
  let weekCursor = 1;

  if (readinessLeadInWeeks >= 2) {
    const meta = BLOCK_META.readiness;
    blocks.push({
      block_number:    1,
      block_type:      'readiness',
      start_week:      weekCursor,
      end_week:        weekCursor + readinessLeadInWeeks - 1,
      total_weeks:     readinessLeadInWeeks,
      label:           BLOCK_LABELS.readiness,
      objective:       BLOCK_OBJECTIVES.readiness,
      volume_trend:    meta.volumeTrend,
      intensity_trend: meta.intensityTrend,
      target_load_pct: meta.targetLoadPct,
      ai_description:  null,
      _blueprint:      null,
    });
    weekCursor += readinessLeadInWeeks;
  }

  // ── Allocate event-specific blocks ─────────────────────────────────────────

  const availableWeeks  = eventSpecificWeeks;
  const blockStartIndex = blocks.length;

  // First pass: compute raw week counts from defaultFrac
  const rawCounts = blueprint.map((spec, i) => {
    if (i === blueprint.length - 1) return null; // last block gets remainder
    return Math.max(spec.minWeeks, Math.round(spec.defaultFrac * availableWeeks));
  });

  // Last block gets whatever is left, clamped to its min
  const usedSoFar = rawCounts.slice(0, -1).reduce((s, v) => s + v, 0);
  rawCounts[rawCounts.length - 1] = Math.max(
    blueprint[blueprint.length - 1].minWeeks,
    availableWeeks - usedSoFar
  );

  // Second pass: if we overshot (sum > availableWeeks), trim from non-taper blocks.
  // Never trim a block below 2 weeks — validator requires at least 2.
  const BLOCK_HARD_MIN = 2;
  let totalAllocated = rawCounts.reduce((s, v) => s + v, 0);
  if (totalAllocated > availableWeeks) {
    for (let i = rawCounts.length - 2; i >= 0; i--) {
      const excess  = totalAllocated - availableWeeks;
      const floor   = Math.max(blueprint[i].minWeeks, BLOCK_HARD_MIN);
      const canTrim = Math.max(0, rawCounts[i] - floor);
      const trimBy  = Math.min(excess, canTrim);
      if (trimBy > 0) {
        rawCounts[i]   -= trimBy;
        totalAllocated -= trimBy;
      }
      if (totalAllocated <= availableWeeks) break;
    }
  }

  // Apply maxWeeks caps
  for (let i = 0; i < rawCounts.length; i++) {
    if (blueprint[i].maxWeeks) {
      rawCounts[i] = Math.min(rawCounts[i], blueprint[i].maxWeeks);
    }
  }

  // Safety: if any block ended up below the hard minimum (2 weeks), bring it back up.
  // This can happen when availableWeeks is small. The extra weeks push totalWeeks
  // slightly beyond the cap, but correctness takes priority over exact duration.
  for (let i = 0; i < rawCounts.length; i++) {
    if (rawCounts[i] < BLOCK_HARD_MIN) {
      rawCounts[i] = BLOCK_HARD_MIN;
    }
  }

  // Build block objects
  blueprint.forEach((spec, i) => {
    const blockWeeks = rawCounts[i];
    const meta       = BLOCK_META[spec.type] || BLOCK_META.base;
    const blockNum   = blockStartIndex + i + 1;

    blocks.push({
      block_number:    blockNum,
      block_type:      spec.type,
      start_week:      weekCursor,
      end_week:        weekCursor + blockWeeks - 1,
      total_weeks:     blockWeeks,
      label:           spec.label || BLOCK_LABELS[spec.type] || spec.type,
      objective:       spec.objective || BLOCK_OBJECTIVES[spec.type] || '',
      volume_trend:    meta.volumeTrend,
      intensity_trend: meta.intensityTrend,
      target_load_pct: meta.targetLoadPct,
      ai_description:  null,
      // Private: used by planWeeks for block-specific policy, stripped before persistence
      _blueprint:      spec,
    });
    weekCursor += blockWeeks;
  });

  return blocks;
}

// ── planWeeks ─────────────────────────────────────────────────────────────────

/**
 * Generate week-level targets for every week in the cycle.
 *
 * Key improvements over the prior version:
 *   - Adaptive recovery wave (2:1 or 3:1) based on athlete state
 *   - Volume anchored to chronic load, not just a ramp formula
 *   - Long session capped by recent max single-session exposure
 *   - Intensity distribution shifts with readiness and psychological signals
 *   - Session count accounts for adherence risk and block type
 *   - Taper is a distinct algorithm (not just a recovery-tagged week)
 *   - Phase-specific themes and objectives with meaningful differences
 *
 * @param {object}      cycleParams  - output of planCycle()
 * @param {object[]}    blocks       - output of planBlocks()
 * @param {object}      goal         - training_goals row
 * @param {object|null} athleteState - optional; falls back to cycleParams._athleteState
 * @returns {object[]}               - array of week specs
 */
function planWeeks(cycleParams, blocks, goal, athleteState) {
  const state = athleteState || cycleParams._athleteState || _defaultAthleteState(cycleParams.level);
  const {
    totalWeeks,
    startDate,
    targetPeakWeekHours,
    baselineHours,
  } = cycleParams;

  const daysPerWeek = clamp(goal.days_per_week || state.days_per_week || 4, 1, 7);

  // Recovery wave: how many loading weeks between recovery weeks
  const recoveryEveryDefault = state.recovery_wave_pattern === '2:1' ? 2 : 3;

  const weeks = [];

  for (const block of blocks) {
    const bp             = block._blueprint; // null for readiness block
    const blockType      = block.block_type;
    const isTaperBlock   = blockType === 'taper';
    const isDeloadBlock  = blockType === 'deload';
    const isReadinessBlk = blockType === 'readiness';

    // Per-block recovery interval (blueprint overrides global if specified)
    const recoveryEvery  = (bp && bp.recoveryEvery != null)
      ? bp.recoveryEvery
      : recoveryEveryDefault;

    // Progressive ramp range for this block (volume band as fraction of peak)
    const volBandMin = bp ? bp.volumeBand[0] : (BLOCK_META[blockType]?.targetLoadPct / 100 - 0.15) || 0.55;
    const volBandMax = bp ? bp.volumeBand[1] : (BLOCK_META[blockType]?.targetLoadPct / 100) || 0.80;

    let loadingWeekCount = 0;

    for (let wi = block.start_week; wi <= block.end_week; wi++) {
      const weekIdx        = wi - 1;
      const posInBlock     = wi - block.start_week; // 0-indexed within block
      const isLastInBlock  = wi === block.end_week;

      // ── Week type classification ────────────────────────────────────────────

      let weekType;
      if (isTaperBlock) {
        weekType = 'taper';
      } else if (isDeloadBlock) {
        weekType = 'deload';
      } else if (isReadinessBlk) {
        weekType = posInBlock === 0 ? 'foundation' : 'loading';
      } else if (
        recoveryEvery !== null &&
        loadingWeekCount > 0 &&
        loadingWeekCount % recoveryEvery === 0 &&
        !isLastInBlock
      ) {
        weekType = 'recovery';
      } else {
        weekType = 'loading';
      }

      const isRecovery = weekType === 'recovery' || weekType === 'deload';

      if (weekType === 'recovery' || weekType === 'deload') {
        // Reset the counter so the next loading wave starts fresh.
        // Without this, loadingWeekCount stays at a multiple and every
        // subsequent week would also be classified as a recovery week.
        loadingWeekCount = 0;
      } else {
        loadingWeekCount++;
      }

      // ── Volume target ────────────────────────────────────────────────────────
      //
      // Compute target using both block band and within-block progression.

      const targetVolumeHours = _computeWeeklyVolume({
        posInBlock,
        blockLength:  block.total_weeks,
        weekType,
        volBandMin,
        volBandMax,
        targetPeakWeekHours,
        baselineHours,
        state,
      });

      // ── Long session target ──────────────────────────────────────────────────

      const longSessionRange = (bp && bp.longSessionFrac)
        ? { min: bp.longSessionFrac[0], max: bp.longSessionFrac[1] }
        : LONG_SESSION_TARGETS[blockType] || LONG_SESSION_TARGETS.base;

      const targetLongSessionHours = _computeLongSession({
        weekVolumeHours: targetVolumeHours,
        weekType,
        longSessionRange,
        targetPeakWeekHours,
        state,
      });

      // ── Session count ────────────────────────────────────────────────────────

      const { targetSessions, targetHardSessions } = _computeSessionAllocation({
        blockType,
        weekType,
        daysPerWeek,
        state,
        bp,
      });

      // ── Intensity distribution ───────────────────────────────────────────────

      const intensityDist = _computeIntensityDist({
        blockType,
        weekType,
        state,
      });

      // ── Date calculation ─────────────────────────────────────────────────────

      const weekStart = addWeeks(parseDate(startDate), weekIdx);
      const weekEnd   = addWeeks(weekStart, 1);
      weekEnd.setUTCDate(weekEnd.getUTCDate() - 1); // Sunday

      // ── Theme and objective ──────────────────────────────────────────────────

      const theme     = _weekTheme(blockType, posInBlock, block.total_weeks, weekType);
      const objective = _weekObjective(blockType, posInBlock, block.total_weeks, weekType, state);
      const notes     = _weekNotes(blockType, weekType, state, posInBlock);

      weeks.push({
        week_number:               wi,
        week_start_date:           toDateStr(weekStart),
        week_end_date:             toDateStr(weekEnd),
        is_recovery_week:          isRecovery,
        theme,
        objective,
        target_sessions:           targetSessions,
        target_hard_sessions:      targetHardSessions,
        target_volume_hours:       targetVolumeHours,
        target_long_session_hours: targetLongSessionHours,
        target_pct_easy:           intensityDist.easy,
        target_pct_moderate:       intensityDist.moderate,
        target_pct_hard:           intensityDist.hard,
        notes,
        // For orchestrator block mapping (stripped before DB insert)
        _block_number: block.block_number,
        // Rich metadata for logging / future UI (stripped before DB insert)
        _meta: {
          week_type:   weekType,
          block_type:  blockType,
          pos_in_block: posInBlock,
          recovery_wave_pattern: state.recovery_wave_pattern,
          loading_week_count:    loadingWeekCount,
          rationale:   objective,
        },
      });
    }
  }

  return weeks;
}

// ── Volume computation ────────────────────────────────────────────────────────

/**
 * Compute weekly volume target for a given week position and context.
 *
 * Volume is anchored to the chronic load baseline and ramped progressively
 * within each block. Recovery and deload weeks use lower bands.
 */
function _computeWeeklyVolume({
  posInBlock,
  blockLength,
  weekType,
  volBandMin,
  volBandMax,
  targetPeakWeekHours,
  baselineHours,
  state,
}) {
  // Recovery / deload: fixed lower band
  if (weekType === 'recovery' || weekType === 'deload') {
    const recovPct = weekType === 'deload' ? 0.50 : 0.55;
    return parseFloat(
      clamp(targetPeakWeekHours * recovPct, 1, targetPeakWeekHours * 0.65).toFixed(2)
    );
  }

  // Taper: rapid volume reduction (week 1 = ~55%, week 2 = ~45%, week 3 = ~40%)
  if (weekType === 'taper') {
    const taperPct = Math.max(0.40, 0.58 - posInBlock * 0.09);
    return parseFloat(
      clamp(targetPeakWeekHours * taperPct, 1, targetPeakWeekHours * 0.62).toFixed(2)
    );
  }

  // Foundation (first week of readiness block): start very conservatively
  if (weekType === 'foundation') {
    return parseFloat(
      clamp(baselineHours * 0.85, 1, targetPeakWeekHours * 0.60).toFixed(2)
    );
  }

  // Loading week: linear ramp from volBandMin to volBandMax across the block
  const t          = blockLength > 1 ? posInBlock / (blockLength - 1) : 0;
  const loadFactor = volBandMin + t * (volBandMax - volBandMin);

  // Psychological modifier: reduce peak if sleep/recovery are poor
  const psychMod   = 1 + state.psychological_load_modifier * 0.04;

  const raw = targetPeakWeekHours * loadFactor * psychMod;
  return parseFloat(
    clamp(raw, 1, targetPeakWeekHours * 1.05).toFixed(2)
  );
}

// ── Long session computation ──────────────────────────────────────────────────

/**
 * Compute target long session duration.
 *
 * Uses block-specific fraction ranges and enforces a safety cap based on
 * the athlete's recent max single-session exposure (prevents spikes).
 */
function _computeLongSession({
  weekVolumeHours,
  weekType,
  longSessionRange,
  targetPeakWeekHours,
  state,
}) {
  if (weekType === 'taper' || weekType === 'deload') {
    // Taper/deload: use the lower end of the range
    const ratio = longSessionRange.min;
    const raw   = weekVolumeHours * ratio;
    return parseFloat(clamp(raw, 0.5, targetPeakWeekHours * 0.40).toFixed(2));
  }

  // Normal loading week: midpoint of range
  const ratio = (longSessionRange.min + longSessionRange.max) / 2;
  let target  = weekVolumeHours * ratio;

  // Safety cap: don't spike more than 15% above the athlete's recent max single session
  const recentMax = state.max_single_session_28d || 0;
  if (recentMax > 0.5) {
    const exposureCap = recentMax * 1.15;
    target = Math.min(target, exposureCap);
  }

  // Absolute ceiling: 50% of peak week, floor: 30 minutes
  return parseFloat(
    clamp(target, 0.5, targetPeakWeekHours * 0.50).toFixed(2)
  );
}

// ── Session allocation ────────────────────────────────────────────────────────

/**
 * Determine session counts for the week.
 *
 * Rules:
 *   - Recovery/deload: 60% of days, 0 hard sessions
 *   - Taper: 75% of days, 1 hard session (reduce volume, maintain sharpness)
 *   - Loading: full days, key sessions gated by block type and athlete state
 *   - Novice / beginner / poor readiness: no hard sessions
 *   - Adherence risk: reduce session count slightly (increases completion rate)
 */
function _computeSessionAllocation({ blockType, weekType, daysPerWeek, state, bp }) {
  const { readiness_tier, adherence_risk, effective_level, training_age_proxy } = state;

  // Recovery / deload
  if (weekType === 'recovery' || weekType === 'deload') {
    return {
      targetSessions:      Math.max(2, Math.floor(daysPerWeek * 0.6)),
      targetHardSessions:  0,
    };
  }

  // Taper
  if (weekType === 'taper') {
    return {
      targetSessions:      Math.max(3, Math.floor(daysPerWeek * 0.75)),
      targetHardSessions:  1,
    };
  }

  // Foundation (readiness block): conservative, no hard work
  if (weekType === 'foundation' || blockType === 'readiness') {
    return {
      targetSessions:      Math.max(2, Math.floor(daysPerWeek * 0.8)),
      targetHardSessions:  0,
    };
  }

  // Normal loading week
  let sessions = daysPerWeek;

  // Reduce session count slightly for high adherence risk (improves completion rate)
  if (adherence_risk === 'high') {
    sessions = Math.max(2, sessions - 1);
  }

  // Hard sessions gated by: training age, readiness, and block type
  const isNoviceOrBeginner = training_age_proxy === 'novice' || effective_level === 'beginner';
  if (isNoviceOrBeginner || readiness_tier === 'low') {
    return { targetSessions: sessions, targetHardSessions: 0 };
  }

  const maxHardFromBlueprint = bp ? (bp.hardSessionsMax ?? 1) : 1;
  const maxHardFromSessions  = Math.floor(sessions * 0.33); // never more than 1/3 of sessions
  const targetHardSessions   = Math.min(maxHardFromBlueprint, maxHardFromSessions);

  return { targetSessions: sessions, targetHardSessions };
}

// ── Intensity distribution ────────────────────────────────────────────────────

/**
 * Compute intensity distribution for a week, adjusted for athlete state signals.
 *
 * Starting point = block type targets.
 * Adjusted for: readiness tier, sleep quality, recovery quality.
 *
 * When readiness or recovery is poor, we shift work toward easy.
 */
function _computeIntensityDist({ blockType, weekType, state }) {
  const { readiness_tier, sleep_quality, recovery_quality } = state;

  if (weekType === 'recovery' || weekType === 'deload') {
    return { easy: 92, moderate: 8, hard: 0 };
  }

  if (weekType === 'taper') {
    return { easy: 68, moderate: 22, hard: 10 };
  }

  const base = { ...INTENSITY_TARGETS[blockType] } || { easy: 80, moderate: 15, hard: 5 };
  let { easy, moderate, hard } = base;

  // Shift toward easy when athlete signals are poor
  let hardReduction = 0;
  if (sleep_quality    === 'poor')  hardReduction += 3;
  if (recovery_quality === 'poor')  hardReduction += 3;
  if (readiness_tier   === 'low')   hardReduction += 4;

  if (hardReduction > 0) {
    const trim = Math.min(hard, hardReduction);
    hard -= trim;
    easy += trim;
  }

  // Normalize to 100
  const total = easy + moderate + hard || 1;
  return {
    easy:     Math.round((easy     / total) * 100),
    moderate: Math.round((moderate / total) * 100),
    hard:     Math.round((hard     / total) * 100),
  };
}

// ── Human-readable metadata ───────────────────────────────────────────────────

function _weekTheme(blockType, posInBlock, blockLen, weekType) {
  if (weekType === 'recovery')   return 'Recovery Week';
  if (weekType === 'deload')     return 'Consolidation Week';
  if (weekType === 'taper')      return posInBlock === 0 ? 'Volume Reduction' : 'Race Prep';
  if (weekType === 'foundation') return 'Foundation Week';

  if (blockType === 'readiness') {
    if (posInBlock === 0)          return 'Rhythm Week';
    return 'Readiness Build';
  }
  if (blockType === 'base') {
    if (posInBlock === 0)          return 'Foundation';
    if (posInBlock === blockLen-1) return 'Base Cap';
    return 'Volume Build';
  }
  if (blockType === 'build') {
    if (posInBlock === 0)          return 'Quality Introduction';
    if (posInBlock === blockLen-1) return 'Build Cap';
    return 'Progressive Load';
  }
  if (blockType === 'specific_build') {
    if (posInBlock === 0)          return 'Race-Specific Entry';
    return 'Race-Specific Build';
  }
  if (blockType === 'peak') {
    return posInBlock === blockLen-1 ? 'Peak Sharpening' : 'Peak Load';
  }
  return 'Training';
}

function _weekObjective(blockType, posInBlock, blockLen, weekType, state) {
  if (weekType === 'recovery') return 'Active recovery — absorb training load and restore readiness.';
  if (weekType === 'deload')   return 'Consolidate fitness gains with reduced load.';

  if (weekType === 'taper') {
    if (posInBlock === 0) return 'Begin volume reduction. Maintain race-pace work to stay sharp.';
    return 'Final race preparation. Arrive fresh, maintain confidence.';
  }

  if (weekType === 'foundation') {
    return 'Establish training rhythm and movement quality. Keep effort conservative.';
  }

  const objectives = {
    readiness:      'Build movement consistency and aerobic confidence.',
    base:           'Accumulate easy aerobic volume and establish long-session routine.',
    build:          posInBlock < Math.floor(blockLen / 2)
                      ? 'Introduce quality work alongside base volume.'
                      : 'Develop event-specific fitness and tolerance to load.',
    specific_build: 'Execute race-specific sessions and build race-day confidence.',
    peak:           'Sustain high load with race-pace sharpening. Manage fatigue carefully.',
  };
  return objectives[blockType] || 'Execute training as planned.';
}

function _weekNotes(blockType, weekType, state, posInBlock) {
  const flags = [];

  if (state.readiness_tier === 'low') {
    flags.push('Readiness low — monitor effort carefully.');
  }
  if (state.sleep_quality === 'poor') {
    flags.push('Poor sleep reported — reduce intensity if needed.');
  }
  if (state.recovery_quality === 'poor') {
    flags.push('Poor recovery reported — prioritize easy work.');
  }
  if (state.adherence_risk === 'high' && weekType === 'loading') {
    flags.push('Adherence risk noted — session count slightly reduced.');
  }
  if (state.acute_to_chronic_ratio != null && state.acute_to_chronic_ratio > 1.3) {
    flags.push(`ACR elevated (${state.acute_to_chronic_ratio}) — watch for fatigue.`);
  }

  return flags.length > 0 ? flags.join(' ') : null;
}

// ── Plan validation ───────────────────────────────────────────────────────────

/**
 * Validate the generated plan for structural correctness.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlan(cycleParams, blocks, weeks) {
  const errors = [];

  if (!cycleParams.totalWeeks || cycleParams.totalWeeks < 4) {
    errors.push('Cycle must have at least 4 weeks.');
  }

  if (blocks.length === 0) {
    errors.push('Plan must have at least one block.');
  }

  // Blocks must be contiguous and cover all weeks
  let cursor = 1;
  for (const b of blocks) {
    if (b.start_week !== cursor) {
      errors.push(`Block ${b.block_number} starts at week ${b.start_week}, expected ${cursor}.`);
    }
    if (b.total_weeks < 2) {
      errors.push(`Block ${b.block_number} has only ${b.total_weeks} week(s); minimum is 2.`);
    }
    cursor = b.end_week + 1;
  }
  if (cursor - 1 !== cycleParams.totalWeeks) {
    errors.push(`Blocks cover ${cursor - 1} weeks but cycle is ${cycleParams.totalWeeks} weeks.`);
  }

  // Weeks must cover all week numbers
  const weekNumbers = new Set(weeks.map(w => w.week_number));
  for (let i = 1; i <= cycleParams.totalWeeks; i++) {
    if (!weekNumbers.has(i)) errors.push(`Week ${i} is missing from the plan.`);
  }

  // Volume safety: no week should exceed 110% of peak
  const maxAllowed = cycleParams.targetPeakWeekHours * 1.1;
  for (const w of weeks) {
    if (w.target_volume_hours > maxAllowed) {
      errors.push(
        `Week ${w.week_number} volume ${w.target_volume_hours}h exceeds safe limit of ${maxAllowed.toFixed(1)}h.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Generate a complete, personalized plan structure from goal and features.
 *
 * @param {object}      goal         - training_goals row
 * @param {object}      features     - computeFeatures() output
 * @param {object|null} athleteState - optional; derived internally if not provided
 * @returns {{ cycleParams, blocks, weeks, athleteState }}
 */
function generatePlan(goal, features, athleteState) {
  const state      = athleteState || deriveAthleteState(goal, features);
  const cycleParams = planCycle(goal, features, state);
  const blocks     = planBlocks(cycleParams, goal, state);

  // Reconcile totalWeeks: minimum-week enforcement in planBlocks may have
  // pushed the actual block sum above the originally-computed totalWeeks.
  // Update cycleParams so planWeeks and validatePlan agree with the real totals.
  const actualBlockWeeks = blocks.reduce((s, b) => s + b.total_weeks, 0);
  if (actualBlockWeeks !== cycleParams.totalWeeks) {
    cycleParams.totalWeeks = actualBlockWeeks;
    cycleParams.endDate    = toDateStr(addWeeks(parseDate(cycleParams.startDate), actualBlockWeeks));
  }

  const weeks = planWeeks(cycleParams, blocks, goal, state);

  const { valid, errors } = validatePlan(cycleParams, blocks, weeks);
  if (!valid) {
    throw new Error(`Planner validation failed:\n${errors.join('\n')}`);
  }

  return { cycleParams, blocks, weeks, athleteState: state };
}

module.exports = {
  generatePlan,
  planCycle,
  planBlocks,
  planWeeks,
  validatePlan,
  // Export constants for tests and other consumers
  BLOCK_BLUEPRINTS,
  BLOCK_META,
  INTENSITY_TARGETS,
  LONG_SESSION_TARGETS,
  GOAL_DEFAULTS,
};
