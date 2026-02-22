'use server';

import { db, races, raceResults, workouts, Race } from '@/lib/db';
import { eq, desc, asc, gte, lte, inArray, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { calculateVDOT } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { syncVdotFromPredictionEngine } from './vdot-sync';
import type { RacePriority } from '@/lib/schema';
import { isPublicAccessMode } from '@/lib/access-mode';
import {
  isWritableRole,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';
import {
  inferEffortFromWorkout,
  updateUserVDOTFromResults,
  autoMatchRaceToResult,
} from './races-analysis';

const READ_ONLY_ERROR = "Oops, can't do that in guest mode! Public mode is read-only.";

async function assertRaceWriteAccess() {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const role = resolveAuthRoleFromGetter(getCookie);
  const sessionOverride = resolveSessionModeOverrideFromGetter(getCookie);
  const publicModeEnabled = resolveEffectivePublicMode({
    role,
    sessionOverride,
    globalPublicMode: isPublicAccessMode(),
  });

  if (publicModeEnabled || !isWritableRole(role)) {
    throw new Error(READ_ONLY_ERROR);
  }
}

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
  return allRaces.filter((r: Race) => r.date >= today && r.status !== 'completed');
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
  await assertRaceWriteAccess();
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
  await assertRaceWriteAccess();
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
  await assertRaceWriteAccess();
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
  workoutId?: number | null;
}) {
  await assertRaceWriteAccess();
  const now = new Date().toISOString();

  // Get distance in meters from label
  const distanceInfo = RACE_DISTANCES[data.distanceLabel];
  const distanceMeters = distanceInfo?.meters || 0;

  const linkedWorkout = data.workoutId
    ? await db.query.workouts.findFirst({ where: eq(workouts.id, data.workoutId) })
    : null;
  const inferredEffort = linkedWorkout
    ? inferEffortFromWorkout({
        workoutType: linkedWorkout.workoutType,
        avgHr: linkedWorkout.avgHr || linkedWorkout.avgHeartRate || null,
        maxHr: linkedWorkout.maxHr || null,
      })
    : 'all_out';

  // Calculate VDOT from this race
  const calculatedVdot = calculateVDOT(distanceMeters, data.finishTimeSeconds);

  const [result] = await db.insert(raceResults).values({
    raceName: data.raceName ?? null,
    date: data.date,
    distanceMeters,
    distanceLabel: data.distanceLabel,
    finishTimeSeconds: data.finishTimeSeconds,
    calculatedVdot,
    effortLevel: data.effortLevel ?? inferredEffort,
    conditions: data.conditions ?? null,
    notes: data.notes ?? null,
    profileId: data.profileId ?? null,
    workoutId: data.workoutId ?? null,
    createdAt: now,
  }).returning();

  // Update user's VDOT and pace zones using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(data.profileId, { skipSmoothing: true });
  } catch (err) {
    console.error('[createRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(data.profileId, result.id);
  }

  // Auto-link to a planned race if possible
  try {
    await autoMatchRaceToResult(result.id, distanceMeters, data.date, data.profileId);
  } catch (err) {
    console.error('[createRaceResult] Auto-match failed (non-fatal):', err);
  }

  revalidatePath('/races');
  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/plan');
  revalidatePath('/analytics');

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
  workoutId?: number | null;
}) {
  await assertRaceWriteAccess();
  const existing = await getRaceResult(id);

  if (!existing) {
    throw new Error('Race result not found');
  }

  // Recalculate distance and VDOT if changed
  const distanceLabel = data.distanceLabel ?? existing.distanceLabel;
  const distanceInfo = RACE_DISTANCES[distanceLabel];
  const distanceMeters = distanceInfo?.meters ?? existing.distanceMeters;
  const finishTimeSeconds = data.finishTimeSeconds ?? existing.finishTimeSeconds;
  const nextWorkoutId = data.workoutId !== undefined ? data.workoutId : existing.workoutId;
  const linkedWorkout = nextWorkoutId
    ? await db.query.workouts.findFirst({ where: eq(workouts.id, nextWorkoutId) })
    : null;
  const inferredEffort = linkedWorkout
    ? inferEffortFromWorkout({
        workoutType: linkedWorkout.workoutType,
        avgHr: linkedWorkout.avgHr || linkedWorkout.avgHeartRate || null,
        maxHr: linkedWorkout.maxHr || null,
      })
    : 'all_out';

  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const [result] = await db.update(raceResults)
    .set({
      raceName: data.raceName !== undefined ? data.raceName : existing.raceName,
      date: data.date ?? existing.date,
      distanceMeters,
      distanceLabel,
      finishTimeSeconds,
      calculatedVdot,
      effortLevel: data.effortLevel ?? (existing.effortLevel as 'all_out' | 'hard' | 'moderate' | 'easy' | null) ?? inferredEffort,
      conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      workoutId: nextWorkoutId,
    })
    .where(eq(raceResults.id, id))
    .returning();

  // Update user's VDOT using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(existing.profileId ?? undefined, { skipSmoothing: true });
  } catch (err) {
    console.error('[updateRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(existing.profileId ?? undefined, result.id);
  }

  revalidatePath('/races');
  revalidatePath('/settings');

  return result;
}

export async function deleteRaceResult(id: number) {
  await assertRaceWriteAccess();
  const existing = await getRaceResult(id);
  await db.delete(raceResults).where(eq(raceResults.id, id));

  // Update user's VDOT using multi-signal prediction engine
  try {
    await syncVdotFromPredictionEngine(existing?.profileId ?? undefined);
  } catch (err) {
    console.error('[deleteRaceResult] Multi-signal VDOT sync failed, falling back:', err);
    await updateUserVDOTFromResults(existing?.profileId ?? undefined);
  }

  revalidatePath('/races');
  revalidatePath('/settings');
}

// ==================== Workout Linking ====================

export async function getWorkoutsForRaceLinking(profileId?: number, date?: string) {
  if (!date) return [];

  // Fetch workouts within ±7 days of given date
  const targetDate = new Date(date);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const conditions = [
    gte(workouts.date, startStr),
    lte(workouts.date, endStr),
  ];
  if (profileId) {
    conditions.push(eq(workouts.profileId, profileId));
  }

  const allWorkouts = await db.query.workouts.findMany({
    where: and(...conditions),
    orderBy: [desc(workouts.date)],
    limit: 20,
  });

  // Prefer race-type workouts, fall back to all if none
  const raceWorkouts = allWorkouts.filter((w: { workoutType: string }) => w.workoutType === 'race');
  const results = raceWorkouts.length > 0 ? raceWorkouts : allWorkouts;

  // Sort by date proximity to target
  return results
    .map((w: { id: number; date: string; distanceMiles: number | null; durationMinutes: number | null; stravaName: string | null; workoutType: string }) => ({
      id: w.id,
      date: w.date,
      distanceMiles: w.distanceMiles,
      durationMinutes: w.durationMinutes,
      stravaName: w.stravaName,
      workoutType: w.workoutType,
    }))
    .sort((a: { date: string }, b: { date: string }) => {
      const aDiff = Math.abs(new Date(a.date).getTime() - targetDate.getTime());
      const bDiff = Math.abs(new Date(b.date).getTime() - targetDate.getTime());
      return aDiff - bDiff;
    });
}
