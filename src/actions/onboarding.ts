'use server';

import { db, userSettings, races, raceResults } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import type { RacePriority, RunnerPersona } from '@/lib/schema';

export interface OnboardingData {
  // Essential fields (Step 1)
  name: string;
  runnerPersona?: RunnerPersona;
  runnerPersonaNotes?: string;
  currentWeeklyMileage: number;
  runsPerWeekCurrent: number;
  currentLongRunMax: number;

  // Training goals (Step 2)
  peakWeeklyMileageTarget: number;
  preferredLongRunDay: string;
  requiredRestDays: string[];
  planAggressiveness: 'conservative' | 'moderate' | 'aggressive';
  qualitySessionsPerWeek: number;

  // Optional race result for VDOT calculation (Step 3)
  recentRace?: {
    distanceLabel: string;
    finishTimeSeconds: number;
    date: string;
  };

  // Goal race (Step 4 - required for plan generation)
  goalRace: {
    name: string;
    date: string;
    distanceLabel: string;
    priority: RacePriority;
    targetTimeSeconds?: number;
  };
}

/**
 * Check if user has completed onboarding.
 */
export async function checkOnboardingStatus() {
  const settings = await db.query.userSettings.findFirst();

  if (!settings) {
    return { needsOnboarding: true, step: 0 };
  }

  // Consider onboarding complete if they have a name and current mileage
  const hasEssentials = settings.name && settings.currentWeeklyMileage !== null;

  return {
    needsOnboarding: !hasEssentials,
    step: settings.onboardingStep ?? 0,
    onboardingCompleted: settings.onboardingCompleted ?? false,
  };
}

/**
 * Save the quick onboarding form data.
 */
export async function saveOnboardingData(data: OnboardingData) {
  const now = new Date().toISOString();
  const existing = await db.query.userSettings.findFirst();

  // Calculate VDOT from recent race if provided
  let vdot: number | null = null;
  let paceZones: ReturnType<typeof calculatePaceZones> | null = null;

  if (data.recentRace) {
    const distanceInfo = RACE_DISTANCES[data.recentRace.distanceLabel];
    if (distanceInfo) {
      vdot = calculateVDOT(distanceInfo.meters, data.recentRace.finishTimeSeconds);
      paceZones = calculatePaceZones(vdot);
    }
  }

  // Build the settings update
  const settingsData = {
    name: data.name,
    runnerPersona: data.runnerPersona ?? null,
    runnerPersonaNotes: data.runnerPersonaNotes ?? null,
    currentWeeklyMileage: data.currentWeeklyMileage,
    runsPerWeekCurrent: data.runsPerWeekCurrent,
    currentLongRunMax: data.currentLongRunMax,
    peakWeeklyMileageTarget: data.peakWeeklyMileageTarget,
    preferredLongRunDay: data.preferredLongRunDay as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    requiredRestDays: JSON.stringify(data.requiredRestDays),
    planAggressiveness: data.planAggressiveness,
    qualitySessionsPerWeek: data.qualitySessionsPerWeek,
    onboardingCompleted: true,
    onboardingStep: 5,
    updatedAt: now,
    // VDOT and pace zones (if calculated)
    ...(vdot && {
      vdot,
      easyPaceSeconds: paceZones?.easy,
      tempoPaceSeconds: paceZones?.tempo,
      thresholdPaceSeconds: paceZones?.threshold,
      intervalPaceSeconds: paceZones?.interval,
      marathonPaceSeconds: paceZones?.marathon,
      halfMarathonPaceSeconds: paceZones?.halfMarathon,
    }),
  };

  if (existing) {
    await db.update(userSettings)
      .set(settingsData)
      .where(eq(userSettings.id, existing.id));
  } else {
    await db.insert(userSettings).values({
      ...settingsData,
      createdAt: now,
      // Default location
      latitude: 40.7336,
      longitude: -74.0027,
      cityName: 'West Village, New York',
    });
  }

  // Save recent race as a race result if provided
  if (data.recentRace) {
    const distanceInfo = RACE_DISTANCES[data.recentRace.distanceLabel];
    if (distanceInfo) {
      await db.insert(raceResults).values({
        raceName: `${data.recentRace.distanceLabel} PR`,
        date: data.recentRace.date,
        distanceMeters: distanceInfo.meters,
        distanceLabel: data.recentRace.distanceLabel,
        finishTimeSeconds: data.recentRace.finishTimeSeconds,
        calculatedVdot: vdot,
        effortLevel: 'all_out',
        createdAt: now,
      });
    }
  }

  // Save goal race (required)
  const goalDistanceInfo = RACE_DISTANCES[data.goalRace.distanceLabel];
  if (goalDistanceInfo) {
    await db.insert(races).values({
      name: data.goalRace.name,
      date: data.goalRace.date,
      distanceMeters: goalDistanceInfo.meters,
      distanceLabel: data.goalRace.distanceLabel,
      priority: data.goalRace.priority,
      targetTimeSeconds: data.goalRace.targetTimeSeconds ?? null,
      trainingPlanGenerated: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Revalidate all relevant paths
  revalidatePath('/');
  revalidatePath('/today');
  revalidatePath('/settings');
  revalidatePath('/races');
  revalidatePath('/coach');
  revalidatePath('/onboarding');

  return { success: true, vdot };
}

/**
 * Update a specific onboarding field (for progressive updates via coach).
 */
export async function updateOnboardingField<K extends keyof typeof userSettings.$inferInsert>(
  field: K,
  value: (typeof userSettings.$inferInsert)[K]
) {
  const now = new Date().toISOString();
  const existing = await db.query.userSettings.findFirst();

  if (!existing) {
    throw new Error('User settings not found. Complete basic onboarding first.');
  }

  await db.update(userSettings)
    .set({
      [field]: value,
      updatedAt: now,
    } as Partial<typeof userSettings.$inferInsert>)
    .where(eq(userSettings.id, existing.id));

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/coach');

  return { success: true };
}

/**
 * Get current user profile for coach context.
 */
export async function getUserProfile() {
  const settings = await db.query.userSettings.findFirst();

  if (!settings) {
    return null;
  }

  // Return a summary of profile completeness
  const profileFields = {
    // Essentials
    name: !!settings.name,
    currentWeeklyMileage: settings.currentWeeklyMileage !== null,
    runsPerWeekCurrent: settings.runsPerWeekCurrent !== null,
    currentLongRunMax: settings.currentLongRunMax !== null,
    preferredLongRunDay: !!settings.preferredLongRunDay,

    // Training background
    yearsRunning: settings.yearsRunning !== null,
    highestWeeklyMileageEver: settings.highestWeeklyMileageEver !== null,

    // Pacing
    vdot: settings.vdot !== null,

    // Preferences
    planAggressiveness: !!settings.planAggressiveness,
    qualitySessionsPerWeek: settings.qualitySessionsPerWeek !== null,

    // Personal
    injuryHistory: !!settings.injuryHistory,
    stressLevel: !!settings.stressLevel,
  };

  const completedCount = Object.values(profileFields).filter(Boolean).length;
  const totalCount = Object.keys(profileFields).length;

  return {
    settings,
    profileCompleteness: {
      fields: profileFields,
      completed: completedCount,
      total: totalCount,
      percentage: Math.round((completedCount / totalCount) * 100),
    },
  };
}
