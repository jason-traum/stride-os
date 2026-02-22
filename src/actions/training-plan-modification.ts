'use server';

import { db, races, trainingBlocks, plannedWorkouts } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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
 * Apply a smart workout audible modification.
 */
export async function applyAudible(
  workoutId: number,
  modification: {
    name?: string;
    workoutType?: string;
    targetDistanceMiles?: number | null;
    targetDurationMinutes?: number | null;
    targetPaceSecondsPerMile?: number | null;
    description?: string;
    rationale?: string;
  }
) {
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    throw new Error('Planned workout not found');
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: 'modified', updatedAt: now };

  if (modification.name !== undefined) update.name = modification.name;
  if (modification.workoutType !== undefined) update.workoutType = modification.workoutType;
  if ('targetDistanceMiles' in modification) update.targetDistanceMiles = modification.targetDistanceMiles;
  if ('targetDurationMinutes' in modification) update.targetDurationMinutes = modification.targetDurationMinutes;
  if ('targetPaceSecondsPerMile' in modification) update.targetPaceSecondsPerMile = modification.targetPaceSecondsPerMile;
  if (modification.description !== undefined) update.description = modification.description;
  if (modification.rationale !== undefined) update.rationale = modification.rationale;

  await db.update(plannedWorkouts)
    .set(update)
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

// ==================== Reset Functions ====================

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
