'use server';

import { db, workouts } from '@/lib/db';
import { eq, and, desc, ne } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

export interface ComparisonWorkout {
  id: number;
  date: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHR: number | null;
  elevationGainFeet: number | null;
  trimp: number | null;
  /** Aerobic efficiency: pace seconds per HR beat (lower = more efficient) */
  efficiency: number | null;
}

export interface WorkoutComparisonResult {
  target: ComparisonWorkout;
  workoutType: string;
  previous: ComparisonWorkout[];
  deltas: {
    /** Pace delta vs most recent previous workout (negative = faster) */
    paceVsLast: number | null;
    /** HR delta vs most recent previous workout (negative = lower HR) */
    hrVsLast: number | null;
    /** Efficiency delta vs most recent (negative = more efficient) */
    efficiencyVsLast: number | null;
    /** Pace delta vs average of previous workouts (negative = faster) */
    paceVsAvg: number | null;
    /** HR delta vs average of previous workouts */
    hrVsAvg: number | null;
  };
  /** Ranking among the compared workouts by pace (1 = fastest) */
  paceRank: number;
  /** Total workouts being compared (target + previous) */
  totalCompared: number;
  /** Human-readable summary string */
  summary: string;
}

function toComparisonWorkout(w: {
  id: number;
  date: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHeartRate: number | null;
  avgHr: number | null;
  elevationGainFeet: number | null;
  elevationGainFt: number | null;
  trimp: number | null;
}): ComparisonWorkout {
  const avgHR = w.avgHeartRate ?? w.avgHr ?? null;
  const pace = w.avgPaceSeconds;
  const efficiency = pace && avgHR ? Math.round((pace / avgHR) * 100) / 100 : null;

  return {
    id: w.id,
    date: w.date,
    distanceMiles: w.distanceMiles,
    durationMinutes: w.durationMinutes,
    avgPaceSeconds: pace,
    avgHR,
    elevationGainFeet: w.elevationGainFeet ?? w.elevationGainFt ?? null,
    trimp: w.trimp,
    efficiency,
  };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const getWorkoutComparison = createProfileAction(
  async (profileId: number, workoutId: number): Promise<WorkoutComparisonResult | null> => {
    // Fetch target workout
    const targetRow = await db.query.workouts.findFirst({
      where: and(eq(workouts.id, workoutId), eq(workouts.profileId, profileId)),
    });

    if (!targetRow) return null;

    const workoutType = targetRow.workoutType || 'easy';

    // Find 5 most recent workouts of same type for same profile, excluding target
    const previousRows = await db.query.workouts.findMany({
      where: and(
        eq(workouts.profileId, profileId),
        eq(workouts.workoutType, workoutType),
        ne(workouts.id, workoutId),
      ),
      orderBy: [desc(workouts.date), desc(workouts.createdAt)],
      limit: 5,
    });

    if (previousRows.length === 0) return null;

    const target = toComparisonWorkout(targetRow);
    const previous = previousRows.map(toComparisonWorkout);

    // Calculate deltas vs most recent previous workout
    const last = previous[0];
    const paceVsLast =
      target.avgPaceSeconds != null && last.avgPaceSeconds != null
        ? target.avgPaceSeconds - last.avgPaceSeconds
        : null;
    const hrVsLast =
      target.avgHR != null && last.avgHR != null
        ? target.avgHR - last.avgHR
        : null;
    const efficiencyVsLast =
      target.efficiency != null && last.efficiency != null
        ? Math.round((target.efficiency - last.efficiency) * 100) / 100
        : null;

    // Calculate deltas vs average of all previous
    const prevWithPace = previous.filter((w: ComparisonWorkout) => w.avgPaceSeconds != null);
    const prevWithHR = previous.filter((w: ComparisonWorkout) => w.avgHR != null);

    const avgPrevPace =
      prevWithPace.length > 0
        ? prevWithPace.reduce((sum: number, w: ComparisonWorkout) => sum + w.avgPaceSeconds!, 0) / prevWithPace.length
        : null;
    const avgPrevHR =
      prevWithHR.length > 0
        ? prevWithHR.reduce((sum: number, w: ComparisonWorkout) => sum + w.avgHR!, 0) / prevWithHR.length
        : null;

    const paceVsAvg =
      target.avgPaceSeconds != null && avgPrevPace != null
        ? Math.round(target.avgPaceSeconds - avgPrevPace)
        : null;
    const hrVsAvg =
      target.avgHR != null && avgPrevHR != null
        ? Math.round(target.avgHR - avgPrevHR)
        : null;

    // Rank by pace among all compared workouts (target + previous)
    const allWithPace = [target, ...previous].filter((w) => w.avgPaceSeconds != null);
    allWithPace.sort((a, b) => a.avgPaceSeconds! - b.avgPaceSeconds!);
    const paceRank = allWithPace.findIndex((w) => w.id === target.id) + 1;
    const totalCompared = allWithPace.length;

    // Build summary string
    const typeLabel = workoutType.replace('_', ' ');
    let summary: string;

    if (paceRank === 1 && totalCompared > 1) {
      summary = `This was your fastest ${typeLabel} in the last ${totalCompared}`;
    } else if (paceRank === totalCompared && totalCompared > 1) {
      summary = `This was your slowest ${typeLabel} in the last ${totalCompared}`;
    } else if (totalCompared > 1) {
      summary = `This was your ${ordinal(paceRank)} fastest ${typeLabel} in the last ${totalCompared}`;
    } else {
      summary = `Only ${typeLabel} workout on record`;
    }

    // Add pace delta detail if available
    if (paceVsLast !== null) {
      const absDelta = Math.abs(paceVsLast);
      if (absDelta >= 1) {
        const direction = paceVsLast < 0 ? 'faster' : 'slower';
        summary += ` \u00B7 ${absDelta}s/mi ${direction} than your last`;
      }
    }

    return {
      target,
      workoutType,
      previous,
      deltas: {
        paceVsLast,
        hrVsLast,
        efficiencyVsLast,
        paceVsAvg,
        hrVsAvg,
      },
      paceRank,
      totalCompared,
      summary,
    };
  },
  'getWorkoutComparison'
);
