/**
 * Seed demo data for the Demo Runner profile (ID: 2)
 *
 * Run with: npx tsx scripts/seed-demo-profile.ts
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

async function seedDemoShoes() {
  console.log('=== Seeding Demo Shoes ===\n');

  const now = new Date().toISOString();

  // Check if shoes already exist for demo profile
  const existing = await sql`SELECT COUNT(*) as count FROM shoes WHERE profile_id = ${DEMO_PROFILE_ID}`;
  if (parseInt(existing[0].count) > 0) {
    console.log(`  Demo profile already has ${existing[0].count} shoes, skipping seed\n`);
    return;
  }

  const shoes = [
    { name: 'Daily Trainers', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', totalMiles: 234 },
    { name: 'Speed Shoes', brand: 'Nike', model: 'Vaporfly 3', category: 'race', totalMiles: 87 },
    { name: 'Easy Day', brand: 'ASICS', model: 'Gel-Nimbus 25', category: 'recovery', totalMiles: 156 },
  ];

  for (const shoe of shoes) {
    await sql`
      INSERT INTO shoes (profile_id, name, brand, model, category, intended_use, total_miles, is_retired, created_at)
      VALUES (${DEMO_PROFILE_ID}, ${shoe.name}, ${shoe.brand}, ${shoe.model}, ${shoe.category}, '[]', ${shoe.totalMiles}, false, ${now})
    `;
    console.log(`  Created shoe: ${shoe.name}`);
  }
  console.log('');
}

async function seedDemoWorkouts() {
  console.log('=== Seeding Demo Workouts ===\n');

  const now = new Date();

  // Check if workouts already exist for demo profile
  const existing = await sql`SELECT COUNT(*) as count FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  if (parseInt(existing[0].count) > 0) {
    console.log(`  Demo profile already has ${existing[0].count} workouts, skipping seed\n`);
    return;
  }

  // Create workouts for the last 30 days
  const workouts = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Skip some days randomly (rest days)
    if (Math.random() < 0.3) continue;

    const dayOfWeek = date.getDay();
    let workoutType: string;
    let distanceMiles: number;
    let paceSeconds: number;

    // Saturday = long run, Tuesday/Thursday = quality, others = easy
    if (dayOfWeek === 6) {
      workoutType = 'long';
      distanceMiles = 10 + Math.random() * 4;
      paceSeconds = 510 + Math.random() * 30; // 8:30-9:00 pace
    } else if (dayOfWeek === 2 || dayOfWeek === 4) {
      workoutType = Math.random() > 0.5 ? 'tempo' : 'interval';
      distanceMiles = 5 + Math.random() * 2;
      paceSeconds = 420 + Math.random() * 30; // 7:00-7:30 pace
    } else {
      workoutType = 'easy';
      distanceMiles = 4 + Math.random() * 2;
      paceSeconds = 540 + Math.random() * 30; // 9:00-9:30 pace
    }

    const durationMinutes = (distanceMiles * paceSeconds) / 60;

    workouts.push({
      date: dateStr,
      distanceMiles: Math.round(distanceMiles * 100) / 100,
      durationMinutes: Math.round(durationMinutes),
      avgPaceSeconds: Math.round(paceSeconds),
      workoutType,
    });
  }

  const createdAt = now.toISOString();
  for (const workout of workouts) {
    await sql`
      INSERT INTO workouts (profile_id, date, distance_miles, duration_minutes, avg_pace_seconds, workout_type, source, created_at, updated_at)
      VALUES (${DEMO_PROFILE_ID}, ${workout.date}, ${workout.distanceMiles}, ${workout.durationMinutes}, ${workout.avgPaceSeconds}, ${workout.workoutType}, 'demo', ${createdAt}, ${createdAt})
    `;
  }
  console.log(`  Created ${workouts.length} demo workouts\n`);
}

async function seedDemoSettings() {
  console.log('=== Checking Demo Settings ===\n');

  // Check if settings exist for demo profile
  const existing = await sql`SELECT COUNT(*) as count FROM user_settings WHERE profile_id = ${DEMO_PROFILE_ID}`;
  if (parseInt(existing[0].count) > 0) {
    console.log(`  Demo profile already has settings, skipping\n`);
    return;
  }

  const now = new Date().toISOString();

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
      ${DEMO_PROFILE_ID}, 'Demo Runner', true, 32, 'male', 4,
      35, 14, 5, 5, 50, 40,
      'saturday', '["tuesday","thursday"]', 'moderate',
      2, 45, 540, 450,
      420, 375, 480, 450,
      'neutral', 'mixed', 'moderate',
      7, 40.7336, -74.0027, 'West Village, New York', 'Coach Demo',
      ${now}, ${now}
    )
  `;
  console.log('  Created demo settings\n');
}

async function showSummary() {
  console.log('=== Demo Profile Summary ===\n');

  const workoutCount = await sql`SELECT COUNT(*) as count FROM workouts WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const shoeCount = await sql`SELECT COUNT(*) as count FROM shoes WHERE profile_id = ${DEMO_PROFILE_ID}`;
  const settingsCount = await sql`SELECT COUNT(*) as count FROM user_settings WHERE profile_id = ${DEMO_PROFILE_ID}`;

  console.log(`  Workouts: ${workoutCount[0].count}`);
  console.log(`  Shoes: ${shoeCount[0].count}`);
  console.log(`  Settings: ${settingsCount[0].count}`);
}

async function main() {
  console.log('Seeding Demo Profile data...\n');

  try {
    await seedDemoShoes();
    await seedDemoWorkouts();
    await seedDemoSettings();
    await showSummary();

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
