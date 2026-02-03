/**
 * Clean up SQLite database to match Postgres
 *
 * Run with: npx tsx scripts/cleanup-sqlite.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'stride.db');
const db = new Database(dbPath);

const JASON_PROFILE_ID = 1;
const DEMO_PROFILE_ID = 2;

function clearChatMessages() {
  console.log('=== Clearing all chat messages ===');
  db.prepare('DELETE FROM chat_messages').run();
  console.log('  Done\n');
}

function removeShoesFromJason() {
  console.log('=== Removing shoes from Jason profile ===');
  db.prepare('UPDATE workouts SET shoe_id = NULL WHERE profile_id = ?').run(JASON_PROFILE_ID);
  db.prepare('DELETE FROM shoes WHERE profile_id = ?').run(JASON_PROFILE_ID);
  console.log('  Done\n');
}

function removeNonStravaWorkouts() {
  console.log('=== Removing non-Strava workouts from Jason profile ===');

  // Delete assessments for those workouts first
  db.prepare(`
    DELETE FROM assessments
    WHERE workout_id IN (
      SELECT id FROM workouts
      WHERE profile_id = ? AND (source IS NULL OR source != 'strava')
    )
  `).run(JASON_PROFILE_ID);

  // Delete the workouts
  const result = db.prepare(`
    DELETE FROM workouts
    WHERE profile_id = ? AND (source IS NULL OR source != 'strava')
  `).run(JASON_PROFILE_ID);

  console.log(`  Deleted ${result.changes} non-Strava workouts\n`);
}

function seedDemoData() {
  console.log('=== Seeding Demo Profile data ===');

  const now = new Date().toISOString();

  // Check if demo already has workouts
  const workoutCount = db.prepare('SELECT COUNT(*) as count FROM workouts WHERE profile_id = ?').get(DEMO_PROFILE_ID) as { count: number };
  if (workoutCount.count > 0) {
    console.log(`  Demo already has ${workoutCount.count} workouts, skipping\n`);
    return;
  }

  // Seed shoes
  const shoes = [
    { name: 'Daily Trainers', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', totalMiles: 234 },
    { name: 'Speed Shoes', brand: 'Nike', model: 'Vaporfly 3', category: 'race', totalMiles: 87 },
    { name: 'Easy Day', brand: 'ASICS', model: 'Gel-Nimbus 25', category: 'recovery', totalMiles: 156 },
  ];

  for (const shoe of shoes) {
    db.prepare(`
      INSERT INTO shoes (profile_id, name, brand, model, category, intended_use, total_miles, is_retired, created_at)
      VALUES (?, ?, ?, ?, ?, '[]', ?, 0, ?)
    `).run(DEMO_PROFILE_ID, shoe.name, shoe.brand, shoe.model, shoe.category, shoe.totalMiles, now);
  }
  console.log('  Created 3 demo shoes');

  // Seed workouts for last 30 days
  const today = new Date();
  let workoutsCreated = 0;

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Skip some days (rest days)
    if (Math.random() < 0.3) continue;

    const dayOfWeek = date.getDay();
    let workoutType: string;
    let distanceMiles: number;
    let paceSeconds: number;

    if (dayOfWeek === 6) {
      workoutType = 'long';
      distanceMiles = 10 + Math.random() * 4;
      paceSeconds = 510 + Math.random() * 30;
    } else if (dayOfWeek === 2 || dayOfWeek === 4) {
      workoutType = Math.random() > 0.5 ? 'tempo' : 'interval';
      distanceMiles = 5 + Math.random() * 2;
      paceSeconds = 420 + Math.random() * 30;
    } else {
      workoutType = 'easy';
      distanceMiles = 4 + Math.random() * 2;
      paceSeconds = 540 + Math.random() * 30;
    }

    const durationMinutes = Math.round((distanceMiles * paceSeconds) / 60);

    db.prepare(`
      INSERT INTO workouts (profile_id, date, distance_miles, duration_minutes, avg_pace_seconds, workout_type, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'demo', ?, ?)
    `).run(
      DEMO_PROFILE_ID,
      dateStr,
      Math.round(distanceMiles * 100) / 100,
      durationMinutes,
      Math.round(paceSeconds),
      workoutType,
      now,
      now
    );
    workoutsCreated++;
  }
  console.log(`  Created ${workoutsCreated} demo workouts\n`);
}

function showSummary() {
  console.log('=== Summary ===');

  const jasonWorkouts = db.prepare('SELECT COUNT(*) as count FROM workouts WHERE profile_id = ?').get(JASON_PROFILE_ID) as { count: number };
  const demoWorkouts = db.prepare('SELECT COUNT(*) as count FROM workouts WHERE profile_id = ?').get(DEMO_PROFILE_ID) as { count: number };
  const jasonShoes = db.prepare('SELECT COUNT(*) as count FROM shoes WHERE profile_id = ?').get(JASON_PROFILE_ID) as { count: number };
  const demoShoes = db.prepare('SELECT COUNT(*) as count FROM shoes WHERE profile_id = ?').get(DEMO_PROFILE_ID) as { count: number };
  const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number };

  console.log(`  Jason workouts: ${jasonWorkouts.count}`);
  console.log(`  Jason shoes: ${jasonShoes.count}`);
  console.log(`  Demo workouts: ${demoWorkouts.count}`);
  console.log(`  Demo shoes: ${demoShoes.count}`);
  console.log(`  Chat messages: ${chatCount.count}`);
}

console.log('Cleaning up SQLite database...\n');

clearChatMessages();
removeShoesFromJason();
removeNonStravaWorkouts();
seedDemoData();
showSummary();

db.close();
console.log('\nDone!');
