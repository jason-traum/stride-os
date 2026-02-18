'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

/**
 * Deprecated helper. Manual token injection is disabled for production safety.
 */
export async function setupStravaTokens() {
  return {
    success: false,
    error: 'Manual token setup is disabled. Use the standard OAuth connect flow in Settings.',
  };
}

export async function testStravaConnection() {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return { success: false, error: 'No active profile' };
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile?.stravaAccessToken) {
      return { success: false, error: 'No Strava access token found' };
    }

    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        Authorization: `Bearer ${profile.stravaAccessToken}`,
      },
    });

    if (response.ok) {
      const athlete = await response.json();
      return {
        success: true,
        athlete: {
          id: athlete.id,
          name: `${athlete.firstname} ${athlete.lastname}`,
          profile: athlete.profile,
        },
      };
    }

    return {
      success: false,
      error: `Strava API error: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
