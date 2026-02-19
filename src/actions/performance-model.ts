'use server';

import { buildPerformanceModel, getRecommendedPaces, type PerformancePaceModel } from '@/lib/training/performance-model';
import { getActiveProfileId } from '@/lib/profile-server';
import { formatPace } from '@/lib/utils';

/**
 * Get the full performance-based pace model for the current user
 */
export async function getPerformanceModel(): Promise<PerformancePaceModel> {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    console.warn('[getPerformanceModel] No active profile');
  }
  return buildPerformanceModel(profileId ?? undefined);
}

/**
 * Get recommended paces for a specific workout type
 */
export async function getPaceRecommendation(workoutType: string): Promise<{
  pace: number;
  range?: { low: number; high: number };
  note: string;
}> {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    console.warn('[getPaceRecommendation] No active profile');
  }
  return getRecommendedPaces(workoutType, profileId ?? undefined);
}

/**
 * Format pace in mm:ss/mi
 */
export function formatPaceSeconds(seconds: number): string {
  return `${formatPace(seconds)}/mi`;
}
