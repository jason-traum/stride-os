'use server';

import { db } from '@/lib/db';
import { coachingInsights } from '@/lib/db/coaching-memory';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function deleteCoachingInsight(insightId: number, profileId: number) {
  try {
    // Verify the insight belongs to the profile before deleting
    const insight = await db
      .select()
      .from(coachingInsights)
      .where(
        and(
          eq(coachingInsights.id, insightId),
          eq(coachingInsights.profileId, profileId)
        )
      )
      .limit(1);

    if (insight.length === 0) {
      throw new Error('Insight not found or unauthorized');
    }

    // Soft delete by setting isActive to false
    await db
      .update(coachingInsights)
      .set({
        isActive: false,
        lastValidated: new Date().toISOString()
      })
      .where(eq(coachingInsights.id, insightId));

    // Revalidate the memory page to show updated data
    revalidatePath('/memory');

    return { success: true };
  } catch (error) {
    console.error('Error deleting coaching insight:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function restoreCoachingInsight(insightId: number, profileId: number) {
  try {
    // Verify the insight belongs to the profile before restoring
    const insight = await db
      .select()
      .from(coachingInsights)
      .where(
        and(
          eq(coachingInsights.id, insightId),
          eq(coachingInsights.profileId, profileId)
        )
      )
      .limit(1);

    if (insight.length === 0) {
      throw new Error('Insight not found or unauthorized');
    }

    // Restore by setting isActive to true
    await db
      .update(coachingInsights)
      .set({
        isActive: true,
        lastValidated: new Date().toISOString()
      })
      .where(eq(coachingInsights.id, insightId));

    // Revalidate the memory page to show updated data
    revalidatePath('/memory');

    return { success: true };
  } catch (error) {
    console.error('Error restoring coaching insight:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}