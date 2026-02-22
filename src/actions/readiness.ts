'use server';

import { db, workouts, assessments, type Workout, type Assessment } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { calculateReadiness, getDefaultReadiness, type ReadinessResult, type ReadinessFactors } from '@/lib/readiness';
import { getFitnessTrendData } from './fitness';
import { getActiveProfileId } from '@/lib/profile-server';
import { getSettings } from './settings';
import { getIntervalsWellness, type IntervalsWellness } from '@/lib/intervals';
import { decryptToken } from '@/lib/token-crypto';

/**
 * Get today's readiness score with factors
 */
export async function getTodayReadinessWithFactors(): Promise<{
  result: ReadinessResult;
  factors: ReadinessFactors;
}> {
  const profileId = await getActiveProfileId();
  const today = toLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);

  // Get recent workouts (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = toLocalDateString(weekAgo);

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        gte(workouts.date, weekAgoStr)
      )
    )
    .orderBy(desc(workouts.date));

  // Get yesterday's workout assessment if exists
  const yesterdayWorkout = recentWorkouts.find(w => w.date === yesterdayStr);
  let yesterdayAssessment: Assessment | null = null;

  if (yesterdayWorkout) {
    const assessmentResult = await db
      .select()
      .from(assessments)
      .where(eq(assessments.workoutId, yesterdayWorkout.id))
      .limit(1);
    yesterdayAssessment = assessmentResult[0] || null;
  }

  // Get most recent assessment for current state
  const mostRecentWorkout = recentWorkouts[0];
  let mostRecentAssessment: Assessment | null = null;

  if (mostRecentWorkout) {
    const assessmentResult = await db
      .select()
      .from(assessments)
      .where(eq(assessments.workoutId, mostRecentWorkout.id))
      .limit(1);
    mostRecentAssessment = assessmentResult[0] || null;
  }

  // Calculate days since last workout
  const lastWorkoutDate = recentWorkouts[0]?.date;
  const restDaysBefore = lastWorkoutDate
    ? Math.floor((new Date(today).getTime() - new Date(lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24))
    : 7; // If no recent workouts, assume well-rested

  // Get TSB from fitness data
  let tsb: number | undefined;
  try {
    const fitnessData = await getFitnessTrendData(30, profileId ?? undefined);
    tsb = fitnessData.currentTsb;
  } catch {
    // Fitness data might not be available
  }

  // Get HRV / resting HR from Intervals.icu wellness data (if connected)
  let hrv: number | undefined;
  let restingHR: number | undefined;
  let hrvBaseline: number | undefined;
  try {
    const settings = await getSettings(profileId ?? undefined);
    if (settings?.intervalsAthleteId && settings?.intervalsApiKey) {
      const apiKey = decryptToken(settings.intervalsApiKey);

      // Fetch today's wellness entry plus recent history for baseline
      const baselineStart = new Date();
      baselineStart.setDate(baselineStart.getDate() - 30);
      const baselineStartStr = baselineStart.toISOString().split('T')[0];

      const wellnessEntries: IntervalsWellness[] = await getIntervalsWellness(
        settings.intervalsAthleteId,
        apiKey,
        { oldest: baselineStartStr, newest: today }
      );

      // Find today's entry (or yesterday's as fallback for morning before sync)
      const todayEntry = wellnessEntries.find(w => w.date === today);
      const yesterdayEntry = wellnessEntries.find(w => w.date === yesterdayStr);
      const latestEntry = todayEntry || yesterdayEntry;

      if (latestEntry) {
        hrv = latestEntry.hrv ?? latestEntry.hrvSDNN ?? undefined;
        restingHR = latestEntry.restingHR ?? undefined;
      }

      // Calculate HRV baseline from recent entries (excluding today)
      const baselineEntries = wellnessEntries
        .filter(w => w.date !== today && (w.hrv || w.hrvSDNN))
        .map(w => w.hrv ?? w.hrvSDNN ?? 0)
        .filter(v => v > 0);

      if (baselineEntries.length >= 5) {
        hrvBaseline = baselineEntries.reduce((sum, v) => sum + v, 0) / baselineEntries.length;
      }
    }
  } catch {
    // Intervals.icu not connected or API error — skip HRV silently
  }

  // Build readiness factors from available data
  const factors: ReadinessFactors = {
    // From most recent assessment
    sleepQuality: mostRecentAssessment?.sleepQuality ?? undefined,
    sleepHours: mostRecentAssessment?.sleepHours ?? undefined,
    soreness: mostRecentAssessment?.soreness ?? undefined,
    legsFeel: mostRecentAssessment?.legsFeel ?? undefined,
    stress: mostRecentAssessment?.stress ?? undefined,
    mood: mostRecentAssessment?.mood ?? undefined,
    illness: mostRecentAssessment?.illness ?? undefined,

    // From yesterday's assessment
    yesterdayRpe: yesterdayAssessment?.rpe ?? undefined,

    // From training data
    tsb,
    restDaysBefore,

    // From Intervals.icu wellness (HRV)
    hrv,
    restingHR,
    hrvBaseline,

    // Life stressors (check if any life tags)
    hasLifeStressors: mostRecentAssessment?.lifeTags
      ? JSON.parse(mostRecentAssessment.lifeTags).length > 0
      : false,
  };

  // If we have very little data, return default (null score)
  const hasData = Object.values(factors).some(v => v !== undefined && v !== false);
  if (!hasData) {
    return {
      result: getDefaultReadiness(),
      factors: {}
    };
  }

  const result = calculateReadiness(factors);

  // Track staleness: how old is the most recent assessment data?
  if (mostRecentWorkout && mostRecentAssessment) {
    const daysSinceAssessment = Math.floor(
      (new Date(today).getTime() - new Date(mostRecentWorkout.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    result.daysSinceAssessment = daysSinceAssessment;
    result.isStale = daysSinceAssessment > 1;

    // If assessment is >2 days old, downgrade confidence significantly
    if (daysSinceAssessment > 2) {
      result.confidence = Math.min(result.confidence, 0.3);
      result.message = `Based on data from ${daysSinceAssessment} days ago — log a new assessment for an up-to-date score`;
    } else if (daysSinceAssessment > 1) {
      // 2 days old: mild confidence reduction
      result.confidence = Math.min(result.confidence, 0.6);
    }
  } else if (mostRecentWorkout && !mostRecentAssessment) {
    // Has workouts but no assessments at all
    result.isStale = true;
  }

  return {
    result,
    factors
  };
}

/**
 * Get today's readiness score (backward compatible)
 */
export async function getTodayReadiness(): Promise<ReadinessResult> {
  const { result } = await getTodayReadinessWithFactors();
  return result;
}

