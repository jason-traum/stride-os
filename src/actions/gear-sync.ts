'use server';

import { db, shoes, workouts, userSettings } from '@/lib/db';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createProfileAction } from '@/lib/action-utils';
import { stravaFetch } from '@/lib/strava-api';
import { isTokenExpired, refreshStravaToken } from '@/lib/strava';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

/**
 * Strava Gear API response shape
 * GET /api/v3/gear/{id}
 */
interface StravaGearResponse {
  id: string;          // e.g. "g12345"
  primary: boolean;
  name: string;        // e.g. "Nike Pegasus 40"
  brand_name: string;  // e.g. "Nike"
  model_name: string;  // e.g. "Pegasus 40"
  distance: number;    // total meters
  description?: string;
  retired?: boolean;
}

/**
 * Get a valid Strava access token for a specific profile, refreshing if needed.
 */
async function getValidAccessTokenForProfile(profileId: number): Promise<{ accessToken: string; settingsId: number } | null> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    return null;
  }

  if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
    try {
      const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));
      await db.update(userSettings).set({
        stravaAccessToken: encryptToken(newTokens.accessToken),
        stravaRefreshToken: encryptToken(newTokens.refreshToken),
        stravaTokenExpiresAt: newTokens.expiresAt,
        updatedAt: new Date().toISOString(),
      }).where(eq(userSettings.id, settings.id));
      return { accessToken: newTokens.accessToken, settingsId: settings.id };
    } catch (error) {
      console.error('[gear-sync] Failed to refresh Strava token:', error);
      return null;
    }
  }

  return { accessToken: decryptToken(settings.stravaAccessToken), settingsId: settings.id };
}

/**
 * Fetch gear details from Strava API.
 */
async function fetchStravaGear(accessToken: string, gearId: string): Promise<StravaGearResponse | null> {
  try {
    const response = await stravaFetch(`/gear/${gearId}`, accessToken);
    if (!response.ok) {
      console.warn(`[gear-sync] Failed to fetch gear ${gearId}: ${response.status}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`[gear-sync] Error fetching gear ${gearId}:`, error);
    return null;
  }
}

/**
 * Sync Strava gear for a profile.
 *
 * 1. Finds all unique stravaGearId values on workouts for this profile
 * 2. Fetches gear details from Strava API
 * 3. Creates or updates shoes records linked by stravaGearId
 * 4. Links workouts to shoes via shoeId based on stravaGearId match
 */
async function _syncStravaGear(profileId: number): Promise<{
  synced: number;
  linked: number;
  errors: string[];
}> {
  const tokenInfo = await getValidAccessTokenForProfile(profileId);
  if (!tokenInfo) {
    throw new Error('Not connected to Strava');
  }

  const { accessToken } = tokenInfo;

  // 1. Find all unique stravaGearId values on workouts for this profile
  const workoutsWithGear = await db
    .select({
      stravaGearId: workouts.stravaGearId,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        isNotNull(workouts.stravaGearId),
      )
    )
    .groupBy(workouts.stravaGearId);

  const uniqueGearIds = workoutsWithGear
    .map((w: { stravaGearId: string | null }) => w.stravaGearId)
    .filter((id: string | null): id is string => id !== null && id !== '');

  if (uniqueGearIds.length === 0) {
    return { synced: 0, linked: 0, errors: [] };
  }

  let synced = 0;
  let linked = 0;
  const errors: string[] = [];

  // 2. For each gear ID, fetch details and create/update shoe
  for (const gearId of uniqueGearIds) {
    const gear = await fetchStravaGear(accessToken, gearId);
    if (!gear) {
      errors.push(`Failed to fetch gear ${gearId}`);
      continue;
    }

    // Check if we already have a shoe with this stravaGearId
    const existingShoe = await db.query.shoes.findFirst({
      where: and(
        eq(shoes.profileId, profileId),
        eq(shoes.stravaGearId, gearId),
      ),
    });

    const distanceMiles = gear.distance / 1609.34;
    const shoeName = gear.name || `${gear.brand_name} ${gear.model_name}`.trim() || 'Unknown Shoe';
    const brandName = gear.brand_name || 'Unknown';
    const modelName = gear.model_name || gear.name || 'Unknown';

    let shoeId: number;

    if (existingShoe) {
      // Update existing shoe with latest data from Strava
      await db.update(shoes).set({
        name: shoeName,
        brand: brandName,
        model: modelName,
        totalMiles: Math.round(distanceMiles * 10) / 10,
        isRetired: gear.retired ?? false,
      }).where(eq(shoes.id, existingShoe.id));
      shoeId = existingShoe.id;
    } else {
      // Create new shoe
      const [newShoe] = await db.insert(shoes).values({
        profileId,
        name: shoeName,
        brand: brandName,
        model: modelName,
        category: 'daily_trainer', // Default category; user can change later
        intendedUse: '[]',
        totalMiles: Math.round(distanceMiles * 10) / 10,
        isRetired: gear.retired ?? false,
        stravaGearId: gearId,
        notes: gear.description || null,
        createdAt: new Date().toISOString(),
      }).returning();
      shoeId = newShoe.id;
    }

    synced++;

    // 3. Link all workouts with this stravaGearId to this shoe
    await db.update(workouts).set({
      shoeId,
      updatedAt: new Date().toISOString(),
    }).where(
      and(
        eq(workouts.profileId, profileId),
        eq(workouts.stravaGearId, gearId),
      )
    );

    // Count linked workouts (drizzle returns the result set)
    // We count by querying how many workouts have this gearId
    const linkedWorkouts = await db
      .select({ count: sql<number>`count(*)` })
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          eq(workouts.stravaGearId, gearId),
          eq(workouts.shoeId, shoeId),
        )
      );

    linked += Number(linkedWorkouts[0]?.count ?? 0);

    // Small delay to avoid Strava rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  revalidatePath('/shoes');
  revalidatePath('/history');

  return { synced, linked, errors };
}

/**
 * Link a single workout to a shoe based on its stravaGearId.
 * Called during Strava sync to auto-link newly imported workouts.
 * Does NOT call the Strava API -- only matches against existing shoes.
 */
export async function linkWorkoutToShoeByGearId(
  workoutId: number,
  stravaGearId: string | undefined | null,
  profileId: number | null | undefined,
): Promise<void> {
  if (!stravaGearId || !profileId) return;

  const existingShoe = await db.query.shoes.findFirst({
    where: and(
      eq(shoes.profileId, profileId),
      eq(shoes.stravaGearId, stravaGearId),
    ),
  });

  if (existingShoe) {
    await db.update(workouts).set({
      shoeId: existingShoe.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(workouts.id, workoutId));
  }
}

/**
 * Get gear summary for a profile: all shoes with workout counts and total miles.
 */
async function _getGearSummary(profileId: number): Promise<{
  shoes: Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
    category: string;
    totalMiles: number;
    workoutCount: number;
    isRetired: boolean;
    stravaGearId: string | null;
    lastUsedDate: string | null;
  }>;
}> {
  // Get all shoes for this profile with workout counts
  const allShoes = await db
    .select({
      id: shoes.id,
      name: shoes.name,
      brand: shoes.brand,
      model: shoes.model,
      category: shoes.category,
      totalMiles: shoes.totalMiles,
      isRetired: shoes.isRetired,
      stravaGearId: shoes.stravaGearId,
    })
    .from(shoes)
    .where(eq(shoes.profileId, profileId));

  const result = [];

  for (const shoe of allShoes) {
    // Count workouts and find last used date
    const stats = await db
      .select({
        count: sql<number>`count(*)`,
        lastDate: sql<string>`max(${workouts.date})`,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          eq(workouts.shoeId, shoe.id),
        )
      );

    result.push({
      id: shoe.id,
      name: shoe.name,
      brand: shoe.brand,
      model: shoe.model,
      category: shoe.category,
      totalMiles: shoe.totalMiles,
      workoutCount: Number(stats[0]?.count ?? 0),
      isRetired: shoe.isRetired,
      stravaGearId: shoe.stravaGearId ?? null,
      lastUsedDate: stats[0]?.lastDate ?? null,
    });
  }

  // Sort: active shoes first (by most miles), then retired
  result.sort((a, b) => {
    if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;
    return b.totalMiles - a.totalMiles;
  });

  return { shoes: result };
}

// Exported wrapped actions
export const syncStravaGear = createProfileAction(_syncStravaGear, 'syncStravaGear');
export const getGearSummary = createProfileAction(_getGearSummary, 'getGearSummary');

/**
 * Direct sync function for admin/CLI usage (bypasses cookie-based profile lookup).
 * Accepts profileId directly.
 */
export async function syncStravaGearForProfile(profileId: number) {
  return _syncStravaGear(profileId);
}
