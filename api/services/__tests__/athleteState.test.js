/**
 * Tests for athleteState.js
 *
 * Covers derived athlete state logic across diverse athlete profiles:
 *   - low-readiness marathon user
 *   - beginner weight-loss user with poor sleep
 *   - intermediate 10k runner with good consistency
 *   - triathlete with swim limiter
 *   - hybrid strength + endurance user
 *
 * Run with: node --test api/services/__tests__/athleteState.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { deriveAthleteState } = require('../athleteState');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGoal(overrides = {}) {
  return {
    goal_type:    'base_fitness',
    level:        'intermediate',
    days_per_week: 4,
    event_date:   null,
    primary_sport: null,
    sleep_quality: null,
    recovery_quality: null,
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
    volume_28d_hours:       16,   // 4h/wk
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

// ── Basic structure ───────────────────────────────────────────────────────────

describe('deriveAthleteState — basic structure', () => {
  it('returns all required fields', () => {
    const state = deriveAthleteState(makeGoal(), makeFeatures());
    const required = [
      'primary_goal_family', 'goal_specificity', 'event_pressure',
      'days_per_week', 'time_budget_minutes', 'schedule_rigidity_score',
      'baseline_frequency_28d', 'baseline_volume_28d',
      'acute_load_7d', 'chronic_load_28d', 'acute_to_chronic_ratio',
      'max_single_session_28d', 'baseline_intensity_profile',
      'recovery_capacity_score', 'fatigue_risk_score', 'readiness_tier',
      'adherence_risk', 'consistency_score', 'training_age_proxy',
      'recovery_wave_pattern', 'needs_readiness_block', 'readiness_lead_in_weeks',
      'sport_readiness', 'primary_sport',
      'environment_preference_profile', 'psychological_load_modifier',
      'effective_level',
    ];
    for (const field of required) {
      assert.ok(Object.prototype.hasOwnProperty.call(state, field), `Missing field: ${field}`);
    }
  });

  it('does not throw on null goal and features', () => {
    assert.doesNotThrow(() => deriveAthleteState(null, null));
  });

  it('does not throw on empty objects', () => {
    assert.doesNotThrow(() => deriveAthleteState({}, {}));
  });
});

// ── Goal family classification ────────────────────────────────────────────────

describe('deriveAthleteState — goal family', () => {
  it('maps race goals to endurance_race', () => {
    for (const gt of ['race_5k','race_10k','race_half_marathon','race_marathon']) {
      const state = deriveAthleteState(makeGoal({ goal_type: gt }), makeFeatures());
      assert.strictEqual(state.primary_goal_family, 'endurance_race', `${gt} should be endurance_race`);
    }
  });

  it('maps weight_loss to weight_loss family', () => {
    const state = deriveAthleteState(makeGoal({ goal_type: 'weight_loss' }), makeFeatures());
    assert.strictEqual(state.primary_goal_family, 'weight_loss');
  });

  it('maps triathlon to triathlon family', () => {
    const state = deriveAthleteState(makeGoal({ goal_type: 'triathlon' }), makeFeatures());
    assert.strictEqual(state.primary_goal_family, 'triathlon');
  });

  it('maps base_fitness / general_performance to fitness', () => {
    for (const gt of ['base_fitness', 'general_performance']) {
      const state = deriveAthleteState(makeGoal({ goal_type: gt }), makeFeatures());
      assert.strictEqual(state.primary_goal_family, 'fitness');
    }
  });
});

// ── Event pressure ─────────────────────────────────────────────────────────────

describe('deriveAthleteState — event pressure', () => {
  it('returns 0 event pressure when no event date', () => {
    const state = deriveAthleteState(makeGoal({ event_date: null }), makeFeatures());
    assert.strictEqual(state.event_pressure, 0);
  });

  it('returns high event pressure when event is ≤4 weeks away', () => {
    const soon = new Date(Date.now() + 3 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const state = deriveAthleteState(makeGoal({ goal_type: 'race_5k', event_date: soon }), makeFeatures());
    assert.strictEqual(state.event_pressure, 100);
  });

  it('returns moderate event pressure when event is 10–12 weeks away', () => {
    const mid = new Date(Date.now() + 11 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const state = deriveAthleteState(makeGoal({ goal_type: 'race_marathon', event_date: mid }), makeFeatures());
    assert.ok(state.event_pressure >= 40 && state.event_pressure <= 80, `expected 40–80 got ${state.event_pressure}`);
  });

  it('returns low event pressure when event is >20 weeks away', () => {
    const far = new Date(Date.now() + 24 * 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const state = deriveAthleteState(makeGoal({ goal_type: 'race_marathon', event_date: far }), makeFeatures());
    assert.ok(state.event_pressure <= 20, `expected ≤20 got ${state.event_pressure}`);
  });
});

// ── ACR computation ───────────────────────────────────────────────────────────

describe('deriveAthleteState — acute-to-chronic ratio', () => {
  it('computes ACR when both loads exist', () => {
    const features = makeFeatures({
      volume_7d_hours:  8,  // acute = 8h
      volume_28d_hours: 16, // chronic = 4h/wk
    });
    const state = deriveAthleteState(makeGoal(), features);
    // ACR = 8 / 4 = 2.0
    assert.strictEqual(state.acute_to_chronic_ratio, 2.0);
  });

  it('returns null ACR when chronic load is near zero', () => {
    const state = deriveAthleteState(makeGoal(), makeFeatures({
      volume_7d_hours:  2,
      volume_28d_hours: 0,
    }));
    assert.strictEqual(state.acute_to_chronic_ratio, null);
  });

  it('flags elevated fatigue risk when ACR > 1.5', () => {
    const features = makeFeatures({ volume_7d_hours: 10, volume_28d_hours: 16 }); // ACR = 2.5
    const state = deriveAthleteState(makeGoal(), features);
    assert.ok(state.fatigue_risk_score >= 50, `expected ≥50 fatigue risk, got ${state.fatigue_risk_score}`);
  });
});

// ── Readiness tier ────────────────────────────────────────────────────────────

describe('deriveAthleteState — readiness tier', () => {
  it('returns high tier for good WHOOP recovery and low fatigue', () => {
    const features = makeFeatures({ avg_recovery_28d: 80 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.readiness_tier, 'high');
  });

  it('returns low tier for poor WHOOP recovery', () => {
    const features = makeFeatures({ avg_recovery_28d: 25 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.readiness_tier, 'low');
  });

  it('returns moderate tier for WHOOP recovery ~50', () => {
    const features = makeFeatures({ avg_recovery_28d: 55 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.readiness_tier, 'moderate');
  });

  it('incorporates HRV trend when no WHOOP recovery score', () => {
    const features = makeFeatures({ hrv_trend: 'declining' });
    const state = deriveAthleteState(makeGoal(), features);
    // declining HRV pushes recovery score down → readiness_tier low or moderate
    assert.ok(['low','moderate'].includes(state.readiness_tier));
  });
});

// ── Adherence risk ────────────────────────────────────────────────────────────

describe('deriveAthleteState — adherence risk', () => {
  it('returns low risk for consistent athlete', () => {
    const features = makeFeatures({ consistency_score: 100, active_weeks_of_last_4: 4 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.adherence_risk, 'low');
  });

  it('returns high risk for inconsistent athlete', () => {
    const features = makeFeatures({ consistency_score: 25, active_weeks_of_last_4: 1 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.adherence_risk, 'high');
  });

  it('returns moderate risk for partial consistency', () => {
    const features = makeFeatures({ consistency_score: 55, active_weeks_of_last_4: 2 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.adherence_risk, 'moderate');
  });
});

// ── Training age proxy ────────────────────────────────────────────────────────

describe('deriveAthleteState — training age proxy', () => {
  it('returns experienced for high freq / volume / consistency', () => {
    const features = makeFeatures({
      sessions_per_week: 5,
      volume_28d_hours:  32,
      consistency_score: 90,
    });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.training_age_proxy, 'experienced');
  });

  it('returns novice for very low activity', () => {
    const features = makeFeatures({
      sessions_per_week: 0.5,
      volume_28d_hours:  1,
      consistency_score: 10,
    });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.training_age_proxy, 'novice');
  });

  it('returns recreational for moderate activity', () => {
    const features = makeFeatures({
      sessions_per_week: 2.5,
      volume_28d_hours:  10,
      consistency_score: 60,
    });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.training_age_proxy, 'recreational');
  });
});

// ── Recovery wave pattern ─────────────────────────────────────────────────────

describe('deriveAthleteState — recovery wave pattern', () => {
  it('returns 2:1 for novice athlete', () => {
    const features = makeFeatures({ consistency_score: 20, sessions_per_week: 1 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.recovery_wave_pattern, '2:1');
  });

  it('returns 3:1 for recreational athlete', () => {
    const features = makeFeatures({ consistency_score: 65, sessions_per_week: 3 });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.recovery_wave_pattern, '3:1');
  });

  it('returns 3:1_flex for experienced athlete with good recovery', () => {
    const features = makeFeatures({
      consistency_score: 95,
      sessions_per_week: 6,
      volume_28d_hours:  40,
      avg_recovery_28d:  80,
    });
    const state = deriveAthleteState(makeGoal(), features);
    assert.strictEqual(state.recovery_wave_pattern, '3:1_flex');
  });
});

// ── Readiness block detection ─────────────────────────────────────────────────

describe('deriveAthleteState — readiness block', () => {
  it('does NOT add readiness block for fitness goal', () => {
    const state = deriveAthleteState(makeGoal({ goal_type: 'base_fitness' }), makeFeatures());
    assert.strictEqual(state.needs_readiness_block, false);
  });

  it('does NOT add readiness block for weight_loss goal', () => {
    const state = deriveAthleteState(makeGoal({ goal_type: 'weight_loss' }), makeFeatures());
    assert.strictEqual(state.needs_readiness_block, false);
  });

  it('adds readiness block for marathon novice with low frequency', () => {
    const features = makeFeatures({
      consistency_score:   20,
      active_weeks_of_last_4: 1,
      sessions_per_week:   1.0,
      volume_28d_hours:    4,
    });
    const state = deriveAthleteState(
      makeGoal({ goal_type: 'race_marathon' }),
      features
    );
    assert.strictEqual(state.needs_readiness_block, true, 'Marathon novice should need a readiness block');
    assert.ok(state.readiness_lead_in_weeks >= 2, `Expected ≥2 lead-in weeks, got ${state.readiness_lead_in_weeks}`);
  });

  it('does NOT add readiness block for experienced consistent runner', () => {
    const features = makeFeatures({
      consistency_score:      90,
      active_weeks_of_last_4: 4,
      sessions_per_week:      5,
      volume_28d_hours:       32,
      longest_session_hours:  1.5,
    });
    const state = deriveAthleteState(
      makeGoal({ goal_type: 'race_half_marathon' }),
      features
    );
    assert.strictEqual(state.needs_readiness_block, false);
  });
});

// ── Psychological modifiers ───────────────────────────────────────────────────

describe('deriveAthleteState — psychological modifiers', () => {
  it('poor sleep reduces psychological_load_modifier', () => {
    const state = deriveAthleteState(
      makeGoal({ sleep_quality: 'poor' }),
      makeFeatures()
    );
    assert.ok(state.psychological_load_modifier < 0, 'Poor sleep should reduce load modifier');
  });

  it('poor sleep AND poor recovery compound the reduction', () => {
    const stateNormal = deriveAthleteState(makeGoal(), makeFeatures());
    const statePoor   = deriveAthleteState(
      makeGoal({ sleep_quality: 'poor', recovery_quality: 'poor' }),
      makeFeatures()
    );
    assert.ok(
      statePoor.psychological_load_modifier < stateNormal.psychological_load_modifier,
      'Compound poor signals should yield lower modifier'
    );
    assert.ok(statePoor.psychological_load_modifier <= -1.5);
  });

  it('good sleep and recovery give a positive modifier', () => {
    const state = deriveAthleteState(
      makeGoal({ sleep_quality: 'good', recovery_quality: 'good' }),
      makeFeatures()
    );
    assert.ok(state.psychological_load_modifier > 0);
  });

  it('modifier is clamped to [-2, +1]', () => {
    const state = deriveAthleteState(
      makeGoal({ sleep_quality: 'poor', recovery_quality: 'poor' }),
      makeFeatures()
    );
    assert.ok(state.psychological_load_modifier >= -2);
    assert.ok(state.psychological_load_modifier <= 1);
  });
});

// ── Effective level (conservative composite) ───────────────────────────────────

describe('deriveAthleteState — effective level', () => {
  it('derates advanced self-report when training age is novice', () => {
    const features = makeFeatures({
      sessions_per_week: 0.5,
      volume_28d_hours: 1,
      consistency_score: 10,
    });
    const state = deriveAthleteState(makeGoal({ level: 'advanced' }), features);
    // novice training age → effective level should be beginner (conservative)
    assert.strictEqual(state.effective_level, 'beginner');
  });

  it('keeps self-reported level when training age matches or is higher', () => {
    const features = makeFeatures({
      sessions_per_week: 5,
      volume_28d_hours: 36,
      consistency_score: 90,
    });
    const state = deriveAthleteState(makeGoal({ level: 'intermediate' }), features);
    // experienced training age → effective level can be intermediate or better
    assert.ok(['intermediate','advanced'].includes(state.effective_level));
  });
});

// ── Sport readiness ───────────────────────────────────────────────────────────

describe('deriveAthleteState — sport readiness', () => {
  it('detects swim limiter for triathlete with low swim %', () => {
    const features = makeFeatures({
      sport_mix: { Run: 60, Ride: 35, Swim: 5 },
    });
    const state = deriveAthleteState(makeGoal({ goal_type: 'triathlon' }), features);
    assert.strictEqual(state.sport_readiness.swim_ready, false);
    assert.ok(
      state.sport_readiness.notes.some(n => n.toLowerCase().includes('swim')),
      'Should flag swim as a limiter'
    );
  });

  it('marks all sports ready for balanced triathlete', () => {
    const features = makeFeatures({
      sport_mix: { Run: 34, Ride: 34, Swim: 32 },
    });
    const state = deriveAthleteState(makeGoal({ goal_type: 'triathlon' }), features);
    assert.strictEqual(state.sport_readiness.run_ready,  true);
    assert.strictEqual(state.sport_readiness.bike_ready, true);
    assert.strictEqual(state.sport_readiness.swim_ready, true);
  });
});

// ── Full persona tests ─────────────────────────────────────────────────────────

describe('deriveAthleteState — persona: low-readiness marathon user', () => {
  it('correctly classifies all key state dimensions', () => {
    const features = makeFeatures({
      avg_recovery_28d:       28,  // poor WHOOP recovery
      consistency_score:      35,
      active_weeks_of_last_4: 1,
      sessions_per_week:      1.5,
      volume_28d_hours:       6,
      longest_session_hours:  0.75,
      hrv_trend:              'declining',
      recovery_trend:         'declining',
    });
    const goal = makeGoal({
      goal_type:  'race_marathon',
      level:      'intermediate',
      days_per_week: 4,
    });
    const state = deriveAthleteState(goal, features);

    assert.strictEqual(state.readiness_tier,          'low');
    assert.strictEqual(state.needs_readiness_block,   true);
    assert.ok(state.readiness_lead_in_weeks >= 2);
    assert.ok(['high','moderate'].includes(state.adherence_risk));
    assert.ok(state.recovery_wave_pattern !== '3:1_flex', 'Should not use aggressive wave');
    assert.ok(state.fatigue_risk_score >= 30, 'Should flag some fatigue risk');
  });
});

describe('deriveAthleteState — persona: beginner weight-loss user with poor sleep', () => {
  it('correctly classifies all key state dimensions', () => {
    const features = makeFeatures({
      has_strava:             true,
      has_whoop:              false,
      sessions_per_week:      1.5,
      volume_28d_hours:       5,
      consistency_score:      40,
      active_weeks_of_last_4: 2,
      longest_session_hours:  0.75,
    });
    const goal = makeGoal({
      goal_type:        'weight_loss',
      level:            'beginner',
      sleep_quality:    'poor',
      recovery_quality: 'poor',
    });
    const state = deriveAthleteState(goal, features);

    assert.strictEqual(state.primary_goal_family, 'weight_loss');
    assert.strictEqual(state.needs_readiness_block, false, 'Weight-loss never needs lead-in block');
    assert.strictEqual(state.effective_level, 'beginner');
    assert.ok(state.psychological_load_modifier < 0, 'Poor sleep+recovery should reduce load modifier');
    assert.strictEqual(state.recovery_wave_pattern, '2:1', 'Novice/poor recovery should use 2:1 wave');
    assert.strictEqual(state.training_age_proxy, 'novice');
  });
});

describe('deriveAthleteState — persona: intermediate 10k runner with good consistency', () => {
  it('correctly classifies all key state dimensions', () => {
    const features = makeFeatures({
      sessions_per_week:      4,
      volume_28d_hours:       24,  // 6h/wk
      consistency_score:      90,
      active_weeks_of_last_4: 4,
      longest_session_hours:  1.5,
      avg_recovery_28d:       68,
    });
    const goal = makeGoal({ goal_type: 'race_10k', level: 'intermediate' });
    const state = deriveAthleteState(goal, features);

    assert.strictEqual(state.primary_goal_family, 'endurance_race');
    assert.strictEqual(state.adherence_risk, 'low');
    assert.ok(['moderate','high'].includes(state.readiness_tier));
    assert.strictEqual(state.needs_readiness_block, false);
    assert.ok(['3:1','3:1_flex'].includes(state.recovery_wave_pattern));
    assert.ok(['recreational','experienced'].includes(state.training_age_proxy));
  });
});

describe('deriveAthleteState — persona: triathlete with swim limiter', () => {
  it('detects swim limiter and flags sport readiness correctly', () => {
    const features = makeFeatures({
      sessions_per_week: 5,
      volume_28d_hours:  30,
      consistency_score: 80,
      active_weeks_of_last_4: 4,
      sport_mix: { Run: 55, Ride: 40, Swim: 5 }, // swim under-represented
      primary_sport: 'Run',
    });
    const goal = makeGoal({ goal_type: 'triathlon', level: 'intermediate' });
    const state = deriveAthleteState(goal, features);

    assert.strictEqual(state.primary_goal_family, 'triathlon');
    assert.strictEqual(state.sport_readiness.swim_ready, false);
    assert.strictEqual(state.sport_readiness.run_ready,  true);
    assert.strictEqual(state.sport_readiness.bike_ready, true);
    assert.ok(state.sport_readiness.notes.length > 0);
  });
});

describe('deriveAthleteState — persona: hybrid strength + endurance user', () => {
  it('derives a sensible state for mixed-sport user', () => {
    const features = makeFeatures({
      sessions_per_week:  4,
      volume_28d_hours:   18,
      consistency_score:  75,
      active_weeks_of_last_4: 3,
      sport_mix: { Run: 50, Strength: 50 },
      primary_sport: 'Run',
    });
    const goal = makeGoal({ goal_type: 'general_performance', level: 'intermediate' });
    const state = deriveAthleteState(goal, features);

    assert.strictEqual(state.primary_goal_family, 'fitness');
    assert.strictEqual(state.adherence_risk, 'low');
    assert.doesNotThrow(() => deriveAthleteState(goal, features));
    assert.ok(state.effective_level, 'Should always have effective_level');
  });
});

// ── Long-run exposure safety ──────────────────────────────────────────────────

describe('deriveAthleteState — long-session exposure', () => {
  it('tracks max_long_run_28d for running goals', () => {
    const features = makeFeatures({ longest_session_hours: 2.0 });
    const state = deriveAthleteState(makeGoal({ goal_type: 'race_marathon' }), features);
    assert.strictEqual(state.max_long_run_28d, 2.0);
  });

  it('max_long_run_28d is null for non-running goals', () => {
    const features = makeFeatures({ sport_mix: { Ride: 100 }, primary_sport: 'Ride' });
    const goal     = makeGoal({ goal_type: 'base_fitness', primary_sport: 'Ride' });
    const state    = deriveAthleteState(goal, features);
    assert.strictEqual(state.max_long_run_28d, null);
  });
});
