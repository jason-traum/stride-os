/**
 * Backfill Strava Activity IDs and Laps
 *
 * This script matches existing workouts to Strava activities and fetches lap data.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-strava-ids.ts [options]
 *
 * Options:
 *   --days=N        Look back N days (default: 90)
 *   --dry-run       Show what would be matched without making changes
 *   --resync        Re-sync laps even for workouts that already have Strava IDs
 *   --delay=N       Delay in ms between API calls to avoid rate limits (default: 200)
 */

import { backfillStravaIds, getMissingStravaIdStats } from '../src/actions/backfill-strava';

async function main() {
  const args = process.argv.slice(2);

  const daysBack = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '90');
  const dryRun = args.includes('--dry-run');
  const resync = args.includes('--resync');
  const rateLimitDelayMs = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '200');

  console.log('\n🔄 Strava Backfill Utility\n');
  console.log(`Options:`);
  console.log(`  Days back: ${daysBack}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Re-sync existing: ${resync}`);
  console.log(`  Rate limit delay: ${rateLimitDelayMs}ms`);
  console.log('');

  // First, show current stats
  console.log('📊 Current Status:');
  try {
    const stats = await getMissingStravaIdStats();
    console.log(`  Total workouts: ${stats.totalWorkouts}`);
    console.log(`  With Strava ID: ${stats.withStravaId}`);
    console.log(`  Without Strava ID: ${stats.withoutStravaId}`);
    console.log(`  With lap data: ${stats.withLaps}`);
    console.log(`  Without lap data: ${stats.withoutLaps}`);
    console.log('');
  } catch (error) {
    console.log(`  Could not fetch stats: ${error}`);
    console.log('');
  }

  // Run backfill
  console.log(dryRun ? '🔍 Dry Run - Finding matches...' : '🚀 Starting backfill...');
  console.log('');

  try {
    const result = await backfillStravaIds({
      daysBack,
      dryRun,
      resyncExistingLaps: resync,
      rateLimitDelayMs,
    });

    console.log('✅ Results:');
    console.log(`  Workouts matched: ${result.matched}`);
    console.log(`  Laps added: ${result.lapsAdded}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (result.details.length > 0) {
      console.log('\n📝 Details:');
      result.details.slice(0, 20).forEach(d => {
        console.log(`  ${d.date} - Workout #${d.workoutId} → Strava ${d.stravaId} (${d.lapCount} laps)`);
      });
      if (result.details.length > 20) {
        console.log(`  ... and ${result.details.length - 20} more`);
      }
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }

  console.log('\n✨ Done!\n');
}

main().catch(console.error);
