/**
 * Import Activity Files Script
 *
 * Parses GPX activity files from a Strava bulk export to extract GPS/HR data,
 * generate encoded polylines, and store stream data in the local SQLite database.
 *
 * Matches activity files to existing workouts by stravaActivityId (filename pattern:
 * {stravaActivityId}.gpx) and populates the workouts.polyline column and
 * workout_streams table.
 *
 * Usage:
 *   npx tsx scripts/import-activity-files.ts                  # full run
 *   npx tsx scripts/import-activity-files.ts --dry-run         # preview only, no writes
 *   npx tsx scripts/import-activity-files.ts --limit 5         # process first N matches
 *   npx tsx scripts/import-activity-files.ts --dry-run --limit 3
 *
 * Safe: only populates polyline and stream data; never deletes or modifies
 * existing workout metrics.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

import {
  parseGpxContent,
  buildStreams,
  type ActivityStreams,
} from '../src/lib/training/activity-file-parser';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ACTIVITY_DIR = path.join(
  process.cwd(),
  'docs',
  'export_113202952-2',
  'activities',
);

// ---------------------------------------------------------------------------
// Direct SQLite access (bypasses Drizzle schema column mismatch)
// ---------------------------------------------------------------------------

const dbPath = path.join(process.cwd(), 'data', 'stride.db');
const sqlite = new Database(dbPath, { readonly: DRY_RUN });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkoutMatch {
  workoutId: number;
  stravaActivityId: number;
  date: string;
  profileId: number | null;
  gpxPath: string;
}

interface ImportResult {
  workoutId: number;
  stravaActivityId: number;
  date: string;
  gpxPath: string;
  trackpointCount: number;
  sampleCount: number;
  totalDistanceMiles: number;
  elevationGainFeet: number;
  totalDurationSeconds: number;
  hasHeartRate: boolean;
  polylineLength: number;
  status: 'success' | 'skipped' | 'error';
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(secPerMile: number): string {
  if (!secPerMile || secPerMile <= 0) return '--';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== Activity File Import Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}`);
  if (LIMIT) console.log(`Limit: first ${LIMIT} matches`);
  console.log(`Activity directory: ${ACTIVITY_DIR}`);
  console.log('');

  // -----------------------------------------------------------------------
  // 1. Scan GPX files in the export directory
  // -----------------------------------------------------------------------

  if (!fs.existsSync(ACTIVITY_DIR)) {
    console.error(`Activity directory not found: ${ACTIVITY_DIR}`);
    process.exit(1);
  }

  const allFiles: string[] = fs.readdirSync(ACTIVITY_DIR);
  const gpxFiles = allFiles.filter((f: string) => f.toLowerCase().endsWith('.gpx'));
  const fitGzFiles = allFiles.filter((f: string) => f.toLowerCase().endsWith('.fit.gz'));
  const fitFiles = allFiles.filter((f: string) =>
    f.toLowerCase().endsWith('.fit') && !f.toLowerCase().endsWith('.fit.gz'),
  );

  console.log(`Files in export directory:`);
  console.log(`  GPX:     ${gpxFiles.length} (will process)`);
  console.log(`  FIT.GZ:  ${fitGzFiles.length} (skipping)`);
  console.log(`  FIT:     ${fitFiles.length} (skipping)`);
  console.log('');

  // Build a map of stravaActivityId -> GPX file path
  const gpxByStravaId = new Map<number, string>();
  for (const file of gpxFiles) {
    const match = file.match(/^(\d+)\.gpx$/i);
    if (match) {
      const stravaId = parseInt(match[1], 10);
      gpxByStravaId.set(stravaId, path.join(ACTIVITY_DIR, file));
    }
  }
  console.log(`GPX files with parseable Strava IDs: ${gpxByStravaId.size}`);

  // -----------------------------------------------------------------------
  // 2. Query workouts with stravaActivityId but no polyline
  // -----------------------------------------------------------------------

  const workoutRows = sqlite
    .prepare(
      `SELECT id, strava_activity_id, date, profile_id
       FROM workouts
       WHERE strava_activity_id IS NOT NULL
         AND polyline IS NULL
       ORDER BY date DESC`,
    )
    .all() as Array<{
      id: number;
      strava_activity_id: number;
      date: string;
      profile_id: number | null;
    }>;

  console.log(`Workouts with Strava ID but no polyline: ${workoutRows.length}`);

  // -----------------------------------------------------------------------
  // 3. Match workouts to GPX files
  // -----------------------------------------------------------------------

  const matches: WorkoutMatch[] = [];
  let noFileCount = 0;

  for (const row of workoutRows) {
    const gpxPath = gpxByStravaId.get(row.strava_activity_id);
    if (gpxPath) {
      matches.push({
        workoutId: row.id,
        stravaActivityId: row.strava_activity_id,
        date: row.date,
        profileId: row.profile_id,
        gpxPath,
      });
    } else {
      noFileCount++;
    }
  }

  console.log(`Matched to GPX files: ${matches.length}`);
  console.log(`No GPX file found: ${noFileCount}`);
  console.log('');

  if (matches.length === 0) {
    console.log('No workouts to import. Done.');
    sqlite.close();
    return;
  }

  // Apply limit
  const toProcess = LIMIT ? matches.slice(0, LIMIT) : matches;
  if (LIMIT) {
    console.log(`Processing first ${toProcess.length} of ${matches.length} matches`);
    console.log('');
  }

  // -----------------------------------------------------------------------
  // 4. Check if workout_streams table already has entries for these workouts
  // -----------------------------------------------------------------------

  const existingStreamIds = new Set<number>();
  const existingStreams = sqlite
    .prepare(
      'SELECT workout_id FROM workout_streams WHERE workout_id IN (' +
        toProcess.map(() => '?').join(',') +
        ')',
    )
    .all(...toProcess.map((m) => m.workoutId)) as Array<{ workout_id: number }>;
  for (const s of existingStreams) {
    existingStreamIds.add(s.workout_id);
  }
  if (existingStreamIds.size > 0) {
    console.log(`Note: ${existingStreamIds.size} workouts already have stream data (will skip)`);
  }

  // -----------------------------------------------------------------------
  // 5. Prepare SQL statements
  // -----------------------------------------------------------------------

  const updatePolylineStmt = sqlite.prepare(
    `UPDATE workouts SET polyline = ?, updated_at = ? WHERE id = ?`,
  );

  const insertStreamStmt = sqlite.prepare(
    `INSERT INTO workout_streams (
      workout_id, profile_id, source, sample_count,
      distance_miles, time_seconds, heartrate,
      pace_seconds_per_mile, altitude_feet, max_hr,
      has_gps_gaps, gps_gap_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // -----------------------------------------------------------------------
  // 6. Process each match
  // -----------------------------------------------------------------------

  const results: ImportResult[] = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const match = toProcess[i];
    const result: ImportResult = {
      workoutId: match.workoutId,
      stravaActivityId: match.stravaActivityId,
      date: match.date,
      gpxPath: match.gpxPath,
      trackpointCount: 0,
      sampleCount: 0,
      totalDistanceMiles: 0,
      elevationGainFeet: 0,
      totalDurationSeconds: 0,
      hasHeartRate: false,
      polylineLength: 0,
      status: 'success',
    };

    try {
      // Skip if stream already exists
      if (existingStreamIds.has(match.workoutId)) {
        result.status = 'skipped';
        result.error = 'Stream already exists';
        skipCount++;
        results.push(result);
        continue;
      }

      // Read and parse GPX file
      const gpxContent = fs.readFileSync(match.gpxPath, 'utf-8');
      const parsed = parseGpxContent(gpxContent);
      result.trackpointCount = parsed.trackpoints.length;

      if (parsed.trackpoints.length < 2) {
        result.status = 'skipped';
        result.error = `Only ${parsed.trackpoints.length} trackpoints`;
        skipCount++;
        results.push(result);
        continue;
      }

      // Build streams
      const streams = buildStreams(parsed.trackpoints);
      if (!streams) {
        result.status = 'skipped';
        result.error = 'buildStreams returned null';
        skipCount++;
        results.push(result);
        continue;
      }

      result.sampleCount = streams.sampleCount;
      result.totalDistanceMiles = streams.totalDistanceMiles;
      result.elevationGainFeet = streams.elevationGainFeet;
      result.totalDurationSeconds = streams.totalDurationSeconds;
      result.hasHeartRate = streams.heartrate.length > 0;
      result.polylineLength = streams.polyline.length;

      if (!streams.polyline || streams.polyline.length === 0) {
        result.status = 'skipped';
        result.error = 'Empty polyline';
        skipCount++;
        results.push(result);
        continue;
      }

      // Write to DB
      if (!DRY_RUN) {
        const now = new Date().toISOString();

        // Update polyline on workout
        updatePolylineStmt.run(streams.polyline, now, match.workoutId);

        // Insert stream data
        insertStreamStmt.run(
          match.workoutId,
          match.profileId,
          'gpx_import',
          streams.sampleCount,
          JSON.stringify(streams.distanceMiles),
          JSON.stringify(streams.time),
          streams.heartrate.length > 0 ? JSON.stringify(streams.heartrate) : null,
          JSON.stringify(streams.paceSecondsPerMile),
          JSON.stringify(streams.altitudeFeet),
          streams.maxHr > 0 ? streams.maxHr : null,
          0, // has_gps_gaps
          0, // gps_gap_count
          now,
          now,
        );
      }

      successCount++;
      results.push(result);

      // Progress every 10 workouts
      if ((i + 1) % 10 === 0 || i === toProcess.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `  Progress: ${i + 1}/${toProcess.length} (${elapsed}s elapsed, ${successCount} imported, ${skipCount} skipped, ${errorCount} errors)`,
        );
      }
    } catch (e) {
      result.status = 'error';
      result.error = String(e);
      errorCount++;
      results.push(result);
      console.error(
        `  ERROR on workout ${match.workoutId} (strava: ${match.stravaActivityId}, ${match.date}): ${e}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 7. Print detailed results for first few
  // -----------------------------------------------------------------------

  console.log('');
  console.log('=== Sample Import Details (first 5 successful) ===');
  const successResults = results.filter((r) => r.status === 'success');

  for (let i = 0; i < Math.min(5, successResults.length); i++) {
    const r = successResults[i];
    console.log(`\n--- Workout #${r.workoutId} | ${r.date} | Strava ${r.stravaActivityId} ---`);
    console.log(`  File:        ${path.basename(r.gpxPath)}`);
    console.log(`  Trackpoints: ${r.trackpointCount}`);
    console.log(`  Samples:     ${r.sampleCount}`);
    console.log(`  Distance:    ${r.totalDistanceMiles.toFixed(2)} mi`);
    console.log(`  Duration:    ${formatDuration(r.totalDurationSeconds)}`);
    console.log(
      `  Avg Pace:    ${formatPace(r.totalDistanceMiles > 0 ? r.totalDurationSeconds / r.totalDistanceMiles : 0)}`,
    );
    console.log(`  Elev Gain:   ${Math.round(r.elevationGainFeet)} ft`);
    console.log(`  Heart Rate:  ${r.hasHeartRate ? 'Yes' : 'No'}`);
    console.log(`  Polyline:    ${r.polylineLength} chars`);
  }

  // Print errors if any
  const errorResults = results.filter((r) => r.status === 'error');
  if (errorResults.length > 0) {
    console.log('');
    console.log('=== Errors ===');
    for (const r of errorResults) {
      console.log(
        `  Workout #${r.workoutId} (${r.date}, strava ${r.stravaActivityId}): ${r.error}`,
      );
    }
  }

  // Print skips if any
  const skippedResults = results.filter((r) => r.status === 'skipped');
  if (skippedResults.length > 0) {
    console.log('');
    console.log(`=== Skipped (${skippedResults.length}) ===`);
    for (const r of skippedResults) {
      console.log(
        `  Workout #${r.workoutId} (${r.date}): ${r.error}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 8. Summary
  // -----------------------------------------------------------------------

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('=== Summary ===');
  console.log(`Processed:     ${results.length}`);
  console.log(`Imported:      ${successCount}`);
  console.log(`Skipped:       ${skipCount}`);
  console.log(`Errors:        ${errorCount}`);
  console.log(`Time:          ${elapsed}s`);
  console.log(`Mode:          ${DRY_RUN ? 'DRY RUN (no writes performed)' : 'LIVE (updates written)'}`);

  if (successCount > 0) {
    const distances = successResults.map((r) => r.totalDistanceMiles);
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const hrCount = successResults.filter((r) => r.hasHeartRate).length;
    const avgSamples = successResults.reduce((a, r) => a + r.sampleCount, 0) / successResults.length;

    console.log('');
    console.log('=== Import Stats ===');
    console.log(`Avg distance:        ${avgDist.toFixed(2)} mi`);
    console.log(`With heart rate:     ${hrCount}/${successCount}`);
    console.log(`Avg samples/file:    ${Math.round(avgSamples)}`);
    console.log(`Total GPX available: ${gpxByStravaId.size}`);
    console.log(`Remaining unmatched: ${noFileCount} workouts (no GPX file)`);
  }

  if (DRY_RUN) {
    console.log('');
    console.log('This was a dry run. To apply changes, run without --dry-run:');
    console.log('  npx tsx scripts/import-activity-files.ts');
  }

  sqlite.close();
}

main();
