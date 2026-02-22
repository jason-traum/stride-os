// Workout Processor Pipeline
// Runs on every workout save/import to populate new computed fields

import { db, workouts, canonicalRoutes, workoutSegments, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { Workout, UserSettings, WorkoutSegment, PlannedWorkout, CanonicalRoute } from '../schema';
import { parseLocalDate } from '@/lib/utils';

import {
  classifyRun,
  computeQualityRatio,
  computeTRIMP,
  computeConditionAdjustment,
  type ClassificationResult,
} from './run-classifier';

import {
  computeExecutionScore,
  serializeExecutionDetails,
  type ExecutionScore,
} from './execution-scorer';

import {
  checkDataQuality,
  serializeDataQualityFlags,
  type DataQualityFlags,
} from './data-quality';

import {
  computeRouteFingerprint,
  matchRoute,
  serializeRouteFingerprint,
  createCanonicalRouteFromWorkout,
  updateRouteStats,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type RouteFingerprint,
  type RouteMatch,
} from './route-matcher';

import {
  classifySplitEffortsWithZones,
  computeZoneDistribution,
  deriveWorkoutType,
  type ZoneBoundaries,
} from './effort-classifier';

import { computeIntervalStress } from './interval-stress';
import { detectIntervalPattern } from './interval-detector';

import type { ZoneDistribution } from './types';

export interface ProcessingResult {
  workoutId: number;
  classification: ClassificationResult | null;
  qualityRatio: number | null;
  trimp: number | null;
  executionScore: ExecutionScore | null;
  dataQuality: DataQualityFlags | null;
  routeMatch: RouteMatch | null;
  newRoute: boolean;
  zoneDistribution: ZoneDistribution | null;
  zoneDominant: string | null;
  zoneBoundariesUsed: ZoneBoundaries | null;
  intervalAdjustedTrimp: number | null;
  intervalStressDetails: string | null;
  errors: string[];
}

/**
 * Main processing pipeline - runs all deterministic engines on a workout
 */
export async function processWorkout(
  workoutId: number,
  options: {
    skipClassification?: boolean;
    skipExecution?: boolean;
    skipDataQuality?: boolean;
    skipRouteMatching?: boolean;
  } = {}
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    workoutId,
    classification: null,
    qualityRatio: null,
    trimp: null,
    executionScore: null,
    dataQuality: null,
    routeMatch: null,
    newRoute: false,
    zoneDistribution: null,
    zoneDominant: null,
    zoneBoundariesUsed: null,
    intervalAdjustedTrimp: null,
    intervalStressDetails: null,
    errors: [],
  };

  try {
    // Fetch the workout with segments
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
      with: {
        segments: true,
        plannedWorkout: true,
      },
    });

    if (!workout) {
      result.errors.push('Workout not found');
      return result;
    }

    // Fetch user settings for this workout's profile
    const settings = workout.profileId
      ? await db.query.userSettings.findFirst({
          where: eq(userSettings.profileId, workout.profileId)
        })
      : await db.query.userSettings.findFirst();

    // Fetch segments if not included
    const segments = workout.segments || await db.query.workoutSegments.findMany({
      where: eq(workoutSegments.workoutId, workoutId),
    });

    // 1. Check Data Quality (do this first as it may affect other processing)
    if (!options.skipDataQuality) {
      try {
        result.dataQuality = checkDataQuality(workout as Workout, segments as WorkoutSegment[]);
      } catch (e) {
        result.errors.push(`Data quality check failed: ${e}`);
      }
    }

    // 2. Compute Quality Ratio and TRIMP
    try {
      result.qualityRatio = computeQualityRatio(
        workout as Workout,
        segments as WorkoutSegment[],
        settings as UserSettings | null
      );
      result.trimp = computeTRIMP(workout as Workout, settings as UserSettings | null);
    } catch (e) {
      result.errors.push(`Metrics computation failed: ${e}`);
    }

    // 3. Classify the run
    if (!options.skipClassification) {
      try {
        result.classification = classifyRun(
          workout as Workout,
          settings as UserSettings | null,
          segments as WorkoutSegment[]
        );
      } catch (e) {
        result.errors.push(`Classification failed: ${e}`);
      }
    }

    // 3b. Zone classification pipeline (effort classifier → zone distribution → workout type)
    // Track classified zones for use in 3c (interval stress)
    let classifiedZoneMap: Map<number, string> | null = null;
    try {
      let classifiableSegments = segments as WorkoutSegment[];

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
        }];
      }

      if (classifiableSegments.length > 0) {
        // Build laps for the classifier
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

        // Classify each segment
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
        result.zoneBoundariesUsed = resolvedZones;

        // Update pace_zone on real (non-synthetic) segments
        classifiedZoneMap = new Map();
        if (segments.length > 0) {
          for (let i = 0; i < classified.length && i < sorted.length; i++) {
            const seg = sorted[i];
            classifiedZoneMap.set(seg.id, classified[i].category);
            if (seg.id > 0) {
              await db.update(workoutSegments)
                .set({
                  paceZone: classified[i].category,
                  paceZoneConfidence: classified[i].confidence,
                })
                .where(eq(workoutSegments.id, seg.id));
            }
          }
        }

        // Compute zone distribution
        const segDurations = sorted.map(seg => ({
          durationSeconds: seg.durationSeconds,
        }));
        const zoneDist = computeZoneDistribution(classified, segDurations);
        result.zoneDistribution = zoneDist;

        // Derive workout type from distribution
        const derived = deriveWorkoutType(zoneDist, {
          workoutType: workout.workoutType,
          distanceMiles: workout.distanceMiles,
          durationMinutes: workout.durationMinutes,
        });
        result.zoneDominant = derived;
      }
    } catch (e) {
      result.errors.push(`Zone classification failed: ${e}`);
    }

    // 3c. Interval stress model (requires zones from 3b)
    try {
      if (result.trimp !== null && segments.length >= 3) {
        const sortedSegs = [...(segments as WorkoutSegment[])].sort((a, b) => a.segmentNumber - b.segmentNumber);
        // Enrich segments with classified pace zones from 3b
        const zonesApplied = sortedSegs.map((seg) => ({
          ...seg,
          paceZone: classifiedZoneMap?.get(seg.id) ?? seg.paceZone,
        }));
        const intervalStress = computeIntervalStress(
          workout as Workout, zonesApplied, settings as UserSettings | null, result.trimp
        );
        result.intervalAdjustedTrimp = intervalStress.intervalAdjustedTrimp;
        result.intervalStressDetails = JSON.stringify(intervalStress);
      }
    } catch (e) {
      result.errors.push(`Interval stress computation failed: ${e}`);
    }

    // 3d. Interval pattern detection (recognizes 8x800, ladders, pyramids, etc.)
    try {
      if (segments.length >= 4) {
        const sortedSegs = [...(segments as WorkoutSegment[])].sort((a, b) => a.segmentNumber - b.segmentNumber);
        // Enrich segments with classified pace zones from 3b
        const zonesApplied = sortedSegs.map((seg) => ({
          ...seg,
          paceZone: classifiedZoneMap?.get(seg.id) ?? seg.paceZone,
        }));
        const intervalPattern = detectIntervalPattern(zonesApplied);

        // Merge pattern into intervalStressDetails JSON (adds to existing stress data)
        if (intervalPattern.type !== 'unknown') {
          const existingDetails = result.intervalStressDetails
            ? JSON.parse(result.intervalStressDetails)
            : {};
          existingDetails.intervalPattern = intervalPattern;
          result.intervalStressDetails = JSON.stringify(existingDetails);
        }
      }
    } catch (e) {
      result.errors.push(`Interval pattern detection failed: ${e}`);
    }

    // 4. Compute route fingerprint and match to canonical routes
    if (!options.skipRouteMatching) {
      try {
        const fingerprint = computeRouteFingerprint(workout as Workout);

        if (fingerprint) {
          // Fetch existing canonical routes
          const existingRoutes = await db.select().from(canonicalRoutes);

          // Try to match
          const match = matchRoute(fingerprint, existingRoutes as CanonicalRoute[]);

          if (match) {
            result.routeMatch = match;

            // Update the matched route's stats
            const matchedRoute = existingRoutes.find(r => r.id === match.routeId);
            if (matchedRoute) {
              const updatedStats = updateRouteStats(matchedRoute as CanonicalRoute, workout as Workout);
              await db.update(canonicalRoutes)
                .set({
                  ...updatedStats,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(canonicalRoutes.id, match.routeId));
            }
          } else if (workout.routeName) {
            // No match found but workout has a route name - create new canonical route
            const newRouteData = createCanonicalRouteFromWorkout(workout as Workout);
            if (newRouteData) {
              const [newRoute] = await db.insert(canonicalRoutes)
                .values({
                  ...newRouteData,
                  runCount: 1,
                  bestTimeSeconds: workout.durationMinutes ? workout.durationMinutes * 60 : null,
                  bestPaceSeconds: workout.avgPaceSeconds || null,
                  averageTimeSeconds: workout.durationMinutes ? workout.durationMinutes * 60 : null,
                  averagePaceSeconds: workout.avgPaceSeconds || null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                .returning();

              result.routeMatch = {
                routeId: newRoute.id,
                routeName: newRoute.name,
                confidence: 1.0,
                matchType: 'exact',
              };
              result.newRoute = true;
            }
          }
        }
      } catch (e) {
        result.errors.push(`Route matching failed: ${e}`);
      }
    }

    // 5. Compute Execution Score (if there's a linked planned workout)
    if (!options.skipExecution && workout.plannedWorkoutId) {
      try {
        const plannedWorkout = workout.plannedWorkout || await db.query.plannedWorkouts.findFirst({
          where: eq(workouts.id, workout.plannedWorkoutId),
        });

        if (plannedWorkout) {
          const weather = workout.weatherTempF ? {
            tempF: workout.weatherTempF || undefined,
            feelsLikeF: workout.weatherFeelsLikeF || undefined,
            humidity: workout.weatherHumidityPct || undefined,
            windMph: workout.weatherWindMph || undefined,
            conditions: workout.weatherConditions || undefined,
          } : undefined;

          result.executionScore = computeExecutionScore(
            workout as Workout,
            plannedWorkout as PlannedWorkout,
            segments as WorkoutSegment[],
            weather,
            settings as UserSettings | null
          );
        }
      } catch (e) {
        result.errors.push(`Execution scoring failed: ${e}`);
      }
    }

    // 6. Update workout record with computed fields
    try {
      await updateWorkoutWithProcessedData(workoutId, result);
    } catch (e) {
      result.errors.push(`Database update failed: ${e}`);
    }

  } catch (e) {
    result.errors.push(`Processing pipeline failed: ${e}`);
  }

  return result;
}

/**
 * Update workout record with processed data
 */
async function updateWorkoutWithProcessedData(
  workoutId: number,
  result: ProcessingResult
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  // Add classification data
  if (result.classification) {
    updates.autoCategory = result.classification.category;
    updates.autoSummary = result.classification.summary;
  }

  // Add metrics
  if (result.qualityRatio !== null) {
    updates.qualityRatio = result.qualityRatio;
  }

  if (result.trimp !== null) {
    updates.trimp = result.trimp;
  }

  if (result.intervalAdjustedTrimp !== null) {
    updates.intervalAdjustedTrimp = result.intervalAdjustedTrimp;
    updates.intervalStressDetails = result.intervalStressDetails;
  }

  // Add execution score
  if (result.executionScore) {
    updates.executionScore = result.executionScore.overall;
    updates.executionDetails = serializeExecutionDetails(result.executionScore);
  }

  // Add data quality flags
  if (result.dataQuality) {
    updates.dataQualityFlags = serializeDataQualityFlags(result.dataQuality);
  }

  // Add zone classification data
  if (result.zoneDistribution) {
    updates.zoneDistribution = JSON.stringify(result.zoneDistribution);
    updates.zoneDominant = result.zoneDominant;
    updates.zoneClassifiedAt = new Date().toISOString();

    if (result.zoneBoundariesUsed) {
      updates.zoneBoundariesUsed = JSON.stringify(result.zoneBoundariesUsed);
    }

    // Update workoutType from zone classification, but only if user hasn't set a manual category
    const currentWorkout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });
    if (currentWorkout && !currentWorkout.category && result.zoneDominant) {
      updates.workoutType = result.zoneDominant;
    }
  }

  // Add route matching data
  if (result.routeMatch) {
    updates.routeId = result.routeMatch.routeId;

    // Also store the fingerprint
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
    });
    if (workout) {
      const fingerprint = computeRouteFingerprint(workout as Workout);
      if (fingerprint) {
        updates.routeFingerprint = serializeRouteFingerprint(fingerprint);
      }
    }
  }

  // Only update if we have something to update
  if (Object.keys(updates).length > 1) { // > 1 because we always have updatedAt
    await db.update(workouts)
      .set(updates)
      .where(eq(workouts.id, workoutId));
  }
}

/**
 * Process multiple workouts in batch (for backfill)
 */
export async function processWorkoutsBatch(
  workoutIds: number[],
  options: {
    skipClassification?: boolean;
    skipExecution?: boolean;
    skipDataQuality?: boolean;
    skipRouteMatching?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  successful: number;
  failed: number;
  results: ProcessingResult[];
}> {
  const results: ProcessingResult[] = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < workoutIds.length; i++) {
    const result = await processWorkout(workoutIds[i], options);
    results.push(result);

    if (result.errors.length === 0) {
      successful++;
    } else {
      failed++;
    }

    if (options.onProgress) {
      options.onProgress(i + 1, workoutIds.length);
    }
  }

  return { successful, failed, results };
}

/**
 * Reprocess all workouts (for schema migrations or algorithm updates)
 */
export async function reprocessAllWorkouts(
  options: {
    skipClassification?: boolean;
    skipExecution?: boolean;
    skipDataQuality?: boolean;
    skipRouteMatching?: boolean;
    limit?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  successful: number;
  failed: number;
  total: number;
}> {
  // Get all workout IDs
  const allWorkouts = await db.select({ id: workouts.id }).from(workouts);
  const workoutIds = allWorkouts.map(w => w.id);

  const idsToProcess = options.limit
    ? workoutIds.slice(0, options.limit)
    : workoutIds;

  const batchResult = await processWorkoutsBatch(idsToProcess, options);

  return {
    successful: batchResult.successful,
    failed: batchResult.failed,
    total: idsToProcess.length,
  };
}

/**
 * Generate an AI explanation for why a workout felt hard
 * This is a template-based approach that prepares context for LLM
 */
export function generateExplanationContext(
  workout: Workout,
  classification: ClassificationResult | null,
  dataQuality: DataQualityFlags | null,
  settings: UserSettings | null,
  recentWorkouts: Workout[],
  assessment?: {
    sleepQuality?: number;
    sleepHours?: number;
    stress?: number;
    soreness?: number;
    fueling?: number;
    hydration?: number;
    rpe?: number;
  }
): {
  factors: string[];
  likelyReasons: string[];
  suggestions: string[];
} {
  const factors: string[] = [];
  const likelyReasons: string[] = [];
  const suggestions: string[] = [];

  // Check weather conditions
  if (workout.weatherSeverityScore && workout.weatherSeverityScore > 5) {
    factors.push('challenging weather');
    if (workout.weatherTempF && workout.weatherTempF > 80) {
      likelyReasons.push('Heat significantly impacts performance');
      suggestions.push('Consider running earlier in cooler temps');
    }
    if (workout.weatherWindMph && workout.weatherWindMph > 15) {
      likelyReasons.push('Strong wind adds resistance and mental fatigue');
    }
  }

  // Check sleep
  if (assessment?.sleepQuality && assessment.sleepQuality < 5) {
    factors.push('poor sleep');
    likelyReasons.push('Low sleep quality affects energy and recovery');
    suggestions.push('Prioritize sleep before tomorrow\'s run');
  }
  if (assessment?.sleepHours && assessment.sleepHours < 6) {
    factors.push('sleep deficit');
    likelyReasons.push('Less than 6 hours of sleep impairs performance');
  }

  // Check stress
  if (assessment?.stress && assessment.stress > 7) {
    factors.push('high stress');
    likelyReasons.push('Elevated stress affects perceived effort');
  }

  // Check soreness
  if (assessment?.soreness && assessment.soreness > 6) {
    factors.push('muscle soreness');
    likelyReasons.push('Residual fatigue from recent training');
    suggestions.push('Consider extra recovery time');
  }

  // Check fueling/hydration
  if (assessment?.fueling && assessment.fueling < 5) {
    factors.push('under-fueled');
    likelyReasons.push('Inadequate nutrition affects energy levels');
    suggestions.push('Eat a proper meal 2-3 hours before running');
  }
  if (assessment?.hydration && assessment.hydration < 5) {
    factors.push('dehydrated');
    likelyReasons.push('Poor hydration impacts performance');
    suggestions.push('Focus on hydration throughout the day');
  }

  // Check recent training load
  const recentMileage = recentWorkouts
    .filter(w => {
      const workoutDate = parseLocalDate(w.date);
      const daysAgo = (Date.now() - workoutDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    })
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  if (recentMileage > 40) {
    factors.push('high recent mileage');
    likelyReasons.push('Accumulated fatigue from recent training volume');
    suggestions.push('Consider a lighter day tomorrow');
  }

  // Check if pace was faster than expected
  if (classification && settings?.easyPaceSeconds && workout.avgPaceSeconds) {
    if (workout.avgPaceSeconds < settings.easyPaceSeconds * 0.9) {
      factors.push('faster than easy pace');
      likelyReasons.push('Running faster than planned increases perceived effort');
      suggestions.push('Slow down on easy days to recover better');
    }
  }

  // Check time of day
  const workoutHour = new Date(workout.createdAt).getHours();
  if (workoutHour >= 12 && workoutHour <= 14 && workout.weatherTempF && workout.weatherTempF > 70) {
    factors.push('midday heat');
    likelyReasons.push('Running in the hottest part of the day');
  }

  return { factors, likelyReasons, suggestions };
}
