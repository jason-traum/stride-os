// classification-tools - Coach tool implementations
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

// Cross-module imports
import { getWeeklyReview } from './briefing-tools';

async function getRouteProgress(input: Record<string, unknown>) {
  const routeId = input.route_id as number | undefined;

  if (routeId) {
    // Get specific route
    const route = await db.query.canonicalRoutes.findFirst({
      where: eq(canonicalRoutes.id, routeId),
    });

    if (!route) {
      return { error: 'Route not found' };
    }

    // Get workouts on this route
    const routeWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.routeId, routeId),
      orderBy: [desc(workouts.date)],
      limit: 10,
    });

    const summary = getRouteProgressSummary(route as CanonicalRoute, routeWorkouts as Workout[]);

    return {
      route: {
        id: route.id,
        name: route.name,
        distance: route.distanceMiles,
        elevation_gain: route.totalElevationGain,
      },
      stats: {
        total_runs: summary.totalRuns,
        personal_best: summary.personalBest ? {
          time: formatTimeFromSeconds(summary.personalBest.time),
          pace: summary.personalBest.pace ? formatPaceFromTraining(summary.personalBest.pace) : null,
        } : null,
        average_time: summary.averageTime ? formatTimeFromSeconds(summary.averageTime) : null,
        average_pace: summary.averagePace ? formatPaceFromTraining(summary.averagePace) : null,
      },
      improvement: summary.improvement,
      recent_trend: summary.recentTrend,
      recent_runs: routeWorkouts.slice(0, 5).map((w: typeof routeWorkouts[number]) => ({
        date: w.date,
        time: w.durationMinutes ? `${w.durationMinutes} min` : null,
        pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
      })),
    };
  } else {
    // List all routes for this profile
    const routesProfileId = await getActiveProfileId();
    const allRoutes = await db.query.canonicalRoutes.findMany({
      where: routesProfileId ? eq(canonicalRoutes.profileId, routesProfileId) : undefined,
      orderBy: [desc(canonicalRoutes.runCount)],
    });

    return {
      routes: allRoutes.map((r: typeof allRoutes[number]) => ({
        id: r.id,
        name: r.name,
        distance: r.distanceMiles,
        run_count: r.runCount,
        best_time: r.bestTimeSeconds ? formatTimeFromSeconds(r.bestTimeSeconds) : null,
        best_pace: r.bestPaceSeconds ? formatPaceFromTraining(r.bestPaceSeconds) : null,
      })),
      tip: 'Run the same routes regularly to track progress over time.',
    };
  }
}

async function getWorkoutClassification(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  const s = await getSettingsForProfile();

  const classification = classifyRun(
    workout as Workout,
    s as UserSettings,
    workout.segments as WorkoutSegment[]
  );

  return {
    workout: {
      id: workout.id,
      date: workout.date,
      logged_type: workout.workoutType,
    },
    classification: {
      detected_category: classification.category,
      confidence: Math.round(classification.confidence * 100),
      summary: classification.summary,
    },
    signals: classification.signals,
    alternative_classifications: classification.alternativeCategories?.map(alt => ({
      category: alt.category,
      confidence: Math.round(alt.confidence * 100),
    })),
    note: classification.category !== workout.workoutType
      ? `Auto-detected as ${classification.category}, you logged it as ${workout.workoutType}.`
      : 'Classification matches your logged type.',
  };
}

async function getExecutionScoreTool(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Check if we have stored execution details
  if (workout.executionScore !== null && workout.executionDetails) {
    const details = parseExecutionDetails(workout.executionDetails);
    return {
      workout_id: workoutId,
      overall_score: workout.executionScore,
      components: details?.components,
      highlights: details?.highlights,
      concerns: details?.concerns,
      from_cache: true,
    };
  }

  // Need to compute - check if there's a planned workout
  const plannedWorkout = workout.plannedWorkoutId
    ? await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.id, workout.plannedWorkoutId),
      })
    : await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.date, workout.date),
      });

  if (!plannedWorkout) {
    return {
      workout_id: workoutId,
      error: 'No planned workout to compare against',
      suggestion: 'Execution scores require a planned workout to measure against.',
    };
  }

  const s = await getSettingsForProfile();

  const weather = workout.weatherTempF ? {
    tempF: workout.weatherTempF || undefined,
    feelsLikeF: workout.weatherFeelsLikeF || undefined,
    humidity: workout.weatherHumidityPct || undefined,
    windMph: workout.weatherWindMph || undefined,
  } : undefined;

  const score = computeExecutionScore(
    workout as Workout,
    plannedWorkout as PlannedWorkout,
    workout.segments as WorkoutSegment[],
    weather,
    s as UserSettings | null
  );

  return {
    workout_id: workoutId,
    overall_score: score.overall,
    components: score.components,
    diagnosis: score.diagnosis,
    suggestion: score.suggestion,
    highlights: score.highlights,
    concerns: score.concerns,
  };
}

async function getDataQualityReport(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Check for cached flags
  if (workout.dataQualityFlags) {
    const cached = parseDataQualityFlags(workout.dataQualityFlags);
    if (cached) {
      return {
        workout_id: workoutId,
        ...cached,
        summary: getDataQualitySummary(cached as DataQualityFlags),
        from_cache: true,
      };
    }
  }

  // Compute fresh
  const quality = checkDataQuality(workout as Workout, workout.segments as WorkoutSegment[]);

  return {
    workout_id: workoutId,
    overall_score: quality.overallScore,
    gps_quality: quality.gpsQuality,
    hr_quality: quality.hrQuality,
    pace_reliability: quality.paceReliability,
    flags: quality.flags,
    recommendations: quality.recommendations,
    summary: getDataQualitySummary(quality),
  };
}

async function logSoreness(input: Record<string, unknown>) {
  const bodyRegion = input.body_region as string;
  const severity = input.severity as number;
  const notes = input.notes as string | undefined;

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  await db.insert(sorenessEntries).values({
    date: today,
    bodyRegion,
    severity,
    notes: notes || null,
    createdAt: now,
  });

  const severityLabel = ['none', 'mild', 'moderate', 'severe'][severity] || 'unknown';

  return {
    success: true,
    logged: {
      date: today,
      body_region: bodyRegion.replace(/_/g, ' '),
      severity: severityLabel,
      notes,
    },
    recommendation: severity >= 2
      ? 'Monitor this area. Consider reducing intensity or taking extra rest if it persists.'
      : severity === 1
      ? 'Mild soreness is normal. Stay aware and warm up thoroughly.'
      : 'Good to go!',
  };
}

async function getWeeklyRecap(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) ?? -1;

  // Reuse weekly review logic
  const review = await getWeeklyReview({ week_offset: weekOffset });

  // Add shareable formatting
  const recap = {
    ...review,
    share_text: generateShareText(review),
    achievements: identifyAchievements(review),
  };

  return recap;
}

function generateShareText(review: Awaited<ReturnType<typeof getWeeklyReview>>): string {
  const miles = review.summary?.total_miles || 0;
  const runs = review.summary?.total_runs || 0;

  let text = `Week in Review\n`;
  text += `${miles} miles across ${runs} runs\n`;

  if (review.highlights && review.highlights.length > 0) {
    text += `${review.highlights[0]}\n`;
  }

  text += `\n#running #training`;
  return text;
}

function identifyAchievements(review: Awaited<ReturnType<typeof getWeeklyReview>>): string[] {
  const achievements = [];

  if ((review.summary?.total_miles || 0) >= 30) {
    achievements.push('30+ mile week');
  }
  if ((review.summary?.total_miles || 0) >= 50) {
    achievements.push('50+ mile week');
  }
  if ((review.plan_adherence?.percent_completed || 0) >= 100) {
    achievements.push('100% plan completion');
  }
  if ((review.verdicts as Record<string, number>)?.['great'] >= 3) {
    achievements.push('3+ great runs this week');
  }

  return achievements;
}

export {
  getRouteProgress,
  getWorkoutClassification,
  getExecutionScoreTool,
  getDataQualityReport,
  logSoreness,
  getWeeklyRecap,
  generateShareText,
  identifyAchievements,
};
