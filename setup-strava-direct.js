// Direct script to setup Strava tokens
require('dotenv').config({ path: '.env.local' });

async function setupStrava() {
  const { neon } = require('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-http');
  const { eq } = require('drizzle-orm');
  const { profiles } = require('./dist/lib/schema.pg');

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    // The credentials
    const accessToken = '90990446d1e5c5beae61acd3cece4a5b27d828ad';
    const refreshToken = 'a46cfcfaa32afb4ca2b80c807e9bacab59cd0760';
    const expiresAt = Math.floor(new Date('2026-02-13T21:33:45Z').getTime() / 1000);

    console.log('Setting up Strava tokens...');

    // Get first profile
    const [profile] = await db.select().from(profiles).limit(1);
    if (!profile) {
      console.error('No profile found!');
      return;
    }

    console.log(`Found profile: ${profile.name} (ID: ${profile.id})`);

    // Update tokens
    await db
      .update(profiles)
      .set({
        stravaAccessToken: accessToken,
        stravaRefreshToken: refreshToken,
        stravaTokenExpiresAt: expiresAt,
      })
      .where(eq(profiles.id, profile.id));

    console.log('✅ Tokens updated!');

    // Fetch athlete info
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const athlete = await response.json();
      console.log(`✅ Connected to Strava athlete: ${athlete.firstname} ${athlete.lastname} (ID: ${athlete.id})`);

      // Update athlete ID
      await db
        .update(profiles)
        .set({
          stravaAthleteId: athlete.id,
        })
        .where(eq(profiles.id, profile.id));

      console.log('✅ Athlete ID saved!');
    } else {
      console.error('Failed to fetch athlete info:', response.status, response.statusText);
    }

    // Test the final setup
    const [updatedProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profile.id));

    console.log('\n✅ Strava integration setup complete!');
    console.log('Access token:', updatedProfile.stravaAccessToken ? '✓ Set' : '✗ Missing');
    console.log('Refresh token:', updatedProfile.stravaRefreshToken ? '✓ Set' : '✗ Missing');
    console.log('Athlete ID:', updatedProfile.stravaAthleteId || 'Not set');
    console.log('Token expires:', new Date(updatedProfile.stravaTokenExpiresAt * 1000).toISOString());

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

setupStrava();