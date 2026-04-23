/**
 * workoutLibrary.js
 *
 * In-memory workout template library — the single source of truth for
 * all workout prescriptions. Mirrors the seeded `workout_library` DB table.
 *
 * Code owns all filtering, selection, and personalization logic.
 * No AI involvement in template selection or content.
 *
 * Each entry:
 *   slug                   — unique identifier
 *   name                   — human label
 *   sport                  — 'Run' | 'Ride' | 'Swim' | 'Strength' | 'Any'
 *   session_type           — 'easy' | 'long' | 'tempo' | 'interval' | 'strength'
 *   slot_type              — 'easy' | 'long' | 'quality' | 'recovery' | 'strength' | 'support'
 *   block_types            — which block types this workout is valid for
 *   week_types             — which week contexts: 'normal' | 'recovery' | 'taper'
 *   levels                 — which athlete levels this workout is valid for
 *   is_key_session         — true = counts toward hard-session quota
 *   duration_min_minutes   — minimum prescribed duration
 *   duration_max_minutes   — maximum prescribed duration
 *   intensity_zone         — 'easy' | 'moderate' | 'hard'
 *   recovery_cost          — 'low' | 'moderate' | 'high'
 *   progression_family     — logical grouping for progression tracking
 *   equipment_requirements — ['pool'] | ['bike'] | ['gym_optional'] | []
 *   contraindications      — jsonb restrictions (optional, null for most)
 *   instructions           — full session instructions for the athlete
 *   rationale              — why this session is prescribed
 */
'use strict';

const WORKOUTS = [
  // ── Running ──────────────────────────────────────────────────────────────────

  {
    slug: 'easy-run',
    name: 'Easy Aerobic Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 75,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run at a comfortable conversational pace. Keep heart rate below 75% of max. This is aerobic base work — do not push.',
    rationale: 'Easy runs develop aerobic efficiency with minimal fatigue, forming the backbone of any run programme.',
  },

  {
    slug: 'aerobic-steady-run',
    name: 'Aerobic Steady Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 35,
    duration_max_minutes: 70,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run at the upper end of easy effort — steady aerobic pace, breathing comfortable but not conversational. Heart rate 70–78% of max. Consistent effort throughout.',
    rationale: 'Aerobic steady running builds a durable aerobic ceiling above pure easy pace, improving sustained running economy.',
  },

  {
    slug: 'base-run',
    name: 'Base Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 65,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Comfortable, unstructured run at an easy effort. No pace target — run by feel, keeping breathing relaxed. Good for any day in the training week.',
    rationale: 'Consistent aerobic base runs accumulate volume without meaningful fatigue, anchoring the week\'s training load.',
  },

  {
    slug: 'comfortable-run',
    name: 'Comfortable Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak', 'taper', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 60,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Easy, conversational run. Choose a flat or gentle route. The goal is movement and aerobic stimulus — not fitness-building stress. Stop if you feel any discomfort.',
    rationale: 'Flexible easy run that fills training day needs across all blocks without adding meaningful fatigue.',
  },

  {
    slug: 'long-run',
    name: 'Long Run',
    sport: 'Run',
    session_type: 'long',
    slot_type: 'long',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 60,
    duration_max_minutes: 150,
    intensity_zone: 'easy',
    recovery_cost: 'high',
    progression_family: 'long_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run steady at easy effort. Focus on time on feet rather than pace. Last 10 min can be progressive if feeling strong.',
    rationale: 'Long runs build endurance, fat adaptation, and musculoskeletal resilience for sustained effort.',
  },

  {
    slug: 'easy-long-run',
    name: 'Easy Long Run',
    sport: 'Run',
    session_type: 'long',
    slot_type: 'long',
    block_types: ['base', 'build', 'peak', 'recovery'],
    week_types: ['recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 45,
    duration_max_minutes: 100,
    intensity_zone: 'easy',
    recovery_cost: 'moderate',
    progression_family: 'long_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run at easy, conversational pace. Time on feet only — no progression, no surges. Stop before fatigue builds. This is the reduced long run for a recovery or taper week.',
    rationale: 'Maintains long-run adaptation at reduced load. Keeps legs moving without digging into recovery debt.',
  },

  {
    slug: 'progression-run',
    name: 'Progression Run',
    sport: 'Run',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 40,
    duration_max_minutes: 70,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Start at easy pace for 15 min. Increase effort every 10 min, finishing the last 10 min at comfortably hard (tempo) pace. Smooth, controlled build — no surges.',
    rationale: 'Progression runs train pacing discipline and gradually stress the aerobic system, building threshold capacity without peaking too early.',
  },

  {
    slug: 'tempo-run',
    name: 'Tempo Run',
    sport: 'Run',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 35,
    duration_max_minutes: 65,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Warm up 10 min easy. Run at comfortably hard pace (can speak 2–3 words) for 20–35 min. Cool down 10 min easy.',
    rationale: 'Tempo work raises lactate threshold and trains your body to sustain faster paces for longer.',
  },

  {
    slug: 'threshold-intervals-run',
    name: 'Threshold Intervals',
    sport: 'Run',
    session_type: 'interval',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 45,
    duration_max_minutes: 70,
    intensity_zone: 'hard',
    recovery_cost: 'high',
    progression_family: 'threshold_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Warm up 10 min easy. Run 3–5 × 8 min at threshold pace (comfortably hard) with 2 min easy jog recovery. Cool down 8 min easy. Aim for consistent splits.',
    rationale: 'Threshold intervals increase lactate clearance capacity and sustain high-output running economy over race-relevant durations.',
  },

  {
    slug: 'interval-run',
    name: 'Interval Run',
    sport: 'Run',
    session_type: 'interval',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 40,
    duration_max_minutes: 70,
    intensity_zone: 'hard',
    recovery_cost: 'high',
    progression_family: 'vo2_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Warm up 12 min easy. Run 5–8 × 3 min hard (can say 1–2 words) with 90 sec easy jog recovery. Cool down 10 min easy.',
    rationale: 'Intervals develop VO2max, running economy, and tolerance for high-intensity effort.',
  },

  {
    slug: 'hill-repeats-run',
    name: 'Hill Repeats',
    sport: 'Run',
    session_type: 'interval',
    slot_type: 'quality',
    block_types: ['base', 'build'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 35,
    duration_max_minutes: 60,
    intensity_zone: 'hard',
    recovery_cost: 'high',
    progression_family: 'vo2_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Warm up 10 min easy. Find a 4–8% grade hill. Sprint up 6–10 × 30–60 sec, walk or jog down for full recovery. Keep form tall, drive arms. Cool down 10 min easy.',
    rationale: 'Hill repeats build running power, neuromuscular strength, and VO2max with lower joint stress than flat intervals.',
  },

  {
    slug: 'race-pace-run',
    name: 'Race Pace Run',
    sport: 'Run',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['peak', 'taper'],
    week_types: ['normal', 'taper'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 30,
    duration_max_minutes: 55,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Warm up 10 min easy. Run 15–25 min at target race pace. Cool down 10 min easy. Controlled and smooth — rehearsal, not all-out.',
    rationale: 'Race pace work sharpens neuromuscular readiness and builds confidence for goal effort.',
  },

  {
    slug: 'strides-run',
    name: 'Strides Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['base', 'build', 'peak', 'taper'],
    week_types: ['normal', 'taper'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 50,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run 20–35 min easy. At the end, do 4–6 × 20 sec accelerations to near-sprint speed on a flat surface, walking 40 sec between each. Relaxed form, high cadence.',
    rationale: 'Strides develop neuromuscular speed, running form, and leg turnover without significant aerobic load.',
  },

  {
    slug: 'shakeout-run',
    name: 'Shakeout Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'recovery',
    block_types: ['taper', 'recovery'],
    week_types: ['recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 15,
    duration_max_minutes: 30,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'recovery_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Very short, very easy run. Zero effort, just moving. Keep it flat and slow. Stop at any sign of fatigue.',
    rationale: 'Shakeout runs loosen legs, reduce stiffness, and maintain neuromuscular activation ahead of a race or rest day.',
  },

  {
    slug: 'taper-opener-run',
    name: 'Taper Opener Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['taper'],
    week_types: ['taper'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 45,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Easy run with 3–4 × 20 sec pickups at race effort near the end. Keep most of the run relaxed. Goal is to feel sharp, not tired.',
    rationale: 'Taper openers maintain neuromuscular sharpness while preserving freshness before a race.',
  },

  {
    slug: 'brick-run',
    name: 'Brick Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 15,
    duration_max_minutes: 35,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Run immediately off the bike — transition quickly and run at easy effort. Legs will feel heavy; maintain form and let pace come naturally. This is a short training stimulus, not a race.',
    rationale: 'Brick runs train the neuromuscular switch from cycling to running, improving transition efficiency for triathlon.',
  },

  {
    slug: 'recovery-run',
    name: 'Recovery Run',
    sport: 'Run',
    session_type: 'easy',
    slot_type: 'recovery',
    block_types: ['taper', 'recovery'],
    week_types: ['recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'recovery_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Very easy run — slower than normal easy pace. Focus on flushing legs, not fitness. Stop early if you feel fatigue.',
    rationale: 'Active recovery accelerates muscle repair and maintains neuromuscular readiness without adding load.',
  },

  // ── Cycling ───────────────────────────────────────────────────────────────────

  {
    slug: 'easy-ride',
    name: 'Easy Aerobic Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 40,
    duration_max_minutes: 120,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Ride at comfortable zone 2 pace. Cadence 85–95 rpm. Keep effort conversational — no pushing on climbs.',
    rationale: 'Zone 2 riding builds aerobic base and metabolic efficiency with minimal fatigue cost.',
  },

  {
    slug: 'endurance-ride',
    name: 'Endurance Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 60,
    duration_max_minutes: 150,
    intensity_zone: 'easy',
    recovery_cost: 'moderate',
    progression_family: 'easy_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Steady zone 2 ride on rolling terrain. Cadence 85–95 rpm. Fuel every 45 min. Maintain consistent effort on climbs — no hammering.',
    rationale: 'Sustained endurance rides develop aerobic base, fat oxidation, and muscular durability for longer efforts.',
  },

  {
    slug: 'steady-aerobic-ride',
    name: 'Steady Aerobic Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 50,
    duration_max_minutes: 100,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Ride at the upper end of zone 2 — steady, purposeful effort. Flat or gently rolling route. Heart rate 70–78% of max. Focus on pedaling smoothly.',
    rationale: 'Aerobic steady riding improves cycling economy and develops the top end of zone 2 without significant fatigue.',
  },

  {
    slug: 'long-ride',
    name: 'Long Ride',
    sport: 'Ride',
    session_type: 'long',
    slot_type: 'long',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 90,
    duration_max_minutes: 180,
    intensity_zone: 'easy',
    recovery_cost: 'high',
    progression_family: 'long_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Steady endurance ride at zone 2. Fuel every 45 min. Last 20 min can include a few harder tempo efforts if feeling fresh.',
    rationale: 'Long rides build aerobic base, fat adaptation, and mental resilience for sustained efforts.',
  },

  {
    slug: 'sweet-spot-ride',
    name: 'Sweet Spot Ride',
    sport: 'Ride',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 50,
    duration_max_minutes: 90,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Warm up 15 min easy. Ride 20–40 min at sweet spot effort (88–93% FTP or zone 3–4 border). Cool down 10 min easy. Keep cadence 85–95 rpm.',
    rationale: 'Sweet spot training offers the highest FTP stimulus per fatigue unit — the most efficient way to build sustained power.',
  },

  {
    slug: 'tempo-ride',
    name: 'Tempo Ride',
    sport: 'Ride',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 50,
    duration_max_minutes: 90,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Warm up 15 min easy. Ride 20–40 min in zone 3–4. Cool down 10 min easy. Flat or rolling route — avoid big climbs.',
    rationale: 'Tempo riding raises FTP and improves sustained power output over race-relevant durations.',
  },

  {
    slug: 'interval-ride',
    name: 'Interval Ride',
    sport: 'Ride',
    session_type: 'interval',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 50,
    duration_max_minutes: 75,
    intensity_zone: 'hard',
    recovery_cost: 'high',
    progression_family: 'vo2_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Warm up 15 min. Complete 5–7 × 4 min at zone 5 with 3 min easy spin recovery. Cool down 10 min. Use trainer or steady climb.',
    rationale: 'VO2max intervals increase aerobic power ceiling and cycling economy.',
  },

  {
    slug: 'cadence-drills-ride',
    name: 'Cadence Drills Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['base', 'build'],
    week_types: ['normal'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 35,
    duration_max_minutes: 65,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Warm up 10 min easy. Do 4–6 × 1 min high-cadence (100–110 rpm) spin with 1 min normal cadence recovery. Keep effort easy throughout. Cool down 10 min.',
    rationale: 'Cadence drills improve pedaling efficiency, reduce hip flexor strain, and build neuromuscular cycling skill.',
  },

  {
    slug: 'brick-ride',
    name: 'Brick Ride',
    sport: 'Ride',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 45,
    duration_max_minutes: 90,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Ride at moderate effort, finishing with 10–15 min at tempo intensity. Lay out your run gear beforehand — transition directly to a short run after. Simulate race conditions.',
    rationale: 'Brick rides train cycling-to-run transitions and prepare the body for the specific demands of triathlon racing.',
  },

  {
    slug: 'taper-opener-ride',
    name: 'Taper Opener Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['taper'],
    week_types: ['taper'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Easy spin with 3–4 × 30 sec at race effort in the middle. Feel the legs respond — stay relaxed. Most of the ride is zone 1–2.',
    rationale: 'Taper openers keep the neuromuscular system sharp without adding fatigue before a race.',
  },

  {
    slug: 'race-simulation-ride',
    name: 'Race Simulation Ride',
    sport: 'Ride',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['peak'],
    week_types: ['normal'],
    levels: ['advanced'],
    is_key_session: true,
    duration_min_minutes: 60,
    duration_max_minutes: 120,
    intensity_zone: 'moderate',
    recovery_cost: 'high',
    progression_family: 'threshold_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Ride a 45–90 min segment at race-target power or effort. Replicate race conditions: pacing strategy, nutrition timing, terrain profile. Follow with a short easy spin cool-down.',
    rationale: 'Race simulation builds mental rehearsal, pacing confidence, and metabolic adaptation for event day.',
  },

  {
    slug: 'recovery-ride',
    name: 'Recovery Ride',
    sport: 'Ride',
    session_type: 'easy',
    slot_type: 'recovery',
    block_types: ['taper', 'recovery'],
    week_types: ['recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 55,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'recovery_ride',
    equipment_requirements: ['bike'],
    contraindications: null,
    instructions: 'Very easy spin — zone 1, cadence 90+. Blood flow and recovery, not fitness. Do not push.',
    rationale: 'Easy spinning flushes metabolic byproducts and aids muscle repair without adding load.',
  },

  // ── Swimming ──────────────────────────────────────────────────────────────────

  {
    slug: 'easy-swim',
    name: 'Steady Swim',
    sport: 'Swim',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'recovery'],
    week_types: ['normal', 'recovery'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Swim steady at comfortable pace. Focus on technique: long strokes, high elbow catch, bilateral breathing. Rest as needed.',
    rationale: 'Steady swim builds aerobic base and refines technique without accumulating fatigue.',
  },

  {
    slug: 'endurance-swim',
    name: 'Endurance Swim',
    sport: 'Swim',
    session_type: 'long',
    slot_type: 'long',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 45,
    duration_max_minutes: 90,
    intensity_zone: 'easy',
    recovery_cost: 'moderate',
    progression_family: 'long_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Continuous or minimally-rested swim at easy aerobic pace. Focus on stroke consistency across the full duration. Take 10–15 sec rest every 400m if needed.',
    rationale: 'Endurance swims build swim-specific aerobic capacity and develop the comfort needed for longer open-water efforts.',
  },

  {
    slug: 'interval-swim',
    name: 'Swim Intervals',
    sport: 'Swim',
    session_type: 'interval',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 40,
    duration_max_minutes: 70,
    intensity_zone: 'moderate',
    recovery_cost: 'moderate',
    progression_family: 'threshold_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Warm up 400m easy. Main set: 8–12 × 50m or 4–6 × 100m with 15 sec rest. Aim for consistent times. Cool down 200m easy.',
    rationale: 'Swim intervals develop threshold speed, pacing discipline, and neuromuscular efficiency.',
  },

  {
    slug: 'threshold-swim',
    name: 'Threshold Swim',
    sport: 'Swim',
    session_type: 'tempo',
    slot_type: 'quality',
    block_types: ['build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: true,
    duration_min_minutes: 40,
    duration_max_minutes: 65,
    intensity_zone: 'hard',
    recovery_cost: 'high',
    progression_family: 'threshold_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Warm up 300m easy. Main set: 3–4 × 200m or 2 × 400m at threshold pace (CSS / T-pace), 20 sec rest. Cool down 200m easy. Smooth, efficient stroke at effort.',
    rationale: 'Threshold swim sets raise critical swim speed and improve the ability to sustain goal-pace effort over race distance.',
  },

  {
    slug: 'technique-swim',
    name: 'Technique Swim',
    sport: 'Swim',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['base', 'build'],
    week_types: ['normal', 'recovery'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 55,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'drill_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Mix drill work and easy swimming: catch-up drill × 50m, fingertip drag × 50m, side kick × 50m, full stroke × 100m. Repeat. Focus on feel for the water, not speed.',
    rationale: 'Technique sessions improve stroke mechanics, which yields speed gains without added fitness load.',
  },

  {
    slug: 'pull-swim',
    name: 'Pull-Focused Swim',
    sport: 'Swim',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['base', 'build', 'peak'],
    week_types: ['normal'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 55,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Use a pull buoy throughout. Swim steady pace focusing on catch and pull mechanics. Alternate 100m pull with 100m full stroke to reinforce the feeling. Aim for consistent splits.',
    rationale: 'Pull swims isolate upper body mechanics, strengthen the catch phase, and allow volume without leg fatigue.',
  },

  {
    slug: 'recovery-swim',
    name: 'Recovery Swim',
    sport: 'Swim',
    session_type: 'easy',
    slot_type: 'recovery',
    block_types: ['recovery', 'taper'],
    week_types: ['recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'recovery_swim',
    equipment_requirements: ['pool'],
    contraindications: null,
    instructions: 'Easy, slow swimming — focus on relaxed stroke and breathing. No lap timing, no pace targets. Just move through the water and let the muscles loosen.',
    rationale: 'Swimming\'s buoyancy makes it ideal active recovery — gentle movement with near-zero impact to flush residual fatigue.',
  },

  // ── Strength & Support ────────────────────────────────────────────────────────

  {
    slug: 'strength-general',
    name: 'Strength & Conditioning',
    sport: 'Strength',
    session_type: 'strength',
    slot_type: 'strength',
    block_types: ['base', 'build', 'recovery'],
    week_types: ['normal', 'recovery'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    intensity_zone: 'easy',
    recovery_cost: 'moderate',
    progression_family: 'strength',
    equipment_requirements: ['gym_optional'],
    contraindications: null,
    instructions: 'Full-body circuit: squats, lunges, deadlifts, push-ups, core. 3 × 10–15 reps. Moderate weight — focus on form. Not to failure.',
    rationale: 'Strength work builds injury resilience, neuromuscular power, and sport economy.',
  },

  {
    slug: 'light-strength',
    name: 'Light Strength',
    sport: 'Strength',
    session_type: 'strength',
    slot_type: 'strength',
    block_types: ['build', 'peak', 'taper', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'strength',
    equipment_requirements: ['gym_optional'],
    contraindications: null,
    instructions: 'Light maintenance circuit: bodyweight or minimal load. Squats, single-leg RDL, glute bridges, push-ups, plank. 2 × 10 reps each. Easy pace, no fatigue accumulation.',
    rationale: 'Light strength maintains neuromuscular adaptations during peak and taper phases without adding fatigue.',
  },

  {
    slug: 'core-session',
    name: 'Core Session',
    sport: 'Strength',
    session_type: 'strength',
    slot_type: 'support',
    block_types: ['base', 'build', 'peak', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 15,
    duration_max_minutes: 30,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'activation',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Core circuit: plank 3 × 30–45 sec, side plank 2 × 20 sec each, dead bug 3 × 8, bird-dog 3 × 8. Slow, controlled, no breath-holding. Rest 45 sec between sets.',
    rationale: 'Core stability reduces energy leakage in all sports and is the foundation of efficient movement under fatigue.',
  },

  {
    slug: 'mobility-session',
    name: 'Mobility Session',
    sport: 'Strength',
    session_type: 'strength',
    slot_type: 'support',
    block_types: ['base', 'build', 'peak', 'taper', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'mobility',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Dynamic warm-up flow: hip flexor stretch, thoracic rotation, ankle circles, hamstring swings, hip openers, calf raises. Hold each 30–60 sec or 10 reps. End with foam rolling quads, calves, ITB.',
    rationale: 'Mobility work reduces injury risk, improves range of motion, and accelerates recovery between training sessions.',
  },

  {
    slug: 'activation-session',
    name: 'Activation Session',
    sport: 'Strength',
    session_type: 'strength',
    slot_type: 'support',
    block_types: ['base', 'build', 'peak', 'taper', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 15,
    duration_max_minutes: 25,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'activation',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Glute and hip activation: clamshells 2 × 15, banded walks 2 × 10 steps, fire hydrants 2 × 12, single-leg glute bridge 2 × 10. Slow and deliberate. Great as pre-run prep.',
    rationale: 'Activation routines switch on stabilizer muscles before training, improving biomechanics and reducing injury risk.',
  },

  {
    slug: 'pre-race-opener',
    name: 'Pre-Race Opener',
    sport: 'Any',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['taper'],
    week_types: ['taper'],
    levels: ['intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'activation',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Very short session in your primary race sport. Easy warm-up with 2–3 short accelerations to race pace. End feeling loose and sharp — not fatigued. This is the day before the race.',
    rationale: 'Pre-race openers prime the neuromuscular system and reduce race-morning stiffness without draining the energy reserves.',
  },

  {
    slug: 'cross-training-any',
    name: 'Optional Cross Training',
    sport: 'Any',
    session_type: 'easy',
    slot_type: 'support',
    block_types: ['base', 'recovery'],
    week_types: ['normal', 'recovery'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 60,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Choose any low-impact aerobic activity: rowing, elliptical, hiking, yoga, aqua jogging. Keep effort easy and enjoyable. No competition with your primary sport sessions.',
    rationale: 'Cross training adds aerobic volume and movement variety without sport-specific fatigue, useful for injury prevention or mental refresh.',
  },

  // ── Generic fallback ──────────────────────────────────────────────────────────

  {
    slug: 'easy-aerobic-any',
    name: 'Easy Aerobic Session',
    sport: 'Any',
    session_type: 'easy',
    slot_type: 'easy',
    block_types: ['base', 'build', 'peak', 'taper', 'recovery'],
    week_types: ['normal', 'recovery', 'taper'],
    levels: ['beginner', 'intermediate', 'advanced'],
    is_key_session: false,
    duration_min_minutes: 25,
    duration_max_minutes: 90,
    intensity_zone: 'easy',
    recovery_cost: 'low',
    progression_family: 'easy_run',
    equipment_requirements: [],
    contraindications: null,
    instructions: 'Easy effort aerobic activity in your preferred sport. Keep heart rate comfortable and conversational. Consistency over intensity.',
    rationale: 'Aerobic base sessions are the foundation of any training plan. Consistency matters more than intensity here.',
  },
];

// ── Slug → id mapping (populated lazily from DB for FK persistence) ─────────
let _slugToId = null; // filled by loadSlugMap() on first use

async function loadSlugMap(supabase) {
  if (_slugToId) return _slugToId;
  const { data, error } = await supabase
    .from('workout_library')
    .select('id, slug');
  if (error) throw new Error(`workout_library slug map: ${error.message}`);
  _slugToId = {};
  for (const row of data || []) _slugToId[row.slug] = row.id;
  return _slugToId;
}

function clearSlugMap() { _slugToId = null; } // for tests

// ── Filtering ─────────────────────────────────────────────────────────────────

/**
 * Derive the week_type string from a plan week row.
 * Values: 'normal' | 'recovery' | 'taper'
 *
 * @param {object} weekRow   — training_plan_weeks row
 * @param {string} blockType — block_type from the block row
 * @returns {string}
 */
function weekTypeFromRow(weekRow, blockType) {
  if (weekRow && weekRow.is_recovery_week) return 'recovery';
  if (blockType === 'taper') return 'taper';
  return 'normal';
}

/**
 * Find the best matching workout for a given slot.
 *
 * Matching priority:
 *   1. Exact sport + slot_type + block_type + week_type + level
 *   2. Exact sport + slot_type + block_type + level  (ignore week_type)
 *   3. Exact sport + session_type match + block_type + level  (legacy fallback)
 *   4. Exact sport + level only
 *   5. 'Any' sport fallback
 *
 * Returns the first matching workout (deterministic).
 * Never returns null — always falls back to 'easy-aerobic-any'.
 *
 * @param {string} sport        — e.g. 'Run'
 * @param {string} slotType     — 'easy' | 'long' | 'quality' | 'recovery' | 'strength' | 'support'
 * @param {string} sessionType  — 'easy' | 'long' | 'tempo' | 'interval' | 'strength'
 * @param {string} blockType    — 'base' | 'build' | 'peak' | 'taper' | 'recovery'
 * @param {string} weekType     — 'normal' | 'recovery' | 'taper'
 * @param {string} level        — 'beginner' | 'intermediate' | 'advanced'
 * @returns {object}            — workout entry from WORKOUTS
 */
/**
 * Score a single workout candidate for a given scheduling context.
 *
 * Each component is independently interpretable — no black-box aggregate.
 * Higher score = better fit. Ties are broken by array order (deterministic).
 *
 * Components (via scoreSuitabilityBreakdown):
 *   weekTypeFit        +3   exact week_type match
 *   blockTypeFit       +2   exact block_type match
 *   recoveryCostFit  +4/+1/−3  cost in recovery week; +2/−1 in taper
 *   slotRoleFit      +2/+1/−1/±2/±3  slot-role and cost alignment
 *   readinessFit     +2/−2   low readiness prefers low cost (non-long slots)
 *   loadToleranceFit +2/−2   low load tolerance prefers low cost (non-long slots)
 *   familyVariety    −2   same progression_family already used this week
 *   slugVariety      −10  exact slug already used this week
 *
 * @param {object}   workout  — WORKOUTS entry
 * @param {object}   ctx      — scoring context
 * @param {string}   ctx.slotType          — 'easy'|'long'|'quality'|'recovery'|'strength'|'support'
 * @param {string}   ctx.blockType         — block phase
 * @param {string}   ctx.weekType          — 'normal'|'recovery'|'taper'
 * @param {string[]} ctx.usedSlugs         — slugs already assigned in this week (default [])
 * @param {string[]} ctx.usedFamilies      — progression_families already used (default [])
 * @param {string}   [ctx.readinessTier]   — 'low'|'moderate'|'high' (default: 'moderate')
 * @param {string}   [ctx.loadToleranceTier] — 'low'|'moderate'|'high' (default: 'moderate')
 * @returns {number}
 */
function scoreCandidate(workout, ctx) {
  return scoreSuitabilityBreakdown(workout, ctx).total;
}

/**
 * Score a workout candidate and return a labeled component breakdown.
 * Exported for testing and logging. scoreCandidate delegates to this.
 *
 * @param {object} workout
 * @param {object} ctx — same as scoreCandidate ctx
 * @returns {{ total: number, components: object }}
 */
function scoreSuitabilityBreakdown(workout, {
  slotType,
  blockType,
  weekType,
  usedSlugs         = [],
  usedFamilies       = [],
  readinessTier      = 'moderate',
  loadToleranceTier  = 'moderate',
}) {
  const c = {}; // named components

  // 1. Week type fit — rewards workouts explicitly designed for this week context
  c.weekTypeFit = (workout.week_types || []).includes(weekType) ? 3 : 0;

  // 2. Block type fit — rewards workouts designed for this training phase
  c.blockTypeFit = (workout.block_types || []).includes(blockType) ? 2 : 0;

  // 3. Recovery cost fit with week context
  c.recoveryCostFit = 0;
  if (weekType === 'recovery') {
    if (workout.recovery_cost === 'low')          c.recoveryCostFit = 4;
    else if (workout.recovery_cost === 'moderate') c.recoveryCostFit = 1;
    else if (workout.recovery_cost === 'high')     c.recoveryCostFit = -3;
  } else if (weekType === 'taper') {
    if (workout.recovery_cost === 'low')           c.recoveryCostFit = 2;
    else if (workout.recovery_cost === 'high')     c.recoveryCostFit = -1;
  }

  // 4. Slot role alignment — rewards workouts that fit the day's purpose
  c.slotRoleFit = 0;
  if (slotType === 'quality') {
    if (workout.is_key_session)                              c.slotRoleFit += 2;
    if (workout.recovery_cost === 'high')                    c.slotRoleFit += 1;
    if (workout.recovery_cost === 'low' && weekType === 'normal') c.slotRoleFit -= 1;
  }
  if (slotType === 'easy' || slotType === 'recovery') {
    if (!workout.is_key_session)                             c.slotRoleFit += 2;
    if (workout.recovery_cost === 'low')                     c.slotRoleFit += 2;
    if (workout.recovery_cost === 'high')                    c.slotRoleFit -= 3;
  }
  if (slotType === 'long') {
    // Long sessions structurally carry high cost — reward rather than penalise
    if (workout.recovery_cost === 'high')                    c.slotRoleFit += 1;
  }

  // 5. Readiness fit — under-recovered athlete needs lower-cost sessions
  //    Skipped for long slot (cost is structural, not a signal of overreaching)
  c.readinessFit = 0;
  if (readinessTier === 'low' && slotType !== 'long') {
    if (workout.recovery_cost === 'low')       c.readinessFit =  2;
    else if (workout.recovery_cost === 'high') c.readinessFit = -2;
  }

  // 6. Load tolerance fit — low-adapted athlete should also avoid high-cost work
  c.loadToleranceFit = 0;
  if (loadToleranceTier === 'low' && slotType !== 'long') {
    if (workout.recovery_cost === 'low')       c.loadToleranceFit =  2;
    else if (workout.recovery_cost === 'high') c.loadToleranceFit = -2;
  }

  // 7. Progression family variety — mild penalty for repeating the same stimulus
  //    (-2 keeps variety as tiebreaker; doesn't override slot/block/week fit)
  c.familyVariety = usedFamilies.includes(workout.progression_family) ? -2 : 0;

  // 8. Slug variety — strong penalty for exact repeat in the same week
  c.slugVariety = usedSlugs.includes(workout.slug) ? -10 : 0;

  const total = Object.values(c).reduce((s, v) => s + v, 0);
  return { total, components: c };
}

/**
 * Return the highest-scoring candidate from a list.
 * Array order is the tiebreaker (deterministic).
 */
function bestMatch(candidates, ctx) {
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, w) =>
    scoreCandidate(w, ctx) > scoreCandidate(best, ctx) ? w : best
  , candidates[0]);
}

/**
 * Find the best matching workout for a given slot.
 *
 * Matching priority (pass order):
 *   1. Exact sport + slot_type + block_type + week_type + level
 *   2. Exact sport + slot_type + block_type + level  (ignore week_type)
 *   3. Exact sport + session_type match + block_type + level  (legacy/compat)
 *   4. Exact sport + level only
 *   5. 'Any' sport fallback
 *
 * Within each pass, candidates are ranked by scoreCandidate().
 * Never returns null — always falls back to 'easy-aerobic-any'.
 *
 * @param {string}   sport
 * @param {string}   slotType           — 'easy'|'long'|'quality'|'recovery'|'strength'|'support'
 * @param {string}   sessionType        — 'easy'|'long'|'tempo'|'interval'|'strength'
 * @param {string}   blockType          — 'base'|'build'|'peak'|'taper'|'recovery'
 * @param {string}   weekType           — 'normal'|'recovery'|'taper'
 * @param {string}   level              — 'beginner'|'intermediate'|'advanced'
 * @param {string[]} usedSlugs          — slugs already scheduled this week (for variety)
 * @param {string}   [readinessTier]    — 'low'|'moderate'|'high' (default: 'moderate')
 * @param {string[]} [usedFamilies]     — progression_families already used this week (default [])
 * @param {string}   [loadToleranceTier] — 'low'|'moderate'|'high' (default: 'moderate')
 * @returns {object}                    — workout entry from WORKOUTS
 */
function pickWorkout(sport, slotType, sessionType, blockType, weekType, level,
  usedSlugs = [], readinessTier = 'moderate',
  usedFamilies = [], loadToleranceTier = 'moderate') {
  // Normalise: beginners can't do interval/tempo — downgrade slot + session type
  const effectiveSlotType    = downgradeSlotForLevel(slotType, level);
  const effectiveSessionType = downgradeSessionTypeForLevel(sessionType, level);
  const effectiveBlockType   = blockType || 'base';
  const effectiveWeekType    = weekType  || 'normal';

  const ctx = {
    slotType: effectiveSlotType, blockType: effectiveBlockType,
    weekType: effectiveWeekType, usedSlugs, readinessTier,
    usedFamilies, loadToleranceTier,
  };

  // Pass 1: slot_type + block_type + week_type + level (tightest)
  const p1 = WORKOUTS.filter(w =>
    w.sport === sport &&
    w.slot_type === effectiveSlotType &&
    w.block_types.includes(effectiveBlockType) &&
    (w.week_types || []).includes(effectiveWeekType) &&
    w.levels.includes(level)
  );
  if (p1.length) return bestMatch(p1, ctx);

  // Pass 2: slot_type + block_type + level (ignore week_type)
  const p2 = WORKOUTS.filter(w =>
    w.sport === sport &&
    w.slot_type === effectiveSlotType &&
    w.block_types.includes(effectiveBlockType) &&
    w.levels.includes(level)
  );
  if (p2.length) return bestMatch(p2, ctx);

  // Pass 3: session_type + block_type + level (legacy/compat)
  const p3 = WORKOUTS.filter(w =>
    w.sport === sport &&
    w.session_type === effectiveSessionType &&
    w.block_types.includes(effectiveBlockType) &&
    w.levels.includes(level)
  );
  if (p3.length) return bestMatch(p3, ctx);

  // Pass 4: exact sport + level (any slot/session type)
  const p4 = WORKOUTS.filter(w =>
    w.sport === sport &&
    w.levels.includes(level)
  );
  if (p4.length) return bestMatch(p4, ctx);

  // Pass 5: 'Any' sport fallback
  return WORKOUTS.find(w => w.slug === 'easy-aerobic-any');
}

/**
 * Beginners should not have quality/hard slots.
 * Map 'quality' → 'easy' for them.
 */
function downgradeSlotForLevel(slotType, level) {
  if (level === 'beginner' && slotType === 'quality') return 'easy';
  return slotType;
}

/**
 * Beginners should not be prescribed interval or tempo sessions.
 * Downgrade to 'easy' to protect safety.
 */
function downgradeSessionTypeForLevel(sessionType, level) {
  if (level === 'beginner' && (sessionType === 'interval' || sessionType === 'tempo')) {
    return 'easy';
  }
  return sessionType;
}

/**
 * Determine the primary sport for a user based on:
 *   1. goal.primary_sport (user-set)
 *   2. features.primary_sport (derived from Strava activities)
 *   3. goal_type default
 *   4. Fallback: 'Run'
 */
function inferPrimarySport(goal, features) {
  if (goal.primary_sport) return goal.primary_sport;
  if (features && features.primary_sport) return features.primary_sport;

  const goalSportMap = {
    race_5k:            'Run',
    race_10k:           'Run',
    race_half_marathon: 'Run',
    race_marathon:      'Run',
    triathlon:          'Run', // default; scheduler rotates sports for triathlon
    base_fitness:       'Run',
    general_performance:'Run',
    weight_loss:        'Run',
  };
  return goalSportMap[goal.goal_type] || 'Run';
}

/**
 * For triathlon goals, return the sport for a given training day index
 * by cycling through Run → Ride → Swim in a repeating pattern.
 * Run more (since it has highest injury risk from overtraining).
 */
function triathlonSportForIndex(index) {
  // Pattern: Run, Ride, Swim, Run, Ride, Run  (for up to 6 sessions)
  const cycle = ['Run', 'Ride', 'Swim', 'Run', 'Ride', 'Run'];
  return cycle[index % cycle.length];
}

module.exports = {
  WORKOUTS,
  pickWorkout,
  scoreCandidate,
  scoreSuitabilityBreakdown,
  weekTypeFromRow,
  inferPrimarySport,
  triathlonSportForIndex,
  loadSlugMap,
  clearSlugMap,
};
