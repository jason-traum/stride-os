'use server';

import { db } from '@/lib/db';
import { workouts, assessments } from '@/lib/schema';
import { desc, eq, and, isNotNull, gte, gt } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// Types for the training partner analysis

export interface GroupStats {
  count: number;
  avgPaceSeconds: number | null;
  avgDistanceMiles: number;
  avgHr: number | null;
  avgRpe: number | null;
  avgMood: number | null; // mood as enjoyment proxy
}

export interface TypeBreakdown {
  workoutType: string;
  solo: GroupStats;
  group: GroupStats;
  paceDifferentialSeconds: number | null; // negative = faster on group runs
  count: number; // total runs of this type with athlete count data
}

export interface TrainingPartnerResult {
  solo: GroupStats;
  group: GroupStats;
  paceDifferentialSeconds: number | null; // negative = faster on group runs
  typeBreakdowns: TypeBreakdown[];
  totalAnalyzed: number;
  hasEnoughGroupData: boolean; // at least 3 group runs to make meaningful comparison
}

/**
 * Calculate average from array of numbers, ignoring nulls.
 */
function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function avgFloat(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Build GroupStats from a set of workouts + their assessments.
 */
function buildGroupStats(
  runs: Array<{
    avgPaceSeconds: number | null;
    distanceMiles: number | null;
    avgHr: number | null;
    rpe: number | null;
    mood: number | null;
  }>
): GroupStats {
  return {
    count: runs.length,
    avgPaceSeconds: avg(runs.map(r => r.avgPaceSeconds)),
    avgDistanceMiles: Math.round(avgFloat(runs.map(r => r.distanceMiles)) * 10) / 10,
    avgHr: avg(runs.map(r => r.avgHr)),
    avgRpe: avg(runs.map(r => r.rpe)),
    avgMood: avg(runs.map(r => r.mood)),
  };
}

// Non-running types to exclude
const EXCLUDE_TYPES = ['cross_train', 'other'];

// Internal row type for enriched workouts
interface EnrichedWorkout {
  id: number;
  date: string;
  workoutType: string;
  avgPaceSeconds: number | null;
  distanceMiles: number | null;
  avgHr: number | null;
  athleteCount: number | null;
  rpe: number | null;
  mood: number | null;
}

/**
 * Analyze the training partner effect: solo vs group running performance.
 * Correlates stravaAthleteCount with pace, RPE, and enjoyment (mood).
 */
export const getTrainingPartnerData = createProfileAction(
  async (profileId: number): Promise<TrainingPartnerResult> => {
    // Query workouts that have stravaAthleteCount and meaningful distance (> 1 mile)
    const allWorkouts = await db
      .select({
        id: workouts.id,
        date: workouts.date,
        workoutType: workouts.workoutType,
        avgPaceSeconds: workouts.avgPaceSeconds,
        distanceMiles: workouts.distanceMiles,
        avgHr: workouts.avgHr,
        athleteCount: workouts.stravaAthleteCount,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          isNotNull(workouts.stravaAthleteCount),
          gt(workouts.distanceMiles, 1)
        )
      )
      .orderBy(desc(workouts.date));

    // Filter to running workouts only
    const runWorkouts = allWorkouts.filter(
      (w: typeof allWorkouts[number]) =>
        !EXCLUDE_TYPES.includes(w.workoutType) && w.avgPaceSeconds && w.avgPaceSeconds > 0
    );

    if (runWorkouts.length === 0) {
      return {
        solo: { count: 0, avgPaceSeconds: null, avgDistanceMiles: 0, avgHr: null, avgRpe: null, avgMood: null },
        group: { count: 0, avgPaceSeconds: null, avgDistanceMiles: 0, avgHr: null, avgRpe: null, avgMood: null },
        paceDifferentialSeconds: null,
        typeBreakdowns: [],
        totalAnalyzed: 0,
        hasEnoughGroupData: false,
      };
    }

    // Get assessments for these workouts (RPE + mood for enjoyment)
    const workoutIds = runWorkouts.map((w: typeof runWorkouts[number]) => w.id);

    // Fetch assessments in batches to avoid huge IN clauses
    const allAssessments = await db
      .select({
        workoutId: assessments.workoutId,
        rpe: assessments.rpe,
        mood: assessments.mood,
      })
      .from(assessments);

    // Build assessment lookup
    const assessmentMap = new Map<number, { rpe: number | null; mood: number | null }>();
    for (const a of allAssessments) {
      if (workoutIds.includes(a.workoutId)) {
        assessmentMap.set(a.workoutId, { rpe: a.rpe, mood: a.mood });
      }
    }

    // Enrich workouts with assessment data
    const enriched: EnrichedWorkout[] = runWorkouts.map((w: typeof runWorkouts[number]) => ({
      ...w,
      rpe: assessmentMap.get(w.id)?.rpe ?? null,
      mood: assessmentMap.get(w.id)?.mood ?? null,
    }));

    // Split into solo vs group
    const soloRuns = enriched.filter((w: EnrichedWorkout) => w.athleteCount === 1);
    const groupRuns = enriched.filter((w: EnrichedWorkout) => w.athleteCount != null && w.athleteCount >= 2);

    const soloStats = buildGroupStats(soloRuns);
    const groupStats = buildGroupStats(groupRuns);

    // Pace differential: negative means group runs are faster
    let paceDifferentialSeconds: number | null = null;
    if (soloStats.avgPaceSeconds && groupStats.avgPaceSeconds) {
      paceDifferentialSeconds = groupStats.avgPaceSeconds - soloStats.avgPaceSeconds;
    }

    // Per-type breakdown
    const typeMap = new Map<string, { solo: EnrichedWorkout[]; group: EnrichedWorkout[] }>();
    for (const w of enriched) {
      const entry = typeMap.get(w.workoutType) || { solo: [], group: [] };
      if (w.athleteCount === 1) {
        entry.solo.push(w);
      } else if (w.athleteCount != null && w.athleteCount >= 2) {
        entry.group.push(w);
      }
      typeMap.set(w.workoutType, entry);
    }

    const typeBreakdowns: TypeBreakdown[] = Array.from(typeMap.entries())
      .map(([workoutType, { solo, group }]) => {
        const soloS = buildGroupStats(solo);
        const groupS = buildGroupStats(group);
        let diff: number | null = null;
        if (soloS.avgPaceSeconds && groupS.avgPaceSeconds) {
          diff = groupS.avgPaceSeconds - soloS.avgPaceSeconds;
        }
        return {
          workoutType,
          solo: soloS,
          group: groupS,
          paceDifferentialSeconds: diff,
          count: solo.length + group.length,
        };
      })
      // Only include types with at least 1 run in each group
      .filter(t => t.solo.count > 0 && t.group.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      solo: soloStats,
      group: groupStats,
      paceDifferentialSeconds,
      typeBreakdowns,
      totalAnalyzed: enriched.length,
      hasEnoughGroupData: groupRuns.length >= 3,
    };
  },
  'getTrainingPartnerData'
);
