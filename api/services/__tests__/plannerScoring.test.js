/**
 * plannerScoring.test.js
 *
 * Tests for the deterministic planner scoring layer:
 *   - computeReadinessScore
 *   - computeLoadTolerance
 *   - computeConfidenceScore
 *   - computeSchedulingContext
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeReadinessScore,
  computeLoadTolerance,
  computeConfidenceScore,
  computeSchedulingContext,
} = require('../plannerScoring');

// ── computeReadinessScore ─────────────────────────────────────────────────────

describe('computeReadinessScore', () => {
  it('returns moderate default when features is null', () => {
    const r = computeReadinessScore(null);
    assert.equal(r.score, 50);
    assert.equal(r.tier, 'moderate');
    assert.equal(r.source, 'default');
  });

  it('returns moderate default when features has no recovery data', () => {
    const r = computeReadinessScore({ has_strava: true, has_whoop: false });
    assert.equal(r.tier, 'moderate');
    assert.equal(r.source, 'default');
  });

  it('uses WHOOP avg_recovery_28d as primary signal', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 80 });
    assert.equal(r.score, 80);
    assert.equal(r.tier, 'high');
    assert.equal(r.source, 'whoop_recovery');
  });

  it('WHOOP recovery 66 → tier high (boundary)', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 67 });
    assert.equal(r.tier, 'high');
  });

  it('WHOOP recovery 33 → tier low (boundary)', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 33 });
    assert.equal(r.tier, 'low');
  });

  it('WHOOP recovery 34 → tier moderate (boundary)', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 34 });
    assert.equal(r.tier, 'moderate');
  });

  it('falls back to hrv_trend when no avg_recovery_28d', () => {
    const r = computeReadinessScore({ hrv_trend: 'improving' });
    assert.equal(r.tier, 'high');
    assert.equal(r.source, 'hrv_trend');
  });

  it('hrv_trend declining → low tier', () => {
    const r = computeReadinessScore({ hrv_trend: 'declining' });
    assert.equal(r.tier, 'low');
    assert.equal(r.source, 'hrv_trend');
  });

  it('hrv_trend stable → moderate tier', () => {
    const r = computeReadinessScore({ hrv_trend: 'stable' });
    assert.equal(r.tier, 'moderate');
  });

  it('falls back to recovery_trend when no hrv_trend', () => {
    const r = computeReadinessScore({ recovery_trend: 'improving' });
    assert.equal(r.source, 'recovery_trend');
    assert.equal(r.tier, 'high');
  });

  it('recovery_trend declining → tier low', () => {
    const r = computeReadinessScore({ recovery_trend: 'declining' });
    assert.equal(r.tier, 'low');
  });

  it('WHOOP takes priority over hrv_trend', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 20, hrv_trend: 'improving' });
    assert.equal(r.source, 'whoop_recovery');
    assert.equal(r.tier, 'low');
  });

  it('clamps WHOOP score to 0–100', () => {
    const r = computeReadinessScore({ avg_recovery_28d: 120 });
    assert.equal(r.score, 100);
    const r2 = computeReadinessScore({ avg_recovery_28d: -5 });
    assert.equal(r2.score, 0);
  });
});

// ── computeLoadTolerance ──────────────────────────────────────────────────────

describe('computeLoadTolerance', () => {
  it('returns moderate default when features is null', () => {
    const r = computeLoadTolerance(null);
    assert.equal(r.score, 50);
    assert.equal(r.tier, 'moderate');
    assert.equal(r.source, 'default');
  });

  it('returns moderate default when consistency_score is null', () => {
    const r = computeLoadTolerance({ has_strava: true });
    assert.equal(r.tier, 'moderate');
    assert.equal(r.source, 'default');
  });

  it('high consistency → high load tolerance', () => {
    const r = computeLoadTolerance({
      consistency_score: 100,
      sessions_per_week: 5,
      volume_28d_hours: 10,
    });
    assert.equal(r.tier, 'high');
    assert.equal(r.source, 'consistency');
  });

  it('low consistency → low load tolerance', () => {
    const r = computeLoadTolerance({
      consistency_score: 25,
      sessions_per_week: 1,
      volume_28d_hours: 0.5,
    });
    assert.equal(r.tier, 'low');
  });

  it('sessions_per_week >= 4 adds bonus', () => {
    const base = computeLoadTolerance({ consistency_score: 60 });
    const with4 = computeLoadTolerance({ consistency_score: 60, sessions_per_week: 4 });
    assert.ok(with4.score > base.score, 'sessions_per_week ≥ 4 should add bonus');
  });

  it('sessions_per_week < 2 adds penalty', () => {
    const base = computeLoadTolerance({ consistency_score: 60 });
    const low  = computeLoadTolerance({ consistency_score: 60, sessions_per_week: 1 });
    assert.ok(low.score < base.score, 'sessions_per_week < 2 should penalise');
  });

  it('very low volume (< 2 hours / 28 days) penalises', () => {
    const norm = computeLoadTolerance({ consistency_score: 60, volume_28d_hours: 8 });
    const low  = computeLoadTolerance({ consistency_score: 60, volume_28d_hours: 1 });
    assert.ok(low.score < norm.score, 'low volume should penalise score');
  });

  it('score is clamped to 0–100', () => {
    const r = computeLoadTolerance({
      consistency_score: 100,
      sessions_per_week: 10,
      volume_28d_hours: 50,
    });
    assert.ok(r.score <= 100);
    const r2 = computeLoadTolerance({
      consistency_score: 0,
      sessions_per_week: 0,
      volume_28d_hours: 0,
    });
    assert.ok(r2.score >= 0);
  });
});

// ── computeSchedulingContext ──────────────────────────────────────────────────

describe('computeSchedulingContext', () => {
  it('returns safe defaults for null features', () => {
    const ctx = computeSchedulingContext(null);
    assert.equal(ctx.readiness.tier, 'moderate');
    assert.equal(ctx.loadTolerance.tier, 'moderate');
    assert.equal(ctx.hardSessionCapReduction, 0);
    assert.equal(ctx.intensityCapReason, null);
    assert.equal(ctx.readinessTier, 'moderate');
  });

  it('no cap when both scores are moderate', () => {
    const features = {
      avg_recovery_28d:  50,
      consistency_score: 60,
      sessions_per_week: 3,
      volume_28d_hours:  5,
    };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.hardSessionCapReduction, 0);
    assert.equal(ctx.intensityCapReason, null);
  });

  it('low readiness triggers cap reduction of 1 when confidence is sufficient', () => {
    // has_whoop gives confidence tier 'high' → cap fires
    const features = { avg_recovery_28d: 20, has_whoop: true, sessions_28d: 10 };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.readiness.tier, 'low');
    assert.equal(ctx.hardSessionCapReduction, 1);
    assert.ok(ctx.intensityCapReason, 'should have a cap reason string');
  });

  it('low readiness does NOT cap when confidence is low (no data)', () => {
    // No WHOOP, no Strava, no sessions → confidence is low → trust the plan
    const features = { avg_recovery_28d: 20 };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.readiness.tier, 'low');
    assert.equal(ctx.hardSessionCapReduction, 0, 'low confidence should not trigger cap');
  });

  it('low load tolerance triggers cap reduction of 1 when confidence is sufficient', () => {
    const features = {
      has_strava: true,
      sessions_28d: 8,
      consistency_score: 10,
      sessions_per_week: 1,
      volume_28d_hours:  0.5,
    };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.loadTolerance.tier, 'low');
    assert.equal(ctx.hardSessionCapReduction, 1);
    assert.ok(ctx.intensityCapReason);
  });

  it('both low: cap reduction is still 1 (not 2)', () => {
    // We cap by 1 max regardless of how many signals are low
    const features = {
      has_whoop: true,
      sessions_28d: 10,
      avg_recovery_28d:  15,
      consistency_score: 10,
      sessions_per_week: 0,
      volume_28d_hours:  0,
    };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.hardSessionCapReduction, 1);
  });

  it('high readiness + high tolerance: no cap', () => {
    const features = {
      avg_recovery_28d:  85,
      consistency_score: 90,
      sessions_per_week: 5,
      volume_28d_hours:  12,
    };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.hardSessionCapReduction, 0);
    assert.equal(ctx.readinessTier, 'high');
  });

  it('readinessTier is the readiness tier shorthand', () => {
    const features = { avg_recovery_28d: 80 };
    const ctx = computeSchedulingContext(features);
    assert.equal(ctx.readinessTier, ctx.readiness.tier);
  });
});

// ── Integration: scoring context affects scheduler ────────────────────────────

describe('computeSchedulingContext → scheduler integration', () => {
  const { buildSchedule, validateSchedule } = require('../scheduler');

  function makeWeek(overrides = {}) {
    return {
      week_start_date: '2026-04-13',
      target_sessions: 5,
      target_hard_sessions: 2,
      target_volume_hours: 8,
      target_long_session_hours: 2,
      is_recovery_week: false,
      week_number: 3,
      ...overrides,
    };
  }

  const block = { block_type: 'build' };
  const goal  = { goal_type: 'race_10k', days_per_week: 5, level: 'intermediate', primary_sport: 'Run' };

  it('low readiness reduces quality session count by 1', () => {
    const week        = makeWeek({ target_hard_sessions: 2 });
    // has_whoop provides sufficient confidence for the cap to fire
    const lowFeatures = { avg_recovery_28d: 20, has_whoop: true, sessions_28d: 10 };
    const scoringCtx  = computeSchedulingContext(lowFeatures);
    assert.equal(scoringCtx.hardSessionCapReduction, 1);

    const { sessions } = buildSchedule(week, block, goal, lowFeatures, scoringCtx);
    const quality = sessions.filter(s => s.slot_type === 'quality');
    assert.ok(quality.length <= 1, `Expected ≤1 quality session, got ${quality.length}`);
  });

  it('moderate readiness preserves planned quality session count', () => {
    const week           = makeWeek({ target_hard_sessions: 2 });
    const normFeatures   = { avg_recovery_28d: 65 }; // tier: moderate-high
    const scoringCtx     = computeSchedulingContext(normFeatures);
    assert.equal(scoringCtx.hardSessionCapReduction, 0);

    const { sessions: normSessions } = buildSchedule(week, block, goal, normFeatures, scoringCtx);
    const { sessions: nullCtxSessions } = buildSchedule(week, block, goal, null, null);

    // Both should produce the same number of quality sessions
    const normQ = normSessions.filter(s => s.slot_type === 'quality').length;
    const nullQ = nullCtxSessions.filter(s => s.slot_type === 'quality').length;
    assert.equal(normQ, nullQ, 'moderate readiness should not change quality count vs null ctx');
  });

  it('low readiness schedule still passes validation', () => {
    const week        = makeWeek({ target_hard_sessions: 2 });
    const lowFeatures = { avg_recovery_28d: 15, has_whoop: true, sessions_28d: 10 };
    const scoringCtx  = computeSchedulingContext(lowFeatures);

    const { days, sessions } = buildSchedule(week, block, goal, lowFeatures, scoringCtx);
    const { valid, errors }  = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
  });

  it('null scoringCtx (no data user) produces valid schedule unchanged', () => {
    const week = makeWeek();
    const { days, sessions, scoringCtx: returnedCtx } = buildSchedule(week, block, goal, null, null);
    const { valid, errors } = validateSchedule(days, sessions, week);
    assert.ok(valid, errors.join('; '));
    assert.equal(returnedCtx, null); // passthrough of null ctx
  });

  it('scoringCtx is returned from buildSchedule for logging', () => {
    const week       = makeWeek();
    const features   = { avg_recovery_28d: 20 };
    const scoringCtx = computeSchedulingContext(features);
    const result     = buildSchedule(week, block, goal, features, scoringCtx);
    assert.ok(result.scoringCtx !== undefined);
    assert.equal(result.scoringCtx.readinessTier, 'low');
  });
});

// ── computeConfidenceScore ────────────────────────────────────────────────────

describe('computeConfidenceScore', () => {
  it('returns low confidence when features is null', () => {
    const c = computeConfidenceScore(null);
    assert.equal(c.tier, 'low');
    assert.equal(c.source, 'no_data');
  });

  it('returns low confidence when no data sources connected', () => {
    const c = computeConfidenceScore({ has_whoop: false, has_strava: false });
    assert.equal(c.tier, 'low');
  });

  it('WHOOP connected adds significant confidence', () => {
    const c = computeConfidenceScore({ has_whoop: true });
    assert.ok(c.score > 50, 'WHOOP should push confidence above 50');
    assert.ok(c.source.includes('whoop'));
  });

  it('Strava + sessions gives moderate confidence', () => {
    const c = computeConfidenceScore({ has_strava: true, sessions_28d: 8 });
    assert.ok(c.score >= 34, 'strava + sessions should be at least moderate');
  });

  it('WHOOP + Strava + rich activity data gives high confidence', () => {
    const c = computeConfidenceScore({ has_whoop: true, has_strava: true, sessions_28d: 12 });
    assert.equal(c.tier, 'high');
  });

  it('sparse activity (< 4 sessions) gets no activity bonus', () => {
    const sparse = computeConfidenceScore({ has_strava: true, sessions_28d: 2 });
    const some   = computeConfidenceScore({ has_strava: true, sessions_28d: 6 });
    assert.ok(sparse.score < some.score, 'sparse activity should score lower');
  });

  it('score is clamped to 0–100', () => {
    const c = computeConfidenceScore({
      has_whoop: true, has_strava: true, sessions_28d: 20,
    });
    assert.ok(c.score <= 100);
  });

  it('loadToleranceTier is present in scheduling context', () => {
    const ctx = computeSchedulingContext({ avg_recovery_28d: 80, consistency_score: 80 });
    assert.ok('loadToleranceTier' in ctx);
    assert.ok(['low','moderate','high'].includes(ctx.loadToleranceTier));
  });

  it('confidence is present in scheduling context', () => {
    const ctx = computeSchedulingContext(null);
    assert.ok(ctx.confidence);
    assert.ok('tier' in ctx.confidence);
    assert.ok('score' in ctx.confidence);
  });
});
