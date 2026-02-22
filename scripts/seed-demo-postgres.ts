/**
 * Seed demo data for Postgres (Neon) deployment
 *
 * Creates a minimal demo account with:
 * - Basic user settings
 * - 5 sample workouts
 * - 1 pair of shoes
 *
 * Run with: DATABASE_URL="postgres://..." npx tsx scripts/seed-demo-postgres.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/schema.pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="postgres://..." npx tsx scripts/seed-demo-postgres.ts');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

// Helper to get date string N days ago
function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().split('T')[0];
}

async function seedDemoData() {
  console.log('🏃 Seeding demo data for Dreamy...\n');

  // 1. Create user settings
  console.log('Creating user settings...');
  await db.insert(schema.userSettings).values({
    name: 'Friend',
    onboardingCompleted: true,
    onboardingStep: 5,
    weeklyVolumeTargetMiles: 20,
    temperaturePreference: 'neutral',
    runnerPersona: 'self_coached',
  }).onConflictDoNothing();
  console.log('  ✓ Settings created');

  // 2. Create a shoe
  console.log('\nCreating shoe...');
  const [shoe] = await db.insert(schema.shoes).values({
    name: 'Daily Trainers',
    brand: 'Nike',
    model: 'Pegasus 41',
    category: 'daily_trainer',
    intendedUse: '["easy","long"]',
    totalMiles: 0,
    purchaseDate: daysAgo(60),
  }).returning();
  console.log(`  ✓ Created: ${shoe.brand} ${shoe.model}`);

  // 3. Create 5 sample workouts
  console.log('\nCreating workouts...');

  const sampleWorkouts = [
    {
      date: daysAgo(12),
      distanceMiles: 4.0,
      durationMinutes: 38,
      avgPaceSeconds: 570, // 9:30/mi
      workoutType: 'easy' as const,
      notes: 'Easy shakeout run. Legs felt good!',
      rpe: 4,
      verdict: 'optimal' as const,
    },
    {
      date: daysAgo(10),
      distanceMiles: 3.2,
      durationMinutes: 28,
      avgPaceSeconds: 525, // 8:45/mi
      workoutType: 'easy' as const,
      notes: 'Quick morning run before work.',
      rpe: 4,
      verdict: 'optimal' as const,
    },
    {
      date: daysAgo(7),
      distanceMiles: 5.5,
      durationMinutes: 46,
      avgPaceSeconds: 502, // 8:22/mi
      workoutType: 'easy' as const,
      notes: 'Felt strong today, kept it controlled.',
      rpe: 5,
      verdict: 'solid' as const,
    },
    {
      date: daysAgo(4),
      distanceMiles: 4.8,
      durationMinutes: 38,
      avgPaceSeconds: 475, // 7:55/mi
      workoutType: 'tempo' as const,
      notes: 'Tempo effort for the middle 2 miles. Good workout!',
      rpe: 7,
      verdict: 'pushed' as const,
    },
    {
      date: daysAgo(1),
      distanceMiles: 6.2,
      durationMinutes: 58,
      avgPaceSeconds: 561, // 9:21/mi
      workoutType: 'long' as const,
      notes: 'Weekend long run. Beautiful morning!',
      rpe: 5,
      verdict: 'solid' as const,
    },
  ];

  for (const w of sampleWorkouts) {
    // Create workout
    const [workout] = await db.insert(schema.workouts).values({
      date: w.date,
      distanceMiles: w.distanceMiles,
      durationMinutes: w.durationMinutes,
      avgPaceSeconds: w.avgPaceSeconds,
      workoutType: w.workoutType,
      notes: w.notes,
      shoeId: shoe.id,
      source: 'manual',
    }).returning();

    // Assessment table not in PG schema - skip for now
    // TODO: Add assessments table to PG schema if needed

    // Shoe is linked via shoeId on the workout record above

    console.log(`  ✓ ${w.date}: ${w.distanceMiles}mi ${w.workoutType}`);
  }

  // Calculate total miles on shoe
  const totalMiles = sampleWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);

  console.log('\n========================================');
  console.log('🎉 Demo data seeded successfully!\n');
  console.log('The demo account has:');
  console.log(`  • ${sampleWorkouts.length} workouts`);
  console.log(`  • 1 pair of shoes (${shoe.brand} ${shoe.model} - ${totalMiles.toFixed(1)}mi)`);
  console.log(`  • Weekly target: 20 miles`);
  console.log('\n📱 Share your Vercel URL with friends!');
  console.log('========================================\n');

  await client.end();
}

function getFeedback(workoutType: string, verdict: string): string {
  if (workoutType === 'easy') {
    return verdict === 'optimal'
      ? 'Perfect easy effort! Recovery runs like this are the foundation of good training.'
      : 'Nice easy run. These aerobic miles add up!';
  }
  if (workoutType === 'tempo') {
    return 'Great tempo work! These comfortably hard efforts build your lactate threshold.';
  }
  if (workoutType === 'long') {
    return 'Solid long run! Building that aerobic engine for race day.';
  }
  return 'Good work getting out there!';
}

seedDemoData().catch((err) => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
