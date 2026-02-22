'use server';

import { db, workouts } from '@/lib/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getActiveProfileId } from '@/lib/profile-server';
import { scanActivities, type ScanResult } from '@/lib/training/activity-scanner';

/**
 * Scan all workouts for the active profile and return flagged activities.
 */
export async function scanWorkoutActivities(profileId?: number): Promise<ScanResult> {
  const pid = profileId ?? (await getActiveProfileId());

  const conditions = pid ? eq(workouts.profileId, pid) : undefined;

  const allWorkouts = await db.query.workouts.findMany({
    where: conditions,
    orderBy: [desc(workouts.date)],
  });

  return scanActivities(allWorkouts);
}

/**
 * Exclude a single workout from training estimates.
 * Sets excludeFromEstimates = true, autoExcluded = true, and stores the reason.
 */
export async function excludeWorkout(
  workoutId: number,
  reason: string
): Promise<void> {
  await db.update(workouts)
    .set({
      excludeFromEstimates: true,
      autoExcluded: true,
      excludeReason: reason,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workouts.id, workoutId));

  revalidatePath('/history');
  revalidatePath('/setup/cleanup');
}

/**
 * Exclude multiple workouts at once.
 */
export async function bulkExcludeWorkouts(
  workoutIds: number[],
  reason: string
): Promise<{ excluded: number }> {
  if (workoutIds.length === 0) return { excluded: 0 };

  await db.update(workouts)
    .set({
      excludeFromEstimates: true,
      autoExcluded: true,
      excludeReason: reason,
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(workouts.id, workoutIds));

  revalidatePath('/history');
  revalidatePath('/setup/cleanup');

  return { excluded: workoutIds.length };
}

/**
 * Re-include a previously excluded workout.
 */
export async function includeWorkout(workoutId: number): Promise<void> {
  await db.update(workouts)
    .set({
      excludeFromEstimates: false,
      autoExcluded: false,
      excludeReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workouts.id, workoutId));

  revalidatePath('/history');
  revalidatePath('/setup/cleanup');
}
