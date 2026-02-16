'use server';

import { db, workouts } from '@/lib/db';
import { reprocessAllWorkouts } from '@/lib/training/workout-processor';
import { revalidatePath } from 'next/cache';

/**
 * Recategorize all workouts by running the zone classification pipeline.
 * Clears user-set `category` overrides so new auto-classification takes effect.
 * Skips route matching and execution scoring for speed.
 */
export async function recategorizeAllWorkouts(): Promise<{
  successful: number;
  failed: number;
  total: number;
}> {
  // Clear user-set category overrides so auto-classification can update workoutType
  await db.update(workouts).set({ category: null });

  const result = await reprocessAllWorkouts({
    skipRouteMatching: true,
    skipExecution: true,
  });

  // Revalidate pages that display workout data
  revalidatePath('/analytics');
  revalidatePath('/history');
  revalidatePath('/today');

  return {
    successful: result.successful,
    failed: result.failed,
    total: result.total,
  };
}
