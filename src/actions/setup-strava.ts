'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export async function setupStravaTokens() {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      throw new Error('No active profile found');
    }

    // The credentials provided by the user
    const accessToken = '90990446d1e5c5beae61acd3cece4a5b27d828ad';
    const refreshToken = 'a46cfcfaa32afb4ca2b80c807e9bacab59cd0760';
    const expiresAt = Math.floor(new Date('2026-02-13T21:33:45Z').getTime() / 1000);

    // Update the profile with Strava tokens
    await db
      .update(profiles)
      .set({
        stravaAccessToken: accessToken,
        stravaRefreshToken: refreshToken,
        stravaTokenExpiresAt: expiresAt,
      })
      .where(eq(profiles.id, profileId));

    // Now fetch the athlete ID from Strava
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const athlete = await response.json();

      // Update with the athlete ID
      await db
        .update(profiles)
        .set({
          stravaAthleteId: athlete.id,
        })
        .where(eq(profiles.id, profileId));

      console.log('Successfully set up Strava integration with athlete ID:', athlete.id);
      return { success: true, athleteId: athlete.id, athleteName: athlete.firstname };
    } else {
      console.error('Failed to fetch Strava athlete:', response.status);
      return { success: true, message: 'Tokens updated but could not fetch athlete info' };
    }
  } catch (error) {
    console.error('Error setting up Strava tokens:', error);
    throw error;
  }
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

    // Test the connection
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': `Bearer ${profile.stravaAccessToken}`,
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
        }
      };
    } else {
      return {
        success: false,
        error: `Strava API error: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}