'use server';

import { db, races, raceResults, userSettings, Race, RaceResult } from '@/lib/db';
import { eq, desc, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import type { RacePriority } from '@/lib/schema';

// ==================== Races (Upcoming) ====================

export async function getRaces(profileId?: number) {
  return db.query.races.findMany({
    where: profileId ? eq(races.profileId, profileId) : undefined,
    orderBy: [asc(races.date)],
  });
}

export async function getUpcomingRaces(profileId?: number) {
  const today = new Date().toISOString().split('T')[0];
  const allRaces: Race[] = await db.query.races.findMany({
    where: profileId ? eq(races.profileId, profileId) : undefined,
    orderBy: [asc(races.date)],
  });
  return allRaces.filter((r: Race) => r.date >= today);
}

export async function getRace(id: number) {
  return db.query.races.findFirst({
    where: eq(races.id, id),
  });
}

export async function createRace(data: {
  name: string;
  date: string;
  distanceLabel: string;
  priority: RacePriority;
  targetTimeSeconds?: number;
  location?: string;
  notes?: string;
  profileId?: number;
}) {
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate target pace if target time is provided
  const targetPaceSecondsPerMile = data.targetTimeSeconds && distanceInfo
    ? Math.round(data.targetTimeSeconds / distanceInfo.miles)
    : null;

  const [race] = await db.insert(races).values({
    name: data.name,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    priority: data.priority,
    targetTimeSeconds: data.targetTimeSeconds ?? null,
    targetPaceSecondsPerMile,
    location: data.location ?? null,
    notes: data.notes ?? null,
    trainingPlanGenerated: false,
    profileId: data.profileId ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');

  return race;
}

export async function updateRace(id: number, data: {
  name?: string;
  date?: string;
  distanceLabel?: string;
  priority?: RacePriority;
  targetTimeSeconds?: number | null;
  location?: string | null;
  notes?: string | null;
}) {
  const now = new Date().toISOString();
  const existing = await getRace(id);

  if (!existing) {
    throw new Error('Race not found');
  }

  // Recalculate distance if label changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;

  // Recalculate target pace if time changed
  const targetTimeSeconds = data.targetTimeSeconds !== undefined
    ? data.targetTimeSeconds
    : existing.targetTimeSeconds;

  const targetPaceSecondsPerMile = targetTimeSeconds && distanceInfo
    ? Math.round(targetTimeSeconds / distanceInfo.miles)
    : null;

  const [race] = await db.update(races)
    .set({
      name: data.name ?? existing.name,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      priority: data.priority ?? existing.priority,
      targetTimeSeconds,
      targetPaceSecondsPerMile,
      location: data.location !== undefined ? data.location : existing.location,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      updatedAt: now,
    })
    .where(eq(races.id, id))
    .returning();

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');

  return race;
}

export async function deleteRace(id: number) {
  await db.delete(races).where(eq(races.id, id));

  revalidatePath('/races');
  revalidatePath('/today');
  revalidatePath('/plan');
}

// ==================== Race Results (Historical) ====================

export async function getRaceResults(profileId?: number) {
  return db.query.raceResults.findMany({
    where: profileId ? eq(raceResults.profileId, profileId) : undefined,
    orderBy: [desc(raceResults.date)],
  });
}

export async function getRaceResult(id: number) {
  return db.query.raceResults.findFirst({
    where: eq(raceResults.id, id),
  });
}

export async function createRaceResult(data: {
  raceName?: string;
  date: string;
  distanceLabel: string;
  finishTimeSeconds: number;
  effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
  conditions?: string;
  notes?: string;
  profileId?: number;
}) {
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate VDOT from this race
  const calculatedVdot = calculateVDOT(distanceMeters, data.finishTimeSeconds);

  const [result] = await db.insert(raceResults).values({
    raceName: data.raceName ?? null,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    finishTimeSeconds: data.finishTimeSeconds,
    calculatedVdot,
    effortLevel: data.effortLevel ?? 'all_out',
    conditions: data.conditions ?? null,
    notes: data.notes ?? null,
    profileId: data.profileId ?? null,
    createdAt: now,
  }).returning();

  // Update user's VDOT and pace zones if this is a better VDOT
  await updateUserVDOTFromResults(data.profileId);

  revalidatePath('/races');
  revalidatePath('/settings');
  revalidatePath('/today');

  return result;
}

export async function updateRaceResult(id: number, data: {
  raceName?: string | null;
  date?: string;
  distanceLabel?: string;
  finishTimeSeconds?: number;
  effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
  conditions?: string | null;
  notes?: string | null;
}) {
  const existing = await getRaceResult(id);

  if (!existing) {
    throw new Error('Race result not found');
  }

  // Recalculate distance and VDOT if changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;
  const finishTimeSeconds = data.finishTimeSeconds ?? existing.finishTimeSeconds;

  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const [result] = await db.update(raceResults)
    .set({
      raceName: data.raceName !== undefined ? data.raceName : existing.raceName,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      finishTimeSeconds,
      calculatedVdot,
      effortLevel: data.effortLevel ?? existing.effortLevel,
      conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
      notes: data.notes !== undefined ? data.notes : existing.notes,
    })
    .where(eq(raceResults.id, id))
    .returning();

  // Update user's VDOT
  await updateUserVDOTFromResults(existing.profileId ?? undefined);

  revalidatePath('/races');
  revalidatePath('/settings');

  return result;
}

export async function deleteRaceResult(id: number) {
  const existing = await getRaceResult(id);
  await db.delete(raceResults).where(eq(raceResults.id, id));

  // Update user's VDOT
  await updateUserVDOTFromResults(existing?.profileId ?? undefined);

  revalidatePath('/races');
  revalidatePath('/settings');
}

// ==================== VDOT Management ====================

/**
 * Update user's VDOT and pace zones from their best recent race result.
 * Uses the highest VDOT from all-out efforts in the last 12 months.
 */
async function updateUserVDOTFromResults(profileId?: number) {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    .toISOString().split('T')[0];

  const results: RaceResult[] = await db.query.raceResults.findMany({
    where: profileId ? eq(raceResults.profileId, profileId) : undefined,
    orderBy: [desc(raceResults.calculatedVdot)],
  });

  // Filter to recent all-out or hard efforts
  const recentResults = results.filter((r: RaceResult) =>
    r.date >= oneYearAgo &&
    (r.effortLevel === 'all_out' || r.effortLevel === 'hard')
  );

  if (recentResults.length === 0) return;

  // Use the best (highest) VDOT
  const bestResult = recentResults[0];
  const vdot = bestResult.calculatedVdot;

  // Validate VDOT is within realistic range (15-85)
  if (!vdot || vdot < 15 || vdot > 85) return;

  // Calculate pace zones
  const zones = calculatePaceZones(vdot);

  // Update user settings (filter by profileId if available)
  const settings = profileId
    ? await db.query.userSettings.findFirst({ where: eq(userSettings.profileId, profileId) })
    : await db.query.userSettings.findFirst();

  if (settings) {
    await db.update(userSettings)
      .set({
        vdot,
        easyPaceSeconds: zones.easy,
        tempoPaceSeconds: zones.tempo,
        thresholdPaceSeconds: zones.threshold,
        intervalPaceSeconds: zones.interval,
        marathonPaceSeconds: zones.marathon,
        halfMarathonPaceSeconds: zones.halfMarathon,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));
  }
}

/**
 * Get the user's current pace zones.
 */
export async function getUserPaceZones() {
  const settings = await db.query.userSettings.findFirst();

  if (!settings?.vdot || settings.vdot < 15 || settings.vdot > 85) {
    return null;
  }

  return calculatePaceZones(settings.vdot);
}

/**
 * Manually set user's VDOT and update pace zones.
 */
export async function setUserVDOT(vdot: number) {
  if (vdot < 15 || vdot > 85) {
    throw new Error('VDOT must be between 15 and 85');
  }

  const zones = calculatePaceZones(vdot);
  const now = new Date().toISOString();

  const settings = await db.query.userSettings.findFirst();

  if (settings) {
    await db.update(userSettings)
      .set({
        vdot,
        easyPaceSeconds: zones.easy,
        tempoPaceSeconds: zones.tempo,
        thresholdPaceSeconds: zones.threshold,
        intervalPaceSeconds: zones.interval,
        marathonPaceSeconds: zones.marathon,
        halfMarathonPaceSeconds: zones.halfMarathon,
        updatedAt: now,
      })
      .where(eq(userSettings.id, settings.id));
  }

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return zones;
}

// Note: Utility functions (getDaysUntilRace, formatRaceTime, etc.) are in @/lib/race-utils
