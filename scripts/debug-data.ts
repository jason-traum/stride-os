/**
 * Debug script to check production data
 * Run with: npx tsx scripts/debug-data.ts
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
  console.log('=== USER SETTINGS ===');
  const settings = await sql`SELECT
    threshold_pace_seconds,
    easy_pace_seconds,
    resting_hr,
    vdot
  FROM user_settings LIMIT 1`;
  console.log('Settings:', settings[0]);

  console.log('\n=== SAMPLE WORKOUTS ===');
  const workouts = await sql`SELECT
    id, date, workout_type, avg_pace_seconds, avg_hr, distance_miles
  FROM workouts
  ORDER BY date DESC
  LIMIT 10`;
  console.log('Recent workouts:');
  workouts.forEach(w => {
    console.log(`  ${w.date}: ${w.workout_type} - ${w.distance_miles}mi @ ${w.avg_pace_seconds}s/mi, HR: ${w.avg_hr}`);
  });

  console.log('\n=== WORKOUT TYPE DISTRIBUTION ===');
  const types = await sql`SELECT
    workout_type, COUNT(*) as count
  FROM workouts
  GROUP BY workout_type
  ORDER BY count DESC`;
  types.forEach(t => console.log(`  ${t.workout_type}: ${t.count}`));

  console.log('\n=== WORKOUTS WITH HR DATA ===');
  const withHr = await sql`SELECT COUNT(*) as count FROM workouts WHERE avg_hr IS NOT NULL`;
  const total = await sql`SELECT COUNT(*) as count FROM workouts`;
  console.log(`${withHr[0].count} / ${total[0].count} workouts have HR data`);

  console.log('\n=== PACE RANGE ===');
  const paceRange = await sql`SELECT
    MIN(avg_pace_seconds) as fastest,
    MAX(avg_pace_seconds) as slowest,
    AVG(avg_pace_seconds) as average
  FROM workouts
  WHERE avg_pace_seconds IS NOT NULL`;
  const p = paceRange[0];
  console.log(`Fastest: ${Math.floor(p.fastest/60)}:${(p.fastest%60).toString().padStart(2,'0')}/mi`);
  console.log(`Slowest: ${Math.floor(p.slowest/60)}:${(p.slowest%60).toString().padStart(2,'0')}/mi`);
  console.log(`Average: ${Math.floor(p.average/60)}:${Math.round(p.average%60).toString().padStart(2,'0')}/mi`);
}

main().catch(console.error);
