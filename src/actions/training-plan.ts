'use server';

import { db, races, trainingBlocks, plannedWorkouts, PlannedWorkout } from '@/lib/db';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateTrainingPlan } from '@/lib/training/plan-generator';
import { calculatePaceZones } from '@/lib/training/vdot-calculator';
import type { PlanGenerationInput, GeneratedPlan } from '@/lib/training/types';
import type { Race } from '@/lib/schema';
import { parseLocalDate } from '@/lib/utils';

// ==================== Plan Generation ====================

/**
 * Generate a training plan for a race.
 */
export async function generatePlanForRace(raceId: number): Promise<GeneratedPlan> {
  // Get race details
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    throw new Error('Race not found');
  }

  // Get user settings
  const settings = await db.query.userSettings.findFirst();
  if (!settings) {
    throw new Error('User settings not found. Please complete onboarding first.');
  }

  // Validate we have minimum required data
  if (!settings.currentWeeklyMileage) {
    throw new Error('Please set your current weekly mileage in settings.');
  }

  // Fetch ALL races to determine start date and incorporate B/C races
  const allRaces = await db.query.races.findMany({
    orderBy: asc(races.date),
  });

  // Find the correct start date:
  // - If there's an A race before this one, start after that race (+ 2 weeks recovery)
  // - Otherwise start from today
  const targetRaceDate = parseLocalDate(race.date);
  const today = new Date();
  let planStartDate = today;

  // Find prior A races (races before this one with priority 'A')
  const priorARaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return r.priority === 'A' && rDate < targetRaceDate && r.id !== race.id;
  });

  if (priorARaces.length > 0) {
    // Start 2 weeks after the most recent prior A race
    const lastPriorARace = priorARaces[priorARaces.length - 1];
    const recoveryStart = parseLocalDate(lastPriorARace.date);
    recoveryStart.setDate(recoveryStart.getDate() + 14); // 2 weeks recovery

    // Use the later of: recovery start or today
    if (recoveryStart > today) {
      planStartDate = recoveryStart;
    }
  }

  // Find B/C races that fall within the plan timeframe
  const intermediateRaces = allRaces.filter((r: Race) => {
    const rDate = parseLocalDate(r.date);
    return (r.priority === 'B' || r.priority === 'C') &&
           rDate > planStartDate &&
           rDate < targetRaceDate &&
           r.id !== race.id;
  }).map((r: Race) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    distanceMeters: r.distanceMeters,
    distanceLabel: r.distanceLabel,
    priority: r.priority as 'B' | 'C',
  }));

  // Build plan generation input
  const paceZones = settings.vdot ? calculatePaceZones(settings.vdot) : undefined;

  // Build athlete profile from extended settings
  const athleteProfile = {
    comfortVO2max: settings.comfortVO2max ?? undefined,
    comfortTempo: settings.comfortTempo ?? undefined,
    comfortHills: settings.comfortHills ?? undefined,
    comfortLongRuns: settings.comfortLongRuns ?? undefined,
    comfortTrackWork: settings.comfortTrackWork ?? undefined,
    yearsRunning: settings.yearsRunning ?? undefined,
    speedworkExperience: settings.speedworkExperience as 'none' | 'beginner' | 'intermediate' | 'advanced' | undefined,
    highestWeeklyMileageEver: settings.highestWeeklyMileageEver ?? undefined,
    needsExtraRest: settings.needsExtraRest ?? undefined,
    stressLevel: settings.stressLevel as 'low' | 'moderate' | 'high' | 'very_high' | undefined,
    commonInjuries: settings.commonInjuries ? JSON.parse(settings.commonInjuries) : undefined,
    weekdayAvailabilityMinutes: settings.weekdayAvailabilityMinutes ?? undefined,
    weekendAvailabilityMinutes: settings.weekendAvailabilityMinutes ?? undefined,
    trainBy: settings.trainBy as 'pace' | 'heart_rate' | 'feel' | 'mixed' | undefined,
    heatSensitivity: settings.heatSensitivity ?? undefined,
  };

  const input: PlanGenerationInput = {
    currentWeeklyMileage: settings.currentWeeklyMileage,
    peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget || Math.round(settings.currentWeeklyMileage * 1.5),
    currentLongRunMax: settings.currentLongRunMax || undefined,
    runsPerWeek: settings.runsPerWeekTarget || settings.runsPerWeekCurrent || 5,
    preferredLongRunDay: settings.preferredLongRunDay || 'sunday',
    preferredQualityDays: settings.preferredQualityDays
      ? JSON.parse(settings.preferredQualityDays)
      : ['tuesday', 'thursday'],
    requiredRestDays: settings.requiredRestDays
      ? JSON.parse(settings.requiredRestDays)
      : [],
    planAggressiveness: settings.planAggressiveness || 'moderate',
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek || 2,
    raceId: race.id,
    raceDate: race.date,
    raceDistanceMeters: race.distanceMeters,
    raceDistanceLabel: race.distanceLabel,
    vdot: settings.vdot ?? undefined,
    paceZones,
    startDate: planStartDate.toISOString().split('T')[0],
    intermediateRaces, // B/C races to incorporate
    athleteProfile, // Extended profile for intelligent workout selection
  };

  // Generate the plan
  const plan = generateTrainingPlan(input);
  plan.raceName = race.name;

  // Save to database
  await savePlanToDatabase(plan, race.id);

  // Mark race as having a training plan
  await db.update(races)
    .set({ trainingPlanGenerated: true, updatedAt: new Date().toISOString() })
    .where(eq(races.id, raceId));

  revalidatePath('/plan');
  revalidatePath('/races');
  revalidatePath('/today');

  return plan;
}

/**
 * Save generated plan to database.
 */
async function savePlanToDatabase(plan: GeneratedPlan, raceId: number) {
  const now = new Date().toISOString();

  // Delete existing training blocks and planned workouts for this race
  const existingBlocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
  });

  for (const block of existingBlocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }

  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

  // Create training blocks for each phase/week
  const blockIds: Record<string, number[]> = {};

  for (const phase of plan.phases) {
    blockIds[phase.phase] = [];
    const phaseWeeks = plan.weeks.filter(w => w.phase === phase.phase);

    for (const week of phaseWeeks) {
      const [block] = await db.insert(trainingBlocks).values({
        raceId,
        name: `${phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1)} - Week ${week.weekNumber}`,
        phase: phase.phase,
        startDate: week.startDate,
        endDate: week.endDate,
        weekNumber: week.weekNumber,
        targetMileage: week.targetMileage,
        focus: week.focus,
        createdAt: now,
      }).returning();

      blockIds[phase.phase].push(block.id);
    }
  }

  // Create planned workouts
  for (const week of plan.weeks) {
    // Find the block for this week
    const phaseBlocks = blockIds[week.phase] || [];
    const weekIndex = plan.weeks.filter(w => w.phase === week.phase && w.weekNumber <= week.weekNumber).length - 1;
    const blockId = phaseBlocks[weekIndex];

    if (!blockId) {
      continue;
    }

    for (const workout of week.workouts) {
      // Map plan workout types to schema workout types
      const workoutTypeMap: Record<string, 'easy' | 'steady' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | 'cross_train' | 'other'> = {
        'easy': 'easy',
        'long': 'long',
        'quality': 'tempo', // Quality workouts default to tempo
        'rest': 'recovery',
        'tempo': 'tempo',
        'threshold': 'tempo',
        'interval': 'interval',
        'race': 'race',
      };

      await db.insert(plannedWorkouts).values({
        raceId: raceId,
        trainingBlockId: blockId,
        date: workout.date,
        templateId: null, // TODO: Map workout.templateId to correct DB template IDs
        workoutType: workoutTypeMap[workout.workoutType] || 'other',
        name: workout.name,
        description: workout.description,
        targetDistanceMiles: workout.targetDistanceMiles ?? null,
        targetDurationMinutes: workout.targetDurationMinutes ?? null,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile ?? null,
        structure: workout.structure ? JSON.stringify(workout.structure) : null,
        rationale: workout.rationale,
        isKeyWorkout: workout.isKeyWorkout,
        alternatives: workout.alternatives ? JSON.stringify(workout.alternatives) : null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

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

// ==================== Plan Modification ====================

/**
 * Update a planned workout status.
 */
export async function updatePlannedWorkoutStatus(
  workoutId: number,
  status: 'scheduled' | 'completed' | 'skipped' | 'modified'
) {
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({ status, updatedAt: now })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Link a completed workout to a planned workout.
 */
export async function linkWorkoutToPlanned(workoutId: number, plannedWorkoutId: number) {
  // This would update the workouts table's plannedWorkoutId field
  // Implementation depends on your workouts schema
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({ status: 'completed', updatedAt: now })
    .where(eq(plannedWorkouts.id, plannedWorkoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Scale down a planned workout.
 */
export async function scaleDownPlannedWorkout(workoutId: number, factor: number = 0.75) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      targetDistanceMiles: workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * factor * 10) / 10
        : null,
      targetDurationMinutes: workout.targetDurationMinutes
        ? Math.round(workout.targetDurationMinutes * factor)
        : null,
      rationale: `${workout.rationale} (scaled to ${Math.round(factor * 100)}%)`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

/**
 * Swap a planned workout with an alternative.
 */
export async function swapPlannedWorkout(workoutId: number, alternativeTemplateId: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  // Get the alternative template
  const { getWorkoutTemplate } = await import('@/lib/training/workout-templates');
  const template = getWorkoutTemplate(alternativeTemplateId);

  if (!template) {
    throw new Error('Alternative template not found');
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      templateId: template.id,
      name: template.name,
      description: template.description,
      structure: JSON.stringify(template.structure),
      rationale: `Swapped from ${workout.name}: ${template.purpose}`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');
}

// ==================== Coach Tools ====================

/**
 * Move a planned workout to a different date.
 */
export async function movePlannedWorkout(workoutId: number, newDate: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();

  // Check if there's already a workout on the target date
  const existingWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, newDate),
  });

  if (existingWorkout && existingWorkout.id !== workoutId) {
    // Swap the dates
    await db.update(plannedWorkouts)
      .set({ date: workout.date, updatedAt: now })
      .where(eq(plannedWorkouts.id, existingWorkout.id));
  }

  await db.update(plannedWorkouts)
    .set({
      date: newDate,
      rationale: workout.rationale
        ? `${workout.rationale} (moved from ${workout.date})`
        : `Moved from ${workout.date}`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Get alternative workouts for a planned workout.
 */
export async function getWorkoutAlternatives(workoutId: number) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  // Get the current phase for phase-appropriate alternatives
  let currentPhase = 'build';
  if (workout.trainingBlockId) {
    const block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
    if (block) {
      currentPhase = block.phase;
    }
  }

  // Parse stored alternatives if any
  const storedAlternatives = workout.alternatives
    ? JSON.parse(workout.alternatives) as string[]
    : [];

  // Get templates for alternatives
  const { getWorkoutTemplate, getTemplatesByCategory } = await import('@/lib/training/workout-templates');

  const alternatives = storedAlternatives.map(id => getWorkoutTemplate(id)).filter(Boolean);

  // If no stored alternatives, suggest some based on workout type
  if (alternatives.length === 0) {
    const category = workout.workoutType === 'tempo' || workout.workoutType === 'interval'
      ? 'threshold'
      : workout.workoutType === 'long'
        ? 'long'
        : 'easy';

    const categoryWorkouts = getTemplatesByCategory(category);
    alternatives.push(...categoryWorkouts.slice(0, 3));
  }

  return {
    workout,
    alternatives,
    currentPhase,
  };
}

/**
 * Delete a planned workout (convert to rest day).
 */
export async function deletePlannedWorkout(workoutId: number) {
  await db.delete(plannedWorkouts).where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Add a note to a planned workout.
 */
export async function addWorkoutNote(workoutId: number, note: string) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();
  const updatedRationale = workout.rationale
    ? `${workout.rationale}\n\nNote: ${note}`
    : `Note: ${note}`;

  await db.update(plannedWorkouts)
    .set({
      rationale: updatedRationale,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  revalidatePath('/plan');
  revalidatePath('/today');

  return { success: true };
}

/**
 * Get training summary for the coach.
 */
export async function getTrainingSummary() {
  const weekPlan = await getCurrentWeekPlan();
  const settings = await db.query.userSettings.findFirst();

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

// ==================== Reset Functions ====================

/**
 * Reset (delete) the training plan for a specific race.
 * Does NOT delete completed workouts - only planned workouts.
 */
export async function resetTrainingPlanForRace(raceId: number) {
  // Get all training blocks for this race
  const blocks = await db.query.trainingBlocks.findMany({
    where: eq(trainingBlocks.raceId, raceId),
  });

  // Delete planned workouts for each block (preserves completed workout links)
  for (const block of blocks) {
    await db.delete(plannedWorkouts).where(eq(plannedWorkouts.trainingBlockId, block.id));
  }

  // Delete the training blocks
  await db.delete(trainingBlocks).where(eq(trainingBlocks.raceId, raceId));

  // Mark the race as not having a generated plan
  await db.update(races)
    .set({ trainingPlanGenerated: false, updatedAt: new Date().toISOString() })
    .where(eq(races.id, raceId));

  revalidatePath('/plan');
  revalidatePath('/today');
  revalidatePath('/races');

  return { success: true };
}

/**
 * Reset ALL training plans (for all races).
 * Does NOT delete completed workouts or race results.
 */
export async function resetAllTrainingPlans() {
  // Delete all planned workouts
  await db.delete(plannedWorkouts);

  // Delete all training blocks
  await db.delete(trainingBlocks);

  // Mark all races as not having generated plans
  await db.update(races)
    .set({ trainingPlanGenerated: false, updatedAt: new Date().toISOString() });

  revalidatePath('/plan');
  revalidatePath('/today');
  revalidatePath('/races');

  return { success: true };
}
