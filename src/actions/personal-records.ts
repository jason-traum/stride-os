'use server';

import { db } from '@/lib/db';
import { stravaBestEfforts, raceResults, workouts } from '@/lib/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { calculateVDOT } from '@/lib/training/vdot-calculator';
import { createProfileAction } from '@/lib/action-utils';
import { getActiveProfileId } from '@/lib/profile-server';

// Standard distances we track PRs for, ordered shortest to longest.
// Maps a canonical key to its display label, distance in meters, and
// the Strava best-effort names that correspond to it.
const STANDARD_DISTANCES = [
  { key: '400m', label: '400m', meters: 400, stravaNames: ['400m'] },
  { key: '1K', label: '1K', meters: 1000, stravaNames: ['1k', '1K'] },
  { key: '1mi', label: '1 Mile', meters: 1609.34, stravaNames: ['1 mile'] },
  { key: '5K', label: '5K', meters: 5000, stravaNames: ['5k', '5K'] },
  { key: '10K', label: '10K', meters: 10000, stravaNames: ['10k', '10K'] },
  { key: 'HM', label: 'Half Marathon', meters: 21097, stravaNames: ['Half-Marathon', 'half marathon'] },
  { key: 'Marathon', label: 'Marathon', meters: 42195, stravaNames: ['Marathon', 'marathon'] },
] as const;

// Map Strava effort name -> canonical distance key (case-insensitive lookup)
const stravaNameToKey = new Map<string, string>();
STANDARD_DISTANCES.forEach(d => {
  d.stravaNames.forEach(n => stravaNameToKey.set(n.toLowerCase(), d.key));
});

// Map raceResults distanceLabel -> canonical distance key
const raceDistanceLabelToKey: Record<string, string> = {
  '1_mile': '1mi',
  '5K': '5K',
  '10K': '10K',
  'half_marathon': 'HM',
  'marathon': 'Marathon',
};

// Rough meter ranges for mapping raceResults by distance (for non-labeled races)
function metersToKey(meters: number): string | null {
  if (meters >= 380 && meters <= 420) return '400m';
  if (meters >= 950 && meters <= 1050) return '1K';
  if (meters >= 1580 && meters <= 1650) return '1mi';
  if (meters >= 4800 && meters <= 5200) return '5K';
  if (meters >= 9500 && meters <= 10500) return '10K';
  if (meters >= 20500 && meters <= 21500) return 'HM';
  if (meters >= 41500 && meters <= 43000) return 'Marathon';
  return null;
}

export interface BestEffortTimelineEntry {
  id: string;               // "effort-{stravaBestEffort.id}" to avoid ID collisions
  name: string;             // Strava name e.g. "5k"
  distanceLabel: string;    // Canonical label e.g. "5K"
  distanceMeters: number;
  timeSeconds: number;
  date: string;
  workoutId: number;
  workoutName: string | null;
  vdot: number;
  source: 'strava_effort';
}

export interface PersonalRecord {
  distanceKey: string;
  distanceLabel: string;
  distanceMeters: number;
  // Best (PR) time
  prTimeSeconds: number;
  prDate: string;
  prWorkoutId: number | null;
  prSource: 'strava_effort' | 'race_result';
  prVdot: number;
  // Previous PR (for trend)
  previousPrTimeSeconds: number | null;
  improvementSeconds: number | null;
  // Is this a new PR (set in the last 30 days)?
  isRecentPr: boolean;
  // Top-3 recent performances at this distance
  recentTop3: Array<{
    timeSeconds: number;
    date: string;
    workoutId: number | null;
    source: 'strava_effort' | 'race_result';
  }>;
}

export interface PersonalRecordsData {
  records: PersonalRecord[];
  lastUpdated: string;
}

/**
 * Get personal records for standard distances.
 * Combines stravaBestEfforts and raceResults to find the best time at each distance,
 * plus recent top-3 and improvement trends.
 */
export const getPersonalRecords = createProfileAction(
  async (profileId: number): Promise<PersonalRecordsData> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch all strava best efforts for this profile's workouts, joined with workout date
    const effortsRaw = await db
      .select({
        id: stravaBestEfforts.id,
        workoutId: stravaBestEfforts.workoutId,
        name: stravaBestEfforts.name,
        distanceMeters: stravaBestEfforts.distanceMeters,
        movingTimeSeconds: stravaBestEfforts.movingTimeSeconds,
        prRank: stravaBestEfforts.prRank,
        workoutDate: workouts.date,
      })
      .from(stravaBestEfforts)
      .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
      .where(eq(workouts.profileId, profileId))
      .orderBy(asc(stravaBestEfforts.movingTimeSeconds));

    // Fetch all race results for this profile
    const racesRaw = await db
      .select()
      .from(raceResults)
      .where(eq(raceResults.profileId, profileId))
      .orderBy(asc(raceResults.finishTimeSeconds));

    // Build a map of distanceKey -> sorted list of performances
    type PerfEntry = {
      timeSeconds: number;
      date: string;
      workoutId: number | null;
      source: 'strava_effort' | 'race_result';
    };

    const perfsByDistance = new Map<string, PerfEntry[]>();

    // Initialize empty arrays for all standard distances
    STANDARD_DISTANCES.forEach(d => {
      perfsByDistance.set(d.key, []);
    });

    // Add strava best efforts
    for (const effort of effortsRaw) {
      const key = stravaNameToKey.get(effort.name.toLowerCase());
      if (!key) continue;
      const list = perfsByDistance.get(key);
      if (!list) continue;
      list.push({
        timeSeconds: effort.movingTimeSeconds,
        date: effort.workoutDate,
        workoutId: effort.workoutId,
        source: 'strava_effort',
      });
    }

    // Add race results
    for (const race of racesRaw) {
      // Try to match by distanceLabel first, then by meters
      let key = raceDistanceLabelToKey[race.distanceLabel];
      if (!key) {
        key = metersToKey(race.distanceMeters) ?? '';
      }
      if (!key) continue;
      const list = perfsByDistance.get(key);
      if (!list) continue;
      list.push({
        timeSeconds: race.finishTimeSeconds,
        date: race.date,
        workoutId: race.workoutId,
        source: 'race_result',
      });
    }

    // Build PersonalRecord for each distance
    const records: PersonalRecord[] = [];

    for (const dist of STANDARD_DISTANCES) {
      const perfs = perfsByDistance.get(dist.key) || [];
      if (perfs.length === 0) continue;

      // Sort by time ascending (fastest first)
      perfs.sort((a, b) => a.timeSeconds - b.timeSeconds);

      const best = perfs[0];
      const vdot = calculateVDOT(dist.meters, best.timeSeconds);

      // Find previous PR (second-best that was set BEFORE the best)
      // The "previous PR" is the fastest time among efforts dated before the current PR date
      const bestDate = best.date;
      const priorPerfs = perfs.filter(p => p.date < bestDate);
      const previousPr = priorPerfs.length > 0 ? priorPerfs[0] : null;
      const improvementSeconds = previousPr
        ? previousPr.timeSeconds - best.timeSeconds
        : null;

      // Is the PR from the last 30 days?
      const isRecentPr = best.date >= thirtyDaysAgoStr;

      // Recent top-3: take the 3 most recent performances (by date, not speed)
      const sortedByDateDesc = [...perfs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const recentTop3 = sortedByDateDesc.slice(0, 3).map(p => ({
        timeSeconds: p.timeSeconds,
        date: p.date,
        workoutId: p.workoutId,
        source: p.source,
      }));

      records.push({
        distanceKey: dist.key,
        distanceLabel: dist.label,
        distanceMeters: dist.meters,
        prTimeSeconds: best.timeSeconds,
        prDate: best.date,
        prWorkoutId: best.workoutId,
        prSource: best.source,
        prVdot: vdot,
        previousPrTimeSeconds: previousPr?.timeSeconds ?? null,
        improvementSeconds,
        isRecentPr,
        recentTop3,
      });
    }

    return {
      records,
      lastUpdated: new Date().toISOString(),
    };
  },
  'getPersonalRecords'
);

/**
 * Get best efforts formatted for the race history timeline.
 * Returns all Strava best efforts at standard distances, joined with workout
 * metadata (date, name). The timeline component handles PR-filtering.
 */
export async function getBestEffortPRs(profileId?: number): Promise<BestEffortTimelineEntry[]> {
  const resolvedProfileId = profileId ?? (await getActiveProfileId()) ?? 1;

  const effortsRaw = await db
    .select({
      id: stravaBestEfforts.id,
      workoutId: stravaBestEfforts.workoutId,
      name: stravaBestEfforts.name,
      distanceMeters: stravaBestEfforts.distanceMeters,
      movingTimeSeconds: stravaBestEfforts.movingTimeSeconds,
      workoutDate: workouts.date,
      workoutName: workouts.stravaName,
    })
    .from(stravaBestEfforts)
    .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
    .where(eq(workouts.profileId, resolvedProfileId))
    .orderBy(desc(workouts.date));

  const entries: BestEffortTimelineEntry[] = [];

  for (const effort of effortsRaw) {
    const key = stravaNameToKey.get(effort.name.toLowerCase());
    if (!key) continue;

    const dist = STANDARD_DISTANCES.find(d => d.key === key);
    if (!dist) continue;

    const vdot = calculateVDOT(dist.meters, effort.movingTimeSeconds);

    entries.push({
      id: `effort-${effort.id}`,
      name: effort.name,
      distanceLabel: dist.label,
      distanceMeters: dist.meters,
      timeSeconds: effort.movingTimeSeconds,
      date: effort.workoutDate,
      workoutId: effort.workoutId,
      workoutName: effort.workoutName,
      vdot,
      source: 'strava_effort',
    });
  }

  return entries;
}
