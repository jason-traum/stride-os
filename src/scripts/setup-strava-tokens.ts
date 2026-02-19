import 'dotenv/config';
import { db } from '../lib/db';
import { profiles } from '../lib/schema.pg';
import { eq } from 'drizzle-orm';
import { encryptToken } from '../lib/token-crypto';

async function setupStravaTokens() {
  const accessToken = process.env.STRAVA_ACCESS_TOKEN;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  const expiresAtRaw = process.env.STRAVA_TOKEN_EXPIRES_AT;

  if (!accessToken || !refreshToken || !expiresAtRaw) {
    console.error('Missing required env vars: STRAVA_ACCESS_TOKEN, STRAVA_REFRESH_TOKEN, STRAVA_TOKEN_EXPIRES_AT');
    process.exit(1);
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) {
    console.error('STRAVA_TOKEN_EXPIRES_AT must be a Unix timestamp in seconds');
    process.exit(1);
  }

  try {
    const [profile] = await db.select().from(profiles).limit(1);
    if (!profile) {
      console.error('No profile found. Create a profile first.');
      process.exit(1);
    }

    await db
      .update(profiles)
      .set({
        stravaAccessToken: encryptToken(accessToken),
        stravaRefreshToken: encryptToken(refreshToken),
        stravaTokenExpiresAt: Math.floor(expiresAt),
      })
      .where(eq(profiles.id, profile.id));

    console.log(`Updated Strava tokens for profile ${profile.id}.`);
  } catch (error) {
    console.error('Error setting up Strava tokens:', error);
    process.exit(1);
  }
}

setupStravaTokens();
