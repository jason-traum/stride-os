/**
 * Add missing columns to Neon Postgres
 * Run with: npx tsx scripts/add-missing-columns.ts
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
  console.log('Adding missing columns to Neon Postgres...\n');

  const alterStatements = [
    // user_settings columns
    `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coach_persona text`,

    // workouts columns
    `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS strava_activity_id bigint`,
    `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS intervals_activity_id text`,
    `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_heart_rate integer`,
    `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS elevation_gain_feet real`,
    `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_load real`,
  ];

  for (const stmt of alterStatements) {
    try {
      await sql(stmt as unknown as TemplateStringsArray);
      console.log(`✓ ${stmt.slice(0, 60)}...`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`- Column already exists: ${stmt.slice(40, 80)}`);
      } else {
        console.error(`✗ Error: ${error.message}`);
      }
    }
  }

  console.log('\nDone! Verifying columns...');

  // Verify user_settings columns
  const userSettingsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'user_settings'
    ORDER BY ordinal_position
  `;
  console.log(`\nuser_settings has ${userSettingsCols.length} columns`);

  // Check for specific columns
  const colNames = userSettingsCols.map((c: any) => c.column_name);
  console.log('Has coach_persona:', colNames.includes('coach_persona'));

  // Verify workouts columns
  const workoutsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'workouts'
    ORDER BY ordinal_position
  `;
  console.log(`\nworkouts has ${workoutsCols.length} columns`);
  const wColNames = workoutsCols.map((c: any) => c.column_name);
  console.log('Has strava_activity_id:', wColNames.includes('strava_activity_id'));
  console.log('Has intervals_activity_id:', wColNames.includes('intervals_activity_id'));
  console.log('Has avg_heart_rate:', wColNames.includes('avg_heart_rate'));
  console.log('Has elevation_gain_feet:', wColNames.includes('elevation_gain_feet'));
  console.log('Has training_load:', wColNames.includes('training_load'));
}

main().catch(console.error);
