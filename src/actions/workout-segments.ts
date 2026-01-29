'use server';

import { db, workoutSegments, type NewWorkoutSegment, type WorkoutSegment } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Add segments to a workout
 */
export async function addWorkoutSegments(
  workoutId: number,
  segments: Omit<NewWorkoutSegment, 'workoutId' | 'createdAt'>[]
): Promise<WorkoutSegment[]> {
  const now = new Date().toISOString();

  const insertedSegments: WorkoutSegment[] = [];

  for (const segment of segments) {
    const [inserted] = await db.insert(workoutSegments).values({
      ...segment,
      workoutId,
      createdAt: now,
    }).returning();

    insertedSegments.push(inserted);
  }

  revalidatePath(`/workout/${workoutId}`);

  return insertedSegments;
}

/**
 * Get segments for a workout
 */
export async function getWorkoutSegments(workoutId: number): Promise<WorkoutSegment[]> {
  return await db.query.workoutSegments.findMany({
    where: eq(workoutSegments.workoutId, workoutId),
    orderBy: (segments, { asc }) => [asc(segments.segmentNumber)],
  });
}

/**
 * Update a workout segment
 */
export async function updateWorkoutSegment(
  segmentId: number,
  data: Partial<Omit<NewWorkoutSegment, 'workoutId' | 'createdAt'>>
): Promise<void> {
  await db.update(workoutSegments)
    .set(data)
    .where(eq(workoutSegments.id, segmentId));

  revalidatePath('/');
}

/**
 * Delete a workout segment
 */
export async function deleteWorkoutSegment(segmentId: number): Promise<void> {
  await db.delete(workoutSegments).where(eq(workoutSegments.id, segmentId));
  revalidatePath('/');
}

/**
 * Delete all segments for a workout
 */
export async function deleteAllWorkoutSegments(workoutId: number): Promise<void> {
  await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));
  revalidatePath(`/workout/${workoutId}`);
}
