// plan-tools - Coach tool implementations
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


async function getTodaysWorkout() {
  const { plannedWorkouts, trainingBlocks } = await import('@/lib/db');

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return {
      has_workout: false,
      message: 'No planned workout for today. Rest day or no active training plan.',
    };
  }

  // Get the training block for phase info
  let block = null;
  if (workout.trainingBlockId) {
    block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
  }

  // Get weather for pace adjustment context
  const s = await getSettingsForProfile();
  let weatherContext = null;

  if (s?.latitude && s?.longitude) {
    const weather = await fetchCurrentWeather(s.latitude, s.longitude);
    if (weather) {
      const severity = calculateConditionsSeverity(weather);
      weatherContext = {
        feels_like_f: weather.feelsLike,
        humidity: weather.humidity,
        severity_score: severity.severityScore,
        should_adjust_pace: severity.severityScore > 30,
      };
    }
  }

  return {
    has_workout: true,
    workout: {
      name: workout.name,
      description: workout.description,
      workout_type: workout.workoutType,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace: workout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(workout.targetPaceSecondsPerMile)
        : null,
      is_key_workout: workout.isKeyWorkout,
      rationale: workout.rationale,
      alternatives: workout.alternatives ? JSON.parse(workout.alternatives) : null,
      status: workout.status,
    },
    phase: block?.phase || null,
    phase_focus: block?.focus || null,
    weather_context: weatherContext,
  };
}

async function getWeeklyPlan() {
  const { plannedWorkouts, trainingBlocks } = await import('@/lib/db');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get the Monday of this week
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - daysToMonday);
  const mondayStr = monday.toISOString().split('T')[0];

  // Get the Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sundayStr = sunday.toISOString().split('T')[0];

  // Get workouts for this week
  const weekWorkouts: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, mondayStr),
      lte(plannedWorkouts.date, sundayStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (weekWorkouts.length === 0) {
    return {
      has_plan: false,
      message: 'No training plan for this week.',
    };
  }

  // Get current training block
  const currentBlock = await db.query.trainingBlocks.findFirst({
    where: and(
      lte(trainingBlocks.startDate, todayStr),
      gte(trainingBlocks.endDate, todayStr)
    ),
  });

  const totalMiles = weekWorkouts.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0);
  const completedMiles = weekWorkouts
    .filter((w: PlannedWorkout) => w.status === 'completed')
    .reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0);

  return {
    has_plan: true,
    week_start: mondayStr,
    week_end: sundayStr,
    phase: currentBlock?.phase || null,
    focus: currentBlock?.focus || null,
    target_mileage: totalMiles,
    completed_mileage: completedMiles,
    workouts: weekWorkouts.map(w => ({
      date: w.date,
      day: new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      name: w.name,
      workout_type: w.workoutType,
      target_miles: w.targetDistanceMiles,
      target_pace: w.targetPaceSecondsPerMile
        ? formatPaceFromTraining(w.targetPaceSecondsPerMile)
        : null,
      is_key: w.isKeyWorkout,
      status: w.status,
      is_today: w.date === todayStr,
    })),
  };
}

async function getPaceZones() {
  const s = await getSettingsForProfile();

  if (!s?.vdot) {
    return {
      has_zones: false,
      message: 'No pace zones set. Add a race result to calculate your VDOT and pace zones.',
    };
  }

  const zones = calculatePaceZones(s.vdot);

  return {
    has_zones: true,
    vdot: s.vdot,
    zones: {
      easy: {
        pace: formatPaceFromTraining(zones.easy),
        description: 'Conversational pace. Should feel comfortable and sustainable.',
      },
      marathon: {
        pace: formatPaceFromTraining(zones.marathon),
        description: 'Marathon race pace. Steady, focused effort.',
      },
      half_marathon: {
        pace: formatPaceFromTraining(zones.halfMarathon),
        description: 'Half marathon race pace. Comfortably hard.',
      },
      tempo: {
        pace: formatPaceFromTraining(zones.tempo),
        description: 'Tempo pace. Sustainable for 40-60 minutes. Controlled discomfort.',
      },
      threshold: {
        pace: formatPaceFromTraining(zones.threshold),
        description: 'Lactate threshold. Can speak in short sentences.',
      },
      interval: {
        pace: formatPaceFromTraining(zones.interval),
        description: 'VO2max intervals. Hard but controlled. 3-5 min efforts.',
      },
      repetition: {
        pace: formatPaceFromTraining(zones.repetition),
        description: 'Fast repeats. 200-400m efforts with full recovery.',
      },
    },
  };
}

async function modifyTodaysWorkout(input: Record<string, unknown>) {
  const { plannedWorkouts } = await import('@/lib/db');

  const action = input.action as 'scale_down' | 'skip' | 'mark_complete';
  const scaleFactor = (input.scale_factor as number) || 0.75;
  const reason = input.reason as string | undefined;
  const isPreview = input.preview === true;

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return { error: 'No planned workout for today.' };
  }

  // Calculate what would change for preview
  const newDistance = workout.targetDistanceMiles
    ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
    : null;
  const newDuration = workout.targetDurationMinutes
    ? Math.round(workout.targetDurationMinutes * scaleFactor)
    : null;

  // If preview mode, return what would change without applying
  if (isPreview) {
    switch (action) {
      case 'scale_down':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be scaled:`,
          changes: [
            workout.targetDistanceMiles
              ? `• Distance: ${workout.targetDistanceMiles} mi → ${newDistance} mi (${Math.round(scaleFactor * 100)}%)`
              : null,
            workout.targetDurationMinutes
              ? `• Duration: ${workout.targetDurationMinutes} min → ${newDuration} min`
              : null,
          ].filter(Boolean),
          workout: {
            id: workout.id,
            name: workout.name,
            current: {
              distance: workout.targetDistanceMiles,
              duration: workout.targetDurationMinutes,
            },
            proposed: {
              distance: newDistance,
              duration: newDuration,
            },
          },
          confirm_prompt: 'Would you like me to apply this modification?',
        };

      case 'skip':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be marked as skipped.`,
          changes: [
            `• Status: scheduled → skipped`,
            reason ? `• Reason: ${reason}` : null,
          ].filter(Boolean),
          workout: {
            id: workout.id,
            name: workout.name,
            type: workout.workoutType,
            distance: workout.targetDistanceMiles,
          },
          confirm_prompt: 'Would you like me to skip this workout?',
        };

      case 'mark_complete':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be marked as complete.`,
          changes: [`• Status: scheduled → completed`],
          workout: {
            id: workout.id,
            name: workout.name,
          },
          confirm_prompt: 'Would you like me to mark this workout as complete?',
        };

      default:
        return { error: 'Unknown action' };
    }
  }

  // Apply the changes
  const now = new Date().toISOString();

  switch (action) {
    case 'scale_down':
      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          targetDurationMinutes: newDuration,
          rationale: `${workout.rationale || ''} (Scaled to ${Math.round(scaleFactor * 100)}%${reason ? ': ' + reason : ''})`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      await recordCoachAction({
        actionType: 'workout_adjustment',
        description: `Scaled today's workout "${workout.name}" to ${Math.round(scaleFactor * 100)}%${reason ? ': ' + reason : ''}`,
        dataSnapshot: {
          action: 'scale_down',
          workoutId: workout.id,
          workoutName: workout.name,
          workoutDate: workout.date,
          originalDistance: workout.targetDistanceMiles,
          proposedDistance: newDistance,
          originalDuration: workout.targetDurationMinutes,
          proposedDuration: newDuration,
          scaleFactor,
        },
      });

      return {
        success: true,
        message: `Workout scaled to ${Math.round(scaleFactor * 100)}%`,
        new_distance: newDistance,
      };

    case 'skip':
      await db.update(plannedWorkouts)
        .set({
          status: 'skipped',
          rationale: `${workout.rationale || ''} (Skipped${reason ? ': ' + reason : ''})`,
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      await recordCoachAction({
        actionType: 'schedule_change',
        description: `Skipped today's workout "${workout.name}"${reason ? ': ' + reason : ''}`,
        dataSnapshot: {
          action: 'skip',
          workoutId: workout.id,
          workoutName: workout.name,
          workoutDate: workout.date,
        },
      });

      return {
        success: true,
        message: 'Workout marked as skipped',
        note: 'Listen to your body. We\'ll adjust the plan as needed.',
      };

    case 'mark_complete':
      await db.update(plannedWorkouts)
        .set({
          status: 'completed',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      return {
        success: true,
        message: 'Workout marked as complete!',
      };

    default:
      return { error: 'Unknown action' };
  }
}

async function getPlanAdherence(input: Record<string, unknown>) {
  const { plannedWorkouts } = await import('@/lib/db');
  const weeksBack = (input.weeks_back as number) || 4;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get date range for analysis
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeksBack * 7));
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all workouts in the period (past only)
  const periodWorkouts: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startDateStr),
      lte(plannedWorkouts.date, todayStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (periodWorkouts.length === 0) {
    return {
      has_data: false,
      message: 'No planned workouts in this period.',
    };
  }

  // Calculate adherence stats
  const completed = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'completed');
  const skipped = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'skipped');
  const modified = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'modified');
  const pending = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'scheduled' || w.status === null);

  const adherenceRate = Math.round((completed.length / periodWorkouts.length) * 100);

  // Analyze patterns
  const keyWorkouts = periodWorkouts.filter((w: PlannedWorkout) => w.isKeyWorkout);
  const keyCompleted = keyWorkouts.filter((w: PlannedWorkout) => w.status === 'completed');
  const keyAdherence = keyWorkouts.length > 0
    ? Math.round((keyCompleted.length / keyWorkouts.length) * 100)
    : null;

  // Check for concerning patterns
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Multiple skips in a row
  let consecutiveSkips = 0;
  let maxConsecutiveSkips = 0;
  for (const workout of periodWorkouts) {
    if (workout.status === 'skipped') {
      consecutiveSkips++;
      maxConsecutiveSkips = Math.max(maxConsecutiveSkips, consecutiveSkips);
    } else {
      consecutiveSkips = 0;
    }
  }

  if (maxConsecutiveSkips >= 3) {
    concerns.push(`Skipped ${maxConsecutiveSkips} workouts in a row - may indicate burnout or life stress`);
    recommendations.push('Consider reducing weekly volume temporarily');
  }

  // Missing key workouts
  if (keyAdherence !== null && keyAdherence < 70) {
    concerns.push(`Only completed ${keyAdherence}% of key workouts`);
    recommendations.push('Key workouts are most important for fitness gains - prioritize these');
  }

  // Low overall adherence
  if (adherenceRate < 60) {
    concerns.push(`Overall adherence at ${adherenceRate}% is below recommended 80%`);
    recommendations.push('The plan may be too aggressive - consider reducing weekly mileage target');
  }

  // Skipping pattern by day of week
  const skipsByDay: Record<string, number> = {};
  for (const workout of skipped) {
    const dayOfWeek = new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    skipsByDay[dayOfWeek] = (skipsByDay[dayOfWeek] || 0) + 1;
  }

  const mostSkippedDay = Object.entries(skipsByDay).sort((a, b) => b[1] - a[1])[0];
  if (mostSkippedDay && mostSkippedDay[1] >= 2) {
    concerns.push(`${mostSkippedDay[0]} workouts frequently skipped (${mostSkippedDay[1]} times)`);
    recommendations.push(`Consider moving workouts away from ${mostSkippedDay[0]} or making them optional`);
  }

  // Good adherence congratulations
  const positives: string[] = [];
  if (adherenceRate >= 90) {
    positives.push('Excellent adherence! Consistency is paying off.');
  } else if (adherenceRate >= 80) {
    positives.push('Strong adherence rate - keep it up!');
  }

  if (keyAdherence && keyAdherence >= 90) {
    positives.push('Great job prioritizing key workouts.');
  }

  return {
    has_data: true,
    period: {
      start: startDateStr,
      end: todayStr,
      weeks: weeksBack,
    },
    stats: {
      total_workouts: periodWorkouts.length,
      completed: completed.length,
      skipped: skipped.length,
      modified: modified.length,
      pending: pending.length,
      adherence_rate: adherenceRate,
      key_workout_adherence: keyAdherence,
    },
    analysis: {
      concerns: concerns.length > 0 ? concerns : null,
      recommendations: recommendations.length > 0 ? recommendations : null,
      positives: positives.length > 0 ? positives : null,
    },
    by_workout_type: groupByWorkoutType(periodWorkouts),
  };
}

export {
  getTodaysWorkout,
  getWeeklyPlan,
  getPaceZones,
  modifyTodaysWorkout,
  getPlanAdherence,
};
