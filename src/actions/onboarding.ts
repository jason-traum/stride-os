'use server';

import { db, userSettings, profiles, races, raceResults } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { generateAura } from '@/lib/aura-color';
import type { RacePriority, RunnerPersona } from '@/lib/schema';
import { getActiveProfileId } from '@/lib/profile-server';

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

  // ==================== Extended Profile Fields (Steps 6-10) ====================

  // Step 6: Athletic Background
  yearsRunning?: number;
  athleticBackground?: string[];
  highestWeeklyMileageEver?: number;
  weeksAtHighestMileage?: number;
  timeSincePeakFitness?: 'current' | '3_months' | '6_months' | '1_year' | '2_plus_years';

  // Step 7: Training Preferences
  preferredQualityDays?: string[];
  comfortVO2max?: number;
  comfortTempo?: number;
  comfortHills?: number;
  comfortLongRuns?: number;
  comfortTrackWork?: number;
  openToDoubles?: boolean;
  trainBy?: 'pace' | 'heart_rate' | 'feel' | 'mixed';

  // Step 7b: Training Philosophy
  trainingPhilosophy?: 'pfitzinger' | 'hansons' | 'daniels' | 'lydiard' | 'polarized' | 'balanced';
  downWeekFrequency?: 'every_3_weeks' | 'every_4_weeks' | 'as_needed' | 'rarely';
  longRunMaxStyle?: 'traditional' | 'hansons_style' | 'progressive';
  fatigueManagementStyle?: 'back_off' | 'balanced' | 'push_through' | 'modify';
  workoutVarietyPref?: 'same' | 'moderate' | 'lots';
  mlrPreference?: boolean;
  progressiveLongRunsOk?: boolean;

  // Step 8: Injury & Recovery
  commonInjuries?: string[];
  currentInjuries?: string;
  needsExtraRest?: boolean;
  typicalSleepHours?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  stressLevel?: 'low' | 'moderate' | 'high' | 'very_high';

  // Step 9: Schedule & Lifestyle
  preferredRunTime?: 'early_morning' | 'morning' | 'midday' | 'evening' | 'flexible';
  weekdayAvailabilityMinutes?: number;
  weekendAvailabilityMinutes?: number;
  heatSensitivity?: number;
  coldSensitivity?: number;
  surfacePreference?: 'road' | 'trail' | 'track' | 'mixed';
  groupVsSolo?: 'solo' | 'group' | 'either';

  // Step 10: Race PRs (Optional)
  marathonPR?: { hours: number; minutes: number; seconds: number } | null;
  halfMarathonPR?: { hours: number; minutes: number; seconds: number } | null;
  tenKPR?: { minutes: number; seconds: number } | null;
  fiveKPR?: { minutes: number; seconds: number } | null;
}

/**
 * Save the quick onboarding form data.
 */
export async function saveOnboardingData(data: OnboardingData) {
  const now = new Date().toISOString();
  const profileId = await getActiveProfileId();
  if (!profileId) throw new Error('No active profile');
  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });

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

  // Helper to convert PR object to seconds
  const prToSeconds = (pr: { hours?: number; minutes: number; seconds: number } | null | undefined): number | null => {
    if (!pr) return null;
    return ((pr.hours || 0) * 3600) + (pr.minutes * 60) + pr.seconds;
  };

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
    onboardingStep: 10,
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
    // Extended profile fields (Steps 6-10)
    ...(data.yearsRunning !== undefined && { yearsRunning: data.yearsRunning }),
    ...(data.athleticBackground && { athleticBackground: data.athleticBackground.join(', ') }),
    ...(data.highestWeeklyMileageEver !== undefined && { highestWeeklyMileageEver: data.highestWeeklyMileageEver }),
    ...(data.weeksAtHighestMileage !== undefined && { weeksAtHighestMileage: data.weeksAtHighestMileage }),
    ...(data.timeSincePeakFitness && { timeSincePeakFitness: data.timeSincePeakFitness }),
    ...(data.preferredQualityDays && { preferredQualityDays: JSON.stringify(data.preferredQualityDays) }),
    ...(data.comfortVO2max !== undefined && { comfortVO2max: data.comfortVO2max }),
    ...(data.comfortTempo !== undefined && { comfortTempo: data.comfortTempo }),
    ...(data.comfortHills !== undefined && { comfortHills: data.comfortHills }),
    ...(data.comfortLongRuns !== undefined && { comfortLongRuns: data.comfortLongRuns }),
    ...(data.comfortTrackWork !== undefined && { comfortTrackWork: data.comfortTrackWork }),
    ...(data.openToDoubles !== undefined && { openToDoubles: data.openToDoubles }),
    ...(data.trainBy && { trainBy: data.trainBy }),
    // Training philosophy fields (Step 7b)
    ...(data.trainingPhilosophy && { trainingPhilosophy: data.trainingPhilosophy }),
    ...(data.downWeekFrequency && { downWeekFrequency: data.downWeekFrequency }),
    ...(data.longRunMaxStyle && { longRunMaxStyle: data.longRunMaxStyle }),
    ...(data.fatigueManagementStyle && { fatigueManagementStyle: data.fatigueManagementStyle }),
    ...(data.workoutVarietyPref && { workoutVarietyPref: data.workoutVarietyPref }),
    ...(data.mlrPreference !== undefined && { mlrPreference: data.mlrPreference }),
    ...(data.progressiveLongRunsOk !== undefined && { progressiveLongRunsOk: data.progressiveLongRunsOk }),
    ...(data.commonInjuries && { commonInjuries: JSON.stringify(data.commonInjuries) }),
    ...(data.currentInjuries && { currentInjuries: data.currentInjuries }),
    ...(data.needsExtraRest !== undefined && { needsExtraRest: data.needsExtraRest }),
    ...(data.typicalSleepHours !== undefined && { typicalSleepHours: data.typicalSleepHours }),
    ...(data.sleepQuality && { sleepQuality: data.sleepQuality }),
    ...(data.stressLevel && { stressLevel: data.stressLevel }),
    ...(data.preferredRunTime && { preferredRunTime: data.preferredRunTime }),
    ...(data.weekdayAvailabilityMinutes !== undefined && { weekdayAvailabilityMinutes: data.weekdayAvailabilityMinutes }),
    ...(data.weekendAvailabilityMinutes !== undefined && { weekendAvailabilityMinutes: data.weekendAvailabilityMinutes }),
    ...(data.heatSensitivity !== undefined && { heatSensitivity: data.heatSensitivity }),
    ...(data.coldSensitivity !== undefined && { coldSensitivity: data.coldSensitivity }),
    ...(data.surfacePreference && { surfacePreference: data.surfacePreference }),
    ...(data.groupVsSolo && { groupVsSolo: data.groupVsSolo }),
    // Race PRs
    ...(data.marathonPR && { marathonPR: prToSeconds(data.marathonPR) }),
    ...(data.halfMarathonPR && { halfMarathonPR: prToSeconds(data.halfMarathonPR) }),
    ...(data.tenKPR && { tenKPR: prToSeconds(data.tenKPR) }),
    ...(data.fiveKPR && { fiveKPR: prToSeconds(data.fiveKPR) }),
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

  // Generate aura colors from the settings data and update the profile
  const aura = generateAura(settingsData);
  const settingsRow = existing ?? (await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  }));
  if (settingsRow?.profileId) {
    await db.update(profiles)
      .set({
        auraColorStart: aura.start,
        auraColorEnd: aura.end,
        updatedAt: now,
      })
      .where(eq(profiles.id, settingsRow.profileId));
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
 * Get current user profile for coach context.
 */
export async function getUserProfile() {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, profileId)
  });

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
