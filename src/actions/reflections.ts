'use server';

import { db, workouts, assessments, postRunReflections } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { ShoeComfort, PainReport, EnergyLevel } from '@/lib/schema';
import { createProfileAction } from '@/lib/action-utils';

/**
 * Get recent workouts that have neither a reflection nor an assessment.
 * Used to prompt the user for a quick post-run check-in.
 */
export const getUnreflectedWorkouts = createProfileAction(
  async (profileId: number, limit: number = 1) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoff = toLocalDateString(threeDaysAgo);

    // Get recent workouts that are missing both reflection and assessment
    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(and(gte(workouts.date, cutoff), eq(workouts.profileId, profileId)))
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
  },
  'getUnreflectedWorkouts'
);

/**
 * Save a post-run reflection for a workout.
 */
export const saveReflection = createProfileAction(
  async (profileId: number, data: {
    workoutId: number;
    rpe: number;
    shoeComfort?: string;
    painReport?: string;
    painLocation?: string;
    energyLevel?: string;
    contextualAnswer?: string;
    quickNote?: string;
  }) => {
    await db.insert(postRunReflections).values({
      workoutId: data.workoutId,
      profileId: profileId,
      rpe: data.rpe,
      shoeComfort: (data.shoeComfort as ShoeComfort) ?? null,
      painReport: (data.painReport as PainReport) ?? null,
      painLocation: data.painLocation || null,
      energyLevel: (data.energyLevel as EnergyLevel) ?? null,
      contextualAnswer: data.contextualAnswer || null,
      quickNote: data.quickNote || null,
      createdAt: new Date().toISOString(),
    });

    revalidatePath('/today');
    revalidatePath(`/workout/${data.workoutId}`);
  },
  'saveReflection'
);

