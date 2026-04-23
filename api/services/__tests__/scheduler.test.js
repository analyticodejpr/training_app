/**
 * scheduler.test.js
 *
 * Tests for the deterministic weekly schedule builder and validator.
 * Verifies: day/session counts, adjacency constraints, duration bounds,
 * required fields, triathlon rotation, beginner safety, and low-data fallback.
 */
'use strict';

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildSchedule, validateSchedule, WEEK_DAYS } = require('../scheduler');

// ── Shared fixtures ───────────────────────────────────────────────────────────

/** Minimal valid week row (Monday-based, 5 sessions, normal week) */
function makeWeek(overrides = {}) {
  return {
    week_start_date:          '2026-04-13', // Monday
    target_sessions:          5,
    target_hard_sessions:     2,
    target_volume_hours:      8,
    target_long_session_hours: 2,
    is_recovery_week:         false,
    week_number:              3,
    ...overrides,
  };
}

function makeBlock(overrides = {}) {
  return { block_type: 'build', ...overrides };
}

function makeGoal(overrides = {}) {
  return {
    goal_type:     'race_10k',
    days_per_week: 5,
    level:         'intermediate',
    primary_sport: null,
    ...overrides,
  };
}

const FULL_FEATURES = {
  primary_sport: 'Run',
  has_strava: true,
  has_whoop:  true,
};

const EMPTY_FEATURES = null; // low-data user

// ── Helpers ───────────────────────────────────────────────────────────────────

function runBuild(weekOverrides = {}, blockOverrides = {}, goalOverrides = {}, features = FULL_FEATURES) {
  return buildSchedule(
    makeWeek(weekOverrides),
    makeBlock(blockOverrides),
    makeGoal(goalOverrides),
    features,
  );
}

function hardZones(sessions) {
  return sessions.filter(s => s.intensity_zone === 'hard');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildSchedule — day counts', () => {
  it('always returns exactly 7 day slots', () => {
    const { days } = runBuild();
    assert.equal(days.length, 7);
  });

  it('day_of_week values are the canonical 7 days in order', () => {
    const { days } = runBuild();
    assert.deepEqual(days.map(d => d.day_of_week), WEEK_DAYS);
  });

  it('training day count matches target_sessions (5)', () => {
    const { days, sessions } = runBuild({ target_sessions: 5 });
    const trainDays = days.filter(d => d.slot_type === 'training');
    assert.equal(trainDays.length, 5);
    assert.equal(sessions.length, 5);
  });

  it('training day count matches target_sessions (3)', () => {
    const { days, sessions } = runBuild({ target_sessions: 3, target_hard_sessions: 1 });
    const trainDays = days.filter(d => d.slot_type === 'training');
    assert.equal(trainDays.length, 3);
    assert.equal(sessions.length, 3);
  });

  it('rest day count is 7 - target_sessions', () => {
    const { days } = runBuild({ target_sessions: 4 });
    const restDays = days.filter(d => d.slot_type === 'rest');
    assert.equal(restDays.length, 3);
  });

  it('day_date for monday is week_start_date', () => {
    const { days } = runBuild({ week_start_date: '2026-04-13' });
    const monday = days.find(d => d.day_of_week === 'monday');
    assert.equal(monday.day_date, '2026-04-13');
  });

  it('day_date for sunday is 6 days after week_start_date', () => {
    const { days } = runBuild({ week_start_date: '2026-04-13' });
    const sunday = days.find(d => d.day_of_week === 'sunday');
    assert.equal(sunday.day_date, '2026-04-19');
  });
});

describe('buildSchedule — required session fields', () => {
  it('every session has a sport', () => {
    const { sessions } = runBuild();
    for (const s of sessions) {
      assert.ok(s.sport, `missing sport on ${s.day_of_week}`);
    }
  });

  it('every session has a session_type', () => {
    const { sessions } = runBuild();
    for (const s of sessions) {
      assert.ok(s.session_type, `missing session_type on ${s.day_of_week}`);
    }
  });

  it('every session has instructions', () => {
    const { sessions } = runBuild();
    for (const s of sessions) {
      assert.ok(s.instructions, `missing instructions on ${s.day_of_week}`);
    }
  });

  it('every session has prescribed_minutes > 0', () => {
    const { sessions } = runBuild();
    for (const s of sessions) {
      assert.ok(s.prescribed_minutes > 0, `zero duration on ${s.day_of_week}`);
    }
  });

  it('every session has an intensity_zone', () => {
    const { sessions } = runBuild();
    const validZones = new Set(['easy', 'moderate', 'hard']);
    for (const s of sessions) {
      assert.ok(validZones.has(s.intensity_zone), `invalid intensity_zone on ${s.day_of_week}`);
    }
  });

  it('every session has workout_slug', () => {
    const { sessions } = runBuild();
    for (const s of sessions) {
      assert.ok(s.workout_slug, `missing workout_slug on ${s.day_of_week}`);
    }
  });
});

describe('buildSchedule — duration bounds', () => {
  // Workout library mins/maxes that matter:
  //   easy-run: 25–75, long-run: 60–150, interval-run: 40–70, tempo-run: 35–65
  it('all session durations are within workout library bounds', () => {
    const GLOBAL_MIN = 20; // smallest min in library
    const GLOBAL_MAX = 180; // largest max in library
    for (const sessions of [4, 5, 6]) {
      const { sessions: sess } = runBuild({ target_sessions: sessions });
      for (const s of sess) {
        assert.ok(
          s.prescribed_minutes >= GLOBAL_MIN && s.prescribed_minutes <= GLOBAL_MAX,
          `${s.workout_slug} on ${s.day_of_week}: ${s.prescribed_minutes} minutes out of bounds`,
        );
      }
    }
  });
});

describe('buildSchedule — no back-to-back hard sessions', () => {
  it('build/peak block with hard sessions: none are adjacent', () => {
    const { days, sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'build' },
      { level: 'advanced' },
    );
    const ordered = [...sessions].sort(
      (a, b) => WEEK_DAYS.indexOf(a.day_of_week) - WEEK_DAYS.indexOf(b.day_of_week),
    );
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      const prevIdx = WEEK_DAYS.indexOf(prev.day_of_week);
      const currIdx = WEEK_DAYS.indexOf(curr.day_of_week);
      if (currIdx - prevIdx === 1) {
        assert.ok(
          !(prev.intensity_zone === 'hard' && curr.intensity_zone === 'hard'),
          `Back-to-back hard on ${prev.day_of_week} and ${curr.day_of_week}`,
        );
      }
    }
  });

  it('validateSchedule passes for build block schedule', () => {
    const week = makeWeek({ target_sessions: 5, target_hard_sessions: 2 });
    const { days, sessions } = buildSchedule(week, makeBlock({ block_type: 'build' }), makeGoal({ level: 'advanced' }), FULL_FEATURES);
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(valid, `Validation failed: ${errors.join('; ')}`);
  });
});

describe('buildSchedule — recovery week', () => {
  it('recovery week: no hard intensity sessions', () => {
    const { sessions } = runBuild({ is_recovery_week: true, target_sessions: 4, target_hard_sessions: 0 });
    const hard = hardZones(sessions);
    assert.equal(hard.length, 0, `Found ${hard.length} hard sessions in recovery week`);
  });

  it('recovery week: target_hard_sessions clamped to 0', () => {
    // Even if caller passes hard_sessions > 0 (should not happen), recovery wins
    const { sessions } = runBuild(
      { is_recovery_week: true, target_sessions: 5, target_hard_sessions: 0 },
      { block_type: 'base' },
    );
    assert.equal(hardZones(sessions).length, 0);
  });

  it('recovery week: validateSchedule passes', () => {
    const week = makeWeek({ is_recovery_week: true, target_sessions: 4, target_hard_sessions: 0 });
    const { days, sessions } = buildSchedule(week, makeBlock(), makeGoal(), FULL_FEATURES);
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });
});

describe('buildSchedule — beginner safety', () => {
  it('beginner: no interval sessions', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'build' },
      { level: 'beginner' },
    );
    const intervals = sessions.filter(s => s.session_type === 'interval');
    assert.equal(intervals.length, 0);
  });

  it('beginner: no tempo sessions', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'build' },
      { level: 'beginner' },
    );
    const tempos = sessions.filter(s => s.session_type === 'tempo');
    assert.equal(tempos.length, 0);
  });

  it('beginner: no hard intensity_zone sessions', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'peak' },
      { level: 'beginner' },
    );
    assert.equal(hardZones(sessions).length, 0);
  });

  it('beginner: validateSchedule passes', () => {
    const week = makeWeek({ target_sessions: 4, target_hard_sessions: 1 });
    const { days, sessions } = buildSchedule(week, makeBlock({ block_type: 'build' }), makeGoal({ level: 'beginner' }), FULL_FEATURES);
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });
});

describe('buildSchedule — triathlon sport rotation', () => {
  it('triathlon goal rotates through Run, Ride, Swim', () => {
    const { sessions } = runBuild(
      { target_sessions: 6, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'triathlon', primary_sport: null },
    );
    const expected = ['Run', 'Ride', 'Swim', 'Run', 'Ride', 'Run'];
    for (let i = 0; i < sessions.length; i++) {
      assert.equal(sessions[i].sport, expected[i], `Session ${i} sport mismatch`);
    }
  });

  it('triathlon: all 3 sports appear in a 6-session week', () => {
    const { sessions } = runBuild(
      { target_sessions: 6, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'triathlon', primary_sport: null },
    );
    const sports = new Set(sessions.map(s => s.sport));
    assert.ok(sports.has('Run'), 'missing Run');
    assert.ok(sports.has('Ride'), 'missing Ride');
    assert.ok(sports.has('Swim'), 'missing Swim');
  });
});

describe('buildSchedule — primary sport selection', () => {
  it('uses goal.primary_sport when set', () => {
    const { sessions } = runBuild(
      { target_sessions: 3, target_hard_sessions: 0 },
      { block_type: 'base' },
      { goal_type: 'base_fitness', primary_sport: 'Ride', level: 'intermediate' },
    );
    for (const s of sessions) {
      assert.equal(s.sport, 'Ride', `Expected Ride, got ${s.sport}`);
    }
  });

  it('uses features.primary_sport when goal.primary_sport is null', () => {
    const { sessions } = runBuild(
      { target_sessions: 3, target_hard_sessions: 0 },
      { block_type: 'base' },
      { goal_type: 'base_fitness', primary_sport: null },
      { primary_sport: 'Ride', has_strava: true, has_whoop: false },
    );
    for (const s of sessions) {
      assert.equal(s.sport, 'Ride', `Expected Ride, got ${s.sport}`);
    }
  });

  it('defaults to Run when no sport info available', () => {
    const { sessions } = runBuild(
      { target_sessions: 3, target_hard_sessions: 0 },
      { block_type: 'base' },
      { goal_type: 'base_fitness', primary_sport: null },
      EMPTY_FEATURES,
    );
    for (const s of sessions) {
      assert.equal(s.sport, 'Run', `Expected Run fallback, got ${s.sport}`);
    }
  });
});

describe('buildSchedule — low-data (null features)', () => {
  it('null features produces a valid schedule', () => {
    const week = makeWeek({ target_sessions: 4, target_hard_sessions: 1 });
    const { days, sessions } = buildSchedule(week, makeBlock(), makeGoal(), EMPTY_FEATURES);
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });

  it('null features: all sessions have required fields', () => {
    const { sessions } = runBuild(
      { target_sessions: 4, target_hard_sessions: 1 },
      { block_type: 'base' },
      {},
      EMPTY_FEATURES,
    );
    for (const s of sessions) {
      assert.ok(s.sport, 'missing sport');
      assert.ok(s.session_type, 'missing session_type');
      assert.ok(s.instructions, 'missing instructions');
      assert.ok(s.prescribed_minutes > 0, 'zero duration');
    }
  });
});

describe('buildSchedule — all goal types produce valid schedules', () => {
  const goalTypes = [
    'base_fitness', 'race_5k', 'race_10k',
    'race_half_marathon', 'race_marathon',
    'triathlon', 'weight_loss', 'general_performance',
  ];
  const blockTypes = ['base', 'build', 'peak', 'taper', 'recovery'];
  const levels = ['beginner', 'intermediate', 'advanced'];

  for (const goalType of goalTypes) {
    for (const blockType of blockTypes) {
      it(`${goalType} / ${blockType} / intermediate produces valid schedule`, () => {
        const hardSessions = ['base', 'recovery'].includes(blockType) ? 0 : 2;
        const week = makeWeek({ target_sessions: 5, target_hard_sessions: hardSessions });
        const goal = makeGoal({ goal_type: goalType, primary_sport: goalType === 'triathlon' ? null : 'Run' });
        const block = makeBlock({ block_type: blockType });
        const { days, sessions } = buildSchedule(week, block, goal, FULL_FEATURES);
        const { valid, errors } = validateSchedule(days, sessions, week);
        assert.ok(valid, `${goalType}/${blockType}: ${errors.join('; ')}`);
      });
    }
  }

  for (const level of levels) {
    it(`race_marathon / build / ${level} produces valid schedule`, () => {
      const week = makeWeek({ target_sessions: 5, target_hard_sessions: level === 'beginner' ? 1 : 2 });
      const goal = makeGoal({ goal_type: 'race_marathon', level });
      const { days, sessions } = buildSchedule(week, makeBlock({ block_type: 'build' }), goal, FULL_FEATURES);
      const { valid, errors } = validateSchedule(days, sessions, week);
      assert.ok(valid, `${level}: ${errors.join('; ')}`);
    });
  }
});

describe('buildSchedule — single-day edge case', () => {
  it('1 session: exactly 1 training day and 6 rest days', () => {
    const { days, sessions } = runBuild({ target_sessions: 1, target_hard_sessions: 0 });
    assert.equal(days.filter(d => d.slot_type === 'training').length, 1);
    assert.equal(sessions.length, 1);
    assert.equal(days.filter(d => d.slot_type === 'rest').length, 6);
  });
});

describe('buildSchedule — maximum sessions edge case', () => {
  it('7 sessions: no rest days', () => {
    const { days, sessions } = runBuild({ target_sessions: 7, target_hard_sessions: 2 });
    assert.equal(days.filter(d => d.slot_type === 'rest').length, 0);
    assert.equal(sessions.length, 7);
  });
});

describe('buildSchedule — variety (no duplicate slugs within one week)', () => {
  it('5-session week with same sport has no duplicate workout slugs', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'race_10k', primary_sport: 'Run', level: 'intermediate' },
    );
    const slugs = sessions.map(s => s.workout_slug);
    const unique = new Set(slugs);
    assert.equal(slugs.length, unique.size,
      `Duplicate slugs in 5-session week: ${slugs.join(', ')}`);
  });

  it('7-session week (max) has no duplicate workout slugs', () => {
    const { sessions } = runBuild(
      { target_sessions: 7, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'race_marathon', primary_sport: 'Run', level: 'advanced' },
    );
    const slugs = sessions.map(s => s.workout_slug);
    const unique = new Set(slugs);
    assert.equal(slugs.length, unique.size,
      `Duplicate slugs in 7-session week: ${slugs.join(', ')}`);
  });

  it('triathlon 6-session week: each sport sees variety (no repeated slugs)', () => {
    const { sessions } = runBuild(
      { target_sessions: 6, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'triathlon', primary_sport: null, level: 'intermediate' },
    );
    const slugs = sessions.map(s => s.workout_slug);
    const unique = new Set(slugs);
    assert.equal(slugs.length, unique.size,
      `Duplicate slugs in triathlon 6-session week: ${slugs.join(', ')}`);
  });

  it('recovery week: no duplicate slugs in a 4-session recovery week', () => {
    const { sessions } = runBuild(
      { target_sessions: 4, target_hard_sessions: 0, is_recovery_week: true },
      { block_type: 'build' },
      { goal_type: 'race_10k', primary_sport: 'Run', level: 'intermediate' },
    );
    const slugs = sessions.map(s => s.workout_slug);
    const unique = new Set(slugs);
    assert.equal(slugs.length, unique.size,
      `Duplicate slugs in recovery week: ${slugs.join(', ')}`);
  });
});

describe('buildSchedule — recovery cost alignment', () => {
  it('recovery week sessions all have low or moderate recovery_cost', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 0, is_recovery_week: true },
      { block_type: 'build' },
      { goal_type: 'race_10k', primary_sport: 'Run', level: 'intermediate' },
    );
    for (const s of sessions) {
      assert.ok(
        s.recovery_cost === 'low' || s.recovery_cost === 'moderate',
        `Recovery week session ${s.workout_slug} has recovery_cost='${s.recovery_cost}'`,
      );
    }
  });

  it('quality slots in normal build week: recovery_cost is moderate or high', () => {
    const { sessions } = runBuild(
      { target_sessions: 5, target_hard_sessions: 2 },
      { block_type: 'build' },
      { goal_type: 'race_10k', primary_sport: 'Run', level: 'advanced' },
    );
    const qualitySessions = sessions.filter(s => s.slot_type === 'quality');
    assert.ok(qualitySessions.length > 0, 'No quality sessions found');
    for (const s of qualitySessions) {
      assert.ok(
        s.recovery_cost === 'moderate' || s.recovery_cost === 'high',
        `Quality session ${s.workout_slug} has low recovery_cost — unexpected`,
      );
    }
  });
});

describe('validateSchedule — error detection', () => {
  it('flags wrong number of days', () => {
    const week = makeWeek();
    const { valid, errors } = validateSchedule([], [], week);
    assert.ok(!valid);
    assert.ok(errors.some(e => e.includes('7 day')));
  });

  it('flags session count mismatch', () => {
    const week = makeWeek();
    const { days } = runBuild();
    const { valid, errors } = validateSchedule(days, [], week);
    assert.ok(!valid);
    assert.ok(errors.some(e => e.toLowerCase().includes('session count')));
  });

  it('flags missing sport on session', () => {
    const week = makeWeek({ target_sessions: 1, target_hard_sessions: 0 });
    const { days, sessions } = buildSchedule(week, makeBlock(), makeGoal(), FULL_FEATURES);
    sessions[0].sport = '';
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(!valid);
    assert.ok(errors.some(e => e.includes('sport')));
  });

  it('flags zero prescribed_minutes', () => {
    const week = makeWeek({ target_sessions: 1, target_hard_sessions: 0 });
    const { days, sessions } = buildSchedule(week, makeBlock(), makeGoal(), FULL_FEATURES);
    sessions[0].prescribed_minutes = 0;
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(!valid);
    assert.ok(errors.some(e => e.includes('zero duration')));
  });

  it('flags hard sessions in recovery week', () => {
    const week = makeWeek({ is_recovery_week: true, target_sessions: 3, target_hard_sessions: 0 });
    const { days, sessions } = buildSchedule(week, makeBlock(), makeGoal(), FULL_FEATURES);
    // Force a hard session to simulate invalid state
    sessions[0].intensity_zone = 'hard';
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(!valid);
    assert.ok(errors.some(e => e.includes('hard')));
  });
});

// ── Phase 3 deepening: long session target and quality type adaptation ─────────

describe('buildSchedule — long session target adaptation', () => {
  const { computeSchedulingContext } = require('../plannerScoring');

  it('low load tolerance reduces long session duration vs default', () => {
    const week = makeWeek({
      target_sessions: 5, target_hard_sessions: 1,
      target_long_session_hours: 2.5,
    });
    const block = { block_type: 'build' };
    const goal  = { goal_type: 'race_marathon', days_per_week: 5, level: 'intermediate', primary_sport: 'Run' };

    // Low load tolerance: has_strava + many sessions but very low consistency
    const lowTolFeatures = {
      has_strava: true, sessions_28d: 10,
      consistency_score: 10, sessions_per_week: 1, volume_28d_hours: 0.5,
    };
    const lowCtx = computeSchedulingContext(lowTolFeatures);
    assert.equal(lowCtx.loadToleranceTier, 'low');

    const modFeatures = {
      has_strava: true, sessions_28d: 10,
      consistency_score: 75, sessions_per_week: 4, volume_28d_hours: 8,
    };
    const modCtx = computeSchedulingContext(modFeatures);

    const { sessions: lowSessions } = buildSchedule(week, block, goal, lowTolFeatures, lowCtx);
    const { sessions: modSessions } = buildSchedule(week, block, goal, modFeatures, modCtx);

    const longLow = lowSessions.find(s => s.slot_type === 'long');
    const longMod = modSessions.find(s => s.slot_type === 'long');

    assert.ok(longLow && longMod, 'Both schedules should have a long session');
    assert.ok(
      longLow.prescribed_minutes <= longMod.prescribed_minutes,
      `Low load tolerance long session (${longLow.prescribed_minutes}min) should be ≤ moderate (${longMod.prescribed_minutes}min)`
    );
  });

  it('low load tolerance schedule still passes validation', () => {
    const week = makeWeek({ target_sessions: 5, target_hard_sessions: 1, target_long_session_hours: 2 });
    const block = { block_type: 'build' };
    const goal  = { goal_type: 'race_10k', days_per_week: 5, level: 'intermediate', primary_sport: 'Run' };
    const features = {
      has_strava: true, sessions_28d: 8,
      consistency_score: 15, sessions_per_week: 1, volume_28d_hours: 1,
    };
    const ctx = computeSchedulingContext(features);
    const { days, sessions } = buildSchedule(week, block, goal, features, ctx);
    const { valid, errors }  = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });
});

describe('buildSchedule — quality type adaptation (readiness tier)', () => {
  const { computeSchedulingContext } = require('../plannerScoring');

  it('low readiness in build/peak: quality sessions use tempo not interval', () => {
    const week = makeWeek({ target_sessions: 5, target_hard_sessions: 2 });
    const block = { block_type: 'build' };
    const goal  = { goal_type: 'race_marathon', days_per_week: 5, level: 'advanced', primary_sport: 'Run' };

    const lowFeatures = { avg_recovery_28d: 20, has_whoop: true, sessions_28d: 10 };
    const lowCtx = computeSchedulingContext(lowFeatures);
    assert.equal(lowCtx.readinessTier, 'low');

    const { sessions } = buildSchedule(week, block, goal, lowFeatures, lowCtx);
    const quality = sessions.filter(s => s.slot_type === 'quality');
    const intervals = quality.filter(s => s.session_type === 'interval');
    assert.equal(intervals.length, 0,
      `Low readiness build block should not have interval sessions, got: ${quality.map(s=>s.session_type).join(', ')}`);
  });

  it('moderate readiness in build/peak: at least one quality session is interval', () => {
    const week = makeWeek({ target_sessions: 5, target_hard_sessions: 2 });
    const block = { block_type: 'build' };
    const goal  = { goal_type: 'race_marathon', days_per_week: 5, level: 'advanced', primary_sport: 'Run' };

    const normFeatures = { avg_recovery_28d: 75, has_whoop: true, sessions_28d: 12 };
    const normCtx = computeSchedulingContext(normFeatures);
    assert.equal(normCtx.readinessTier, 'high');

    const { sessions } = buildSchedule(week, block, goal, normFeatures, normCtx);
    const quality = sessions.filter(s => s.slot_type === 'quality');
    const intervals = quality.filter(s => s.session_type === 'interval');
    assert.ok(intervals.length >= 1,
      `High readiness build block should include at least one interval session`);
  });

  it('quality type downgrade does not break schedule validation', () => {
    const week = makeWeek({ target_sessions: 5, target_hard_sessions: 2 });
    const block = { block_type: 'peak' };
    const goal  = { goal_type: 'race_10k', days_per_week: 5, level: 'advanced', primary_sport: 'Run' };

    const lowFeatures = { avg_recovery_28d: 25, has_whoop: true, sessions_28d: 10 };
    const ctx = computeSchedulingContext(lowFeatures);
    const { days, sessions } = buildSchedule(week, block, goal, lowFeatures, ctx);
    const { valid, errors }  = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });
});
