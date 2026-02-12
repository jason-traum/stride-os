'use server';

import { getValidAccessToken, syncStravaActivities } from './strava';

/**
 * Manually sync recent Strava activities
 * Useful for testing and debugging
 */
export async function syncRecentActivities(days: number = 7) {
  try {
    // Calculate date range
    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await syncStravaActivities({
      since: since.toISOString(),
    });

    return result;
  } catch (error) {
    console.error('Manual sync failed:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test Strava connection and token validity
 */
export async function testStravaConnection() {
  try {
    const { getStravaStatus } = await import('./strava-fix');
    const status = await getStravaStatus();

    if (!status.isConnected) {
      return {
        success: false,
        error: 'Not connected to Strava',
      };
    }

    // Try to get athlete info
    const { getStravaAthlete } = await import('@/lib/strava');
    const { getActiveProfileId } = await import('@/lib/profile-server');
    const { getSettings } = await import('./settings');

    const profileId = await getActiveProfileId();
    const settings = await getSettings(profileId);

    if (!settings?.stravaAccessToken) {
      return {
        success: false,
        error: 'No access token found',
      };
    }

    const athlete = await getStravaAthlete(settings.stravaAccessToken);

    return {
      success: true,
      athlete,
      lastSync: settings.stravaLastSyncAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}