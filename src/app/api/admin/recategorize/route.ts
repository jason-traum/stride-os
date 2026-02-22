import { NextResponse } from 'next/server';
import { db, workouts } from '@/lib/db';
import { processWorkout } from '@/lib/training/workout-processor';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Clear user-set category overrides so auto-classification can update workoutType
  await db.update(workouts).set({ category: null });

  // Get all workout IDs
  const allWorkouts: { id: number }[] = await db.select({ id: workouts.id }).from(workouts);
  const workoutIds = allWorkouts.map((w: { id: number }) => w.id);

  let successful = 0;
  let failed = 0;
  const sampleErrors: Array<{ workoutId: number; errors: string[] }> = [];

  for (const id of workoutIds) {
    const result = await processWorkout(id, {
      skipRouteMatching: true,
      skipExecution: true,
    });

    if (result.errors.length === 0) {
      successful++;
    } else {
      failed++;
      // Capture first 10 error details for debugging
      if (sampleErrors.length < 10) {
        sampleErrors.push({ workoutId: id, errors: result.errors });
      }
    }
  }

  return NextResponse.json({
    successful,
    failed,
    total: workoutIds.length,
    sampleErrors,
  });
}
