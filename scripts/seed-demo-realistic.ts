/**
 * Seed REALISTIC demo data for the Demo Runner profile
 *
 * Creates 16 weeks of training data with:
 * - Varied week structures (not identical)
 * - Realistic run type distribution
 * - Lap data for quality workouts
 * - Messy data (missed days, GPS issues, etc.)
 * - Race results (5K, 10K, half marathon)
 * - Weather conditions
 * - Progressive fitness trend
 * - Shoe rotation
 *
 * Run with: npx tsx scripts/seed-demo-realistic.ts
 */

import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const DEMO_PROFILE_ID = 2;

// Helper functions
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateToString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Workout generation interfaces
interface Lap {
  distance: number;
  pace: number; // seconds per mile
  hr: number;
  type: 'warmup' | 'cooldown' | 'easy' | 'interval' | 'recovery_jog' | 'tempo' | 'threshold' | 'race';
}

interface GeneratedWorkout {
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  avgHR: number;
  maxHR: number;
  workoutType: string;
  notes?: string;
  weatherTempF?: number;
  weatherConditions?: string;
  laps?: Lap[];
  source: string;
  shoeId?: number;
}

// Pace zones that progress over 16 weeks
function getPaceZones(weekNumber: number): {
  recovery: { min: number; max: number };
  easy: { min: number; max: number };
  marathon: { min: number; max: number };
  threshold: { min: number; max: number };
  interval: { min: number; max: number };
} {
  // Start with ~42 VDOT, progress to ~45 VDOT over 16 weeks
  const progressFactor = 1 - (weekNumber / 16) * 0.08; // 8% faster by week 16

  return {
    recovery: { min: 585 * progressFactor, max: 630 * progressFactor }, // 9:45-10:30
    easy: { min: 510 * progressFactor, max: 555 * progressFactor },     // 8:30-9:15
    marathon: { min: 465 * progressFactor, max: 495 * progressFactor }, // 7:45-8:15
    threshold: { min: 415 * progressFactor, max: 435 * progressFactor }, // 6:55-7:15
    interval: { min: 375 * progressFactor, max: 395 * progressFactor }, // 6:15-6:35
  };
}

// Generate an easy run
function generateEasyRun(date: Date, weekNumber: number, shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const distance = randomBetween(5, 8);
  const avgPace = randomBetween(zones.easy.min, zones.easy.max);
  const avgHR = randomInt(135, 150);

  // Simple lap data (per mile)
  const laps: Lap[] = [];
  for (let i = 0; i < Math.floor(distance); i++) {
    laps.push({
      distance: 1,
      pace: avgPace + randomBetween(-10, 10),
      hr: avgHR + randomInt(-5, 5),
      type: 'easy',
    });
  }
  // Partial last mile
  const partial = distance - Math.floor(distance);
  if (partial > 0.1) {
    laps.push({
      distance: Math.round(partial * 100) / 100,
      pace: avgPace + randomBetween(-10, 10),
      hr: avgHR + randomInt(-3, 3),
      type: 'easy',
    });
  }

  return {
    date: dateToString(date),
    distanceMiles: Math.round(distance * 100) / 100,
    durationMinutes: Math.round((distance * avgPace) / 60),
    avgPaceSeconds: Math.round(avgPace),
    avgHR,
    maxHR: avgHR + randomInt(10, 20),
    workoutType: 'easy',
    laps,
    source: 'strava',
    shoeId: shoeIds[randomInt(0, shoeIds.length - 1)],
  };
}

// Generate a recovery run
function generateRecoveryRun(date: Date, weekNumber: number, shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const distance = randomBetween(3, 5);
  const avgPace = randomBetween(zones.recovery.min, zones.recovery.max);
  const avgHR = randomInt(120, 140);

  return {
    date: dateToString(date),
    distanceMiles: Math.round(distance * 100) / 100,
    durationMinutes: Math.round((distance * avgPace) / 60),
    avgPaceSeconds: Math.round(avgPace),
    avgHR,
    maxHR: avgHR + randomInt(8, 15),
    workoutType: 'recovery',
    source: 'strava',
    shoeId: shoeIds[2], // Recovery shoe
  };
}

// Generate a long run
function generateLongRun(date: Date, weekNumber: number, shoeIds: number[], isProgressionRun: boolean = false): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);

  // Long run distance progresses: 12mi in week 1, up to 18mi by week 12, then tapers
  let targetDistance: number;
  if (weekNumber <= 12) {
    targetDistance = 12 + (weekNumber - 1) * 0.5;
  } else {
    targetDistance = 18 - (weekNumber - 12) * 1.5; // Taper
  }
  targetDistance = Math.min(18, Math.max(12, targetDistance + randomBetween(-1, 1)));

  const laps: Lap[] = [];
  let totalDuration = 0;
  let totalHR = 0;
  let maxHR = 0;

  if (isProgressionRun) {
    // Progression: start easy, finish at marathon pace
    const milesEasy = Math.floor(targetDistance * 0.6);
    const milesFast = Math.floor(targetDistance) - milesEasy;

    // Easy miles
    for (let i = 0; i < milesEasy; i++) {
      const pace = zones.easy.min + (zones.easy.max - zones.easy.min) * (1 - i / milesEasy * 0.3);
      const hr = 140 + i * 2;
      laps.push({ distance: 1, pace, hr, type: 'easy' });
      totalDuration += pace;
      totalHR += hr;
      maxHR = Math.max(maxHR, hr);
    }

    // Marathon pace miles
    for (let i = 0; i < milesFast; i++) {
      const pace = zones.marathon.min + randomBetween(-5, 10);
      const hr = 160 + i * 2;
      laps.push({ distance: 1, pace, hr, type: 'tempo' });
      totalDuration += pace;
      totalHR += hr;
      maxHR = Math.max(maxHR, hr);
    }
  } else {
    // Regular long run at easy-to-moderate pace
    for (let i = 0; i < Math.floor(targetDistance); i++) {
      // Gradual drift as fatigue sets in
      const fatigueFactor = 1 + (i / targetDistance) * 0.05;
      const pace = (zones.easy.min + randomBetween(0, 20)) * fatigueFactor;
      const hr = 140 + i * 1.5 + randomInt(-3, 3);
      laps.push({ distance: 1, pace: Math.round(pace), hr: Math.round(hr), type: 'easy' });
      totalDuration += pace;
      totalHR += hr;
      maxHR = Math.max(maxHR, hr);
    }
  }

  const numLaps = laps.length;

  return {
    date: dateToString(date),
    distanceMiles: Math.round(targetDistance * 100) / 100,
    durationMinutes: Math.round(totalDuration / 60),
    avgPaceSeconds: Math.round(totalDuration / numLaps),
    avgHR: Math.round(totalHR / numLaps),
    maxHR: Math.round(maxHR) + randomInt(3, 8),
    workoutType: 'long',
    notes: isProgressionRun ? 'Progression long run - last few miles at marathon pace' : undefined,
    laps,
    source: 'strava',
    shoeId: shoeIds[0], // Daily trainer for long runs
  };
}

// Generate tempo run
function generateTempoRun(date: Date, weekNumber: number, shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const tempoMiles = randomBetween(3, 5);

  const laps: Lap[] = [];

  // Warmup: 1.5 miles easy
  laps.push({ distance: 1.5, pace: zones.easy.max, hr: 138, type: 'warmup' });

  // Tempo segment
  for (let i = 0; i < Math.floor(tempoMiles); i++) {
    laps.push({
      distance: 1,
      pace: zones.threshold.min + randomBetween(-5, 10),
      hr: 165 + randomInt(-3, 5),
      type: 'threshold',
    });
  }

  // Cooldown: 1 mile easy
  laps.push({ distance: 1, pace: zones.easy.max + 20, hr: 145, type: 'cooldown' });

  const totalDistance = 1.5 + tempoMiles + 1;
  const totalDuration = laps.reduce((sum, l) => sum + l.distance * l.pace, 0);
  const avgHR = Math.round(laps.reduce((sum, l) => sum + l.hr * l.distance, 0) / totalDistance);

  return {
    date: dateToString(date),
    distanceMiles: Math.round(totalDistance * 100) / 100,
    durationMinutes: Math.round(totalDuration / 60),
    avgPaceSeconds: Math.round(totalDuration / totalDistance),
    avgHR,
    maxHR: 175 + randomInt(0, 8),
    workoutType: 'tempo',
    notes: `${Math.floor(tempoMiles)} miles at threshold pace`,
    laps,
    source: 'strava',
    shoeId: shoeIds[0],
  };
}

// Generate interval session (800m repeats)
function generateIntervalSession(date: Date, weekNumber: number, shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const numRepeats = randomInt(5, 8);

  const laps: Lap[] = [];

  // Warmup with strides
  laps.push({ distance: 1.5, pace: zones.easy.max, hr: 138, type: 'warmup' });

  // Interval repeats (800m = 0.5mi)
  for (let i = 0; i < numRepeats; i++) {
    // Work interval
    laps.push({
      distance: 0.5,
      pace: zones.interval.min + randomBetween(-10, 15),
      hr: 178 + randomInt(-3, 8),
      type: 'interval',
    });
    // Recovery jog (400m = 0.25mi)
    if (i < numRepeats - 1) {
      laps.push({
        distance: 0.25,
        pace: zones.recovery.max + 20,
        hr: 155 + randomInt(-5, 5),
        type: 'recovery_jog',
      });
    }
  }

  // Cooldown
  laps.push({ distance: 1.5, pace: zones.easy.max + 10, hr: 142, type: 'cooldown' });

  const totalDistance = laps.reduce((sum, l) => sum + l.distance, 0);
  const totalDuration = laps.reduce((sum, l) => sum + l.distance * l.pace, 0);
  const avgHR = Math.round(laps.reduce((sum, l) => sum + l.hr * l.distance, 0) / totalDistance);

  return {
    date: dateToString(date),
    distanceMiles: Math.round(totalDistance * 100) / 100,
    durationMinutes: Math.round(totalDuration / 60),
    avgPaceSeconds: Math.round(totalDuration / totalDistance),
    avgHR,
    maxHR: 186 + randomInt(0, 5),
    workoutType: 'interval',
    notes: `${numRepeats}x800m @ ${formatPace(zones.interval.min)}-${formatPace(zones.interval.max)} w/ 400m jog recovery`,
    laps,
    source: 'strava',
    shoeId: shoeIds[1], // Speed shoes
  };
}

// Generate a race
function generateRace(date: Date, weekNumber: number, raceType: '5k' | '10k' | 'half', shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);

  const raceConfigs = {
    '5k': { distance: 3.1, paceMultiplier: 0.92, targetHR: 182 },
    '10k': { distance: 6.2, paceMultiplier: 0.95, targetHR: 178 },
    'half': { distance: 13.1, paceMultiplier: 1.02, targetHR: 172 },
  };

  const config = raceConfigs[raceType];
  const racePace = zones.threshold.min * config.paceMultiplier;

  const laps: Lap[] = [];
  for (let i = 0; i < Math.floor(config.distance); i++) {
    // Even pacing with slight variation
    laps.push({
      distance: 1,
      pace: racePace + randomBetween(-8, 8),
      hr: config.targetHR + randomInt(-3, 5),
      type: 'race',
    });
  }
  // Partial last mile
  const partial = config.distance - Math.floor(config.distance);
  if (partial > 0.05) {
    laps.push({
      distance: Math.round(partial * 100) / 100,
      pace: racePace - 10, // Kick at the end
      hr: config.targetHR + 8,
      type: 'race',
    });
  }

  const totalDuration = laps.reduce((sum, l) => sum + l.distance * l.pace, 0);

  const raceNames = {
    '5k': ['Downtown 5K', 'Turkey Trot 5K', 'Park Run'],
    '10k': ['Bridge Run 10K', 'Autumn Classic 10K'],
    'half': ['City Half Marathon', 'Spring Half'],
  };

  return {
    date: dateToString(date),
    distanceMiles: config.distance,
    durationMinutes: Math.round(totalDuration / 60),
    avgPaceSeconds: Math.round(racePace),
    avgHR: config.targetHR,
    maxHR: config.targetHR + randomInt(5, 10),
    workoutType: 'race',
    notes: `${raceNames[raceType][randomInt(0, raceNames[raceType].length - 1)]} - ${raceType.toUpperCase()}`,
    laps,
    source: 'strava',
    shoeId: shoeIds[1], // Race shoes
  };
}

// Generate a treadmill run (no GPS data)
function generateTreadmillRun(date: Date, weekNumber: number): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const distance = randomBetween(4, 6);
  const avgPace = randomBetween(zones.easy.min, zones.easy.max);

  return {
    date: dateToString(date),
    distanceMiles: Math.round(distance * 100) / 100,
    durationMinutes: Math.round((distance * avgPace) / 60),
    avgPaceSeconds: Math.round(avgPace),
    avgHR: randomInt(140, 155),
    maxHR: randomInt(160, 170),
    workoutType: 'easy',
    notes: 'Treadmill run - rainy day',
    source: 'manual',
  };
}

// Generate a bad day / cut short run
function generateCutShortRun(date: Date, weekNumber: number, shoeIds: number[]): GeneratedWorkout {
  const zones = getPaceZones(weekNumber);
  const distance = randomBetween(2.5, 4);
  const avgPace = randomBetween(zones.easy.max, zones.recovery.min);

  return {
    date: dateToString(date),
    distanceMiles: Math.round(distance * 100) / 100,
    durationMinutes: Math.round((distance * avgPace) / 60),
    avgPaceSeconds: Math.round(avgPace),
    avgHR: randomInt(145, 160), // HR higher than expected for pace (fatigue/stress)
    maxHR: randomInt(165, 175),
    workoutType: 'easy',
    notes: 'Felt tired, cut it short. Legs heavy.',
    source: 'strava',
    shoeId: shoeIds[2],
  };
}

// Add weather to some workouts
function addWeather(workout: GeneratedWorkout): GeneratedWorkout {
  const conditions = ['clear', 'cloudy', 'rain', 'hot', 'cold', 'windy'];
  const condition = conditions[randomInt(0, conditions.length - 1)];

  let temp: number;
  switch (condition) {
    case 'hot':
      temp = randomInt(78, 90);
      break;
    case 'cold':
      temp = randomInt(25, 38);
      break;
    default:
      temp = randomInt(45, 72);
  }

  return {
    ...workout,
    weatherTempF: temp,
    weatherConditions: condition,
  };
}

// Main generation function
async function generateAllWorkouts(): Promise<GeneratedWorkout[]> {
  const workouts: GeneratedWorkout[] = [];
  const today = new Date();
  const startDate = addDays(today, -112); // 16 weeks ago

  // Get shoe IDs (will be created first)
  const shoeIds = [1, 2, 3]; // Placeholder, will be actual IDs

  // Races scheduled at specific weeks
  const raceWeeks = {
    5: '5k',    // 5K at week 5
    9: '10k',   // 10K at week 9
    14: 'half', // Half marathon tune-up at week 14
  } as const;

  // Recovery weeks (every 4th week)
  const recoveryWeeks = [4, 8, 12, 16];

  // Track one "busy week" where runner missed several days
  const busyWeek = 7;

  for (let week = 1; week <= 16; week++) {
    const weekStart = addDays(startDate, (week - 1) * 7);
    const isRecoveryWeek = recoveryWeeks.includes(week);
    const isBusyWeek = week === busyWeek;
    const raceThisWeek = raceWeeks[week as keyof typeof raceWeeks];

    // Standard week structure: Mon off, Tue quality, Wed easy, Thu quality, Fri easy/off, Sat long, Sun recovery
    const weekPlan = [
      { day: 0, type: 'off' },        // Monday - off
      { day: 1, type: 'quality1' },   // Tuesday - quality
      { day: 2, type: 'easy' },       // Wednesday - easy
      { day: 3, type: 'quality2' },   // Thursday - quality
      { day: 4, type: 'easy_or_off' }, // Friday - easy or off
      { day: 5, type: 'long' },       // Saturday - long
      { day: 6, type: 'recovery' },   // Sunday - recovery
    ];

    for (const { day, type } of weekPlan) {
      const runDate = addDays(weekStart, day);

      // Skip if in future
      if (runDate > today) continue;

      // Busy week - skip more days
      if (isBusyWeek && (day === 2 || day === 4 || day === 6)) continue;

      // Recovery week - reduced volume and intensity
      if (isRecoveryWeek && type === 'quality2') continue;

      let workout: GeneratedWorkout | null = null;

      switch (type) {
        case 'off':
          continue;

        case 'quality1':
          if (raceThisWeek && day === 1) {
            // Race week - easy shakeout instead of quality
            workout = generateEasyRun(runDate, week, shoeIds);
            workout.distanceMiles = randomBetween(3, 4);
            workout.notes = 'Pre-race shakeout';
          } else {
            // Tempo run
            workout = generateTempoRun(runDate, week, shoeIds);
          }
          break;

        case 'quality2':
          if (raceThisWeek) {
            // Race day!
            workout = generateRace(runDate, week, raceThisWeek, shoeIds);
          } else {
            // Intervals
            workout = generateIntervalSession(runDate, week, shoeIds);
          }
          break;

        case 'easy':
          // Occasionally a treadmill run or cut short
          const rand = Math.random();
          if (rand < 0.05) {
            workout = generateTreadmillRun(runDate, week);
          } else if (rand < 0.1) {
            workout = generateCutShortRun(runDate, week, shoeIds);
          } else {
            workout = generateEasyRun(runDate, week, shoeIds);
          }
          break;

        case 'easy_or_off':
          // 40% chance of taking the day off
          if (Math.random() < 0.4) continue;
          workout = generateEasyRun(runDate, week, shoeIds);
          workout.distanceMiles = randomBetween(4, 5);
          break;

        case 'long':
          // Occasionally a progression long run
          const isProgression = Math.random() < 0.25;
          workout = generateLongRun(runDate, week, shoeIds, isProgression);
          break;

        case 'recovery':
          workout = generateRecoveryRun(runDate, week, shoeIds);
          break;
      }

      if (workout) {
        // Add weather to ~60% of workouts
        if (Math.random() < 0.6) {
          workout = addWeather(workout);
        }
        workouts.push(workout);
      }
    }
  }

  return workouts;
}

// Database operations
async function clearDemoData() {
  console.log('=== Clearing existing demo data ===\n');

  // Get workout IDs for demo profile first
  const demoWorkouts = await sql`SELECT id FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const workoutIds = (demoWorkouts as { id: number }[]).map((w) => w.id);

  if (workoutIds.length > 0) {
    // Delete segments and assessments for these workouts
    for (const wid of workoutIds) {
      await sql`DELETE FROM workout_segments WHERE workout_id = ${wid}`;
      await sql`DELETE FROM assessments WHERE workout_id = ${wid}`;
    }
    console.log(`  Deleted segments and assessments for ${workoutIds.length} workouts`);
  }

  await sql`DELETE FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  await sql`DELETE FROM shoes WHERE profile_id = ${DEMO_PROFILE_ID}`;

  // Delete planned_workouts through races (planned_workouts doesn't have profile_id directly)
  const demoRaces = await sql`SELECT id FROM races WHERE profile_id = ${DEMO_PROFILE_ID}`;
  for (const race of demoRaces) {
    await sql`DELETE FROM planned_workouts WHERE race_id = ${race.id}`;
  }

  await sql`DELETE FROM races WHERE profile_id = ${DEMO_PROFILE_ID}`;

  console.log('  Cleared workouts, shoes, races, and planned workouts\n');
}

async function seedShoes(): Promise<number[]> {
  console.log('=== Seeding Demo Shoes ===\n');

  const now = new Date().toISOString();
  const shoeIds: number[] = [];

  const shoes = [
    { name: 'Daily Trainers', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', totalMiles: 287 },
    { name: 'Race Day', brand: 'Nike', model: 'Vaporfly 3', category: 'race', totalMiles: 95 },
    { name: 'Recovery', brand: 'ASICS', model: 'Gel-Nimbus 25', category: 'recovery', totalMiles: 168 },
  ];

  for (const shoe of shoes) {
    const result = await sql`
      INSERT INTO shoes (profile_id, name, brand, model, category, intended_use, total_miles, is_retired, created_at)
      VALUES (${DEMO_PROFILE_ID}, ${shoe.name}, ${shoe.brand}, ${shoe.model}, ${shoe.category}, '[]', ${shoe.totalMiles}, false, ${now})
      RETURNING id
    `;
    shoeIds.push(result[0].id);
    console.log(`  Created shoe: ${shoe.name} (ID: ${result[0].id})`);
  }

  console.log('');
  return shoeIds;
}

async function seedRaces() {
  console.log('=== Seeding Demo Races ===\n');

  const now = new Date();
  const createdAt = now.toISOString();

  // Goal race: Spring marathon (future)
  const marathonDate = new Date(2026, 4, 3); // May 3, 2026
  await sql`
    INSERT INTO races (profile_id, name, date, distance_meters, distance_label, priority, target_time_seconds, training_plan_generated, created_at)
    VALUES (${DEMO_PROFILE_ID}, 'Jersey City Marathon', ${dateToString(marathonDate)}, 42195, 'marathon', 'A', 11100, true, ${createdAt})
  `;
  console.log('  Created A race: Jersey City Marathon');

  // Past races are handled in workout generation
  console.log('');
}

async function seedSettings() {
  console.log('=== Seeding Demo Settings ===\n');

  // Check if settings exist
  const existing = await sql`SELECT COUNT(*) as count FROM user_settings WHERE profile_id = ${DEMO_PROFILE_ID}`;

  const now = new Date().toISOString();

  if (parseInt(existing[0].count) > 0) {
    // Update existing
    await sql`
      UPDATE user_settings SET
        name = 'Jason',
        onboarding_completed = true,
        age = 34,
        gender = 'male',
        years_running = 5,
        current_weekly_mileage = 42,
        current_long_run_max = 16,
        runs_per_week_current = 5,
        runs_per_week_target = 6,
        peak_weekly_mileage_target = 55,
        weekly_volume_target_miles = 45,
        preferred_long_run_day = 'saturday',
        preferred_quality_days = '["tuesday","thursday"]',
        plan_aggressiveness = 'moderate',
        quality_sessions_per_week = 2,
        vdot = 44,
        easy_pace_seconds = 525,
        tempo_pace_seconds = 435,
        threshold_pace_seconds = 420,
        interval_pace_seconds = 385,
        marathon_pace_seconds = 465,
        half_marathon_pace_seconds = 435,
        temperature_preference = 'neutral',
        train_by = 'mixed',
        stress_level = 'moderate',
        typical_sleep_hours = 7,
        latitude = 40.7336,
        longitude = -74.0027,
        city_name = 'West Village, New York',
        coach_name = 'Coach',
        updated_at = ${now}
      WHERE profile_id = ${DEMO_PROFILE_ID}
    `;
    console.log('  Updated existing settings\n');
  } else {
    await sql`
      INSERT INTO user_settings (
        profile_id, name, onboarding_completed, age, gender, years_running,
        current_weekly_mileage, current_long_run_max, runs_per_week_current,
        runs_per_week_target, peak_weekly_mileage_target, weekly_volume_target_miles,
        preferred_long_run_day, preferred_quality_days, plan_aggressiveness,
        quality_sessions_per_week, vdot, easy_pace_seconds, tempo_pace_seconds,
        threshold_pace_seconds, interval_pace_seconds, marathon_pace_seconds,
        half_marathon_pace_seconds, temperature_preference, train_by, stress_level,
        typical_sleep_hours, latitude, longitude, city_name, coach_name, created_at, updated_at
      ) VALUES (
        ${DEMO_PROFILE_ID}, 'Jason', true, 34, 'male', 5,
        42, 16, 5, 6, 55, 45,
        'saturday', '["tuesday","thursday"]', 'moderate',
        2, 44, 525, 435,
        420, 385, 465, 435,
        'neutral', 'mixed', 'moderate',
        7, 40.7336, -74.0027, 'West Village, New York', 'Coach',
        ${now}, ${now}
      )
    `;
    console.log('  Created new settings\n');
  }
}

async function seedWorkouts(shoeIds: number[]) {
  console.log('=== Generating Realistic Workouts ===\n');

  const workouts = await generateAllWorkouts();
  const createdAt = new Date().toISOString();

  // Update shoe IDs in workouts
  for (const workout of workouts) {
    if (workout.shoeId) {
      // Map placeholder IDs to actual IDs
      const shoeIndex = (workout.shoeId as number) - 1;
      workout.shoeId = shoeIds[shoeIndex] || shoeIds[0];
    }
  }

  let count = 0;
  for (const workout of workouts) {
    await sql`
      INSERT INTO workouts (
        profile_id, date, distance_miles, duration_minutes, avg_pace_seconds,
        avg_hr, max_hr, workout_type, notes,
        weather_temp_f, weather_conditions, source, shoe_id, created_at, updated_at
      ) VALUES (
        ${DEMO_PROFILE_ID}, ${workout.date}, ${workout.distanceMiles}, ${workout.durationMinutes}, ${workout.avgPaceSeconds},
        ${workout.avgHR}, ${workout.maxHR}, ${workout.workoutType}, ${workout.notes || null},
        ${workout.weatherTempF || null}, ${workout.weatherConditions || null}, ${workout.source}, ${workout.shoeId || null},
        ${createdAt}, ${createdAt}
      )
    `;
    count++;
  }

  console.log(`  Created ${count} workouts over 16 weeks\n`);

  // Summary stats
  const totalMiles = workouts.reduce((sum, w) => sum + w.distanceMiles, 0);
  const longRuns = workouts.filter(w => w.workoutType === 'long').length;
  const tempos = workouts.filter(w => w.workoutType === 'tempo').length;
  const intervals = workouts.filter(w => w.workoutType === 'interval').length;
  const races = workouts.filter(w => w.workoutType === 'race').length;

  console.log('  Distribution:');
  console.log(`    Total miles: ${Math.round(totalMiles)}`);
  console.log(`    Long runs: ${longRuns}`);
  console.log(`    Tempo runs: ${tempos}`);
  console.log(`    Interval sessions: ${intervals}`);
  console.log(`    Races: ${races}`);
  console.log('');
}

async function showSummary() {
  console.log('=== Demo Profile Summary ===\n');

  const workoutCount = await sql`SELECT COUNT(*) as count FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const totalMiles = await sql`SELECT COALESCE(SUM(distance_miles), 0) as total FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const shoeCount = await sql`SELECT COUNT(*) as count FROM shoes WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const raceCount = await sql`SELECT COUNT(*) as count FROM races WHERE profile_id = ${DEMO_PROFILE_ID}`;

  console.log(`  Workouts: ${workoutCount[0].count} (${Math.round(totalMiles[0].total)} total miles)`);
  console.log(`  Shoes: ${shoeCount[0].count}`);
  console.log(`  Upcoming races: ${raceCount[0].count}`);
  console.log('');
}

async function main() {
  console.log('\n========================================');
  console.log('  REALISTIC DEMO DATA SEEDER');
  console.log('  16 weeks of training history');
  console.log('========================================\n');

  try {
    await clearDemoData();
    const shoeIds = await seedShoes();
    await seedRaces();
    await seedSettings();
    await seedWorkouts(shoeIds);
    await showSummary();

    console.log('Done! Demo profile now has realistic training data.\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
