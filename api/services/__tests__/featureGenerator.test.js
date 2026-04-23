/**
 * Tests for featureGenerator.js
 *
 * Uses Node built-in test runner (node:test + node:assert).
 * Run with: node --test api/services/__tests__/featureGenerator.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { computeFeatures } = require('../featureGenerator');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeActivity(daysAgo, movingTimeSecs = 3600, avgHr = null, sport = 'Run') {
  const d = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  return {
    starts_at:    d.toISOString(),
    sport_type:   sport,
    moving_time_s: movingTimeSecs,
    avg_hr:       avgHr,
  };
}

function makeMetric(daysAgo, recovery = 70, hrv = 55, resting_hr = 52, sleep_score = 75) {
  const d = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  return {
    day:            d.toISOString().split('T')[0],
    recovery_score: recovery,
    hrv,
    resting_hr,
    sleep_score,
    strain_score:   null,
  };
}

// Full-data context: Strava + WHOOP, healthy training load
const fullDataContext = {
  hasStrava: true,
  hasWhoop:  true,
  activities: [
    makeActivity(1,  3600), makeActivity(3,  5400), makeActivity(5,  1800),
    makeActivity(8,  3600), makeActivity(10, 5400), makeActivity(12, 1800),
    makeActivity(15, 3600), makeActivity(17, 5400), makeActivity(20, 1800),
    makeActivity(22, 3600), makeActivity(25, 5400), makeActivity(27, 1800),
  ],
  dailyMetrics: Array.from({ length: 30 }, (_, i) => makeMetric(30 - i)),
};

// Low-data context: no providers connected
const lowDataContext = {
  hasStrava: false,
  hasWhoop:  false,
  activities: [],
  dailyMetrics: [],
};

// Partial context: Strava only
const stravaOnlyContext = {
  hasStrava: true,
  hasWhoop:  false,
  activities: [
    makeActivity(2, 3600), makeActivity(5, 7200), makeActivity(9, 3600),
    makeActivity(12, 5400),
  ],
  dailyMetrics: [],
};

// ── Volume tests ──────────────────────────────────────────────────────────────

describe('computeFeatures – volume', () => {
  it('returns zero volume for empty activities', () => {
    const f = computeFeatures(lowDataContext);
    assert.strictEqual(f.volume_7d_hours, 0);
    assert.strictEqual(f.volume_28d_hours, 0);
    assert.strictEqual(f.sessions_7d, 0);
    assert.strictEqual(f.sessions_28d, 0);
  });

  it('computes 7d volume correctly', () => {
    const f = computeFeatures(fullDataContext);
    // Activities within last 7 days: daysAgo 1, 3, 5 → 3600+5400+1800 = 10800s = 3h
    assert.strictEqual(f.sessions_7d, 3);
    assert.strictEqual(f.volume_7d_hours, 3.0);
  });

  it('computes 28d volume correctly', () => {
    const f = computeFeatures(fullDataContext);
    // All 12 activities are within 27 days → 12 sessions
    assert.strictEqual(f.sessions_28d, 12);
    // 12 * (3600+5400+1800)/3 = 12 * 3600s = 12h total... actually mixed
    // 4 groups: (3600+5400+1800) * 4 = 10800*4 = 43200s = 12h
    assert.strictEqual(f.volume_28d_hours, 12.0);
  });

  it('computes sessions_per_week as sessions_28d / 4', () => {
    const f = computeFeatures(fullDataContext);
    assert.strictEqual(f.sessions_per_week, 3.0); // 12/4
  });

  it('computes longest session hours', () => {
    const f = computeFeatures(fullDataContext);
    // Max is 5400s = 1.5h
    assert.strictEqual(f.longest_session_hours, 1.5);
  });
});

// ── Consistency tests ─────────────────────────────────────────────────────────

describe('computeFeatures – consistency', () => {
  it('returns 0 consistency for no activities', () => {
    const f = computeFeatures(lowDataContext);
    assert.strictEqual(f.consistency_score, 0);
    assert.strictEqual(f.active_weeks_of_last_4, 0);
  });

  it('returns 100 consistency when all 4 weeks are active', () => {
    const f = computeFeatures(fullDataContext);
    // Activities in each of the last 4 weeks
    assert.strictEqual(f.active_weeks_of_last_4, 4);
    assert.strictEqual(f.consistency_score, 100.0);
  });

  it('returns partial consistency for partial coverage', () => {
    // Only activity in last 7 days → only 1 week active of last 4
    const context = {
      ...lowDataContext,
      hasStrava: true,
      activities: [makeActivity(2, 3600)],
    };
    const f = computeFeatures(context);
    assert.ok(f.active_weeks_of_last_4 >= 1);
    assert.ok(f.consistency_score > 0 && f.consistency_score <= 100);
  });
});

// ── Intensity distribution tests ──────────────────────────────────────────────

describe('computeFeatures – intensity', () => {
  it('defaults to 70/20/10 for no activities', () => {
    const f = computeFeatures(lowDataContext);
    // default from empty activities path
    assert.strictEqual(f.pct_easy, 70);
    assert.strictEqual(f.pct_moderate, 20);
    assert.strictEqual(f.pct_hard, 10);
  });

  it('classifies low-HR activities as easy', () => {
    const ctx = {
      ...lowDataContext,
      hasStrava: true,
      activities: [
        makeActivity(1, 3600, 125),
        makeActivity(3, 3600, 130),
        makeActivity(5, 3600, 135),
      ],
    };
    const f = computeFeatures(ctx);
    assert.strictEqual(f.pct_easy, 100);
    assert.strictEqual(f.pct_moderate, 0);
    assert.strictEqual(f.pct_hard, 0);
  });

  it('classifies high-HR activities as hard', () => {
    const ctx = {
      ...lowDataContext,
      hasStrava: true,
      activities: [
        makeActivity(1, 3600, 165),
        makeActivity(3, 3600, 170),
        makeActivity(5, 3600, 175),
      ],
    };
    const f = computeFeatures(ctx);
    assert.strictEqual(f.pct_hard, 100);
    assert.strictEqual(f.pct_easy, 0);
  });

  it('returns easy=100 when no HR data available (conservative default)', () => {
    const ctx = {
      ...lowDataContext,
      hasStrava: true,
      activities: [
        makeActivity(1, 3600, null),
        makeActivity(3, 3600, null),
      ],
    };
    const f = computeFeatures(ctx);
    assert.strictEqual(f.pct_easy, 100);
  });
});

// ── Recovery feature tests ────────────────────────────────────────────────────

describe('computeFeatures – recovery', () => {
  it('returns null recovery features when WHOOP not connected', () => {
    const f = computeFeatures(stravaOnlyContext);
    assert.strictEqual(f.avg_recovery_28d, null);
    assert.strictEqual(f.avg_hrv_28d, null);
    assert.strictEqual(f.hrv_trend, null);
    assert.strictEqual(f.recovery_trend, null);
  });

  it('computes avg recovery from WHOOP metrics', () => {
    const f = computeFeatures(fullDataContext);
    // All metrics have recovery=70
    assert.strictEqual(f.avg_recovery_28d, 70.0);
    assert.strictEqual(f.avg_hrv_28d, 55.0);
    assert.strictEqual(f.avg_resting_hr_28d, 52.0);
    assert.strictEqual(f.avg_sleep_score_28d, 75.0);
  });

  it('returns stable trend for flat recovery data', () => {
    const f = computeFeatures(fullDataContext);
    // All metrics are flat — should be stable
    assert.strictEqual(f.recovery_trend, 'stable');
    assert.strictEqual(f.hrv_trend, 'stable');
  });
});

// ── Sport mix tests ───────────────────────────────────────────────────────────

describe('computeFeatures – sport mix', () => {
  it('returns null primary sport for no activities', () => {
    const f = computeFeatures(lowDataContext);
    assert.strictEqual(f.primary_sport, null);
  });

  it('identifies primary sport correctly', () => {
    const ctx = {
      ...lowDataContext,
      hasStrava: true,
      activities: [
        makeActivity(1, 3600, null, 'Run'),
        makeActivity(2, 3600, null, 'Run'),
        makeActivity(3, 3600, null, 'Ride'),
      ],
    };
    const f = computeFeatures(ctx);
    assert.strictEqual(f.primary_sport, 'Run');
    assert.ok(f.sport_mix['Run'] > f.sport_mix['Ride']);
  });

  it('sport_mix percentages sum to ~100', () => {
    const f = computeFeatures(fullDataContext);
    const total = Object.values(f.sport_mix).reduce((s, v) => s + v, 0);
    // Allow rounding error of ±2
    assert.ok(total >= 98 && total <= 102, `Expected ~100, got ${total}`);
  });
});

// ── Flags tests ───────────────────────────────────────────────────────────────

describe('computeFeatures – provider flags', () => {
  it('sets has_strava and has_whoop from context', () => {
    const f = computeFeatures(fullDataContext);
    assert.strictEqual(f.has_strava, true);
    assert.strictEqual(f.has_whoop, true);
  });

  it('sets both false for low-data context', () => {
    const f = computeFeatures(lowDataContext);
    assert.strictEqual(f.has_strava, false);
    assert.strictEqual(f.has_whoop, false);
  });
});
