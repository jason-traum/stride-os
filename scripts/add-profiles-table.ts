/**
 * Migration script to add profile_id columns to ALL data tables
 * This enables full data isolation per profile.
 *
 * Run with: npx tsx scripts/add-profiles-table.ts
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

// Tables that need profile_id column
const TABLES_NEEDING_PROFILE_ID = [
  'user_settings',
  'workouts',
  'shoes',
  'chat_messages',
  'races',
  'race_results',
  'clothing_items',
  'coach_settings',
  'coach_actions',
  'canonical_routes',
];

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    AND column_name = ${columnName}
  `;
  return result.length > 0;
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name = ${tableName}
  `;
  return result.length > 0;
}

async function addProfileIdColumn(tableName: string): Promise<void> {
  // Check if table exists first
  const tExists = await tableExists(tableName);
  if (!tExists) {
    console.log(`  ${tableName}: table does not exist, skipping`);
    return;
  }

  const exists = await checkColumnExists(tableName, 'profile_id');
  if (exists) {
    console.log(`  ${tableName}: profile_id already exists`);
    return;
  }

  console.log(`  ${tableName}: adding profile_id column...`);
  // Use raw SQL since we can't use template literals for table names
  await sql.query(`ALTER TABLE ${tableName} ADD COLUMN profile_id INTEGER REFERENCES profiles(id)`);
  console.log(`  ${tableName}: done`);
}

async function assignExistingDataToProfile(tableName: string, profileId: number): Promise<void> {
  // Check if table exists first
  const tExists = await tableExists(tableName);
  if (!tExists) {
    console.log(`  ${tableName}: table does not exist, skipping`);
    return;
  }

  // Check if profile_id column exists
  const colExists = await checkColumnExists(tableName, 'profile_id');
  if (!colExists) {
    console.log(`  ${tableName}: no profile_id column, skipping`);
    return;
  }

  // Update all rows without a profile_id to belong to the given profile
  const result = await sql.query(
    `UPDATE ${tableName} SET profile_id = $1 WHERE profile_id IS NULL`,
    [profileId]
  );
  console.log(`  ${tableName}: assigned ${result.count ?? 0} rows to profile ${profileId}`);
}

async function migrate() {
  console.log('Starting full profiles migration...\n');

  // Step 1: Create profiles table if it doesn't exist
  console.log('Step 1: Creating profiles table...');
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'personal',
      avatar_color TEXT DEFAULT '#3b82f6',
      is_protected BOOLEAN DEFAULT false,
      settings_snapshot TEXT,
      data_snapshot TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  console.log('Profiles table ready\n');

  // Step 2: Add profile_id column to all data tables
  console.log('Step 2: Adding profile_id column to all data tables...');
  for (const tableName of TABLES_NEEDING_PROFILE_ID) {
    await addProfileIdColumn(tableName);
  }
  console.log('');

  // Step 3: Create default profiles
  console.log('Step 3: Creating default profiles...');
  const now = new Date().toISOString();

  // Jason profile
  let jasonProfileId: number;
  const existingJason = await sql`
    SELECT id FROM profiles WHERE name = 'Jason' AND type = 'personal' LIMIT 1
  `;
  if (existingJason.length === 0) {
    const result = await sql`
      INSERT INTO profiles (name, type, avatar_color, is_protected, created_at, updated_at)
      VALUES ('Jason', 'personal', '#3b82f6', false, ${now}, ${now})
      RETURNING id
    `;
    jasonProfileId = result[0].id;
    console.log(`  Created Jason profile (ID: ${jasonProfileId})`);
  } else {
    jasonProfileId = existingJason[0].id;
    console.log(`  Jason profile exists (ID: ${jasonProfileId})`);
  }

  // Demo Runner profile
  let demoProfileId: number;
  const existingDemo = await sql`
    SELECT id FROM profiles WHERE name = 'Demo Runner' AND type = 'demo' LIMIT 1
  `;
  if (existingDemo.length === 0) {
    const result = await sql`
      INSERT INTO profiles (name, type, avatar_color, is_protected, created_at, updated_at)
      VALUES ('Demo Runner', 'demo', '#f59e0b', true, ${now}, ${now})
      RETURNING id
    `;
    demoProfileId = result[0].id;
    console.log(`  Created Demo Runner profile (ID: ${demoProfileId})`);
  } else {
    demoProfileId = existingDemo[0].id;
    console.log(`  Demo Runner profile exists (ID: ${demoProfileId})`);
  }
  console.log('');

  // Step 4: Assign all existing data to Jason's profile
  console.log('Step 4: Assigning existing data to Jason\'s profile...');
  for (const tableName of TABLES_NEEDING_PROFILE_ID) {
    await assignExistingDataToProfile(tableName, jasonProfileId);
  }
  console.log('');

  // Step 5: Create demo settings if they don't exist
  console.log('Step 5: Creating demo settings...');
  const existingDemoSettings = await sql`
    SELECT id FROM user_settings WHERE profile_id = ${demoProfileId} LIMIT 1
  `;
  if (existingDemoSettings.length === 0) {
    await sql`
      INSERT INTO user_settings (
        profile_id, name, onboarding_completed, age, gender, years_running,
        current_weekly_mileage, current_long_run_max, runs_per_week_current,
        runs_per_week_target, peak_weekly_mileage_target, weekly_volume_target_miles,
        preferred_long_run_day, preferred_quality_days, plan_aggressiveness,
        quality_sessions_per_week, vdot, easy_pace_seconds, tempo_pace_seconds,
        threshold_pace_seconds, interval_pace_seconds, marathon_pace_seconds,
        half_marathon_pace_seconds, temperature_preference, train_by, stress_level,
        typical_sleep_hours, latitude, longitude, city_name, created_at, updated_at
      ) VALUES (
        ${demoProfileId}, 'Demo Runner', true, 32, 'male', 4,
        35, 14, 5, 5, 50, 40,
        'saturday', '["tuesday","thursday"]', 'moderate',
        2, 45, 540, 450,
        420, 375, 480, 450,
        'neutral', 'mixed', 'moderate',
        7, 40.7336, -74.0027, 'West Village, New York',
        ${now}, ${now}
      )
    `;
    console.log('  Created demo settings');
  } else {
    console.log('  Demo settings already exist');
  }
  console.log('');

  console.log('Migration complete!');
  console.log('');
  console.log('Summary:');
  console.log(`  - Profiles table: ready`);
  console.log(`  - profile_id added to: ${TABLES_NEEDING_PROFILE_ID.join(', ')}`);
  console.log(`  - Jason profile ID: ${jasonProfileId}`);
  console.log(`  - Demo Runner profile ID: ${demoProfileId}`);
  console.log(`  - All existing data assigned to Jason's profile`);
}

migrate().catch(console.error);
