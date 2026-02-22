'use server';

import { db, workouts, plannedWorkouts } from '@/lib/db';
import { desc, gte, eq, and } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { createProfileAction } from '@/lib/action-utils';
import { getFitnessTrendData } from './fitness';
import { getTodayReadinessWithFactors } from './readiness';
import type { WorkoutType, Workout } from '@/lib/schema';
import type { ReadinessResult, ReadinessFactors } from '@/lib/readiness';

// --- Types ---

export interface TrainingCueFactor {
  label: string;
  value: string;
  impact: 'positive' | 'neutral' | 'caution' | 'warning';
}

export type PlanAlignment = 'agrees' | 'suggests_easier' | 'suggests_harder';

export interface TrainingCue {
  suggestedType: WorkoutType | 'rest';
  suggestedName: string;
  distanceRange: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  factors: TrainingCueFactor[];
  plannedWorkout?: {
    name: string;
    workoutType: string;
    targetDistanceMiles: number | null;
  };
  alignment?: PlanAlignment;
}

// --- Helpers ---

const QUALITY_TYPES = new Set<string>(['tempo', 'threshold', 'interval', 'repetition', 'race']);
const HARD_TYPES = new Set<string>(['tempo', 'threshold', 'interval', 'repetition', 'race', 'long']);

function isWeekend(): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = tomorrow.getDay();
  return day === 0 || day === 6; // Sun or Sat
}

function countHardDaysThisWeek(recentWorkouts: Workout[]): number {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const mondayStr = toLocalDateString(monday);

  return recentWorkouts.filter(
    (w) => w.date >= mondayStr && HARD_TYPES.has(w.workoutType)
  ).length;
}

function countConsecutiveRestDays(recentWorkouts: Workout[]): number {
  const today = toLocalDateString(new Date());
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() - 1);
    const dStr = toLocalDateString(d);
    if (dStr >= today) continue;
    const hasWorkout = recentWorkouts.some((w) => w.date === dStr);
    if (!hasWorkout) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getWeeklyMileage(recentWorkouts: Workout[]): number {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const mondayStr = toLocalDateString(monday);

  return recentWorkouts
    .filter((w) => w.date >= mondayStr)
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
}

function getAvgWeeklyMileage(recentWorkouts: Workout[]): number {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoff = toLocalDateString(fourWeeksAgo);

  const total = recentWorkouts
    .filter((w) => w.date >= cutoff)
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  return total / 4;
}

function getTypeIntensityRank(type: WorkoutType | 'rest'): number {
  const ranks: Record<string, number> = {
    rest: 0,
    recovery: 1,
    easy: 2,
    steady: 3,
    long: 4,
    marathon: 5,
    tempo: 6,
    threshold: 7,
    interval: 8,
    repetition: 9,
    race: 10,
  };
  return ranks[type] ?? 2;
}

// --- Main Engine ---

/**
 * Get smart training cue with optional pre-fetched readiness data.
 * When called from pages that already fetch readiness (e.g., /today),
 * pass the readiness data to avoid a duplicate DB round-trip.
 */
async function _getSmartTrainingCue(
  profileId: number,
  prefetchedReadiness?: { result: ReadinessResult; factors: ReadinessFactors } | null,
): Promise<TrainingCue | null> {
  // Only fetch readiness if not provided by caller
  const readinessPromise: Promise<{ result: ReadinessResult; factors: ReadinessFactors } | null> = prefetchedReadiness !== undefined
    ? Promise.resolve(prefetchedReadiness)
    : getTodayReadinessWithFactors().then(r => r.success ? r.data : null).catch(() => null);

  // Parallel data fetches
  const [fitnessData, readinessData, recentWorkouts, tomorrowPlanned] = await Promise.all([
    getFitnessTrendData(30, profileId).catch(() => null),
    readinessPromise,
    getRecentWorkouts(profileId),
    getTomorrowPlannedWorkout(),
  ]);

  // Need at least fitness data to make a suggestion
  if (!fitnessData) return null;

  const tsb = fitnessData.currentTsb;
  const readinessScore = readinessData?.result.score ?? 65;
  const hardDays = countHardDaysThisWeek(recentWorkouts);
  const restDays = countConsecutiveRestDays(recentWorkouts);
  const weeklyMiles = getWeeklyMileage(recentWorkouts);
  const avgWeeklyMiles = getAvgWeeklyMileage(recentWorkouts);
  const factors: TrainingCueFactor[] = [];

  // --- Base suggestion from TSB ---
  let suggestedType: WorkoutType | 'rest';
  let suggestedName: string;
  let distMin: number;
  let distMax: number;
  let reasoning: string;

  if (tsb < -20) {
    suggestedType = 'recovery';
    suggestedName = 'Rest or Very Easy Run';
    distMin = 3;
    distMax = 4;
    reasoning = 'Your body is significantly fatigued. Prioritize recovery.';
    factors.push({ label: 'TSB', value: `${tsb.toFixed(0)}`, impact: 'warning' });
  } else if (tsb < -10) {
    suggestedType = 'easy';
    suggestedName = 'Easy Run';
    distMin = 4;
    distMax = 6;
    reasoning = 'Moderate fatigue — keep it easy to absorb recent training.';
    factors.push({ label: 'TSB', value: `${tsb.toFixed(0)}`, impact: 'caution' });
  } else if (tsb < 0) {
    suggestedType = hardDays < 2 ? 'steady' : 'easy';
    suggestedName = hardDays < 2 ? 'Easy/Moderate Run' : 'Easy Run';
    distMin = 5;
    distMax = 7;
    reasoning = 'Building fitness — a quality session is fine if you haven\'t done too many this week.';
    factors.push({ label: 'TSB', value: `${tsb.toFixed(0)}`, impact: 'neutral' });
  } else if (tsb <= 10) {
    suggestedType = 'tempo';
    suggestedName = 'Quality Session';
    distMin = 5;
    distMax = 8;
    reasoning = 'Optimal form — great day for a quality workout.';
    factors.push({ label: 'TSB', value: `+${tsb.toFixed(0)}`, impact: 'positive' });
  } else {
    suggestedType = 'long';
    suggestedName = 'Long Run or Quality Session';
    distMin = 6;
    distMax = 10;
    reasoning = 'Well-rested — push harder or go longer today.';
    factors.push({ label: 'TSB', value: `+${tsb.toFixed(0)}`, impact: 'positive' });
  }

  // --- Modifiers ---

  // 3+ hard days this week → downgrade
  if (hardDays >= 3) {
    if (QUALITY_TYPES.has(suggestedType)) {
      suggestedType = 'easy';
      suggestedName = 'Easy Run';
      reasoning = 'Already 3+ hard days this week. Time to recover.';
    }
    distMax = Math.min(distMax, 6);
    factors.push({ label: 'Hard days', value: `${hardDays} this week`, impact: 'caution' });
  } else {
    factors.push({ label: 'Hard days', value: `${hardDays} this week`, impact: hardDays >= 2 ? 'neutral' : 'positive' });
  }

  // Readiness modifiers
  if (readinessScore < 50) {
    if (QUALITY_TYPES.has(suggestedType)) {
      suggestedType = 'easy';
      suggestedName = 'Easy Run';
      reasoning = 'Readiness is low — keep it easy today.';
    }
    distMax = Math.min(distMax, 5);
    factors.push({ label: 'Readiness', value: `${readinessScore}`, impact: 'warning' });
  } else if (readinessScore > 80) {
    if (suggestedType === 'easy' && hardDays < 2 && tsb > -10) {
      suggestedType = 'steady';
      suggestedName = 'Moderate Effort Run';
      reasoning = 'High readiness — you could push a bit today.';
    }
    factors.push({ label: 'Readiness', value: `${readinessScore}`, impact: 'positive' });
  } else {
    factors.push({ label: 'Readiness', value: `${readinessScore}`, impact: 'neutral' });
  }

  // Weekend → prefer long run if not fatigued
  if (isWeekend() && tsb > -15 && hardDays < 3 && suggestedType !== 'recovery') {
    if (suggestedType === 'easy' || suggestedType === 'steady') {
      suggestedType = 'long';
      suggestedName = 'Long Run';
      distMin = Math.max(distMin, 7);
      distMax = Math.max(distMax, 10);
      reasoning += ' Weekend is a good time for your long run.';
    }
    factors.push({ label: 'Weekend', value: 'Yes', impact: 'positive' });
  }

  // Weekly mileage >120% of average → cap distance
  if (avgWeeklyMiles > 0 && weeklyMiles > avgWeeklyMiles * 1.2) {
    distMax = Math.min(distMax, 5);
    distMin = Math.min(distMin, distMax); // Ensure min doesn't exceed max
    const ratio = weeklyMiles / avgWeeklyMiles;
    const ratioLabel = ratio >= 2 ? `${ratio.toFixed(1)}x avg` : `${Math.round(ratio * 100)}% of avg`;
    factors.push({ label: 'Weekly miles', value: `${weeklyMiles.toFixed(0)} (${ratioLabel})`, impact: 'caution' });
  } else if (avgWeeklyMiles > 0) {
    factors.push({ label: 'Weekly miles', value: `${weeklyMiles.toFixed(0)}`, impact: 'neutral' });
  }

  // Consecutive rest days >= 2 → can upgrade
  if (restDays >= 2 && suggestedType === 'easy') {
    suggestedType = 'steady';
    suggestedName = 'Easy/Moderate Run';
    reasoning = `${restDays} rest days — you should be fresh enough for moderate effort.`;
    factors.push({ label: 'Rest days', value: `${restDays} consecutive`, impact: 'positive' });
  }

  // Build distance range string
  const distanceRange = `${distMin}–${distMax} mi`;

  // --- Plan alignment ---
  let alignment: PlanAlignment | undefined;
  let plannedWorkoutInfo: TrainingCue['plannedWorkout'] | undefined;

  if (tomorrowPlanned) {
    plannedWorkoutInfo = {
      name: tomorrowPlanned.name,
      workoutType: tomorrowPlanned.workoutType,
      targetDistanceMiles: tomorrowPlanned.targetDistanceMiles,
    };

    const plannedRank = getTypeIntensityRank(tomorrowPlanned.workoutType as WorkoutType);
    const suggestedRank = getTypeIntensityRank(suggestedType);

    if (Math.abs(plannedRank - suggestedRank) <= 1) {
      alignment = 'agrees';
    } else if (suggestedRank < plannedRank) {
      alignment = 'suggests_easier';
    } else {
      alignment = 'suggests_harder';
    }
  }

  // Confidence based on data availability
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (fitnessData.metrics.length > 21 && readinessData) {
    confidence = 'high';
  } else if (fitnessData.metrics.length < 7) {
    confidence = 'low';
  }

  return {
    suggestedType,
    suggestedName,
    distanceRange,
    reasoning,
    confidence,
    factors,
    plannedWorkout: plannedWorkoutInfo,
    alignment,
  };
}

// --- Data fetchers ---

async function getRecentWorkouts(profileId?: number): Promise<Workout[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = toLocalDateString(sevenDaysAgo);

  const conditions = [gte(workouts.date, cutoff)];
  if (profileId) conditions.push(eq(workouts.profileId, profileId));

  return db
    .select()
    .from(workouts)
    .where(and(...conditions))
    .orderBy(desc(workouts.date));
}

async function getTomorrowPlannedWorkout() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toLocalDateString(tomorrow);

  return db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, tomorrowStr),
  });
}

export const getSmartTrainingCue = createProfileAction(_getSmartTrainingCue, 'getSmartTrainingCue');
