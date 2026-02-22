/**
 * Reprocess Workouts Script
 *
 * Re-runs the workout processing pipeline over all existing workouts in the
 * local SQLite database. Applies recent fixes (interval detection, timezone
 * parsing, Tanaka HR formula, execution scoring) without hitting any
 * external APIs.
 *
 * Usage:
 *   npx tsx scripts/reprocess-workouts.ts           # full run
 *   npx tsx scripts/reprocess-workouts.ts --dry-run  # preview only, no writes
 *   npx tsx scripts/reprocess-workouts.ts --limit 5  # process first N workouts
 *
 * Safe: only updates computed fields; never deletes data.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

import type { Workout, UserSettings, WorkoutSegment as DBWorkoutSegment } from '../src/lib/schema';

import {
  classifyRun,
  computeQualityRatio,
  computeTRIMP,
  computeConditionAdjustment,
} from '../src/lib/training/run-classifier';

import {
  classifySplitEffortsWithZones,
  computeZoneDistribution,
  deriveWorkoutType,
  type ZoneBoundaries,
} from '../src/lib/training/effort-classifier';

import { computeIntervalStress } from '../src/lib/training/interval-stress';
import { detectIntervalPattern } from '../src/lib/training/interval-detector';
import { checkDataQuality, serializeDataQualityFlags } from '../src/lib/training/data-quality';

import type { ZoneDistribution } from '../src/lib/training/types';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined;
const PREVIEW_COUNT = 3; // How many before/after diffs to print

// ---------------------------------------------------------------------------
// Direct SQLite access (bypasses Drizzle schema column mismatch)
// ---------------------------------------------------------------------------

const dbPath = path.join(process.cwd(), 'data', 'stride.db');
const sqlite = new Database(dbPath, { readonly: false });

// Snake_case row from SQLite -> camelCase Workout-like object
// Only the fields our processing pipeline actually reads
interface WorkoutRow {
  id: number;
  date: string;
  distance_miles: number | null;
  duration_minutes: number | null;
  avg_pace_seconds: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_ft: number | null;
  elevation_gain_feet: number | null;
  route_name: string | null;
  shoe_id: number | null;
  workout_type: string | null;
  source: string | null;
  notes: string | null;
  weather_temp_f: number | null;
  weather_feels_like_f: number | null;
  weather_humidity_pct: number | null;
  weather_wind_mph: number | null;
  weather_conditions: string | null;
  weather_severity_score: number | null;
  planned_workout_id: number | null;
  strava_activity_id: number | null;
  avg_heart_rate: number | null;
  training_load: number | null;
  profile_id: number | null;
  auto_category: string | null;
  category: string | null;
  quality_ratio: number | null;
  trimp: number | null;
  zone_distribution: string | null;
  zone_dominant: string | null;
  zone_classified_at: string | null;
  zone_boundaries_used: string | null;
  interval_adjusted_trimp: number | null;
  interval_stress_details: string | null;
  execution_score: number | null;
  execution_details: string | null;
  data_quality_flags: string | null;
  route_fingerprint: string | null;
  route_id: number | null;
  strava_name: string | null;
  exclude_from_estimates: number | null;
  auto_excluded: number | null;
  exclude_reason: string | null;
  elapsed_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

interface SegmentRow {
  id: number;
  workout_id: number;
  segment_number: number;
  segment_type: string;
  distance_miles: number | null;
  duration_seconds: number | null;
  pace_seconds_per_mile: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_ft: number | null;
  notes: string | null;
  pace_zone: string | null;
  pace_zone_confidence: number | null;
  created_at: string;
}

interface SettingsRow {
  id: number;
  profile_id: number | null;
  name: string;
  vdot: number | null;
  easy_pace_seconds: number | null;
  tempo_pace_seconds: number | null;
  threshold_pace_seconds: number | null;
  interval_pace_seconds: number | null;
  marathon_pace_seconds: number | null;
  half_marathon_pace_seconds: number | null;
  resting_hr: number | null;
  age: number | null;
  gender: string | null;
}

function rowToWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    date: row.date,
    distanceMiles: row.distance_miles,
    durationMinutes: row.duration_minutes,
    avgPaceSeconds: row.avg_pace_seconds,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    elevationGainFt: row.elevation_gain_ft,
    elevationGainFeet: row.elevation_gain_feet,
    routeName: row.route_name,
    shoeId: row.shoe_id,
    workoutType: row.workout_type as Workout['workoutType'],
    source: row.source as Workout['source'],
    notes: row.notes,
    weatherTempF: row.weather_temp_f,
    weatherFeelsLikeF: row.weather_feels_like_f,
    weatherHumidityPct: row.weather_humidity_pct,
    weatherWindMph: row.weather_wind_mph,
    weatherConditions: row.weather_conditions as Workout['weatherConditions'],
    weatherSeverityScore: row.weather_severity_score,
    plannedWorkoutId: row.planned_workout_id,
    stravaActivityId: row.strava_activity_id,
    avgHeartRate: row.avg_heart_rate,
    trainingLoad: row.training_load,
    profileId: row.profile_id,
    autoCategory: row.auto_category,
    category: row.category,
    qualityRatio: row.quality_ratio,
    trimp: row.trimp,
    zoneDistribution: row.zone_distribution,
    zoneDominant: row.zone_dominant,
    zoneClassifiedAt: row.zone_classified_at,
    zoneBoundariesUsed: row.zone_boundaries_used,
    intervalAdjustedTrimp: row.interval_adjusted_trimp,
    intervalStressDetails: row.interval_stress_details,
    executionScore: row.execution_score,
    executionDetails: row.execution_details,
    dataQualityFlags: row.data_quality_flags,
    routeFingerprint: row.route_fingerprint,
    routeId: row.route_id,
    stravaName: row.strava_name,
    excludeFromEstimates: row.exclude_from_estimates ? true : false,
    autoExcluded: row.auto_excluded ? true : false,
    excludeReason: row.exclude_reason,
    elapsedTimeMinutes: row.elapsed_time_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Fields that may not exist in local DB -- default to null
    polyline: null,
    structureOverride: null,
    autoSummary: null,
    aiExplanation: null,
    intervalsActivityId: null,
    stravaDescription: null,
    stravaKudosCount: null,
    stravaCommentCount: null,
    stravaAchievementCount: null,
    stravaPhotoCount: null,
    stravaAthleteCount: null,
    stravaMaxSpeed: null,
    stravaAverageCadence: null,
    stravaSufferScore: null,
    stravaPerceivedExertion: null,
    stravaGearId: null,
    stravaDeviceName: null,
    startLatitude: null,
    startLongitude: null,
    endLatitude: null,
    endLongitude: null,
    stravaIsTrainer: null,
    stravaIsCommute: null,
    stravaKudosLastChecked: null,
    startTimeLocal: null,
  } as Workout;
}

function rowToSegment(row: SegmentRow): DBWorkoutSegment {
  return {
    id: row.id,
    workoutId: row.workout_id,
    segmentNumber: row.segment_number,
    segmentType: row.segment_type as DBWorkoutSegment['segmentType'],
    distanceMiles: row.distance_miles,
    durationSeconds: row.duration_seconds,
    paceSecondsPerMile: row.pace_seconds_per_mile,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    elevationGainFt: row.elevation_gain_ft,
    notes: row.notes,
    paceZone: row.pace_zone,
    paceZoneConfidence: row.pace_zone_confidence,
    createdAt: row.created_at,
  };
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    ...row,
    profileId: row.profile_id,
    name: row.name,
    vdot: row.vdot,
    easyPaceSeconds: row.easy_pace_seconds,
    tempoPaceSeconds: row.tempo_pace_seconds,
    thresholdPaceSeconds: row.threshold_pace_seconds,
    intervalPaceSeconds: row.interval_pace_seconds,
    marathonPaceSeconds: row.marathon_pace_seconds,
    halfMarathonPaceSeconds: row.half_marathon_pace_seconds,
    restingHr: row.resting_hr,
    age: row.age,
    gender: row.gender as UserSettings['gender'],
  } as unknown as UserSettings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPace(sec: number | null | undefined): string {
  if (!sec) return '--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
}

interface ReprocessResult {
  workoutId: number;
  date: string;
  distanceMiles: number | null;

  // Before values
  oldWorkoutType: string | null;
  oldAutoCategory: string | null;
  oldTrimp: number | null;
  oldQualityRatio: number | null;
  oldZoneDominant: string | null;
  oldIntervalAdjustedTrimp: number | null;

  // After values
  newWorkoutType: string | null;
  newAutoCategory: string | null;
  newTrimp: number | null;
  newQualityRatio: number | null;
  newZoneDominant: string | null;
  newIntervalAdjustedTrimp: number | null;
  newZoneDistribution: ZoneDistribution | null;
  newZoneBoundariesUsed: ZoneBoundaries | null;
  newIntervalStressDetails: string | null;

  changed: boolean;
  errors: string[];
}

function printDiff(label: string, before: unknown, after: unknown): string {
  const b = before === null || before === undefined ? '--' : String(before);
  const a = after === null || after === undefined ? '--' : String(after);
  if (b === a) return '';
  return `  ${label}: ${b} -> ${a}`;
}

// ---------------------------------------------------------------------------
// Main reprocessing logic for a single workout
// ---------------------------------------------------------------------------

function reprocessWorkout(
  workout: Workout,
  segments: DBWorkoutSegment[],
  settings: UserSettings | null,
): ReprocessResult {
  const result: ReprocessResult = {
    workoutId: workout.id,
    date: workout.date,
    distanceMiles: workout.distanceMiles,
    oldWorkoutType: workout.workoutType,
    oldAutoCategory: workout.autoCategory,
    oldTrimp: workout.trimp,
    oldQualityRatio: workout.qualityRatio,
    oldZoneDominant: workout.zoneDominant,
    oldIntervalAdjustedTrimp: workout.intervalAdjustedTrimp,
    newWorkoutType: null,
    newAutoCategory: null,
    newTrimp: null,
    newQualityRatio: null,
    newZoneDominant: null,
    newIntervalAdjustedTrimp: null,
    newZoneDistribution: null,
    newZoneBoundariesUsed: null,
    newIntervalStressDetails: null,
    changed: false,
    errors: [],
  };

  // 1. Data quality flags
  let dataQualityFlags: string | null = null;
  try {
    const dq = checkDataQuality(workout, segments);
    dataQualityFlags = serializeDataQualityFlags(dq);
  } catch (e) {
    result.errors.push(`Data quality: ${e}`);
  }

  // 2. Quality ratio + TRIMP (uses updated Tanaka formula in run-classifier)
  try {
    result.newQualityRatio = computeQualityRatio(workout, segments, settings);
    result.newTrimp = computeTRIMP(workout, settings);
  } catch (e) {
    result.errors.push(`TRIMP/quality: ${e}`);
  }

  // 3. Classification (uses updated run-classifier)
  try {
    const classification = classifyRun(workout, settings, segments);
    result.newAutoCategory = classification.category;
  } catch (e) {
    result.errors.push(`Classification: ${e}`);
  }

  // 4. Zone classification pipeline (effort classifier -> zone distribution -> workout type)
  let classifiedZoneMap: Map<number, string> | null = null;
  try {
    let classifiableSegments = segments;

    // If no segments but we have avg pace + duration, create a synthetic one
    if (classifiableSegments.length === 0 && workout.avgPaceSeconds && workout.durationMinutes) {
      const syntheticDuration = workout.durationMinutes * 60;
      const syntheticDistance = workout.distanceMiles || (syntheticDuration / workout.avgPaceSeconds);
      classifiableSegments = [{
        id: 0,
        workoutId: workout.id,
        segmentNumber: 1,
        segmentType: 'steady',
        distanceMiles: syntheticDistance,
        durationSeconds: syntheticDuration,
        paceSecondsPerMile: workout.avgPaceSeconds,
        avgHr: workout.avgHr || workout.avgHeartRate || null,
        maxHr: workout.maxHr || null,
        elevationGainFt: workout.elevationGainFt || workout.elevationGainFeet || null,
        notes: null,
        paceZone: null,
        paceZoneConfidence: null,
        createdAt: workout.createdAt,
      } as DBWorkoutSegment];
    }

    if (classifiableSegments.length > 0) {
      const sorted = [...classifiableSegments].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const laps = sorted.map(seg => ({
        lapNumber: seg.segmentNumber,
        distanceMiles: seg.distanceMiles || 1,
        durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
        avgPaceSeconds: seg.paceSecondsPerMile || 480,
        avgHeartRate: seg.avgHr,
        maxHeartRate: seg.maxHr,
        elevationGainFeet: seg.elevationGainFt,
        lapType: seg.segmentType || 'steady',
      }));

      const { splits: classified, zones: resolvedZones } = classifySplitEffortsWithZones(laps, {
        vdot: settings?.vdot,
        easyPace: settings?.easyPaceSeconds,
        tempoPace: settings?.tempoPaceSeconds,
        thresholdPace: settings?.thresholdPaceSeconds,
        intervalPace: settings?.intervalPaceSeconds,
        marathonPace: settings?.marathonPaceSeconds,
        workoutType: workout.workoutType || 'easy',
        avgPaceSeconds: workout.avgPaceSeconds,
        conditionAdjustment: computeConditionAdjustment(workout),
      });
      result.newZoneBoundariesUsed = resolvedZones;

      // Build zone map and update pace_zone on real segments
      classifiedZoneMap = new Map();
      if (segments.length > 0) {
        for (let i = 0; i < classified.length && i < sorted.length; i++) {
          const seg = sorted[i];
          classifiedZoneMap.set(seg.id, classified[i].category);

          // Update pace_zone on real (non-synthetic) segments
          if (!DRY_RUN && seg.id > 0) {
            sqlite.prepare(
              'UPDATE workout_segments SET pace_zone = ?, pace_zone_confidence = ? WHERE id = ?'
            ).run(classified[i].category, classified[i].confidence, seg.id);
          }
        }
      }

      // Compute zone distribution
      const segDurations = sorted.map(seg => ({
        durationSeconds: seg.durationSeconds,
      }));
      const zoneDist = computeZoneDistribution(classified, segDurations);
      result.newZoneDistribution = zoneDist;

      // Derive workout type from distribution
      const derived = deriveWorkoutType(zoneDist, {
        workoutType: workout.workoutType,
        distanceMiles: workout.distanceMiles,
        durationMinutes: workout.durationMinutes,
      });
      result.newZoneDominant = derived;
    }
  } catch (e) {
    result.errors.push(`Zone classification: ${e}`);
  }

  // 5. Interval stress model (requires zones from step 4)
  try {
    if (result.newTrimp !== null && segments.length >= 3) {
      const sortedSegs = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const zonesApplied = sortedSegs.map((seg) => ({
        ...seg,
        paceZone: classifiedZoneMap?.get(seg.id) ?? seg.paceZone,
      }));
      const intervalStress = computeIntervalStress(
        workout, zonesApplied, settings, result.newTrimp
      );
      result.newIntervalAdjustedTrimp = intervalStress.intervalAdjustedTrimp;
      result.newIntervalStressDetails = JSON.stringify(intervalStress);
    }
  } catch (e) {
    result.errors.push(`Interval stress: ${e}`);
  }

  // 6. Interval pattern detection (8x800, ladders, pyramids, etc.)
  try {
    if (segments.length >= 4) {
      const sortedSegs = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const zonesApplied = sortedSegs.map((seg) => ({
        ...seg,
        paceZone: classifiedZoneMap?.get(seg.id) ?? seg.paceZone,
      }));
      const intervalPattern = detectIntervalPattern(zonesApplied);

      if (intervalPattern.type !== 'unknown') {
        const existingDetails = result.newIntervalStressDetails
          ? JSON.parse(result.newIntervalStressDetails)
          : {};
        existingDetails.intervalPattern = intervalPattern;
        result.newIntervalStressDetails = JSON.stringify(existingDetails);
      }
    }
  } catch (e) {
    result.errors.push(`Interval pattern: ${e}`);
  }

  // Determine the new workoutType
  // Only change workoutType if user hasn't set a manual category
  if (!workout.category && result.newZoneDominant) {
    result.newWorkoutType = result.newZoneDominant;
  } else {
    result.newWorkoutType = workout.workoutType;
  }

  // Detect if anything changed
  result.changed =
    result.newAutoCategory !== result.oldAutoCategory ||
    result.newTrimp !== result.oldTrimp ||
    result.newQualityRatio !== result.oldQualityRatio ||
    result.newZoneDominant !== result.oldZoneDominant ||
    result.newIntervalAdjustedTrimp !== result.oldIntervalAdjustedTrimp ||
    result.newWorkoutType !== result.oldWorkoutType;

  // 7. Write updates to DB (unless dry run)
  if (!DRY_RUN) {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    const addUpdate = (column: string, value: unknown) => {
      if (value !== undefined) {
        setClauses.push(`${column} = ?`);
        values.push(value);
      }
    };

    addUpdate('updated_at', new Date().toISOString());

    if (result.newAutoCategory) {
      addUpdate('auto_category', result.newAutoCategory);
    }
    if (result.newQualityRatio !== null) {
      addUpdate('quality_ratio', result.newQualityRatio);
    }
    if (result.newTrimp !== null) {
      addUpdate('trimp', result.newTrimp);
    }
    if (result.newIntervalAdjustedTrimp !== null) {
      addUpdate('interval_adjusted_trimp', result.newIntervalAdjustedTrimp);
      addUpdate('interval_stress_details', result.newIntervalStressDetails);
    }
    if (dataQualityFlags) {
      addUpdate('data_quality_flags', dataQualityFlags);
    }
    if (result.newZoneDistribution) {
      addUpdate('zone_distribution', JSON.stringify(result.newZoneDistribution));
      addUpdate('zone_dominant', result.newZoneDominant);
      addUpdate('zone_classified_at', new Date().toISOString());
      if (result.newZoneBoundariesUsed) {
        addUpdate('zone_boundaries_used', JSON.stringify(result.newZoneBoundariesUsed));
      }
      // Update workoutType from zone classification only if user hasn't set a manual category
      if (!workout.category && result.newZoneDominant) {
        addUpdate('workout_type', result.newZoneDominant);
      }
    }

    if (setClauses.length > 1) { // > 1 because we always have updated_at
      values.push(workout.id);
      const sql = `UPDATE workouts SET ${setClauses.join(', ')} WHERE id = ?`;
      sqlite.prepare(sql).run(...values);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== Workout Reprocessing Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}`);
  if (LIMIT) console.log(`Limit: first ${LIMIT} workouts`);
  console.log('');

  // Load settings
  const settingsRows = sqlite.prepare('SELECT * FROM user_settings LIMIT 1').all() as SettingsRow[];
  if (settingsRows.length === 0) {
    console.error('No user settings found. Aborting.');
    process.exit(1);
  }
  const settings = rowToSettings(settingsRows[0]);
  console.log(`Profile: ${settings.name || 'Default'} (VDOT: ${settings.vdot ?? 'not set'})`);
  console.log(`Easy pace: ${formatPace(settings.easyPaceSeconds)}, Tempo: ${formatPace(settings.tempoPaceSeconds)}, Threshold: ${formatPace(settings.thresholdPaceSeconds)}`);
  console.log('');

  // Load all workouts
  const workoutQuery = LIMIT
    ? sqlite.prepare('SELECT * FROM workouts ORDER BY date DESC LIMIT ?').all(LIMIT) as WorkoutRow[]
    : sqlite.prepare('SELECT * FROM workouts ORDER BY date DESC').all() as WorkoutRow[];

  console.log(`Found ${workoutQuery.length} workouts to process`);

  // Preload all segments (avoid N+1 queries)
  const allSegmentRows = sqlite.prepare('SELECT * FROM workout_segments').all() as SegmentRow[];
  const segmentsByWorkout = new Map<number, DBWorkoutSegment[]>();
  for (const segRow of allSegmentRows) {
    const seg = rowToSegment(segRow);
    const existing = segmentsByWorkout.get(seg.workoutId) || [];
    existing.push(seg);
    segmentsByWorkout.set(seg.workoutId, existing);
  }
  console.log(`Loaded ${allSegmentRows.length} segments across ${segmentsByWorkout.size} workouts`);
  console.log('');

  // Process
  const results: ReprocessResult[] = [];
  let processed = 0;
  let changed = 0;
  let errored = 0;
  const startTime = Date.now();

  for (const workoutRow of workoutQuery) {
    const workout = rowToWorkout(workoutRow);
    const segments = segmentsByWorkout.get(workout.id) || [];

    try {
      const result = reprocessWorkout(workout, segments, settings);
      results.push(result);

      if (result.changed) changed++;
      if (result.errors.length > 0) errored++;
      processed++;

      // Progress every 50 workouts
      if (processed % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Progress: ${processed}/${workoutQuery.length} (${elapsed}s elapsed, ${changed} changed)`);
      }
    } catch (e) {
      errored++;
      processed++;
      console.error(`  Error on workout ${workoutRow.id} (${workoutRow.date}): ${e}`);
    }
  }

  // Print before/after diffs for first few workouts that changed
  console.log('');
  console.log(`=== Before/After Preview (first ${PREVIEW_COUNT} changed workouts) ===`);
  const changedResults = results.filter(r => r.changed);

  for (let i = 0; i < Math.min(PREVIEW_COUNT, changedResults.length); i++) {
    const r = changedResults[i];
    console.log(`\n--- Workout #${r.workoutId} | ${r.date} | ${r.distanceMiles?.toFixed(1) ?? '?'} mi ---`);

    const diffs = [
      printDiff('workoutType', r.oldWorkoutType, r.newWorkoutType),
      printDiff('autoCategory', r.oldAutoCategory, r.newAutoCategory),
      printDiff('trimp', r.oldTrimp !== null ? Math.round(r.oldTrimp) : null, r.newTrimp !== null ? Math.round(r.newTrimp) : null),
      printDiff('qualityRatio', r.oldQualityRatio !== null ? r.oldQualityRatio.toFixed(3) : null, r.newQualityRatio !== null ? r.newQualityRatio.toFixed(3) : null),
      printDiff('zoneDominant', r.oldZoneDominant, r.newZoneDominant),
      printDiff('intervalAdjTrimp', r.oldIntervalAdjustedTrimp !== null ? Math.round(r.oldIntervalAdjustedTrimp) : null, r.newIntervalAdjustedTrimp !== null ? Math.round(r.newIntervalAdjustedTrimp) : null),
    ].filter(Boolean);

    if (diffs.length === 0) {
      console.log('  (marked changed but values look identical -- likely precision diff)');
    } else {
      diffs.forEach(d => console.log(d));
    }

    if (r.errors.length > 0) {
      console.log(`  ERRORS: ${r.errors.join('; ')}`);
    }
  }

  // Summary stats
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('=== Summary ===');
  console.log(`Processed:  ${processed}`);
  console.log(`Changed:    ${changed}`);
  console.log(`Unchanged:  ${processed - changed - errored}`);
  console.log(`Errors:     ${errored}`);
  console.log(`Time:       ${elapsed}s`);
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN (no writes performed)' : 'LIVE (updates written)'}`);

  // Category distribution
  const categoryDist = new Map<string, number>();
  for (const r of results) {
    const cat = r.newWorkoutType || r.newAutoCategory || 'unknown';
    categoryDist.set(cat, (categoryDist.get(cat) || 0) + 1);
  }

  console.log('');
  console.log('Category distribution (after reprocessing):');
  const sortedCats: [string, number][] = [];
  categoryDist.forEach((count, cat) => sortedCats.push([cat, count]));
  sortedCats.sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const bar = '#'.repeat(Math.min(40, Math.round(count / results.length * 40)));
    console.log(`  ${cat.padEnd(14)} ${String(count).padStart(4)}  ${bar}`);
  }

  // TRIMP stats
  const trimps = results.map(r => r.newTrimp).filter((t): t is number => t !== null);
  if (trimps.length > 0) {
    const avgTrimp = trimps.reduce((a, b) => a + b, 0) / trimps.length;
    const minTrimp = Math.min(...trimps);
    const maxTrimp = Math.max(...trimps);
    console.log('');
    console.log(`TRIMP stats: avg=${Math.round(avgTrimp)}, min=${Math.round(minTrimp)}, max=${Math.round(maxTrimp)}`);
  }

  if (DRY_RUN) {
    console.log('');
    console.log('This was a dry run. To apply changes, run without --dry-run:');
    console.log('  npx tsx scripts/reprocess-workouts.ts');
  }

  sqlite.close();
}

main();
