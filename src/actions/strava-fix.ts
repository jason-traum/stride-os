'use server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getStravaStatus as _originalGetStravaStatus } from './strava';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { isTokenExpired, refreshStravaToken } from '@/lib/strava';
import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * Enhanced getStravaStatus that checks token expiration
 * and attempts to refresh if needed before reporting status
 */
export async function getStravaStatus() {
  const profileId = await getActiveProfileId();
  const settings = await getSettings(profileId);

  if (!settings || !settings.stravaAccessToken) {
    return {
      isConnected: false,
      autoSync: true,
    };
  }

  // Check if token is expired
  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {

    if (settings.stravaRefreshToken) {
      try {
        const newTokens = await refreshStravaToken(settings.stravaRefreshToken);

        // Update tokens in database
        await db.update(userSettings)
          .set({
            stravaAccessToken: newTokens.accessToken,
            stravaRefreshToken: newTokens.refreshToken,
            stravaTokenExpiresAt: newTokens.expiresAt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userSettings.id, settings.id));


        return {
          isConnected: true,
          athleteId: settings.stravaAthleteId ?? undefined,
          lastSyncAt: settings.stravaLastSyncAt ?? undefined,
          autoSync: settings.stravaAutoSync ?? true,
        };
      } catch (error) {
        console.error('Failed to refresh Strava token:', error);
        // Token refresh failed, show as disconnected
        return {
          isConnected: false,
          autoSync: settings.stravaAutoSync ?? true,
        };
      }
    }
  }

  // Token is still valid
  return {
    isConnected: true,
    athleteId: settings.stravaAthleteId ?? undefined,
    lastSyncAt: settings.stravaLastSyncAt ?? undefined,
    autoSync: settings.stravaAutoSync ?? true,
  };
}