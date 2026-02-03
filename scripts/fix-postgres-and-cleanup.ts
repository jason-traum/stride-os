/**
 * Fix Postgres schema and clean up data for profiles
 *
 * 1. Add missing columns to workouts table
 * 2. Clear chat messages for all profiles
 * 3. Remove shoes from Jason's profile (profile_id = 1)
 * 4. Remove non-Strava workouts from Jason's profile
 * 5. Keep all Strava workouts in both profiles
 *
 * Run with: npx tsx scripts/fix-postgres-and-cleanup.ts
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

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    AND column_name = ${columnName}
  `;
  return result.length > 0;
}

async function addColumnIfMissing(tableName: string, columnName: string, columnDef: string): Promise<void> {
  const exists = await columnExists(tableName, columnName);
  if (exists) {
    console.log(`  ${tableName}.${columnName}: already exists`);
    return;
  }
  console.log(`  ${tableName}.${columnName}: adding...`);
  await sql.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  console.log(`  ${tableName}.${columnName}: done`);
}

async function fixPostgresSchema() {
  console.log('=== Step 1: Adding missing columns to workouts table ===\n');

  // These columns might be missing from the production schema
  const missingColumns = [
    ['auto_category', 'TEXT'],
    ['category', 'TEXT'],
    ['auto_summary', 'TEXT'],
    ['ai_explanation', 'TEXT'],
    ['quality_ratio', 'REAL'],
    ['trimp', 'REAL'],
    ['execution_score', 'REAL'],
    ['execution_details', 'TEXT'],
    ['data_quality_flags', 'TEXT'],
    ['route_fingerprint', 'TEXT'],
    ['route_id', 'INTEGER'],
  ];

  for (const [colName, colDef] of missingColumns) {
    await addColumnIfMissing('workouts', colName, colDef);
  }
  console.log('');
}

async function clearChatMessages() {
  console.log('=== Step 2: Clearing all chat messages ===\n');

  const result = await sql`DELETE FROM chat_messages`;
  console.log(`  Deleted all chat messages\n`);
}

async function removeShoesFromJason() {
  console.log('=== Step 3: Removing shoes from Jason profile (ID: 1) ===\n');

  // First, unlink any workouts from these shoes
  await sql`UPDATE workouts SET shoe_id = NULL WHERE profile_id = 1`;
  console.log('  Unlinked shoes from workouts');

  // Then delete the shoes
  const result = await sql`DELETE FROM shoes WHERE profile_id = 1`;
  console.log(`  Deleted shoes from Jason profile\n`);
}

async function removeNonStravaWorkouts() {
  console.log('=== Step 4: Removing non-Strava workouts from Jason profile ===\n');

  // Count before
  const beforeCount = await sql`
    SELECT COUNT(*) as count FROM workouts
    WHERE profile_id = 1 AND (source IS NULL OR source != 'strava')
  `;
  console.log(`  Found ${beforeCount[0].count} non-Strava workouts to remove`);

  // Delete assessments for those workouts first
  await sql`
    DELETE FROM assessments
    WHERE workout_id IN (
      SELECT id FROM workouts
      WHERE profile_id = 1 AND (source IS NULL OR source != 'strava')
    )
  `;
  console.log('  Deleted related assessments');

  // Delete workout segments
  await sql`
    DELETE FROM workout_segments
    WHERE workout_id IN (
      SELECT id FROM workouts
      WHERE profile_id = 1 AND (source IS NULL OR source != 'strava')
    )
  `;
  console.log('  Deleted related workout segments');

  // Now delete the workouts
  const result = await sql`
    DELETE FROM workouts
    WHERE profile_id = 1 AND (source IS NULL OR source != 'strava')
  `;
  console.log(`  Deleted non-Strava workouts\n`);
}

async function showSummary() {
  console.log('=== Summary ===\n');

  // Count workouts per profile
  const workoutCounts = await sql`
    SELECT profile_id, source, COUNT(*) as count
    FROM workouts
    GROUP BY profile_id, source
    ORDER BY profile_id, source
  `;
  console.log('Workouts by profile and source:');
  for (const row of workoutCounts) {
    console.log(`  Profile ${row.profile_id}, Source: ${row.source || 'null'}: ${row.count} workouts`);
  }

  // Count shoes per profile
  const shoeCounts = await sql`
    SELECT profile_id, COUNT(*) as count
    FROM shoes
    GROUP BY profile_id
  `;
  console.log('\nShoes by profile:');
  for (const row of shoeCounts) {
    console.log(`  Profile ${row.profile_id}: ${row.count} shoes`);
  }

  // Count chat messages
  const chatCount = await sql`SELECT COUNT(*) as count FROM chat_messages`;
  console.log(`\nChat messages: ${chatCount[0].count}`);
}

async function main() {
  console.log('Starting Postgres fix and cleanup...\n');

  try {
    await fixPostgresSchema();
    await clearChatMessages();
    await removeShoesFromJason();
    await removeNonStravaWorkouts();
    await showSummary();

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
