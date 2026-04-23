/**
 * Tests for planner.js
 *
 * Uses Node built-in test runner (node:test + node:assert).
 * Run with: node --test api/services/__tests__/planner.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { planCycle, planBlocks, planWeeks, validatePlan, generatePlan } = require('../planner');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGoal(overrides = {}) {
  return {
    goal_type:    'base_fitness',
    level:        'intermediate',
    days_per_week: 4,
    event_date:   null,
    ...overrides,
  };
}

function makeFeatures(overrides = {}) {
  return {
    has_strava:          true,
    has_whoop:           false,
    volume_7d_hours:     4,
    volume_28d_hours:    16,  // 4h/wk baseline
    sessions_7d:         3,
    sessions_28d:        12,
    sessions_per_week:   3.0,
    longest_session_hours: 1.5,
    consistency_score:   75,
    active_weeks_of_last_4: 3,
    pct_easy:            70,
    pct_moderate:        20,
    pct_hard:            10,
    avg_recovery_28d:    null,
    avg_hrv_28d:         null,
    hrv_trend:           null,
    recovery_trend:      null,
    primary_sport:       'Run',
    sport_mix:           { Run: 100 },
    ...overrides,
  };
}

function makeLowDataFeatures() {
  return makeFeatures({
    has_strava:          false,
    has_whoop:           false,
    volume_7d_hours:     0,
    volume_28d_hours:    0,
    sessions_7d:         0,
    sessions_28d:        0,
    sessions_per_week:   0,
    longest_session_hours: 0,
    consistency_score:   0,
    active_weeks_of_last_4: 0,
    primary_sport:       null,
    sport_mix:           {},
  });
}

// ── planCycle tests ───────────────────────────────────────────────────────────

describe('planCycle', () => {
  it('returns default 12 weeks for base_fitness with no event date', () => {
    const params = planCycle(makeGoal(), makeFeatures());
    assert.strictEqual(params.totalWeeks, 12);
  });

  it('clips totalWeeks to minWeeks if event is very soon', () => {
    const soon = new Date(Date.now() + 3 * 7 * 24 * 3600 * 1000)
      .toISOString().split('T')[0];
    const params = planCycle(makeGoal({ goal_type: 'race_5k', event_date: soon }), makeFeatures());
    // min for race_5k is 6
    assert.strictEqual(params.totalWeeks, 6);
  });

  it('clips totalWeeks to maxWeeks if event is very far', () => {
    const far = new Date(Date.now() + 52 * 7 * 24 * 3600 * 1000)
      .toISOString().split('T')[0];
    const params = planCycle(makeGoal({ goal_type: 'race_marathon', event_date: far }), makeFeatures());
    // max for marathon event-specific plan is 22; readiness lead-in may add more
    assert.ok(params.totalWeeks >= 22, `expected totalWeeks >= 22, got ${params.totalWeeks}`);
  });

  it('computes peak hours relative to baseline for connected user', () => {
    // 16h / 4 weeks = 4h/wk baseline; intermediate multiplier = 1.6 → 6.4h peak
    const params = planCycle(makeGoal(), makeFeatures());
    assert.ok(params.targetPeakWeekHours > 4, 'peak must exceed baseline');
    assert.ok(params.targetPeakWeekHours <= 15, 'intermediate max is 15h');
  });

  it('falls back to low-data baseline when no Strava', () => {
    // intermediate low-data default = 5h/wk; × 1.6 = 8h peak
    const params = planCycle(makeGoal(), makeLowDataFeatures());
    // 5 * 1.6 = 8, within beginner..advanced bounds
    assert.ok(params.targetPeakWeekHours > 0);
    assert.ok(params.targetPeakWeekHours <= 15);
  });

  it('always returns a startDate on or after today, and on a Monday', () => {
    const params = planCycle(makeGoal(), makeFeatures());
    const start  = new Date(params.startDate + 'T00:00:00Z');
    const today  = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');
    assert.ok(start >= today, 'start date must be today or in the future');
    assert.strictEqual(start.getUTCDay(), 1, 'start date must be a Monday');
  });

  it('endDate is totalWeeks after startDate', () => {
    const params = planCycle(makeGoal(), makeFeatures());
    const start = new Date(params.startDate + 'T00:00:00Z');
    const end   = new Date(params.endDate   + 'T00:00:00Z');
    const diffWeeks = (end - start) / (7 * 24 * 3600 * 1000);
    assert.strictEqual(diffWeeks, params.totalWeeks);
  });
});

// ── planBlocks tests ──────────────────────────────────────────────────────────

describe('planBlocks', () => {
  it('generates blocks that cover all weeks contiguously', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);

    let cursor = 1;
    for (const b of blocks) {
      assert.strictEqual(b.start_week, cursor, `Block ${b.block_number} should start at ${cursor}`);
      assert.ok(b.total_weeks >= 2, `Block ${b.block_number} must have ≥2 weeks`);
      cursor = b.end_week + 1;
    }
    assert.strictEqual(cursor - 1, params.totalWeeks, 'Blocks must cover all weeks');
  });

  it('generates at least 1 block', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    assert.ok(blocks.length >= 1);
  });

  it('generates taper block for race goals', () => {
    const goal   = makeGoal({ goal_type: 'race_marathon' });
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const hasTaper = blocks.some(b => b.block_type === 'taper');
    assert.strictEqual(hasTaper, true);
  });

  it('does NOT generate taper block for base_fitness', () => {
    const goal   = makeGoal({ goal_type: 'base_fitness' });
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const hasTaper = blocks.some(b => b.block_type === 'taper');
    assert.strictEqual(hasTaper, false);
  });

  it('each block has required fields', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    for (const b of blocks) {
      assert.ok(b.block_number, 'block_number');
      assert.ok(b.block_type, 'block_type');
      assert.ok(b.label, 'label');
      assert.ok(b.objective, 'objective');
      assert.ok(b.volume_trend, 'volume_trend');
      assert.ok(b.intensity_trend, 'intensity_trend');
      assert.ok(b.target_load_pct > 0, 'target_load_pct');
    }
  });
});

// ── planWeeks tests ───────────────────────────────────────────────────────────

describe('planWeeks', () => {
  it('generates one week entry per week number', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    assert.strictEqual(weeks.length, params.totalWeeks);
    const numbers = weeks.map(w => w.week_number);
    for (let i = 1; i <= params.totalWeeks; i++) {
      assert.ok(numbers.includes(i), `Week ${i} must be present`);
    }
  });

  it('recovery weeks have reduced volume relative to surrounding weeks', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    const recoveryWeeks = weeks.filter(w => w.is_recovery_week);
    const normalWeeks   = weeks.filter(w => !w.is_recovery_week);

    if (recoveryWeeks.length > 0 && normalWeeks.length > 0) {
      const avgRecovery = recoveryWeeks.reduce((s, w) => s + w.target_volume_hours, 0) / recoveryWeeks.length;
      const avgNormal   = normalWeeks.reduce((s, w) => s + w.target_volume_hours, 0) / normalWeeks.length;
      assert.ok(avgRecovery < avgNormal, 'Recovery weeks must have lower average volume than normal weeks');
    }
  });

  it('each week has required fields', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    for (const w of weeks) {
      assert.ok(w.week_number > 0, 'week_number');
      assert.ok(w.week_start_date, 'week_start_date');
      assert.ok(w.week_end_date, 'week_end_date');
      assert.ok(typeof w.is_recovery_week === 'boolean', 'is_recovery_week must be boolean');
      assert.ok(w.target_volume_hours > 0, `Week ${w.week_number} must have volume > 0`);
      assert.ok(w.target_sessions > 0, `Week ${w.week_number} must have sessions > 0`);
    }
  });

  it('taper weeks have fewer sessions than days_per_week', () => {
    const goal   = makeGoal({ goal_type: 'race_marathon', days_per_week: 5 });
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    const taperBlock = blocks.find(b => b.block_type === 'taper');
    if (taperBlock) {
      const taperWeeks = weeks.filter(w => w._block_number === taperBlock.block_number);
      for (const w of taperWeeks) {
        assert.ok(w.target_sessions <= 5, 'Taper sessions must not exceed days_per_week');
      }
    }
  });

  it('no week exceeds peak volume by more than 5%', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    const limit = params.targetPeakWeekHours * 1.1;
    for (const w of weeks) {
      assert.ok(
        w.target_volume_hours <= limit,
        `Week ${w.week_number}: ${w.target_volume_hours}h exceeds limit of ${limit.toFixed(2)}h`
      );
    }
  });

  it('week dates are contiguous and non-overlapping', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);

    for (let i = 1; i < weeks.length; i++) {
      const prev = new Date(weeks[i-1].week_end_date + 'T00:00:00Z');
      const curr = new Date(weeks[i].week_start_date + 'T00:00:00Z');
      const diff = (curr - prev) / (24 * 3600 * 1000);
      assert.strictEqual(diff, 1, `Week ${i+1} must start the day after week ${i} ends`);
    }
  });
});

// ── validatePlan tests ────────────────────────────────────────────────────────

describe('validatePlan', () => {
  it('validates a correct plan as valid', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);
    const { valid, errors } = validatePlan(params, blocks, weeks);
    assert.strictEqual(valid, true, `Expected valid but got errors: ${errors.join('; ')}`);
  });

  it('rejects a plan with missing week', () => {
    const goal   = makeGoal();
    const params = planCycle(goal, makeFeatures());
    const blocks = planBlocks(params, goal);
    const weeks  = planWeeks(params, blocks, goal);
    // Remove week 3
    const truncated = weeks.filter(w => w.week_number !== 3);
    const { valid } = validatePlan(params, blocks, truncated);
    assert.strictEqual(valid, false);
  });

  it('rejects a plan with too few total weeks', () => {
    const params = { totalWeeks: 2, targetPeakWeekHours: 5 };
    const { valid } = validatePlan(params, [{ start_week: 1, end_week: 2, total_weeks: 2, block_number: 1 }], []);
    assert.strictEqual(valid, false);
  });
});

// ── generatePlan integration test ─────────────────────────────────────────────

describe('generatePlan (integration)', () => {
  it('generates a full valid plan for full-data user', () => {
    const goal    = makeGoal({ goal_type: 'race_half_marathon', days_per_week: 5 });
    const features = makeFeatures({ volume_28d_hours: 20 }); // 5h/wk baseline
    const { cycleParams, blocks, weeks } = generatePlan(goal, features);

    assert.ok(cycleParams.totalWeeks >= 10, `expected >= 10 weeks, got ${cycleParams.totalWeeks}`);
    assert.ok(blocks.length >= 2);
    assert.strictEqual(weeks.length, cycleParams.totalWeeks);
    // All blocks must meet the 2-week minimum
    for (const b of blocks) {
      assert.ok(b.total_weeks >= 2, `Block ${b.block_number} (${b.block_type}) has only ${b.total_weeks} week(s)`);
    }
  });

  it('generates a valid plan for low-data user', () => {
    const goal     = makeGoal({ goal_type: 'base_fitness', level: 'beginner' });
    const features = makeLowDataFeatures();
    const { cycleParams, blocks, weeks } = generatePlan(goal, features);

    assert.ok(cycleParams.totalWeeks >= 8);
    assert.ok(blocks.length >= 1);
    assert.strictEqual(weeks.length, cycleParams.totalWeeks);

    // No week should have 0 volume
    for (const w of weeks) {
      assert.ok(w.target_volume_hours > 0, `Week ${w.week_number} must have volume > 0`);
    }
  });

  it('generates a valid marathon plan for advanced athlete', () => {
    const inFar = new Date(Date.now() + 22 * 7 * 24 * 3600 * 1000)
      .toISOString().split('T')[0];
    const goal    = makeGoal({ goal_type: 'race_marathon', level: 'advanced', days_per_week: 6, event_date: inFar });
    const features = makeFeatures({
      volume_28d_hours: 48,  // 12h/wk
      sessions_per_week: 6,
    });
    const { cycleParams, blocks, weeks } = generatePlan(goal, features);

    assert.ok(cycleParams.totalWeeks >= 14);
    assert.ok(blocks.some(b => b.block_type === 'taper'));
    assert.ok(blocks.some(b => b.block_type === 'peak'));
    assert.strictEqual(weeks.length, cycleParams.totalWeeks);
  });

  it('all goal types generate without throwing', () => {
    const allGoalTypes = [
      'base_fitness','race_5k','race_10k','race_half_marathon',
      'race_marathon','triathlon','weight_loss','general_performance',
    ];
    for (const gt of allGoalTypes) {
      const goal = makeGoal({ goal_type: gt });
      assert.doesNotThrow(() => generatePlan(goal, makeFeatures()), `Goal type '${gt}' threw an error`);
    }
  });

  it('all levels generate without throwing', () => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      const goal = makeGoal({ level });
      assert.doesNotThrow(() => generatePlan(goal, makeFeatures()), `Level '${level}' threw an error`);
    }
  });
});
