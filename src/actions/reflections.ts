'use server';

import { db, workouts, assessments, postRunReflections } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';
import { revalidatePath } from 'next/cache';

/**
 * Get recent workouts that have neither a reflection nor an assessment.
 * Used to prompt the user for a quick post-run check-in.
 */
export async function getUnreflectedWorkouts(limit: number = 1) {
  const profileId = await getActiveProfileId();

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const cutoff = toLocalDateString(threeDaysAgo);

  // Get recent workouts that are missing both reflection and assessment
  const conditions = [gte(workouts.date, cutoff)];
  if (profileId) conditions.push(eq(workouts.profileId, profileId));

  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(and(...conditions))
    .orderBy(desc(workouts.date))
    .limit(limit + 10); // fetch extras to filter

  if (recentWorkouts.length === 0) return [];

  // Check which have assessments or reflections
  const results = [];
  for (const w of recentWorkouts) {
    if (results.length >= limit) break;

    const [existingAssessment] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.workoutId, w.id))
      .limit(1);

    if (existingAssessment) continue;

    const [existingReflection] = await db
      .select({ id: postRunReflections.id })
      .from(postRunReflections)
      .where(eq(postRunReflections.workoutId, w.id))
      .limit(1);

    if (existingReflection) continue;

    results.push(w);
  }

  return results;
}

/**
 * Save a post-run reflection for a workout.
 */
export async function saveReflection(data: {
  workoutId: number;
  rpe: number;
  shoeComfort?: string;
  painReport?: string;
  painLocation?: string;
  energyLevel?: string;
  contextualAnswer?: string;
  quickNote?: string;
}) {
  const profileId = await getActiveProfileId();

  await db.insert(postRunReflections).values({
    workoutId: data.workoutId,
    profileId: profileId ?? null,
    rpe: data.rpe,
    shoeComfort: data.shoeComfort as any,
    painReport: data.painReport as any,
    painLocation: data.painLocation || null,
    energyLevel: data.energyLevel as any,
    contextualAnswer: data.contextualAnswer || null,
    quickNote: data.quickNote || null,
    createdAt: new Date().toISOString(),
  });

  revalidatePath('/today');
  revalidatePath(`/workout/${data.workoutId}`);
}

