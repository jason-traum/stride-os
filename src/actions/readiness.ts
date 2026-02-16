'use server';

import { db, workouts, assessments, type Workout, type Assessment } from '@/lib/db';
import { desc, gte, eq } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { calculateReadiness, getDefaultReadiness, type ReadinessResult, type ReadinessFactors } from '@/lib/readiness';
import { getFitnessTrendData } from './fitness';

/**
 * Get today's readiness score with factors
 */
export async function getTodayReadinessWithFactors(): Promise<{
  result: ReadinessResult;
  factors: ReadinessFactors;
}> {
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
    .where(gte(workouts.date, weekAgoStr))
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
    const fitnessData = await getFitnessTrendData(30);
    tsb = fitnessData.currentTsb;
  } catch {
    // Fitness data might not be available
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

    // Life stressors (check if any life tags)
    hasLifeStressors: mostRecentAssessment?.lifeTags
      ? JSON.parse(mostRecentAssessment.lifeTags).length > 0
      : false,
  };

  // If we have very little data, return default
  const hasData = Object.values(factors).some(v => v !== undefined && v !== false);
  if (!hasData) {
    return {
      result: getDefaultReadiness(),
      factors: {}
    };
  }

  return {
    result: calculateReadiness(factors),
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

/**
 * Get readiness trend over time
 */
export async function getReadinessTrend(days: number = 14): Promise<Array<{
  date: string;
  score: number;
}>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = toLocalDateString(startDate);

  // Get all workouts in range with assessments
  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, startDateStr))
    .orderBy(desc(workouts.date));

  // Get all assessments for these workouts
  const workoutIds = recentWorkouts.map(w => w.id);
  if (workoutIds.length === 0) return [];

  const allAssessments = await db
    .select()
    .from(assessments)
    .where(gte(assessments.workoutId, Math.min(...workoutIds)));

  const assessmentMap = new Map<number, Assessment>();
  for (const a of allAssessments) {
    if (workoutIds.includes(a.workoutId)) {
      assessmentMap.set(a.workoutId, a);
    }
  }

  // Calculate readiness for each day that has data
  const trend: Array<{ date: string; score: number }> = [];

  for (const workout of recentWorkouts) {
    const assessment = assessmentMap.get(workout.id);
    if (!assessment) continue;

    const factors: ReadinessFactors = {
      sleepQuality: assessment.sleepQuality ?? undefined,
      sleepHours: assessment.sleepHours ?? undefined,
      soreness: assessment.soreness ?? undefined,
      legsFeel: assessment.legsFeel ?? undefined,
      stress: assessment.stress ?? undefined,
      mood: assessment.mood ?? undefined,
      illness: assessment.illness ?? undefined,
    };

    const result = calculateReadiness(factors);
    trend.push({
      date: workout.date,
      score: result.score,
    });
  }

  return trend.reverse(); // Oldest first for charting
}
