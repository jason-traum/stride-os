// schedule-tools - Coach tool implementations
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


async function getTodaysPlannedWorkout() {
  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return {
      found: false,
      message: 'No planned workout for today.',
    };
  }

  return {
    found: true,
    workout: {
      id: workout.id,
      date: workout.date,
      name: workout.name,
      workout_type: workout.workoutType,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace_seconds_per_mile: workout.targetPaceSecondsPerMile,
      rationale: workout.rationale,
      is_key_workout: workout.isKeyWorkout,
      status: workout.status,
      structure: workout.structure ? JSON.parse(workout.structure) : null,
    },
  };
}

async function getPlannedWorkoutByDate(input: Record<string, unknown>) {
  let dateStr = input.date as string;

  // Handle "tomorrow" conversion
  if (dateStr === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateStr = tomorrow.toISOString().split('T')[0];
  }

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, dateStr),
  });

  if (!workout) {
    const notFoundResult = {
      found: false,
      date: dateStr,
      message: `No planned workout for ${dateStr}.`,
      suggestion: 'Use suggest_next_workout or prescribe_workout to get a workout recommendation.',
    };
    return notFoundResult;
  }

  const formatPace = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const result = {
    found: true,
    date: dateStr,
    workout: {
      id: workout.id,
      date: workout.date,
      name: workout.name,
      workout_type: workout.workoutType,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace: workout.targetPaceSecondsPerMile ? formatPace(workout.targetPaceSecondsPerMile) : null,
      rationale: workout.rationale,
      is_key_workout: workout.isKeyWorkout,
      status: workout.status,
      structure: workout.structure ? JSON.parse(workout.structure) : null,
    },
    message: `${workout.name} planned for ${dateStr}`,
  };

  return result;
}

async function updatePlannedWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const isPreview = input.preview === true;

  const existing = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!existing) {
    return { success: false, error: 'Planned workout not found' };
  }

  // Build the updates
  const updates: Record<string, unknown> = {};
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  if (input.name && input.name !== existing.name) {
    updates.name = input.name;
    changes.push({ field: 'name', from: existing.name, to: input.name });
  }
  if (input.description && input.description !== existing.description) {
    updates.description = input.description;
    changes.push({ field: 'description', from: existing.description?.substring(0, 50) + '...', to: (input.description as string).substring(0, 50) + '...' });
  }
  if (input.target_distance_miles && input.target_distance_miles !== existing.targetDistanceMiles) {
    updates.targetDistanceMiles = input.target_distance_miles;
    changes.push({ field: 'distance', from: `${existing.targetDistanceMiles} mi`, to: `${input.target_distance_miles} mi` });
  }
  if (input.workout_type && input.workout_type !== existing.workoutType) {
    updates.workoutType = input.workout_type;
    changes.push({ field: 'type', from: existing.workoutType, to: input.workout_type });
  }
  if (input.rationale) {
    updates.rationale = input.rationale;
  }

  if (input.target_pace_per_mile) {
    const paceStr = input.target_pace_per_mile as string;
    const [mins, secs] = paceStr.split(':').map(Number);
    const newPace = mins * 60 + (secs || 0);
    if (newPace !== existing.targetPaceSecondsPerMile) {
      updates.targetPaceSecondsPerMile = newPace;
      const oldPace = existing.targetPaceSecondsPerMile
        ? formatPaceFromTraining(existing.targetPaceSecondsPerMile)
        : 'none';
      changes.push({ field: 'pace', from: oldPace, to: paceStr });
    }
  }

  // If preview mode, return what would change without applying
  if (isPreview) {
    if (changes.length === 0) {
      return {
        success: true,
        preview: true,
        message: 'No changes detected - workout already matches the requested values.',
        workout: {
          id: existing.id,
          name: existing.name,
          date: existing.date,
        },
      };
    }

    return {
      success: true,
      preview: true,
      message: `Preview: The following changes would be applied to "${existing.name}" on ${existing.date}:`,
      changes: changes.map(c => `• ${c.field}: ${c.from} → ${c.to}`),
      workout: {
        id: existing.id,
        name: existing.name,
        date: existing.date,
        current: {
          name: existing.name,
          type: existing.workoutType,
          distance: existing.targetDistanceMiles,
          pace: existing.targetPaceSecondsPerMile,
        },
        proposed: {
          name: updates.name || existing.name,
          type: updates.workoutType || existing.workoutType,
          distance: updates.targetDistanceMiles || existing.targetDistanceMiles,
          pace: updates.targetPaceSecondsPerMile || existing.targetPaceSecondsPerMile,
        },
      },
      confirm_prompt: 'Would you like me to apply these changes?',
    };
  }

  // Apply the changes
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    await db.update(plannedWorkouts)
      .set(updates)
      .where(eq(plannedWorkouts.id, workoutId));

    // Record in coach actions audit log
    await recordCoachAction({
      actionType: 'workout_adjustment',
      description: `Updated ${existing.name} on ${existing.date}: ${changes.map(c => `${c.field} ${c.from} -> ${c.to}`).join(', ')}`,
      dataSnapshot: {
        workoutId,
        workoutName: existing.name,
        workoutDate: existing.date,
        changes,
      },
    });
  }

  return {
    success: true,
    message: `Updated planned workout: ${updates.name || existing.name}`,
    updated_fields: Object.keys(updates).filter(k => k !== 'updatedAt'),
  };
}

async function suggestWorkoutModification(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const reason = input.reason as string;
  const suggestedChange = input.suggested_change as string;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  return {
    success: true,
    original_workout: {
      id: workout.id,
      name: workout.name,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
    },
    suggestion: {
      reason,
      suggested_change: suggestedChange,
    },
    message: `Suggestion for ${workout.name}: ${suggestedChange} (Reason: ${reason}). Would you like me to make this change?`,
  };
}

async function swapWorkouts(input: Record<string, unknown>) {
  const workoutId1 = input.workout_id_1 as number;
  const workoutId2 = input.workout_id_2 as number;
  const reason = input.reason as string | undefined;
  const isPreview = input.preview === true;

  const workout1 = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId1),
  });

  const workout2 = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId2),
  });

  if (!workout1 || !workout2) {
    return {
      success: false,
      error: `Workout not found: ${!workout1 ? workoutId1 : workoutId2}`
    };
  }

  const date1 = workout1.date;
  const date2 = workout2.date;

  // Format dates for display
  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // If preview mode, return what would change without applying
  if (isPreview) {
    return {
      success: true,
      preview: true,
      message: `Preview: The following swap would be applied:`,
      changes: [
        `• ${workout1.name}: ${formatDate(date1)} → ${formatDate(date2)}`,
        `• ${workout2.name}: ${formatDate(date2)} → ${formatDate(date1)}`,
      ],
      workout_1: {
        id: workout1.id,
        name: workout1.name,
        type: workout1.workoutType,
        current_date: date1,
        proposed_date: date2,
      },
      workout_2: {
        id: workout2.id,
        name: workout2.name,
        type: workout2.workoutType,
        current_date: date2,
        proposed_date: date1,
      },
      confirm_prompt: 'Would you like me to swap these workouts?',
    };
  }

  // Apply the swap
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      date: date2,
      rationale: `${workout1.rationale || ''} (Swapped with ${workout2.name}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId1));

  await db.update(plannedWorkouts)
    .set({
      date: date1,
      rationale: `${workout2.rationale || ''} (Swapped with ${workout1.name}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId2));

  return {
    success: true,
    message: `Swapped workouts: ${workout1.name} (now ${formatDate(date2)}) ↔ ${workout2.name} (now ${formatDate(date1)})`,
    workout_1: {
      id: workout1.id,
      name: workout1.name,
      original_date: date1,
      new_date: date2,
    },
    workout_2: {
      id: workout2.id,
      name: workout2.name,
      original_date: date2,
      new_date: date1,
    },
  };
}

async function rescheduleWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const newDate = input.new_date as string;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const originalDate = workout.date;
  const now = new Date().toISOString();

  // Check if there's already a workout on the target date
  const existingOnNewDate = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, newDate),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  await db.update(plannedWorkouts)
    .set({
      date: newDate,
      rationale: `${workout.rationale || ''} (Moved from ${originalDate}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  await recordCoachAction({
    actionType: 'schedule_change',
    description: `Moved "${workout.name}" from ${originalDate} to ${newDate}${reason ? ': ' + reason : ''}`,
    dataSnapshot: {
      workoutId: workout.id,
      workoutName: workout.name,
      originalDate,
      newDate,
    },
  });

  return {
    success: true,
    message: `Moved ${workout.name} from ${originalDate} to ${newDate}`,
    workout: {
      id: workout.id,
      name: workout.name,
      original_date: originalDate,
      new_date: newDate,
    },
    warning: existingOnNewDate
      ? `Note: There's already a ${existingOnNewDate.name} scheduled for ${newDate}. You may want to swap or reschedule that one too.`
      : undefined,
  };
}

async function skipWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      status: 'skipped',
      rationale: `${workout.rationale || ''} (Skipped${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  await recordCoachAction({
    actionType: 'schedule_change',
    description: `Skipped "${workout.name}" on ${workout.date}${reason ? ': ' + reason : ''}`,
    dataSnapshot: {
      action: 'skip',
      workoutId: workout.id,
      workoutName: workout.name,
      workoutDate: workout.date,
    },
  });

  return {
    success: true,
    message: `Skipped ${workout.name} on ${workout.date}`,
    workout: {
      id: workout.id,
      name: workout.name,
      date: workout.date,
      was_key_workout: workout.isKeyWorkout,
    },
    note: workout.isKeyWorkout
      ? "This was a key workout. If possible, consider rescheduling rather than skipping entirely."
      : "One day won't break your training. Listen to your body.",
  };
}

async function getWeekWorkouts(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) || 0;

  // Calculate the start and end of the target week
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get to Monday

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const workoutsForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  const formatPace = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    week_start: startStr,
    week_end: endStr,
    week_offset: weekOffset,
    workouts: workoutsForWeek.map((w: PlannedWorkout) => ({
      id: w.id,
      date: w.date,
      day_of_week: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      name: w.name,
      workout_type: w.workoutType,
      target_distance_miles: w.targetDistanceMiles,
      target_pace: formatPace(w.targetPaceSecondsPerMile),
      description: w.description,
      is_key_workout: w.isKeyWorkout,
      status: w.status,
    })),
    total_planned_miles: workoutsForWeek.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
  };
}

async function makeDownWeek(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) || 0;
  const reductionPercent = (input.reduction_percent as number) || 30;
  const keepLongRun = input.keep_long_run !== false; // default true
  const reason = input.reason as string | undefined;

  // Calculate the start and end of the target week
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const workoutsForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  if (workoutsForWeek.length === 0) {
    return { success: false, error: 'No scheduled workouts found for this week.' };
  }

  const now = new Date().toISOString();
  const scaleFactor = (100 - reductionPercent) / 100;
  const modifications: Array<{ name: string; change: string }> = [];

  for (const workout of workoutsForWeek) {
    const isLongRun = workout.workoutType === 'long';
    const isQuality = ['tempo', 'interval', 'threshold', 'fartlek'].includes(workout.workoutType);

    if (isLongRun && keepLongRun) {
      // Reduce long run distance but keep it
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          rationale: `${workout.rationale || ''} (Recovery week: reduced to ${Math.round(scaleFactor * 100)}%)`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Reduced from ${workout.targetDistanceMiles}mi to ${newDistance}mi`,
      });
    } else if (isQuality) {
      // Convert quality sessions to easy runs
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10 // 80% of original distance as easy
        : null;

      await db.update(plannedWorkouts)
        .set({
          name: 'Easy Run',
          workoutType: 'easy',
          targetDistanceMiles: newDistance,
          description: `Easy recovery run (originally: ${workout.name})`,
          rationale: `${workout.rationale || ''} (Recovery week: converted to easy)`,
          isKeyWorkout: false,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Converted to easy ${newDistance}mi`,
      });
    } else {
      // Easy runs - just reduce distance
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          rationale: `${workout.rationale || ''} (Recovery week)`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Reduced to ${newDistance}mi`,
      });
    }
  }

  const originalMiles = workoutsForWeek.reduce((sum: number, w: { targetDistanceMiles: number | null }) => sum + (w.targetDistanceMiles || 0), 0);

  // Recalculate after modifications
  const updatedWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
  });
  const newMiles = updatedWorkouts.reduce((sum: number, w: { targetDistanceMiles: number | null }) => sum + (w.targetDistanceMiles || 0), 0);

  await recordCoachAction({
    actionType: 'plan_modification',
    description: `Made week of ${startStr} a recovery week (${reductionPercent}% reduction)${reason ? ': ' + reason : ''}`,
    dataSnapshot: {
      weekStart: startStr,
      weekEnd: endStr,
      originalMiles: Math.round(originalMiles * 10) / 10,
      newMiles: Math.round(newMiles * 10) / 10,
      modifications,
      affectedWorkoutIds: workoutsForWeek.map((w: PlannedWorkout) => w.id),
    },
  });

  return {
    success: true,
    message: `Made week of ${startStr} a recovery week`,
    reason: reason || 'Recovery/down week',
    original_miles: Math.round(originalMiles * 10) / 10,
    new_miles: Math.round(newMiles * 10) / 10,
    reduction: `${reductionPercent}%`,
    modifications,
    note: 'Quality sessions converted to easy runs. This week is about recovery—listen to your body.',
  };
}

async function insertRestDay(input: Record<string, unknown>) {
  const date = input.date as string;
  const pushWorkouts = (input.push_workouts as boolean) || false;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, date),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  if (!workout) {
    return {
      success: true,
      message: `${date} is already a rest day (no workout scheduled).`,
    };
  }

  const now = new Date().toISOString();

  if (pushWorkouts) {
    // Get all workouts from this date to end of week and push them forward
    const workoutDate = new Date(date + 'T12:00:00');
    const dayOfWeek = workoutDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    const weekEnd = new Date(workoutDate);
    weekEnd.setDate(workoutDate.getDate() + daysUntilSunday);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const workoutsToShift = await db.query.plannedWorkouts.findMany({
      where: and(
        gte(plannedWorkouts.date, date),
        lte(plannedWorkouts.date, weekEndStr),
        eq(plannedWorkouts.status, 'scheduled')
      ),
      orderBy: [desc(plannedWorkouts.date)], // Process from end to avoid collisions
    });

    const shifted: string[] = [];
    for (const w of workoutsToShift) {
      const oldDate = new Date(w.date + 'T12:00:00');
      oldDate.setDate(oldDate.getDate() + 1);
      const newDate = oldDate.toISOString().split('T')[0];

      await db.update(plannedWorkouts)
        .set({
          date: newDate,
          rationale: `${w.rationale || ''} (Shifted +1 day${reason ? ': ' + reason : ''})`,
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, w.id));

      shifted.push(`${w.name}: ${w.date} → ${newDate}`);
    }

    return {
      success: true,
      message: `Inserted rest day on ${date}. Pushed ${workoutsToShift.length} workouts forward.`,
      reason,
      shifted_workouts: shifted,
      warning: 'Note: Workouts may now extend into next week. Review your schedule.',
    };
  } else {
    // Just skip the workout on this day
    await db.update(plannedWorkouts)
      .set({
        status: 'skipped',
        rationale: `${workout.rationale || ''} (Rest day inserted${reason ? ': ' + reason : ''})`,
        updatedAt: now,
      })
      .where(eq(plannedWorkouts.id, workout.id));

    return {
      success: true,
      message: `Made ${date} a rest day. Skipped: ${workout.name}`,
      skipped_workout: {
        name: workout.name,
        type: workout.workoutType,
        was_key_workout: workout.isKeyWorkout,
      },
      reason,
      note: workout.isKeyWorkout
        ? 'This was a key workout. Consider rescheduling it to another day if possible.'
        : 'Rest is part of training. You\'ll come back stronger.',
    };
  }
}

async function adjustWorkoutDistance(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const newDistance = input.new_distance_miles as number;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const oldDistance = workout.targetDistanceMiles;
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      targetDistanceMiles: newDistance,
      rationale: `${workout.rationale || ''} (Distance adjusted from ${oldDistance}mi to ${newDistance}mi${reason ? ': ' + reason : ''})`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  const changeDirection = newDistance > (oldDistance || 0) ? 'increased' : 'reduced';

  return {
    success: true,
    message: `${workout.name} on ${workout.date}: ${changeDirection} from ${oldDistance}mi to ${newDistance}mi`,
    workout: {
      id: workout.id,
      name: workout.name,
      date: workout.date,
      old_distance: oldDistance,
      new_distance: newDistance,
    },
  };
}

async function convertToEasy(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const keepDistance = input.keep_distance !== false; // default true
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  if (workout.workoutType === 'easy' || workout.workoutType === 'recovery') {
    return {
      success: true,
      message: `${workout.name} is already an easy/recovery run.`,
      no_change: true,
    };
  }

  const now = new Date().toISOString();
  const originalName = workout.name;
  const originalType = workout.workoutType;
  const newDistance = keepDistance
    ? workout.targetDistanceMiles
    : workout.targetDistanceMiles
      ? Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10
      : null;

  await db.update(plannedWorkouts)
    .set({
      name: 'Easy Run',
      workoutType: 'easy',
      targetDistanceMiles: newDistance,
      targetPaceSecondsPerMile: null, // Remove pace target for easy
      description: `Easy run (originally: ${originalName})`,
      rationale: `${workout.rationale || ''} (Converted to easy${reason ? ': ' + reason : ''})`,
      isKeyWorkout: false,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  await recordCoachAction({
    actionType: 'workout_adjustment',
    description: `Converted "${originalName}" to easy run on ${workout.date}${reason ? ': ' + reason : ''}`,
    dataSnapshot: {
      workoutId: workout.id,
      workoutName: originalName,
      workoutDate: workout.date,
      changes: [
        { field: 'type', from: originalType, to: 'easy' },
        { field: 'name', from: originalName, to: 'Easy Run' },
        ...(newDistance !== workout.targetDistanceMiles ? [{ field: 'distance', from: workout.targetDistanceMiles, to: newDistance }] : []),
      ],
    },
  });

  return {
    success: true,
    message: `Converted ${originalName} to easy ${newDistance}mi run`,
    original: {
      name: originalName,
      type: originalType,
      distance: workout.targetDistanceMiles,
    },
    new: {
      name: 'Easy Run',
      type: 'easy',
      distance: newDistance,
    },
    date: workout.date,
    note: 'Sometimes an easy day is the smartest workout. You\'ll absorb previous training better.',
  };
}

export {
  getTodaysPlannedWorkout,
  getPlannedWorkoutByDate,
  updatePlannedWorkout,
  suggestWorkoutModification,
  swapWorkouts,
  rescheduleWorkout,
  skipWorkout,
  getWeekWorkouts,
  makeDownWeek,
  insertRestDay,
  adjustWorkoutDistance,
  convertToEasy,
};
