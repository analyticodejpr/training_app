/**
 * planner.js — Express router for all training planner endpoints.
 *
 * All routes require a valid Supabase JWT via X-Supabase-Token header.
 * All DB operations are scoped to req.supabaseUser.id (RLS enforced at DB level).
 *
 * Routes:
 *   POST   /api/planner/goals            — create or replace active goal
 *   GET    /api/planner/goals/active     — get current active goal
 *   POST   /api/planner/generate         — generate plan from active goal
 *   GET    /api/planner/cycles/active    — get active cycle
 *   GET    /api/planner/cycles/:id/blocks — get blocks for a cycle
 *   GET    /api/planner/cycles/:id/weeks  — get weeks for a cycle
 */
'use strict';

const express = require('express');
const { requireSupabaseUser } = require('../middleware/requireSupabaseUser');
const { supabase }            = require('../db/supabase');
const { generateAndPersistPlan }     = require('../services/plannerOrchestrator');
const { generateAndPersistSchedule,
        getCurrentWeekSchedule }      = require('../services/schedulerOrchestrator');

const router = express.Router();

// All planner routes require a valid Supabase user
router.use(requireSupabaseUser);

// ── POST /api/planner/goals ───────────────────────────────────────────────────
/**
 * Create (or replace) the user's active training goal.
 * Any existing active goal is cancelled before inserting the new one.
 *
 * Body: {
 *   goal_type:    string (required)
 *   days_per_week: int (required)
 *   level:        string (required)
 *   event_date:   string YYYY-MM-DD (optional)
 *   event_name:   string (optional)
 *   primary_sport: string (optional)
 *   notes:        string (optional)
 * }
 */
router.post('/goals', async (req, res) => {
  const userId = req.supabaseUser.id;
  const {
    goal_type, days_per_week, level,
    event_date, event_name, primary_sport, notes,
  } = req.body;

  if (!goal_type)    return res.status(400).json({ error: 'goal_type is required' });
  if (!days_per_week) return res.status(400).json({ error: 'days_per_week is required' });
  if (!level)        return res.status(400).json({ error: 'level is required' });

  const validGoalTypes = [
    'base_fitness','race_5k','race_10k','race_half_marathon',
    'race_marathon','triathlon','weight_loss','general_performance',
  ];
  if (!validGoalTypes.includes(goal_type)) {
    return res.status(400).json({ error: `goal_type must be one of: ${validGoalTypes.join(', ')}` });
  }

  const validLevels = ['beginner', 'intermediate', 'advanced'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: 'level must be beginner, intermediate, or advanced' });
  }

  const daysNum = parseInt(days_per_week, 10);
  if (isNaN(daysNum) || daysNum < 1 || daysNum > 7) {
    return res.status(400).json({ error: 'days_per_week must be between 1 and 7' });
  }

  try {
    // Cancel any existing active goal
    const { error: cancelErr } = await supabase
      .from('training_goals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (cancelErr) throw new Error(`cancel existing goal: ${cancelErr.message}`);

    // Insert new goal
    const payload = {
      user_id:      userId,
      goal_type,
      days_per_week: daysNum,
      level,
      event_date:   event_date || null,
      event_name:   event_name || null,
      primary_sport: primary_sport || null,
      notes:        notes || null,
      status:       'active',
    };

    const { data: goal, error: insertErr } = await supabase
      .from('training_goals')
      .insert(payload)
      .select('*')
      .single();
    if (insertErr) throw new Error(`goal insert: ${insertErr.message}`);

    res.status(201).json({ goal });
  } catch (err) {
    console.error('[planner/goals]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/planner/goals/active ─────────────────────────────────────────────
/**
 * Returns the user's current active goal, or null if none exists.
 */
router.get('/goals/active', async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    const { data: goal, error } = await supabase
      .from('training_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    res.json({ goal: goal || null });
  } catch (err) {
    console.error('[planner/goals/active]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/planner/generate ────────────────────────────────────────────────
/**
 * Generate a full training plan from the user's active goal.
 * Cancels any previously active cycle before creating the new one.
 *
 * Body: {} (uses active goal automatically)
 * Returns: { cycleId, blockCount, weekCount, dataMode, totalWeeks, peakHours, startDate, endDate }
 */
router.post('/generate', async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    // Find active goal
    const { data: goal, error: goalErr } = await supabase
      .from('training_goals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalErr) throw new Error(goalErr.message);
    if (!goal)   return res.status(400).json({ error: 'No active goal found. Create a goal first.' });

    const result = await generateAndPersistPlan(userId, goal.id);
    res.status(201).json(result);
  } catch (err) {
    console.error('[planner/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/planner/cycles/active ───────────────────────────────────────────
/**
 * Returns the user's current active plan cycle, or null if none.
 */
router.get('/cycles/active', async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    const { data: cycle, error } = await supabase
      .from('training_plan_cycles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    res.json({ cycle: cycle || null });
  } catch (err) {
    console.error('[planner/cycles/active]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/planner/cycles/:id/blocks ───────────────────────────────────────
/**
 * Returns all blocks for a cycle, ordered by block_number.
 * Returns 404 if the cycle doesn't belong to the requesting user.
 */
router.get('/cycles/:id/blocks', async (req, res) => {
  const userId  = req.supabaseUser.id;
  const cycleId = req.params.id;
  try {
    // Verify cycle ownership
    const { data: cycle, error: cycleErr } = await supabase
      .from('training_plan_cycles')
      .select('id')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (cycleErr) throw new Error(cycleErr.message);
    if (!cycle)   return res.status(404).json({ error: 'Cycle not found' });

    const { data: blocks, error: blocksErr } = await supabase
      .from('training_plan_blocks')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .order('block_number', { ascending: true });

    if (blocksErr) throw new Error(blocksErr.message);
    res.json({ blocks: blocks || [] });
  } catch (err) {
    console.error('[planner/cycles/:id/blocks]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/planner/cycles/:id/weeks ────────────────────────────────────────
/**
 * Returns all weeks for a cycle, ordered by week_number.
 * Returns 404 if the cycle doesn't belong to the requesting user.
 */
router.get('/cycles/:id/weeks', async (req, res) => {
  const userId  = req.supabaseUser.id;
  const cycleId = req.params.id;
  try {
    // Verify cycle ownership
    const { data: cycle, error: cycleErr } = await supabase
      .from('training_plan_cycles')
      .select('id')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (cycleErr) throw new Error(cycleErr.message);
    if (!cycle)   return res.status(404).json({ error: 'Cycle not found' });

    const { data: weeks, error: weeksErr } = await supabase
      .from('training_plan_weeks')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .order('week_number', { ascending: true });

    if (weeksErr) throw new Error(weeksErr.message);
    res.json({ weeks: weeks || [] });
  } catch (err) {
    console.error('[planner/cycles/:id/weeks]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/planner/schedule/generate ──────────────────────────────────────
/**
 * Generate (or regenerate) the current-week session schedule from the
 * active plan cycle. Idempotent — safely replaces any existing schedule
 * for the current week.
 *
 * Returns 400 with { error, lifecycle, cycle } when plan is pre_start or completed.
 * Returns 201 with { lifecycle, cycle, week, days, sessions } on success.
 */
router.post('/schedule/generate', async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    const result = await generateAndPersistSchedule(userId);
    res.status(201).json(result);
  } catch (err) {
    console.error('[planner/schedule/generate]', err.message);
    if (err.code === 'PRE_START' || err.code === 'COMPLETED') {
      return res.status(400).json({
        error:     err.message,
        lifecycle: err.lifecycle,
        cycle:     err.cycle,
      });
    }
    const status = err.message.includes('No active') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── GET /api/planner/schedule/current ────────────────────────────────────────
/**
 * Return the current-week schedule including lifecycle state.
 * Always returns { lifecycle, cycle, week, days, sessions }.
 *
 * lifecycle: 'no_plan' | 'pre_start' | 'active' | 'completed'
 * days/sessions are empty arrays when lifecycle is not 'active' or schedule
 * has not been generated yet.
 */
router.get('/schedule/current', async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    const result = await getCurrentWeekSchedule(userId);
    res.json(result);
  } catch (err) {
    console.error('[planner/schedule/current]', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
