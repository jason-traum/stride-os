// workout-tools - Coach tool implementations
// Auto-generated from coach-tools.ts split

// Coach tools for Claude function calling

import { db, workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts, trainingBlocks, sorenessEntries, canonicalRoutes, coachActions } from '@/lib/db';
import { eq, desc, gte, asc, and, lte, lt } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { fetchCurrentWeather, type WeatherCondition } from '../weather';
import { calculateConditionsSeverity, calculatePaceAdjustment, parsePaceToSeconds } from '../conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems, getCategoryLabel } from '../outfit';
import { calculatePace, formatPace as formatPaceFromTraining } from '../utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { calculateVDOT, calculatePaceZones } from '../training/vdot-calculator';
import { RACE_DISTANCES } from '../training/types';
import { detectAlerts } from '../alerts';
import { enhancedPrescribeWorkout } from '../enhanced-prescribe-workout';
import type { WorkoutType, Verdict, NewAssessment, ClothingCategory, TemperaturePreference, OutfitRating, ExtremityRating, RacePriority, Workout, Assessment, Shoe, ClothingItem, PlannedWorkout, Race, CanonicalRoute, WorkoutSegment, UserSettings } from '../schema';
import { performVibeCheck, adaptWorkout, vibeCheckDefinition, adaptWorkoutDefinition } from '../vibe-check-tool';
import { MasterPlanGenerator } from '../master-plan';
import { DetailedWindowGenerator } from '../detailed-window-generator';
import { CoachingMemory } from '../coaching-memory';

// New feature imports
import {
  classifyRun,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeQualityRatio,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeTRIMP,
} from '../training/run-classifier';
import {
  computeExecutionScore,
  parseExecutionDetails,
} from '../training/execution-scorer';
import {
  checkDataQuality,
  parseDataQualityFlags,
  getDataQualitySummary,
  type DataQualityFlags,
} from '../training/data-quality';
import {
  getRouteProgressSummary,
} from '../training/route-matcher';
import { generateExplanationContext } from '../training/workout-processor';
import {
  standardPlans,
  getStandardPlan,
  getPlansByAuthor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSuitablePlans,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type StandardPlanTemplate,
} from '../training/standard-plans';
import { buildPerformanceModel } from '../training/performance-model';
import { getCoachingKnowledge, getRelatedTopics, getTopicWithRelated, type KnowledgeTopic } from '../coach-knowledge';
import { isPublicAccessMode } from '../access-mode';

// Analytics imports for coach context (roadmap 3.15)
import { getFatigueResistanceData } from '@/actions/fatigue-resistance';
import { getSplitTendencyData } from '@/actions/split-tendency';
import { getRunningEconomyData } from '@/actions/running-economy';

// Threshold detection & recovery model imports
import { getThresholdEstimate } from '@/actions/threshold';
import { getRecoveryAnalysis } from '@/actions/recovery';


// Shared utilities from split modules
import { getSettingsForProfile, recordCoachAction, formatPace, parseTimeToSeconds, formatTimeFromSeconds, formatSecondsToTime, getDateDaysAgo, getWeekStart, groupByWorkoutType, buildProfileUpdates, updateUserVDOTFromResult, createPendingCoachAction } from './shared';
import type { WorkoutWithRelations, DemoContext, DemoAction } from './types';


async function getRecentWorkouts(input: Record<string, unknown>) {
  const count = Math.min((input.count as number) || 5, 20);
  const workoutType = input.workout_type as string | undefined;

  const profileId = await getActiveProfileId();
  const query = db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
    with: {
      shoe: true,
      assessment: true,
    },
    orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    limit: count,
  });

  let results: WorkoutWithRelations[] = await query;

  if (workoutType) {
    results = results.filter((w: WorkoutWithRelations) => w.workoutType === workoutType);
  }

  return results.map((w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    pace_per_mile: w.avgPaceSeconds ? formatPace(w.avgPaceSeconds) : null,
    workout_type: w.workoutType,
    route_name: w.routeName,
    shoe: w.shoe?.name || null,
    notes: w.notes,
    weather: w.weatherTempF ? {
      temp_f: w.weatherTempF,
      feels_like_f: w.weatherFeelsLikeF,
      humidity: w.weatherHumidityPct,
      conditions: w.weatherConditions,
    } : null,
    assessment: w.assessment ? {
      verdict: w.assessment.verdict,
      rpe: w.assessment.rpe,
      legs_feel: w.assessment.legsFeel,
      sleep_quality: w.assessment.sleepQuality,
      sleep_hours: w.assessment.sleepHours,
      stress: w.assessment.stress,
      note: w.assessment.note,
    } : null,
  }));
}

async function getWorkoutDetail(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: {
      shoe: true,
      assessment: true,
    },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  return {
    id: workout.id,
    date: workout.date,
    distance_miles: workout.distanceMiles,
    duration_minutes: workout.durationMinutes,
    pace_per_mile: workout.avgPaceSeconds ? formatPace(workout.avgPaceSeconds) : null,
    workout_type: workout.workoutType,
    route_name: workout.routeName,
    notes: workout.notes,
    shoe: workout.shoe ? {
      id: workout.shoe.id,
      name: workout.shoe.name,
      total_miles: workout.shoe.totalMiles,
    } : null,
    weather: workout.weatherTempF ? {
      temp_f: workout.weatherTempF,
      feels_like_f: workout.weatherFeelsLikeF,
      humidity: workout.weatherHumidityPct,
      wind_mph: workout.weatherWindMph,
      conditions: workout.weatherConditions,
      severity_score: workout.weatherSeverityScore,
    } : null,
    assessment: workout.assessment ? {
      verdict: workout.assessment.verdict,
      rpe: workout.assessment.rpe,
      was_intended_workout: workout.assessment.wasIntendedWorkout,
      legs_feel: workout.assessment.legsFeel,
      breathing_feel: workout.assessment.breathingFeel,
      sleep_quality: workout.assessment.sleepQuality,
      sleep_hours: workout.assessment.sleepHours,
      stress: workout.assessment.stress,
      soreness: workout.assessment.soreness,
      mood: workout.assessment.mood,
      hydration: workout.assessment.hydration,
      perceived_heat: workout.assessment.perceivedHeat,
      note: workout.assessment.note,
    } : null,
  };
}

async function getShoes(input: Record<string, unknown>) {
  const includeRetired = input.include_retired as boolean || false;

  const profileId = await getActiveProfileId();
  let results: Shoe[] = profileId
    ? await db.select().from(shoes).where(eq(shoes.profileId, profileId))
    : await db.select().from(shoes);

  if (!includeRetired) {
    results = results.filter((s: Shoe) => !s.isRetired);
  }

  return results.map((s: Shoe) => ({
    id: s.id,
    name: s.name,
    brand: s.brand,
    model: s.model,
    category: s.category,
    total_miles: s.totalMiles,
    is_retired: s.isRetired,
  }));
}

async function getUserSettings() {
  const s = await getSettingsForProfile();

  if (!s) {
    return { error: 'No settings found' };
  }

  return {
    name: s.name,
    location: s.cityName || null,
    weekly_volume_target_miles: s.weeklyVolumeTargetMiles,
    heat_acclimatization_score: s.heatAcclimatizationScore,
    default_target_pace: s.defaultTargetPaceSeconds ? formatPace(s.defaultTargetPaceSeconds) : null,
    preferred_long_run_day: s.preferredLongRunDay,
    coach_context: s.coachContext,
  };
}

async function logWorkout(input: Record<string, unknown>) {
  const now = new Date();
  const date = (input.date as string) || now.toISOString().split('T')[0];
  let distanceMiles = input.distance_miles as number | undefined;
  let durationMinutes = input.duration_minutes as number | undefined;
  const pacePerMile = input.pace_per_mile as string | undefined;
  let workoutType = input.workout_type as WorkoutType | undefined;
  const shoeId = input.shoe_id as number | undefined;
  const routeName = input.route_name as string | undefined;
  const notes = input.notes as string | undefined;

  // Get active profile
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Find planned workout for this date to auto-link and auto-categorize
  const plannedWorkoutForDate = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, date),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    with: {
      template: true,
    },
    orderBy: [desc(plannedWorkouts.isKeyWorkout)], // Prioritize key workouts
  });

  // Auto-detect workout type from planned workout if not explicitly provided
  if (!workoutType && plannedWorkoutForDate) {
    // Map template category or workout type to our WorkoutType
    const templateType = plannedWorkoutForDate.workoutType;
    if (templateType) {
      workoutType = templateType as WorkoutType;
    }
  }

  // Track if we should auto-detect from pace later (no planned workout and no explicit type)
  const shouldAutoDetectFromPace = !workoutType && !plannedWorkoutForDate;

  // Parse pace string "mm:ss" to seconds
  let paceSeconds: number | null = null;
  if (pacePerMile) {
    const parts = pacePerMile.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        paceSeconds = mins * 60 + secs;
      }
    }
  }

  // Validate: need at least two of (distance, duration, pace) to calculate the third
  const valuesProvided = [distanceMiles, durationMinutes, paceSeconds].filter(v => v !== undefined && v !== null).length;
  if (valuesProvided < 2 && !distanceMiles) {
    return {
      success: false,
      message: 'Please provide at least two of: distance, duration, or pace. For example: "5 miles in 45 minutes" or "30 minutes at 9:00 pace"',
    };
  }

  // Calculate missing values from the two provided values
  // Priority: calculate from what's given
  if (distanceMiles && durationMinutes) {
    // Both provided: calculate pace
    paceSeconds = calculatePace(distanceMiles, durationMinutes);
  } else if (durationMinutes && paceSeconds) {
    // Duration + pace: calculate distance
    // distance = duration (minutes) / (pace (seconds) / 60)
    distanceMiles = Math.round((durationMinutes / (paceSeconds / 60)) * 100) / 100;
  } else if (distanceMiles && paceSeconds) {
    // Distance + pace: calculate duration
    // duration = distance * pace (seconds) / 60
    durationMinutes = Math.round((distanceMiles * paceSeconds / 60) * 10) / 10;
  }

  // Final pace calculation if we have both distance and duration now
  const avgPaceSeconds = distanceMiles && durationMinutes
    ? calculatePace(distanceMiles, durationMinutes)
    : paceSeconds;

  // Auto-detect workout type from pace if no planned workout and no explicit type
  if (shouldAutoDetectFromPace && avgPaceSeconds) {
    // Get user's pace zones to classify the workout
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.profileId, profileId)
    });
    if (settings?.vdot && settings.vdot >= 15 && settings.vdot <= 85) {
      const paceZones = calculatePaceZones(settings.vdot);
      // Compare avg pace to zones (lower pace seconds = faster)
      // Threshold: tempo - marathon pace range
      // Tempo: around threshold pace
      // Interval: faster than threshold
      // Easy: slower than marathon pace
      // Long: based on distance (10+ miles at easy pace)

      const easyPaceSeconds = paceZones.easy || 600;
      const tempoPaceSeconds = paceZones.tempo || 480;
      const thresholdPaceSeconds = paceZones.threshold || 420;
      const intervalPaceSeconds = paceZones.interval || 360;

      // Determine workout type based on pace
      if (distanceMiles && distanceMiles >= 10 && avgPaceSeconds >= easyPaceSeconds - 30) {
        workoutType = 'long';
      } else if (avgPaceSeconds <= intervalPaceSeconds + 15) {
        workoutType = 'interval';
      } else if (avgPaceSeconds <= thresholdPaceSeconds + 15) {
        workoutType = 'tempo';
      } else if (avgPaceSeconds <= tempoPaceSeconds + 20) {
        workoutType = 'steady';
      } else if (avgPaceSeconds >= easyPaceSeconds + 30) {
        workoutType = 'recovery';
      } else {
        workoutType = 'easy';
      }
    }
  }

  // Default to 'easy' if still no type
  if (!workoutType) {
    workoutType = 'easy';
  }

  // Check for duplicate workout (same date with similar distance/duration logged recently)
  // This prevents the AI from accidentally logging the same workout multiple times
  const dupCheckProfileId = await getActiveProfileId();
  const existingWorkouts = await db.query.workouts.findMany({
    where: dupCheckProfileId
      ? and(eq(workouts.profileId, dupCheckProfileId), eq(workouts.date, date))
      : eq(workouts.date, date),
    orderBy: [desc(workouts.createdAt)],
    limit: 5,
  });

  for (const existing of existingWorkouts) {
    // Check if created within last 5 minutes (to catch duplicates from same conversation)
    const createdAt = new Date(existing.createdAt);
    const minutesAgo = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (minutesAgo < 5) {
      // Check if distance matches (within 0.1 miles tolerance)
      const distanceMatch = !distanceMiles || !existing.distanceMiles ||
        Math.abs(distanceMiles - existing.distanceMiles) < 0.1;

      // Check if duration matches (within 2 minutes tolerance)
      const durationMatch = !durationMinutes || !existing.durationMinutes ||
        Math.abs(durationMinutes - existing.durationMinutes) < 2;

      // Check if workout type matches
      const typeMatch = existing.workoutType === workoutType;

      if (distanceMatch && durationMatch && typeMatch) {
        // This looks like a duplicate - return the existing workout instead
        const paceStr = existing.avgPaceSeconds ? formatPace(existing.avgPaceSeconds) : '';
        return {
          success: true,
          workout_id: existing.id,
          message: `This workout was already logged (ID: ${existing.id}). No duplicate created.`,
          distance_miles: existing.distanceMiles,
          duration_minutes: existing.durationMinutes,
          pace: paceStr || null,
          already_existed: true,
        };
      }
    }
  }

  const [workout] = await db.insert(workouts).values({
    profileId: profileId || null,
    date,
    distanceMiles,
    durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
    avgPaceSeconds,
    workoutType,
    shoeId: shoeId || null,
    routeName: routeName || null,
    notes: notes || null,
    source: 'manual',
    plannedWorkoutId: plannedWorkoutForDate?.id || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }).returning();

  // Update shoe mileage if provided
  if (shoeId && distanceMiles) {
    const [shoe] = await db.select().from(shoes).where(eq(shoes.id, shoeId));
    if (shoe) {
      await db.update(shoes)
        .set({ totalMiles: shoe.totalMiles + distanceMiles })
        .where(eq(shoes.id, shoeId));
    }
  }

  // Link to planned workout if found - update planned workout to mark as completed
  let linkedPlannedWorkout: PlannedWorkout | null = null;
  if (plannedWorkoutForDate) {
    // Update the planned workout to mark as completed and link to logged workout
    await db.update(plannedWorkouts)
      .set({
        status: 'completed',
        completedWorkoutId: workout.id,
        updatedAt: now.toISOString(),
      })
      .where(eq(plannedWorkouts.id, plannedWorkoutForDate.id));

    linkedPlannedWorkout = plannedWorkoutForDate;
  }

  // Build informative message
  const durationStr = durationMinutes ? `${Math.round(durationMinutes)} min` : '';
  const distanceStr = distanceMiles ? `${distanceMiles} miles` : '';
  const paceStr = avgPaceSeconds ? formatPace(avgPaceSeconds) : '';

  const parts = [distanceStr, durationStr].filter(Boolean).join(', ');
  let message = `Workout logged: ${parts} ${workoutType} run on ${date}${paceStr ? ` @ ${paceStr}/mi pace` : ''}`;

  // Add note about linking to planned workout
  if (linkedPlannedWorkout) {
    const plannedName = linkedPlannedWorkout.name || 'scheduled workout';
    message += `. Linked to planned "${plannedName}" and marked as completed.`;
  }

  return {
    success: true,
    workout_id: workout.id,
    message,
    distance_miles: distanceMiles || null,
    duration_minutes: durationMinutes ? Math.round(durationMinutes) : null,
    pace: paceStr || null,
    linked_planned_workout_id: linkedPlannedWorkout?.id || null,
    linked_planned_workout_name: linkedPlannedWorkout?.name || null,
  };
}

async function updateWorkoutTool(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  if (!workoutId) {
    return {
      success: false,
      message: 'Workout ID is required. Please specify which workout to update.',
    };
  }

  // Find the existing workout
  const existingWorkout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!existingWorkout) {
    return {
      success: false,
      message: `Workout with ID ${workoutId} not found.`,
    };
  }

  // Build update object with only provided fields
  const updateData: Partial<Workout> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.workout_type !== undefined) {
    updateData.workoutType = input.workout_type as WorkoutType;
  }
  if (input.distance_miles !== undefined) {
    updateData.distanceMiles = input.distance_miles as number;
  }
  if (input.duration_minutes !== undefined) {
    updateData.durationMinutes = input.duration_minutes as number;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes as string;
  }
  if (input.route_name !== undefined) {
    updateData.routeName = input.route_name as string;
  }
  if (input.shoe_id !== undefined) {
    updateData.shoeId = input.shoe_id as number;
  }

  // Recalculate pace if distance or duration changed
  const newDistance = updateData.distanceMiles ?? existingWorkout.distanceMiles;
  const newDuration = updateData.durationMinutes ?? existingWorkout.durationMinutes;
  if (newDistance && newDuration && (updateData.distanceMiles !== undefined || updateData.durationMinutes !== undefined)) {
    updateData.avgPaceSeconds = calculatePace(newDistance, newDuration);
  }

  // Perform update
  await db.update(workouts)
    .set(updateData)
    .where(eq(workouts.id, workoutId));

  // Format response
  const changes: string[] = [];
  if (input.workout_type !== undefined) {
    changes.push(`type → ${input.workout_type}`);
  }
  if (input.distance_miles !== undefined) {
    changes.push(`distance → ${input.distance_miles} mi`);
  }
  if (input.duration_minutes !== undefined) {
    changes.push(`duration → ${input.duration_minutes} min`);
  }
  if (input.notes !== undefined) {
    changes.push(`notes updated`);
  }
  if (input.route_name !== undefined) {
    changes.push(`route → ${input.route_name}`);
  }

  const changeStr = changes.length > 0 ? changes.join(', ') : 'no changes';

  return {
    success: true,
    workout_id: workoutId,
    message: `Updated workout from ${existingWorkout.date}: ${changeStr}`,
    previous_type: existingWorkout.workoutType,
    new_type: updateData.workoutType ?? existingWorkout.workoutType,
  };
}

async function logAssessment(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const verdict = input.verdict as Verdict;
  const rpe = input.rpe as number;

  const now = new Date().toISOString();

  // Check if assessment already exists
  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.workoutId, workoutId),
  });

  const assessmentData: Partial<NewAssessment> = {
    verdict,
    rpe,
    legsFeel: input.legs_feel as number | undefined ?? null,
    breathingFeel: input.breathing_feel as NewAssessment['breathingFeel'] | undefined ?? null,
    sleepQuality: input.sleep_quality as number | undefined ?? null,
    sleepHours: input.sleep_hours as number | undefined ?? null,
    stress: input.stress as number | undefined ?? null,
    soreness: input.soreness as number | undefined ?? null,
    hydration: input.hydration as number | undefined ?? null,
    note: input.note as string | undefined ?? null,
  };

  if (existing) {
    await db.update(assessments)
      .set(assessmentData)
      .where(eq(assessments.id, existing.id));

    return {
      success: true,
      message: 'Assessment updated',
    };
  }

  await db.insert(assessments).values({
    workoutId,
    ...assessmentData,
    verdict,
    rpe,
    wasIntendedWorkout: 'yes',
    issues: '[]',
    legsTags: '[]',
    lifeTags: '[]',
    hydrationTags: '[]',
    createdAt: now,
  } as NewAssessment);

  return {
    success: true,
    message: 'Assessment saved',
  };
}

async function getTrainingSummary(input: Record<string, unknown>) {
  const days = (input.days as number) || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const summaryProfileId = await getActiveProfileId();
  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: summaryProfileId
      ? and(eq(workouts.profileId, summaryProfileId), gte(workouts.date, cutoffStr))
      : gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  const totalMiles = recentWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = recentWorkouts.length;

  const typeDistribution: Record<string, number> = {};
  recentWorkouts.forEach((w: WorkoutWithRelations) => {
    typeDistribution[w.workoutType] = (typeDistribution[w.workoutType] || 0) + 1;
  });

  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment);
  const avgRpe = assessedWorkouts.length > 0
    ? assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length
    : null;

  const verdictCounts: Record<string, number> = {};
  assessedWorkouts.forEach((w: WorkoutWithRelations) => {
    if (w.assessment?.verdict) {
      verdictCounts[w.assessment.verdict] = (verdictCounts[w.assessment.verdict] || 0) + 1;
    }
  });

  const avgSleep = assessedWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepHours).length > 0
    ? assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.sleepHours || 0), 0) /
      assessedWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepHours).length
    : null;

  // Fetch threshold pace and recovery status to enrich the summary
  let thresholdPaceSummary: string | null = null;
  let recoverySummary: { score: number; ready_for_quality: boolean; hours_until_ready: number } | null = null;
  try {
    const [thresholdResult, recoveryResult] = await Promise.all([
      getThresholdEstimate().catch(() => null),
      getRecoveryAnalysis().catch(() => null),
    ]);
    if (thresholdResult?.success && thresholdResult.data.method !== 'insufficient_data') {
      thresholdPaceSummary = `${formatPaceFromTraining(thresholdResult.data.thresholdPaceSecondsPerMile)}/mi (${Math.round(thresholdResult.data.confidence * 100)}% confidence, method: ${thresholdResult.data.method})`;
    }
    if (recoveryResult?.success) {
      const r = recoveryResult.data;
      recoverySummary = {
        score: r.recoveryScore,
        ready_for_quality: r.readyForQuality,
        hours_until_ready: r.estimatedRecoveryHours,
      };
    }
  } catch {
    // Non-critical enrichment, continue without
  }

  return {
    period_days: days,
    total_miles: Math.round(totalMiles * 10) / 10,
    total_runs: totalRuns,
    runs_per_week: Math.round((totalRuns / days) * 7 * 10) / 10,
    miles_per_run: totalRuns > 0 ? Math.round((totalMiles / totalRuns) * 10) / 10 : 0,
    workout_type_distribution: typeDistribution,
    average_rpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
    verdict_distribution: verdictCounts,
    average_sleep_hours: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
    // Auto-detected threshold pace from recent workout data
    auto_detected_threshold_pace: thresholdPaceSummary,
    // Current recovery status from personalized model
    recovery_status: recoverySummary,
  };
}

async function searchWorkouts(input: Record<string, unknown>) {
  const query = input.query as string | undefined;
  const dateFrom = input.date_from as string | undefined;
  const dateTo = input.date_to as string | undefined;

  const searchProfileId = await getActiveProfileId();
  let results: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: searchProfileId ? eq(workouts.profileId, searchProfileId) : undefined,
    with: {
      shoe: true,
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
    limit: 20,
  });

  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter((w: WorkoutWithRelations) =>
      (w.notes?.toLowerCase().includes(lowerQuery)) ||
      (w.routeName?.toLowerCase().includes(lowerQuery))
    );
  }

  if (dateFrom) {
    results = results.filter((w: WorkoutWithRelations) => w.date >= dateFrom);
  }

  if (dateTo) {
    results = results.filter((w: WorkoutWithRelations) => w.date <= dateTo);
  }

  return results.map((w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    workout_type: w.workoutType,
    route_name: w.routeName,
    notes: w.notes,
    verdict: w.assessment?.verdict,
  }));
}

export {
  getRecentWorkouts,
  getWorkoutDetail,
  getShoes,
  getUserSettings,
  logWorkout,
  updateWorkoutTool,
  logAssessment,
  getTrainingSummary,
  searchWorkouts,
};
