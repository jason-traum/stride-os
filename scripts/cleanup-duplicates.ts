/**
 * Clean up duplicate workouts from the database
 * Run with: npx tsx scripts/cleanup-duplicates.ts
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

async function main() {
  console.log('=== ANALYZING DUPLICATES ===\n');

  // Find duplicate workouts (same date + distance + duration)
  const duplicates = await sql`
    SELECT date, distance_miles, duration_minutes, workout_type, COUNT(*) as count,
           array_agg(id ORDER BY id) as ids
    FROM workouts
    GROUP BY date, distance_miles, duration_minutes, workout_type
    HAVING COUNT(*) > 1
    ORDER BY date DESC
  `;

  console.log(`Found ${duplicates.length} groups of duplicates\n`);

  if (duplicates.length === 0) {
    console.log('No duplicates to clean up!');
    return;
  }

  // Show first 10 duplicate groups
  console.log('Sample duplicates:');
  for (const dup of duplicates.slice(0, 10)) {
    console.log(`  ${dup.date}: ${dup.distance_miles}mi ${dup.workout_type} (${dup.count}x) - IDs: ${dup.ids.join(', ')}`);
  }

  // Collect IDs to delete (keep the first one, delete the rest)
  const idsToDelete: number[] = [];
  for (const dup of duplicates) {
    // Keep the first ID, delete the rest
    const [_keep, ...toDelete] = dup.ids;
    idsToDelete.push(...toDelete);
  }

  console.log(`\nWill delete ${idsToDelete.length} duplicate workouts`);

  // Delete duplicates
  if (idsToDelete.length > 0) {
    // First delete related assessments
    const assessmentResult = await sql`
      DELETE FROM assessments
      WHERE workout_id = ANY(${idsToDelete})
    `;
    console.log(`Deleted assessments for duplicate workouts`);

    // Then delete the workouts
    const workoutResult = await sql`
      DELETE FROM workouts
      WHERE id = ANY(${idsToDelete})
    `;
    console.log(`Deleted ${idsToDelete.length} duplicate workouts`);
  }

  // Also delete workouts with invalid pace (0 or > 20 min/mile)
  console.log('\n=== CLEANING INVALID PACES ===');
  const invalidPaces = await sql`
    DELETE FROM workouts
    WHERE avg_pace_seconds IS NOT NULL
    AND (avg_pace_seconds < 180 OR avg_pace_seconds > 1200)
    RETURNING id, date, avg_pace_seconds
  `;
  console.log(`Deleted ${invalidPaces.length} workouts with invalid paces`);

  // Final count
  console.log('\n=== FINAL COUNTS ===');
  const counts = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT date) as unique_dates,
      COUNT(CASE WHEN avg_hr IS NOT NULL THEN 1 END) as with_hr,
      COUNT(CASE WHEN strava_activity_id IS NOT NULL THEN 1 END) as from_strava
    FROM workouts
  `;
  console.log(`Total workouts: ${counts[0].total}`);
  console.log(`Unique dates: ${counts[0].unique_dates}`);
  console.log(`With HR data: ${counts[0].with_hr}`);
  console.log(`From Strava: ${counts[0].from_strava}`);

  // Workout type breakdown
  console.log('\n=== WORKOUT TYPE BREAKDOWN ===');
  const types = await sql`
    SELECT workout_type, COUNT(*) as count
    FROM workouts
    GROUP BY workout_type
    ORDER BY count DESC
  `;
  for (const t of types) {
    console.log(`  ${t.workout_type}: ${t.count}`);
  }
}

main().catch(console.error);
