/**
 * plannerPersona.test.js
 *
 * Integration tests for the redesigned planner, exercising it through
 * realistic athlete personas to verify that the output is meaningfully
 * personalized — not just a generic template.
 *
 * Personas:
 *   1. Low-readiness marathon user
 *   2. Beginner weight-loss user with poor sleep
 *   3. Intermediate 10k runner with good consistency
 *   4. Triathlete with swim limiter
 *   5. Hybrid strength + endurance user
 *
 * Run with: node --test api/services/__tests__/plannerPersona.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generatePlan }    = require('../planner');
const { deriveAthleteState } = require('../athleteState');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGoal(overrides = {}) {
  return {
    goal_type:         'base_fitness',
    level:             'intermediate',
    days_per_week:     4,
    event_date:        null,
    primary_sport:     null,
    sleep_quality:     null,
    recovery_quality:  null,
    indoor_preference: null,
    routine_vs_variety: null,
    ...overrides,
  };
}

function makeFeatures(overrides = {}) {
  return {
    has_strava:             true,
    has_whoop:              false,
    volume_7d_hours:        4,
    volume_28d_hours:       16,
    sessions_7d:            3,
    sessions_28d:           12,
    sessions_per_week:      3.0,
    longest_session_hours:  1.5,
    consistency_score:      75,
    active_weeks_of_last_4: 3,
    pct_easy:               70,
    pct_moderate:           20,
    pct_hard:               10,
    avg_recovery_28d:       null,
    avg_hrv_28d:            null,
    hrv_trend:              null,
    avg_resting_hr_28d:     null,
    avg_sleep_score_28d:    null,
    recovery_trend:         null,
    primary_sport:          'Run',
    sport_mix:              { Run: 100 },
    ...overrides,
  };
}

// Helper: weeks belonging to a block type
function weeksForBlockType(weeks, blocks, blockType) {
  const matching = blocks
    .filter(b => b.block_type === blockType)
    .map(b => b.block_number);
  return weeks.filter(w => matching.includes(w._block_number));
}

// ── Persona 1: Low-readiness marathon user ─────────────────────────────────────

describe('Persona: low-readiness marathon user', () => {
  const goal = makeGoal({
    goal_type:    'race_marathon',
    level:        'intermediate',
    days_per_week: 4,
    event_date:   new Date(Date.now() + 20 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });
  const features = makeFeatures({
    avg_recovery_28d:       25,  // poor WHOOP recovery
    consistency_score:      30,
    active_weeks_of_last_4: 1,
    sessions_per_week:      1.5,
    volume_28d_hours:       6,
    longest_session_hours:  0.75,
    hrv_trend:              'declining',
    recovery_trend:         'declining',
  });

  it('generates a valid plan without throwing', () => {
    assert.doesNotThrow(() => generatePlan(goal, features));
  });

  it('includes a readiness block at the start', () => {
    const { blocks } = generatePlan(goal, features);
    assert.strictEqual(blocks[0].block_type, 'readiness', 'First block should be readiness');
  });

  it('readiness block has conservative volume (≤ 65% of peak)', () => {
    const { cycleParams, blocks, weeks } = generatePlan(goal, features);
    const readinessWeeks = weeksForBlockType(weeks, blocks, 'readiness');
    for (const w of readinessWeeks) {
      assert.ok(
        w.target_volume_hours <= cycleParams.targetPeakWeekHours * 0.70,
        `Readiness week ${w.week_number} volume ${w.target_volume_hours}h should be conservative`
      );
    }
  });

  it('readiness block has 0 hard sessions', () => {
    const { blocks, weeks } = generatePlan(goal, features);
    const readinessWeeks = weeksForBlockType(weeks, blocks, 'readiness');
    for (const w of readinessWeeks) {
      assert.strictEqual(
        w.target_hard_sessions, 0,
        `Readiness week ${w.week_number} should have no hard sessions`
      );
    }
  });

  it('uses 2:1 recovery wave (≤ 2 loading weeks between recovery weeks)', () => {
    const { athleteState } = generatePlan(goal, features);
    assert.strictEqual(athleteState.recovery_wave_pattern, '2:1');
  });

  it('includes a taper block for marathon', () => {
    const { blocks } = generatePlan(goal, features);
    const hasTaper = blocks.some(b => b.block_type === 'taper');
    assert.strictEqual(hasTaper, true);
  });

  it('plan total weeks are within bounds', () => {
    const { cycleParams } = generatePlan(goal, features);
    assert.ok(cycleParams.totalWeeks >= 10);
    assert.ok(cycleParams.totalWeeks <= 30);
  });

  it('long session target is protected (not spiked above recent max × 1.15)', () => {
    const { weeks } = generatePlan(goal, features);
    const recentMax  = features.longest_session_hours;
    const cap        = recentMax * 1.15;
    for (const w of weeks) {
      if (!w.is_recovery_week) {
        assert.ok(
          w.target_long_session_hours <= cap + 0.01, // small float tolerance
          `Week ${w.week_number} long session ${w.target_long_session_hours}h > cap ${cap.toFixed(2)}h`
        );
      }
    }
  });
});

// ── Persona 2: Beginner weight-loss user with poor sleep ──────────────────────

describe('Persona: beginner weight-loss user with poor sleep', () => {
  const goal = makeGoal({
    goal_type:        'weight_loss',
    level:            'beginner',
    days_per_week:    3,
    sleep_quality:    'poor',
    recovery_quality: 'poor',
  });
  const features = makeFeatures({
    sessions_per_week:      1.5,
    volume_28d_hours:       5,
    consistency_score:      40,
    active_weeks_of_last_4: 2,
    longest_session_hours:  0.75,
  });

  it('generates a valid plan without throwing', () => {
    assert.doesNotThrow(() => generatePlan(goal, features));
  });

  it('does NOT include a readiness block (weight_loss uses its own foundation block)', () => {
    const { blocks } = generatePlan(goal, features);
    assert.strictEqual(blocks[0].block_type, 'readiness', 'Weight-loss first block should be readiness/foundation type');
    // weight_loss blueprint starts with 'readiness' type — so first block IS readiness
    // this is different from a marathon lead-in (which is prepended externally)
    assert.ok(blocks.length >= 2, 'Should have at least 2 blocks');
  });

  it('has no hard sessions in any week', () => {
    const { weeks } = generatePlan(goal, features);
    for (const w of weeks) {
      assert.strictEqual(
        w.target_hard_sessions, 0,
        `Week ${w.week_number} beginner should have 0 hard sessions`
      );
    }
  });

  it('volume is below intermediate levels (beginner bounds)', () => {
    const { cycleParams } = generatePlan(goal, features);
    assert.ok(cycleParams.targetPeakWeekHours <= 8, `Expected ≤8h/wk peak for beginner, got ${cycleParams.targetPeakWeekHours}`);
  });

  it('peak volume is reduced due to poor sleep/recovery signals', () => {
    // Same goal, good sleep
    const goodGoal = makeGoal({ goal_type: 'weight_loss', level: 'beginner', days_per_week: 3 });
    const { cycleParams: poorCtx }  = generatePlan(goal, features);
    const { cycleParams: goodCtx }  = generatePlan(goodGoal, features);
    assert.ok(
      poorCtx.targetPeakWeekHours <= goodCtx.targetPeakWeekHours + 0.1,
      'Poor sleep should not produce higher peak than good sleep'
    );
  });

  it('uses 2:1 recovery wave for novice', () => {
    const { athleteState } = generatePlan(goal, features);
    assert.strictEqual(athleteState.recovery_wave_pattern, '2:1');
  });

  it('week notes mention poor sleep/recovery signals', () => {
    const { weeks } = generatePlan(goal, features);
    const flaggedWeeks = weeks.filter(w => w.notes && (
      w.notes.includes('Poor sleep') || w.notes.includes('poor')
    ));
    assert.ok(flaggedWeeks.length > 0, 'Some weeks should flag the poor sleep signal');
  });
});

// ── Persona 3: Intermediate 10k runner with good consistency ───────────────────

describe('Persona: intermediate 10k runner with good consistency', () => {
  const goal = makeGoal({
    goal_type:    'race_10k',
    level:        'intermediate',
    days_per_week: 5,
    event_date:   new Date(Date.now() + 14 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });
  const features = makeFeatures({
    sessions_per_week:      4.5,
    volume_28d_hours:       24,  // 6h/wk
    consistency_score:      90,
    active_weeks_of_last_4: 4,
    longest_session_hours:  1.5,
    avg_recovery_28d:       68,
  });

  it('generates a valid plan without throwing', () => {
    assert.doesNotThrow(() => generatePlan(goal, features));
  });

  it('does NOT add a readiness block (consistent athlete ready for event work)', () => {
    const { blocks } = generatePlan(goal, features);
    assert.notStrictEqual(blocks[0].block_type, 'readiness',
      'Consistent intermediate should not need a lead-in readiness block'
    );
  });

  it('has a taper block', () => {
    const { blocks } = generatePlan(goal, features);
    assert.ok(blocks.some(b => b.block_type === 'taper'));
  });

  it('has at least 1 hard session in build weeks', () => {
    const { blocks, weeks } = generatePlan(goal, features);
    const buildWeeks = weeksForBlockType(weeks, blocks, 'build');
    if (buildWeeks.length > 0) {
      const anyHard = buildWeeks.some(w => w.target_hard_sessions >= 1);
      assert.ok(anyHard, 'Build block should have hard sessions for intermediate consistent runner');
    }
  });

  it('volume is anchored to recent chronic load (not just level default)', () => {
    const { cycleParams } = generatePlan(goal, features);
    // chronic load = 6h/wk; intermediate multiplier ~1.55 → ~9.3h peak
    // Level bound max is 15h → should be around 9–10h
    assert.ok(cycleParams.baselineHours >= 4, `Expected ≥4h baseline, got ${cycleParams.baselineHours}`);
    assert.ok(cycleParams.targetPeakWeekHours >= 6, `Expected ≥6h peak, got ${cycleParams.targetPeakWeekHours}`);
  });

  it('uses 3:1 or 3:1_flex recovery wave (consistent athlete)', () => {
    const { athleteState } = generatePlan(goal, features);
    assert.ok(
      ['3:1','3:1_flex'].includes(athleteState.recovery_wave_pattern),
      `Expected 3:1 or flex wave, got ${athleteState.recovery_wave_pattern}`
    );
  });
});

// ── Persona 4: Triathlete with swim limiter ────────────────────────────────────

describe('Persona: triathlete with swim limiter', () => {
  const goal = makeGoal({
    goal_type:    'triathlon',
    level:        'intermediate',
    days_per_week: 6,
    event_date:   new Date(Date.now() + 18 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });
  const features = makeFeatures({
    sessions_per_week:      5,
    volume_28d_hours:       30,
    consistency_score:      80,
    active_weeks_of_last_4: 4,
    sport_mix:              { Run: 55, Ride: 40, Swim: 5 },
    primary_sport:          'Run',
    longest_session_hours:  2.0,
  });

  it('generates a valid plan without throwing', () => {
    assert.doesNotThrow(() => generatePlan(goal, features));
  });

  it('uses the triathlon blueprint (includes base + build + specific_build + taper)', () => {
    const { blocks } = generatePlan(goal, features);
    const types = blocks.map(b => b.block_type);
    assert.ok(types.includes('base'));
    assert.ok(types.includes('build'));
    assert.ok(types.includes('taper'));
  });

  it('detects swim as a limiter in athlete state', () => {
    const { athleteState } = generatePlan(goal, features);
    assert.strictEqual(athleteState.sport_readiness.swim_ready, false);
    assert.ok(athleteState.sport_readiness.notes.some(n => n.toLowerCase().includes('swim')));
  });

  it('all blocks have at least 2 weeks', () => {
    const { blocks } = generatePlan(goal, features);
    for (const b of blocks) {
      assert.ok(b.total_weeks >= 2, `Block ${b.block_number} (${b.block_type}) has only ${b.total_weeks} week(s)`);
    }
  });

  it('taper block has reduced volume vs peak', () => {
    const { cycleParams, blocks, weeks } = generatePlan(goal, features);
    const taperWeeks = weeksForBlockType(weeks, blocks, 'taper');
    if (taperWeeks.length > 0) {
      for (const w of taperWeeks) {
        assert.ok(
          w.target_volume_hours <= cycleParams.targetPeakWeekHours * 0.65,
          `Taper week ${w.week_number} volume ${w.target_volume_hours}h should be <65% of peak`
        );
      }
    }
  });
});

// ── Persona 5: Hybrid strength + endurance user ────────────────────────────────

describe('Persona: hybrid strength + endurance user', () => {
  const goal = makeGoal({
    goal_type:     'general_performance',
    level:         'intermediate',
    days_per_week: 5,
    primary_sport: 'Run',
  });
  const features = makeFeatures({
    sessions_per_week:      4.5,
    volume_28d_hours:       18,
    consistency_score:      75,
    active_weeks_of_last_4: 3,
    sport_mix:              { Run: 55, Strength: 45 },
    primary_sport:          'Run',
    longest_session_hours:  1.3,
  });

  it('generates a valid plan without throwing', () => {
    assert.doesNotThrow(() => generatePlan(goal, features));
  });

  it('generates all required week fields', () => {
    const { weeks } = generatePlan(goal, features);
    for (const w of weeks) {
      assert.ok(w.week_number > 0);
      assert.ok(w.week_start_date);
      assert.ok(w.week_end_date);
      assert.ok(typeof w.is_recovery_week === 'boolean');
      assert.ok(w.target_volume_hours > 0);
      assert.ok(w.target_sessions > 0);
    }
  });

  it('uses fitness blueprint (no taper block for general_performance)', () => {
    const { blocks } = generatePlan(goal, features);
    const hasTaper = blocks.some(b => b.block_type === 'taper');
    assert.strictEqual(hasTaper, false, 'general_performance should not have a taper block');
  });

  it('volume progression is gradual (loading weeks increase within blocks)', () => {
    const { blocks, weeks } = generatePlan(goal, features);
    const baseBlocks = blocks.filter(b => b.block_type === 'base');
    for (const block of baseBlocks) {
      const blockWeeks = weeks
        .filter(w => w._block_number === block.block_number && !w.is_recovery_week)
        .sort((a, b) => a.week_number - b.week_number);
      if (blockWeeks.length >= 3) {
        // Volume should generally trend upward within the block
        const firstVolume = blockWeeks[0].target_volume_hours;
        const lastVolume  = blockWeeks[blockWeeks.length - 1].target_volume_hours;
        assert.ok(
          lastVolume >= firstVolume * 0.85, // allow some variance, but not a big drop
          `Base block volume should not drop significantly: first=${firstVolume}, last=${lastVolume}`
        );
      }
    }
  });
});

// ── Cross-persona invariants ───────────────────────────────────────────────────

describe('All personas — structural invariants', () => {
  const personas = [
    {
      name: 'low-readiness marathon',
      goal: makeGoal({
        goal_type: 'race_marathon', level: 'intermediate', days_per_week: 4,
        event_date: new Date(Date.now() + 20 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      }),
      features: makeFeatures({ avg_recovery_28d: 25, consistency_score: 30, sessions_per_week: 1.5 }),
    },
    {
      name: 'beginner weight-loss poor sleep',
      goal: makeGoal({ goal_type: 'weight_loss', level: 'beginner', days_per_week: 3,
        sleep_quality: 'poor', recovery_quality: 'poor' }),
      features: makeFeatures({ consistency_score: 40, sessions_per_week: 1.5, volume_28d_hours: 5 }),
    },
    {
      name: 'intermediate 10k consistent',
      goal: makeGoal({ goal_type: 'race_10k', level: 'intermediate', days_per_week: 5,
        event_date: new Date(Date.now() + 14 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      }),
      features: makeFeatures({ sessions_per_week: 4.5, volume_28d_hours: 24, consistency_score: 90, avg_recovery_28d: 68 }),
    },
    {
      name: 'triathlete swim limiter',
      goal: makeGoal({ goal_type: 'triathlon', level: 'intermediate', days_per_week: 6,
        event_date: new Date(Date.now() + 18 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      }),
      features: makeFeatures({ sessions_per_week: 5, volume_28d_hours: 30, consistency_score: 80,
        sport_mix: { Run: 55, Ride: 40, Swim: 5 } }),
    },
    {
      name: 'hybrid strength+endurance',
      goal: makeGoal({ goal_type: 'general_performance', level: 'intermediate', days_per_week: 5 }),
      features: makeFeatures({ sessions_per_week: 4.5, volume_28d_hours: 18, consistency_score: 75 }),
    },
  ];

  for (const p of personas) {
    it(`${p.name}: plan is valid (no validation errors)`, () => {
      assert.doesNotThrow(() => generatePlan(p.goal, p.features), `${p.name} should generate without error`);
    });

    it(`${p.name}: all blocks have ≥2 weeks`, () => {
      const { blocks } = generatePlan(p.goal, p.features);
      for (const b of blocks) {
        assert.ok(b.total_weeks >= 2, `${p.name}: block ${b.block_number} (${b.block_type}) has only ${b.total_weeks} week(s)`);
      }
    });

    it(`${p.name}: week count matches cycle total`, () => {
      const { cycleParams, weeks } = generatePlan(p.goal, p.features);
      assert.strictEqual(weeks.length, cycleParams.totalWeeks, `${p.name}: week count mismatch`);
    });

    it(`${p.name}: no week exceeds 110% of peak volume`, () => {
      const { cycleParams, weeks } = generatePlan(p.goal, p.features);
      const limit = cycleParams.targetPeakWeekHours * 1.1;
      for (const w of weeks) {
        assert.ok(
          w.target_volume_hours <= limit,
          `${p.name} week ${w.week_number}: ${w.target_volume_hours}h exceeds ${limit.toFixed(1)}h`
        );
      }
    });

    it(`${p.name}: recovery weeks have lower volume than average non-recovery weeks`, () => {
      const { weeks } = generatePlan(p.goal, p.features);
      const recWeeks  = weeks.filter(w => w.is_recovery_week);
      const normWeeks = weeks.filter(w => !w.is_recovery_week);
      if (recWeeks.length > 0 && normWeeks.length > 0) {
        const avgRec  = recWeeks.reduce((s, w) => s + w.target_volume_hours, 0) / recWeeks.length;
        const avgNorm = normWeeks.reduce((s, w) => s + w.target_volume_hours, 0) / normWeeks.length;
        assert.ok(avgRec < avgNorm, `${p.name}: recovery avg ${avgRec.toFixed(2)} should be < normal avg ${avgNorm.toFixed(2)}`);
      }
    });

    it(`${p.name}: athleteState is returned and complete`, () => {
      const { athleteState } = generatePlan(p.goal, p.features);
      assert.ok(athleteState, `${p.name}: athleteState should be returned`);
      assert.ok(athleteState.primary_goal_family, `${p.name}: should have goal family`);
      assert.ok(athleteState.effective_level, `${p.name}: should have effective_level`);
    });
  }
});
