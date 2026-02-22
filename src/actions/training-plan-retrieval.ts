'use server';

import { db, races, trainingBlocks, plannedWorkouts, PlannedWorkout, userSettings } from '@/lib/db';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import { parseLocalDate } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';
import { extendWindowIfNeeded } from './training-plan-generation';

// ==================== Plan Retrieval ====================

/**
 * Get the training plan for a race.
 */
export async function getTrainingPlan(raceId: number) {
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return null;
  }

  const blocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
    orderBy: [asc(trainingBlocks.startDate)],
  });

  // Get all planned workouts for each block
  const workoutsByBlock: Record<number, typeof plannedWorkouts.$inferSelect[]> = {};

  for (const block of blocks) {
    const blockWorkouts = await db.query.plannedWorkouts.findMany({
      where: eq(plannedWorkouts.trainingBlockId, block.id),
      orderBy: [asc(plannedWorkouts.date)],
    });
    workoutsByBlock[block.id] = blockWorkouts;
  }

  return {
    race,
    blocks,
    workoutsByBlock,
  };
}

/**
 * Get the current week's plan.
 */
export async function getCurrentWeekPlan() {
  // Auto-extend window if needed
  await extendWindowIfNeeded();

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

  // Get today's workout
  const todaysWorkout = weekWorkouts.find((w: PlannedWorkout) => w.date === todayStr);

  // Get the current training block
  const currentBlock = await db.query.trainingBlocks.findFirst({
    where: and(
      lte(trainingBlocks.startDate, todayStr),
      gte(trainingBlocks.endDate, todayStr)
    ),
  });

  return {
    weekStart: mondayStr,
    weekEnd: sundayStr,
    workouts: weekWorkouts,
    todaysWorkout,
    currentBlock,
    totalMiles: weekWorkouts.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
    completedMiles: weekWorkouts
      .filter((w: PlannedWorkout) => w.status === 'completed')
      .reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
  };
}

/**
 * Get today's planned workout.
 */
export async function getTodaysWorkout() {
  // Auto-extend window if needed
  await extendWindowIfNeeded();

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return null;
  }

  // Get the training block for phase info
  let block = null;
  if (workout.trainingBlockId) {
    block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
  }

  return {
    ...workout,
    phase: block?.phase,
    phaseFocus: block?.focus,
  };
}

/**
 * Get training summary for the coach.
 */
export async function getTrainingSummary() {
  const profileId = await getActiveProfileId();
  const weekPlan = await getCurrentWeekPlan();
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });

  // Get upcoming races
  const today = new Date().toISOString().split('T')[0];
  const upcomingRaces = await db.query.races.findMany({
    where: gte(races.date, today),
    orderBy: [asc(races.date)],
  });

  const nextRace = upcomingRaces[0];
  let daysUntilRace: number | null = null;

  if (nextRace) {
    const raceDate = parseLocalDate(nextRace.date);
    const todayDate = new Date(today);
    daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    currentWeek: weekPlan,
    currentPhase: weekPlan.currentBlock?.phase || null,
    phaseFocus: weekPlan.currentBlock?.focus || null,
    nextRace: nextRace ? {
      name: nextRace.name,
      date: nextRace.date,
      distance: nextRace.distanceLabel,
      daysUntil: daysUntilRace,
    } : null,
    vdot: settings?.vdot,
    weeklyMileageTarget: weekPlan.totalMiles,
    weeklyMileageCompleted: weekPlan.completedMiles,
  };
}
