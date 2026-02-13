import 'dotenv/config';
import { db } from '../lib/db';
import { profiles } from '../lib/schema.pg';
import { eq } from 'drizzle-orm';

async function setupStravaTokens() {
  try {
    // The credentials provided by the user
    const accessToken = '90990446d1e5c5beae61acd3cece4a5b27d828ad';
    const refreshToken = 'a46cfcfaa32afb4ca2b80c807e9bacab59cd0760';
    const expiresAt = new Date('2026-02-13T21:33:45Z').getTime() / 1000; // Convert to Unix timestamp

    console.log('Setting up Strava tokens for the active profile...');

    // Get the first/active profile (assuming single user for now)
    const [profile] = await db
      .select()
      .from(profiles)
      .limit(1);

    if (!profile) {
      console.error('No profile found! Please create a profile first.');
      return;
    }

    console.log(`Found profile: ${profile.name || 'Unnamed'} (ID: ${profile.id})`);

    // Update the profile with Strava tokens
    await db
      .update(profiles)
      .set({
        stravaAccessToken: accessToken,
        stravaRefreshToken: refreshToken,
        stravaTokenExpiresAt: Math.floor(expiresAt),
        // Note: We'll need the athlete ID from Strava API
      })
      .where(eq(profiles.id, profile.id));

    console.log('✅ Successfully updated Strava tokens!');
    console.log(`Access token expires at: ${new Date(expiresAt * 1000).toISOString()}`);
    console.log('\nNext steps:');
    console.log('1. The app will fetch your athlete ID on first API call');
    console.log('2. You can now sync your Strava activities');
    console.log('3. Visit /settings to verify the connection');

  } catch (error) {
    console.error('Error setting up Strava tokens:', error);
  } finally {
    process.exit(0);
  }
}

setupStravaTokens();