'use server';

import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  exchangeStravaCode,
  refreshStravaToken,
  deauthorizeStrava,
  isTokenExpired,
  getStravaAthlete,
} from '@/lib/strava';
import { getSettings } from './settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

export interface StravaConnectionStatus {
  isConnected: boolean;
  athleteId?: number;
  lastSyncAt?: string;
  autoSync: boolean;
}

export async function getOrCreateSettingsForProfile(profileId?: number) {
  if (profileId === undefined) {
    return getSettings();
  }

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });
  if (existing) return existing;

  const now = new Date().toISOString();
  const [created] = await db.insert(userSettings).values({
    profileId,
    name: '',
    createdAt: now,
    updatedAt: now,
  }).returning();
  return created;
}

/**
 * Get current Strava connection status for the active profile
 */
export async function getStravaStatus(): Promise<StravaConnectionStatus> {
  const profileId = await getActiveProfileId();
  const settings = await getOrCreateSettingsForProfile(profileId);

  if (!settings || !settings.stravaAccessToken) {
    return {
      isConnected: false,
      autoSync: true,
    };
  }

  return {
    isConnected: true,
    athleteId: settings.stravaAthleteId ?? undefined,
    lastSyncAt: settings.stravaLastSyncAt ?? undefined,
    autoSync: settings.stravaAutoSync ?? true,
  };
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function connectStrava(
  code: string,
  redirectUri?: string,
  profileIdOverride?: number
): Promise<{ success: boolean; error?: string }> {
  try {

    const tokens = await exchangeStravaCode(code, redirectUri);

    const activeProfileId = profileIdOverride ?? await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(activeProfileId);

    if (!settings) {
      console.error('[connectStrava] User settings not found');
      return { success: false, error: 'User settings not found' };
    }

    // Get athlete info
    await getStravaAthlete(tokens.accessToken);

    // Save tokens to settings (encrypted at rest)
    await db.update(userSettings)
      .set({
        stravaAthleteId: tokens.athleteId,
        stravaAccessToken: encryptToken(tokens.accessToken),
        stravaRefreshToken: encryptToken(tokens.refreshToken),
        stravaTokenExpiresAt: tokens.expiresAt,
        stravaAutoSync: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[connectStrava] Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    // Return the actual error message for debugging
    return { success: false, error: error.message || 'Failed to connect to Strava' };
  }
}

/**
 * Disconnect Strava account
 */
export async function disconnectStrava(): Promise<{ success: boolean; error?: string }> {
  try {
    const profileId = await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(profileId);

    if (!settings || !settings.stravaAccessToken) {
      return { success: false, error: 'Not connected to Strava' };
    }

    // Try to deauthorize on Strava's side
    try {
      await deauthorizeStrava(decryptToken(settings.stravaAccessToken));
    } catch {
      // Continue even if deauthorization fails
      console.warn('Failed to deauthorize on Strava side');
    }

    // Clear tokens from settings
    await db.update(userSettings)
      .set({
        stravaAthleteId: null,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        stravaTokenExpiresAt: null,
        stravaLastSyncAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect Strava:', error);
    return { success: false, error: 'Failed to disconnect from Strava' };
  }
}

/**
 * Get a valid access token, refreshing if needed
 * Uses the active profile's settings
 */
export async function getValidAccessToken(): Promise<string | null> {
  const profileId = await getActiveProfileId();
  const settings = await getOrCreateSettingsForProfile(profileId);

  if (!settings || !settings.stravaAccessToken || !settings.stravaRefreshToken) {
    return null;
  }

  // Check if token needs refresh
  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
    try {
      const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));

      // Save new tokens (encrypted at rest)
      await db.update(userSettings)
        .set({
          stravaAccessToken: encryptToken(newTokens.accessToken),
          stravaRefreshToken: encryptToken(newTokens.refreshToken),
          stravaTokenExpiresAt: newTokens.expiresAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.id, settings.id));

      return newTokens.accessToken;
    } catch (error) {
      console.error('Failed to refresh Strava token:', error);
      return null;
    }
  }

  return decryptToken(settings.stravaAccessToken);
}

/**
 * Toggle auto-sync setting
 */
export async function setStravaAutoSync(enabled: boolean): Promise<{ success: boolean }> {
  try {
    const profileId = await getActiveProfileId();
    const settings = await getOrCreateSettingsForProfile(profileId);
    if (!settings) {
      return { success: false };
    }

    await db.update(userSettings)
      .set({
        stravaAutoSync: enabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update Strava auto-sync:', error);
    return { success: false };
  }
}
