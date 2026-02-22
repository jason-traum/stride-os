'use server';

import { db, workouts } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Toggle whether a workout is excluded from fitness estimates (VDOT, EF trend).
 * Excluded workouts still count for mileage, CTL/ATL/TSB, and history display.
 */
export async function toggleWorkoutExclusion(
  workoutId: number,
  excluded: boolean,
  reason?: string
) {
  await db.update(workouts)
    .set({
      excludeFromEstimates: excluded,
      // If user is un-excluding, clear the auto-excluded flag
      ...(excluded ? {} : { autoExcluded: false }),
      ...(reason !== undefined ? { excludeReason: reason } : {}),
    })
    .where(eq(workouts.id, workoutId));

  revalidatePath('/history');
  revalidatePath('/analytics/predictions');
  revalidatePath(`/workout/${workoutId}`);
}

/**
 * Update just the exclude reason/notes field for a workout.
 */
export async function updateExcludeReason(workoutId: number, reason: string) {
  await db.update(workouts)
    .set({ excludeReason: reason })
    .where(eq(workouts.id, workoutId));

  revalidatePath(`/workout/${workoutId}`);
}
