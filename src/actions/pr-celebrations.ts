'use server';

import { db } from '@/lib/db';
import { stravaBestEfforts, workouts } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';
import { calculateVDOT } from '@/lib/training/vdot-calculator';
import { createProfileAction } from '@/lib/action-utils';

// Standard distances for PR tracking (matches personal-records.ts)
const STANDARD_DISTANCES = [
  { key: '400m', label: '400m', meters: 400, stravaNames: ['400m'] },
  { key: '1K', label: '1K', meters: 1000, stravaNames: ['1k', '1K'] },
  { key: '1mi', label: '1 Mile', meters: 1609.34, stravaNames: ['1 mile'] },
  { key: '5K', label: '5K', meters: 5000, stravaNames: ['5k', '5K'] },
  { key: '10K', label: '10K', meters: 10000, stravaNames: ['10k', '10K'] },
  { key: 'HM', label: 'Half Marathon', meters: 21097, stravaNames: ['Half-Marathon', 'half marathon'] },
  { key: 'Marathon', label: 'Marathon', meters: 42195, stravaNames: ['Marathon', 'marathon'] },
] as const;

// Map Strava effort name -> canonical distance key
const stravaNameToKey = new Map<string, string>();
const stravaNameToDistance = new Map<string, typeof STANDARD_DISTANCES[number]>();
STANDARD_DISTANCES.forEach(d => {
  d.stravaNames.forEach(n => {
    stravaNameToKey.set(n.toLowerCase(), d.key);
    stravaNameToDistance.set(n.toLowerCase(), d);
  });
});

export interface PRCelebration {
  /** stravaBestEfforts.id of the new PR */
  bestEffortId: number;
  /** Canonical distance key, e.g. "5K" */
  distanceKey: string;
  /** Display label, e.g. "5K" */
  distanceLabel: string;
  /** Distance in meters */
  distanceMeters: number;
  /** New PR time in seconds */
  newTimeSeconds: number;
  /** Previous best time in seconds (null if first effort at this distance) */
  oldTimeSeconds: number | null;
  /** Time improvement in seconds (positive = faster) */
  improvementSeconds: number | null;
  /** Improvement as percentage (positive = faster) */
  improvementPct: number | null;
  /** VDOT from new PR */
  newVdot: number;
  /** VDOT from old PR (null if no previous) */
  oldVdot: number | null;
  /** VDOT change (positive = improvement) */
  vdotChange: number | null;
  /** Date of the PR workout */
  date: string;
  /** Workout ID */
  workoutId: number;
  /** Strava activity name */
  workoutName: string | null;
}

export interface PRCelebrationsData {
  celebrations: PRCelebration[];
}

/**
 * Get recent PRs from the last 30 days for celebration display.
 * Finds stravaBestEfforts with prRank=1, then looks up the previous best
 * at each distance to compute improvement stats.
 */
export const getRecentPRs = createProfileAction(
  async (profileId: number): Promise<PRCelebrationsData> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch all best efforts for this profile's workouts (joined with workout metadata)
    const effortsRaw = await db
      .select({
        id: stravaBestEfforts.id,
        workoutId: stravaBestEfforts.workoutId,
        name: stravaBestEfforts.name,
        distanceMeters: stravaBestEfforts.distanceMeters,
        movingTimeSeconds: stravaBestEfforts.movingTimeSeconds,
        prRank: stravaBestEfforts.prRank,
        workoutDate: workouts.date,
        workoutName: workouts.stravaName,
      })
      .from(stravaBestEfforts)
      .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
      .where(eq(workouts.profileId, profileId))
      .orderBy(asc(stravaBestEfforts.movingTimeSeconds));

    // Group efforts by distance key
    type EffortRow = typeof effortsRaw[number];
    const effortsByDistance: Record<string, EffortRow[]> = {};

    for (const effort of effortsRaw) {
      const key = stravaNameToKey.get(effort.name.toLowerCase());
      if (!key) continue;
      if (!effortsByDistance[key]) {
        effortsByDistance[key] = [];
      }
      effortsByDistance[key].push(effort);
    }

    const celebrations: PRCelebration[] = [];

    for (const distKey of Object.keys(effortsByDistance)) {
      const efforts = effortsByDistance[distKey];
      // Find PRs (prRank=1) from the last 30 days
      const recentPRs = efforts.filter(
        (e: EffortRow) => e.prRank === 1 && e.workoutDate >= thirtyDaysAgoStr
      );

      if (recentPRs.length === 0) continue;

      // The actual PR is the fastest among prRank=1 efforts
      const pr = recentPRs[0]; // Already sorted by movingTimeSeconds asc

      const dist = STANDARD_DISTANCES.find(d => d.key === distKey);
      if (!dist) continue;

      // Find the previous best: the fastest effort at this distance that was set BEFORE the PR date
      const priorEfforts = efforts.filter(
        (e: EffortRow) => e.workoutDate < pr.workoutDate
      );
      // priorEfforts is already sorted by movingTimeSeconds asc
      const previousBest = priorEfforts.length > 0 ? priorEfforts[0] : null;

      const newVdot = calculateVDOT(dist.meters, pr.movingTimeSeconds);
      const oldVdot = previousBest
        ? calculateVDOT(dist.meters, previousBest.movingTimeSeconds)
        : null;

      const improvementSeconds = previousBest
        ? previousBest.movingTimeSeconds - pr.movingTimeSeconds
        : null;
      const improvementPct = previousBest
        ? ((previousBest.movingTimeSeconds - pr.movingTimeSeconds) / previousBest.movingTimeSeconds) * 100
        : null;
      const vdotChange = oldVdot !== null ? newVdot - oldVdot : null;

      celebrations.push({
        bestEffortId: pr.id,
        distanceKey: distKey,
        distanceLabel: dist.label,
        distanceMeters: dist.meters,
        newTimeSeconds: pr.movingTimeSeconds,
        oldTimeSeconds: previousBest?.movingTimeSeconds ?? null,
        improvementSeconds,
        improvementPct: improvementPct !== null ? Math.round(improvementPct * 100) / 100 : null,
        newVdot,
        oldVdot,
        vdotChange: vdotChange !== null ? Math.round(vdotChange * 10) / 10 : null,
        date: pr.workoutDate,
        workoutId: pr.workoutId,
        workoutName: pr.workoutName,
      });
    }

    // Sort by date descending (most recent PR first)
    celebrations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { celebrations };
  },
  'getRecentPRs'
);
