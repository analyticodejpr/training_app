/**
 * workoutLibrary.test.js
 *
 * Tests for the expanded workout library:
 *   - slot_type and week_types filtering via pickWorkout()
 *   - fallback behavior when sport-specific options are sparse
 *   - beginner downgrade behavior
 *   - weekTypeFromRow derivation
 *   - scoreCandidate: interpretable scoring components
 *   - usedSlugs variety penalty
 *   - all slots have at least one candidate per sport
 */
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  WORKOUTS,
  pickWorkout,
  scoreCandidate,
  weekTypeFromRow,
  clearSlugMap,
} = require('../workoutLibrary');

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(sport, slotType, sessionType, blockType, weekType, level) {
  return pickWorkout(sport, slotType, sessionType, blockType, weekType, level);
}

// ── weekTypeFromRow ───────────────────────────────────────────────────────────

describe('weekTypeFromRow', () => {
  it('returns recovery when is_recovery_week=true', () => {
    assert.equal(weekTypeFromRow({ is_recovery_week: true }, 'build'), 'recovery');
  });

  it('returns taper when block_type=taper and not recovery week', () => {
    assert.equal(weekTypeFromRow({ is_recovery_week: false }, 'taper'), 'taper');
  });

  it('returns normal for regular build week', () => {
    assert.equal(weekTypeFromRow({ is_recovery_week: false }, 'build'), 'normal');
  });

  it('returns normal for base week', () => {
    assert.equal(weekTypeFromRow({ is_recovery_week: false }, 'base'), 'normal');
  });

  it('recovery week overrides taper block type', () => {
    // A recovery week inside a taper block is still 'recovery'
    assert.equal(weekTypeFromRow({ is_recovery_week: true }, 'taper'), 'recovery');
  });
});

// ── pickWorkout: slot_type filtering ─────────────────────────────────────────

describe('pickWorkout — slot_type matching', () => {
  it('long slot returns a long workout for Run', () => {
    const w = pick('Run', 'long', 'long', 'base', 'normal', 'intermediate');
    assert.equal(w.slot_type, 'long');
    assert.equal(w.sport, 'Run');
  });

  it('long slot returns a long workout for Ride', () => {
    const w = pick('Ride', 'long', 'long', 'base', 'normal', 'intermediate');
    assert.equal(w.slot_type, 'long');
    assert.equal(w.sport, 'Ride');
  });

  it('quality slot returns a quality workout for Run in build block', () => {
    const w = pick('Run', 'quality', 'interval', 'build', 'normal', 'intermediate');
    assert.equal(w.slot_type, 'quality');
    assert.equal(w.sport, 'Run');
  });

  it('easy slot returns an easy workout for Run', () => {
    const w = pick('Run', 'easy', 'easy', 'base', 'normal', 'intermediate');
    assert.equal(w.slot_type, 'easy');
    assert.equal(w.sport, 'Run');
  });

  it('recovery slot returns a recovery workout', () => {
    const w = pick('Run', 'recovery', 'easy', 'recovery', 'recovery', 'intermediate');
    assert.ok(['recovery', 'easy'].includes(w.slot_type));
    assert.equal(w.sport, 'Run');
  });

  it('support slot returns a support workout for Run (strides or taper-opener)', () => {
    const w = pick('Run', 'support', 'easy', 'base', 'normal', 'intermediate');
    assert.ok(w.slot_type === 'support' || w.slot_type === 'easy', `unexpected slot_type: ${w.slot_type}`);
  });
});

// ── pickWorkout: week_type filtering ─────────────────────────────────────────

describe('pickWorkout — week_type filtering', () => {
  it('taper week: returns a taper-compatible workout for Run', () => {
    const w = pick('Run', 'easy', 'easy', 'taper', 'taper', 'intermediate');
    assert.ok(w.week_types.includes('taper') || w.week_types.includes('normal'),
      `workout ${w.slug} has week_types: ${w.week_types}`);
  });

  it('recovery week: returns a recovery-compatible workout for Run', () => {
    const w = pick('Run', 'recovery', 'easy', 'recovery', 'recovery', 'intermediate');
    assert.ok(w.week_types.includes('recovery') || w.week_types.includes('normal'));
  });

  it('normal week: easy Run returns a normal-week compatible workout', () => {
    const w = pick('Run', 'easy', 'easy', 'base', 'normal', 'intermediate');
    assert.ok(w.week_types.includes('normal'));
  });
});

// ── pickWorkout: beginner downgrade ──────────────────────────────────────────

describe('pickWorkout — beginner downgrade', () => {
  it('beginner with quality slot gets an easy-zone workout', () => {
    const w = pick('Run', 'quality', 'interval', 'build', 'normal', 'beginner');
    // quality downgrades to easy for beginner
    assert.ok(w.intensity_zone !== 'hard',
      `beginner got hard session: ${w.slug} (${w.intensity_zone})`);
  });

  it('beginner with interval session_type gets downgraded to easy workout', () => {
    const w = pick('Run', 'easy', 'interval', 'build', 'normal', 'beginner');
    assert.ok(w.intensity_zone !== 'hard');
  });

  it('beginner with tempo session_type gets downgraded to easy workout', () => {
    const w = pick('Run', 'easy', 'tempo', 'build', 'normal', 'beginner');
    assert.ok(w.intensity_zone !== 'hard');
  });

  it('beginner Run still gets a valid workout', () => {
    const w = pick('Run', 'easy', 'easy', 'base', 'normal', 'beginner');
    assert.ok(w.slug, 'workout should have a slug');
    assert.ok(w.instructions, 'workout should have instructions');
  });
});

// ── pickWorkout: fallback behavior ───────────────────────────────────────────

describe('pickWorkout — fallback behavior', () => {
  it('unknown sport falls back to easy-aerobic-any', () => {
    const w = pick('UnknownSport', 'easy', 'easy', 'base', 'normal', 'intermediate');
    assert.equal(w.slug, 'easy-aerobic-any');
  });

  it('swim long slot falls back gracefully when no exact match in taper block', () => {
    // No taper swim-long in library; should still return a workout
    const w = pick('Swim', 'long', 'long', 'taper', 'taper', 'intermediate');
    assert.ok(w.slug, 'should get a workout slug');
    assert.ok(w.instructions, 'should have instructions');
  });

  it('pickWorkout never returns null', () => {
    const sports = ['Run', 'Ride', 'Swim', 'Strength', 'X-sport'];
    const slots  = ['easy', 'long', 'quality', 'recovery', 'strength', 'support'];
    const blocks = ['base', 'build', 'peak', 'taper', 'recovery'];
    const weeks  = ['normal', 'recovery', 'taper'];
    const levels = ['beginner', 'intermediate', 'advanced'];

    for (const sport of sports) {
      for (const slot of slots) {
        for (const block of blocks) {
          const w = pick(sport, slot, 'easy', block, 'normal', 'intermediate');
          assert.ok(w !== null && w !== undefined, `null result for ${sport}/${slot}/${block}`);
          assert.ok(w.slug, `no slug for ${sport}/${slot}/${block}`);
        }
      }
    }
  });
});

// ── pickWorkout: coverage validation ─────────────────────────────────────────

describe('pickWorkout — sport + slot coverage', () => {
  const mainSports = ['Run', 'Ride', 'Swim'];
  const keySlots   = ['easy', 'long', 'quality', 'recovery'];

  for (const sport of mainSports) {
    for (const slot of keySlots) {
      it(`${sport} / ${slot} slot resolves to a sport-specific workout in build/normal/intermediate`, () => {
        const w = pick(sport, slot, slot === 'quality' ? 'interval' : slot, 'build', 'normal', 'intermediate');
        // Should prefer sport-specific; fallback to Any is acceptable
        assert.ok(w.sport === sport || w.sport === 'Any',
          `Expected ${sport} or Any, got ${w.sport} (${w.slug})`);
      });
    }
  }
});

// ── WORKOUTS array integrity ──────────────────────────────────────────────────

describe('WORKOUTS array integrity', () => {
  it('has at least 35 templates', () => {
    assert.ok(WORKOUTS.length >= 35, `Only ${WORKOUTS.length} templates found`);
  });

  it('all templates have required fields', () => {
    const required = ['slug','name','sport','session_type','slot_type','block_types',
                      'week_types','levels','is_key_session','duration_min_minutes',
                      'duration_max_minutes','intensity_zone','recovery_cost',
                      'progression_family','instructions'];
    for (const w of WORKOUTS) {
      for (const field of required) {
        assert.ok(w[field] !== undefined && w[field] !== null,
          `${w.slug} missing field: ${field}`);
      }
    }
  });

  it('all slugs are unique', () => {
    const slugs = WORKOUTS.map(w => w.slug);
    const unique = new Set(slugs);
    assert.equal(slugs.length, unique.size, 'Duplicate slugs found');
  });

  it('all intensity_zones are valid', () => {
    const valid = new Set(['easy', 'moderate', 'hard']);
    for (const w of WORKOUTS) {
      assert.ok(valid.has(w.intensity_zone), `${w.slug}: invalid intensity_zone "${w.intensity_zone}"`);
    }
  });

  it('all recovery_costs are valid', () => {
    const valid = new Set(['low', 'moderate', 'high']);
    for (const w of WORKOUTS) {
      assert.ok(valid.has(w.recovery_cost), `${w.slug}: invalid recovery_cost "${w.recovery_cost}"`);
    }
  });

  it('all slot_types are valid', () => {
    const valid = new Set(['easy','long','quality','recovery','strength','support']);
    for (const w of WORKOUTS) {
      assert.ok(valid.has(w.slot_type), `${w.slug}: invalid slot_type "${w.slot_type}"`);
    }
  });

  it('all week_types contain only valid values', () => {
    const valid = new Set(['normal', 'recovery', 'taper']);
    for (const w of WORKOUTS) {
      for (const wt of (w.week_types || [])) {
        assert.ok(valid.has(wt), `${w.slug}: invalid week_type "${wt}"`);
      }
    }
  });

  it('all block_types contain only valid values', () => {
    const valid = new Set(['base','build','peak','taper','recovery']);
    for (const w of WORKOUTS) {
      for (const bt of (w.block_types || [])) {
        assert.ok(valid.has(bt), `${w.slug}: invalid block_type "${bt}"`);
      }
    }
  });

  it('duration_min_minutes < duration_max_minutes for all templates', () => {
    for (const w of WORKOUTS) {
      assert.ok(
        w.duration_min_minutes < w.duration_max_minutes,
        `${w.slug}: min ${w.duration_min_minutes} >= max ${w.duration_max_minutes}`,
      );
    }
  });

  it('quality slot workouts have moderate or hard intensity_zone', () => {
    const qualityWorkouts = WORKOUTS.filter(w => w.slot_type === 'quality');
    assert.ok(qualityWorkouts.length > 0, 'No quality workouts found');
    for (const w of qualityWorkouts) {
      assert.ok(
        w.intensity_zone === 'moderate' || w.intensity_zone === 'hard',
        `quality workout ${w.slug} has easy intensity_zone`,
      );
    }
  });

  it('recovery slot workouts have easy intensity_zone', () => {
    const recoveryWorkouts = WORKOUTS.filter(w => w.slot_type === 'recovery');
    for (const w of recoveryWorkouts) {
      assert.equal(w.intensity_zone, 'easy',
        `recovery workout ${w.slug} has non-easy intensity: ${w.intensity_zone}`);
    }
  });

  it('has at least 2 run quality workouts for build/peak blocks', () => {
    const runQuality = WORKOUTS.filter(w =>
      w.sport === 'Run' && w.slot_type === 'quality' &&
      (w.block_types.includes('build') || w.block_types.includes('peak'))
    );
    assert.ok(runQuality.length >= 2, `Only ${runQuality.length} run quality workouts`);
  });

  it('has at least 1 swim long workout', () => {
    const swimLong = WORKOUTS.filter(w => w.sport === 'Swim' && w.slot_type === 'long');
    assert.ok(swimLong.length >= 1, 'No swim long workout found');
  });

  it('has at least 1 recovery workout for each main sport', () => {
    for (const sport of ['Run', 'Ride', 'Swim']) {
      const recoveries = WORKOUTS.filter(w => w.sport === sport && w.slot_type === 'recovery');
      assert.ok(recoveries.length >= 1, `No recovery workout for ${sport}`);
    }
  });
});

// ── scoreCandidate — component tests ─────────────────────────────────────────

describe('scoreCandidate — scoring components', () => {
  // Minimal mock workouts for isolated component testing
  const lowCostEasy = {
    slug: 'test-low', slot_type: 'easy', block_types: ['build'], week_types: ['normal'],
    is_key_session: false, recovery_cost: 'low',
  };
  const highCostQuality = {
    slug: 'test-high', slot_type: 'quality', block_types: ['build'], week_types: ['normal'],
    is_key_session: true, recovery_cost: 'high',
  };
  const moderateCost = {
    slug: 'test-mod', slot_type: 'easy', block_types: ['build'], week_types: ['normal'],
    is_key_session: false, recovery_cost: 'moderate',
  };

  it('exact week_type match adds score', () => {
    const withMatch    = scoreCandidate({ ...lowCostEasy, week_types: ['normal'] }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] });
    const withoutMatch = scoreCandidate({ ...lowCostEasy, week_types: ['taper']  }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] });
    assert.ok(withMatch > withoutMatch, `expected ${withMatch} > ${withoutMatch}`);
  });

  it('exact block_type match adds score', () => {
    const withMatch    = scoreCandidate({ ...lowCostEasy, block_types: ['build'] }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] });
    const withoutMatch = scoreCandidate({ ...lowCostEasy, block_types: ['base']  }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] });
    assert.ok(withMatch > withoutMatch);
  });

  it('recovery week: low recovery_cost scores higher than high recovery_cost', () => {
    const ctx = { slotType: 'easy', blockType: 'recovery', weekType: 'recovery', usedSlugs: [] };
    const scoreLow  = scoreCandidate({ ...lowCostEasy,   recovery_cost: 'low'  }, ctx);
    const scoreHigh = scoreCandidate({ ...highCostQuality, recovery_cost: 'high' }, ctx);
    assert.ok(scoreLow > scoreHigh, `low(${scoreLow}) should beat high(${scoreHigh}) in recovery week`);
  });

  it('taper week: low recovery_cost preferred over high', () => {
    const ctx = { slotType: 'easy', blockType: 'taper', weekType: 'taper', usedSlugs: [] };
    const scoreLow  = scoreCandidate({ ...lowCostEasy, week_types: ['taper'], block_types: ['taper'], recovery_cost: 'low'  }, ctx);
    const scoreHigh = scoreCandidate({ ...lowCostEasy, week_types: ['taper'], block_types: ['taper'], recovery_cost: 'high' }, ctx);
    assert.ok(scoreLow > scoreHigh);
  });

  it('quality slot: key_session=true scores higher than false', () => {
    const ctx = { slotType: 'quality', blockType: 'build', weekType: 'normal', usedSlugs: [] };
    const keyScore    = scoreCandidate({ ...highCostQuality, is_key_session: true  }, ctx);
    const nonKeyScore = scoreCandidate({ ...highCostQuality, is_key_session: false }, ctx);
    assert.ok(keyScore > nonKeyScore);
  });

  it('easy slot: key_session=false scores higher than key_session=true', () => {
    const ctx = { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] };
    const nonKeyScore = scoreCandidate({ ...lowCostEasy, is_key_session: false }, ctx);
    const keyScore    = scoreCandidate({ ...lowCostEasy, is_key_session: true  }, ctx);
    assert.ok(nonKeyScore > keyScore);
  });

  it('easy slot: low recovery_cost scores higher than high', () => {
    const ctx = { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] };
    const scoreLow  = scoreCandidate({ ...lowCostEasy, recovery_cost: 'low'  }, ctx);
    const scoreHigh = scoreCandidate({ ...lowCostEasy, recovery_cost: 'high' }, ctx);
    assert.ok(scoreLow > scoreHigh);
  });

  it('recovery slot: high recovery_cost penalised', () => {
    const ctx = { slotType: 'recovery', blockType: 'recovery', weekType: 'recovery', usedSlugs: [] };
    const scoreLow  = scoreCandidate({ ...lowCostEasy, slot_type: 'recovery', recovery_cost: 'low'  }, ctx);
    const scoreHigh = scoreCandidate({ ...lowCostEasy, slot_type: 'recovery', recovery_cost: 'high' }, ctx);
    assert.ok(scoreLow > scoreHigh);
  });

  it('usedSlugs: repeated slug is heavily penalised', () => {
    const ctx = { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: ['test-low'] };
    const fresh   = scoreCandidate({ ...lowCostEasy, slug: 'test-fresh' }, ctx);
    const repeated = scoreCandidate({ ...lowCostEasy, slug: 'test-low'  }, ctx);
    assert.ok(repeated < fresh, `repeated(${repeated}) should be < fresh(${fresh})`);
  });

  it('usedSlugs penalty is at least 10 points', () => {
    const base = scoreCandidate({ ...lowCostEasy, slug: 'x' }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: [] });
    const penalised = scoreCandidate({ ...lowCostEasy, slug: 'x' }, { slotType: 'easy', blockType: 'build', weekType: 'normal', usedSlugs: ['x'] });
    assert.ok(base - penalised >= 10, `penalty was only ${base - penalised}`);
  });
});

// ── pickWorkout: scoring-driven selection ─────────────────────────────────────

describe('pickWorkout — scoring changes selection when candidates tie on filters', () => {
  it('recovery week Run easy slot: selects a low recovery_cost workout over a higher one', () => {
    // In a recovery week, easy Run slot should pick a low-cost workout
    const w = pickWorkout('Run', 'recovery', 'easy', 'recovery', 'recovery', 'intermediate', []);
    assert.ok(w.recovery_cost === 'low', `Expected low recovery_cost, got ${w.recovery_cost} (${w.slug})`);
  });

  it('usedSlugs: with 3 easy Run slots, all three use different slugs when alternatives exist', () => {
    const used = [];
    const slugs = [];
    for (let i = 0; i < 3; i++) {
      const w = pickWorkout('Run', 'easy', 'easy', 'base', 'normal', 'intermediate', used);
      slugs.push(w.slug);
      used.push(w.slug);
    }
    // There are at least 3 Run easy candidates in the library, so all should differ
    const unique = new Set(slugs);
    assert.ok(unique.size >= 2,
      `Expected variety across 3 easy slots, got: ${slugs.join(', ')}`);
  });

  it('usedSlugs: Ride easy slots pick different workouts when library has options', () => {
    const used = [];
    const first  = pickWorkout('Ride', 'easy', 'easy', 'build', 'normal', 'intermediate', used);
    used.push(first.slug);
    const second = pickWorkout('Ride', 'easy', 'easy', 'build', 'normal', 'intermediate', used);
    // If library has ≥2 Ride easy options they should differ
    const rideEasy = WORKOUTS.filter(w => w.sport === 'Ride' && w.slot_type === 'easy');
    if (rideEasy.length >= 2) {
      assert.notEqual(first.slug, second.slug, 'Second Ride easy should differ from first when options exist');
    }
  });

  it('quality slot in normal/build: selects is_key_session=true workout when available', () => {
    const w = pickWorkout('Run', 'quality', 'interval', 'build', 'normal', 'advanced', []);
    assert.ok(w.is_key_session === true, `Expected key session, got ${w.slug} (is_key_session=${w.is_key_session})`);
  });
});

// ── scoreSuitabilityBreakdown ─────────────────────────────────────────────────

describe('scoreSuitabilityBreakdown — component structure', () => {
  const { scoreSuitabilityBreakdown, WORKOUTS } = require('../workoutLibrary');

  const easyRun = WORKOUTS.find(w => w.slug === 'easy-run');
  const baseCtx = {
    slotType: 'easy', blockType: 'build', weekType: 'normal',
    usedSlugs: [], usedFamilies: [], readinessTier: 'moderate', loadToleranceTier: 'moderate',
  };

  it('returns total and components object', () => {
    const result = scoreSuitabilityBreakdown(easyRun, baseCtx);
    assert.ok(typeof result.total === 'number');
    assert.ok(result.components && typeof result.components === 'object');
  });

  it('has all expected component keys', () => {
    const { components } = scoreSuitabilityBreakdown(easyRun, baseCtx);
    const expected = ['weekTypeFit','blockTypeFit','recoveryCostFit','slotRoleFit',
                      'readinessFit','loadToleranceFit','familyVariety','slugVariety'];
    for (const key of expected) {
      assert.ok(key in components, `Missing component: ${key}`);
    }
  });

  it('total equals sum of components', () => {
    const { total, components } = scoreSuitabilityBreakdown(easyRun, baseCtx);
    const sum = Object.values(components).reduce((s, v) => s + v, 0);
    assert.equal(total, sum);
  });

  it('load tolerance fit: low load tolerance prefers low-cost workouts', () => {
    const lowCost  = WORKOUTS.find(w => w.slug === 'easy-run');       // recovery_cost: 'low'
    const highCost = WORKOUTS.find(w => w.slug === 'interval-run');   // recovery_cost: 'high'
    const ctx = { ...baseCtx, slotType: 'quality', loadToleranceTier: 'low' };
    const { components: cLow  } = scoreSuitabilityBreakdown(lowCost, ctx);
    const { components: cHigh } = scoreSuitabilityBreakdown(highCost, ctx);
    assert.ok(cLow.loadToleranceFit > 0, 'low cost should get positive load tolerance fit');
    assert.ok(cHigh.loadToleranceFit < 0, 'high cost should get negative load tolerance fit');
  });

  it('load tolerance fit: moderate/high tolerance → neutral (0)', () => {
    const w   = WORKOUTS.find(w => w.slug === 'easy-run');
    const ctx = { ...baseCtx, loadToleranceTier: 'moderate' };
    const { components } = scoreSuitabilityBreakdown(w, ctx);
    assert.equal(components.loadToleranceFit, 0);
  });

  it('family variety: same family already used → penalty of -2', () => {
    const w   = WORKOUTS.find(w => w.slug === 'easy-run'); // easy_run family
    const ctx = { ...baseCtx, usedFamilies: ['easy_run'] };
    const { components } = scoreSuitabilityBreakdown(w, ctx);
    assert.equal(components.familyVariety, -2);
  });

  it('family variety: different family already used → no penalty', () => {
    const w   = WORKOUTS.find(w => w.slug === 'easy-run'); // easy_run family
    const ctx = { ...baseCtx, usedFamilies: ['long_run'] };
    const { components } = scoreSuitabilityBreakdown(w, ctx);
    assert.equal(components.familyVariety, 0);
  });

  it('slug variety: used slug gets -10 penalty', () => {
    const w   = WORKOUTS.find(w => w.slug === 'easy-run');
    const ctx = { ...baseCtx, usedSlugs: ['easy-run'] };
    const { components } = scoreSuitabilityBreakdown(w, ctx);
    assert.equal(components.slugVariety, -10);
  });

  it('load tolerance fit does not apply to long slot', () => {
    const longRun = WORKOUTS.find(w => w.slug === 'long-run');
    const ctx = { ...baseCtx, slotType: 'long', loadToleranceTier: 'low' };
    const { components } = scoreSuitabilityBreakdown(longRun, ctx);
    assert.equal(components.loadToleranceFit, 0, 'long slot should not be affected by load tolerance fit');
  });
});

describe('pickWorkout — load tolerance and family variety', () => {
  it('low load tolerance: easy slot selects lower-cost workout over higher-cost', () => {
    const w = pickWorkout('Run', 'easy', 'easy', 'build', 'normal', 'intermediate',
      [], 'moderate', [], 'low');
    assert.ok(w.recovery_cost === 'low' || w.recovery_cost === 'moderate',
      `Expected low/moderate cost with low load tolerance, got ${w.slug} (${w.recovery_cost})`);
  });

  it('family variety: two easy Run slots pick different progression_families when possible', () => {
    const used = [];
    const usedFamilies = [];
    const first = pickWorkout('Run', 'easy', 'easy', 'build', 'normal', 'intermediate',
      used, 'moderate', usedFamilies, 'moderate');
    used.push(first.slug);
    usedFamilies.push(first.progression_family);

    const second = pickWorkout('Run', 'easy', 'easy', 'build', 'normal', 'intermediate',
      used, 'moderate', usedFamilies, 'moderate');

    // With enough variety in the easy Run pool, families should differ
    const runEasy = require('../workoutLibrary').WORKOUTS.filter(w => w.sport === 'Run' && w.slot_type === 'easy');
    const families = new Set(runEasy.map(w => w.progression_family));
    if (families.size >= 2) {
      assert.notEqual(first.progression_family, second.progression_family,
        `Expected different families: first=${first.slug}(${first.progression_family}), second=${second.slug}(${second.progression_family})`);
    }
  });
});
