'use server';

import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';

export interface ManualStravaCredentials {
  accessToken: string;
  refreshToken: string;
  athleteId: string;
}

/**
 * Connect Strava using manually provided tokens
 */
export async function connectStravaManual(credentials: ManualStravaCredentials): Promise<{ success: boolean; error?: string }> {
  try {
    const profileId = await getActiveProfileId();
    const settings = await getSettings(profileId);

    if (!settings) {
      return { success: false, error: 'User settings not found' };
    }

    // Parse athlete ID to number
    const athleteId = parseInt(credentials.athleteId, 10);
    if (isNaN(athleteId)) {
      return { success: false, error: 'Invalid athlete ID' };
    }

    // Save tokens to settings
    await db.update(userSettings)
      .set({
        stravaAthleteId: athleteId,
        stravaAccessToken: credentials.accessToken,
        stravaRefreshToken: credentials.refreshToken,
        // Set expiry to 6 hours from now (Strava tokens typically last 6 hours)
        stravaTokenExpiresAt: Math.floor(Date.now() / 1000) + (6 * 60 * 60),
        stravaAutoSync: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Failed to connect Strava manually:', error);
    return { success: false, error: error.message || 'Failed to save credentials' };
  }
}