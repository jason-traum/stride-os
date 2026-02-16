/**
 * Best Effort Detection
 * Automatically detects personal records within runs using lap/segment data
 */

import type { Workout } from '@/lib/schema';

export interface WorkoutLap {
  lapIndex: number;
  distanceMeters?: number;
  elapsedTimeSeconds?: number;
}

export interface BestEffort {
  workoutId: number;
  workoutDate: string;
  distance: string; // '400m', '1mi', '5K', etc.
  distanceMeters: number;
  timeSeconds: number;
  timeFormatted: string;
  pace: string; // min:sec/mi
  startLapIndex: number;
  endLapIndex: number;
  isPR: boolean;
  rankAllTime?: number;
  improvementSeconds?: number; // Improvement over previous best
  equivalentVDOT?: number;
}

export interface EffortAnalysis {
  bestEfforts: BestEffort[];
  recentPRs: BestEffort[];
  notifications: string[];
}

// Standard distances to check (in meters)
const STANDARD_DISTANCES = [
  { name: '400m', meters: 400, tolerance: 10 },
  { name: '800m', meters: 800, tolerance: 20 },
  { name: '1K', meters: 1000, tolerance: 25 },
  { name: '1mi', meters: 1609.34, tolerance: 40 },
  { name: '5K', meters: 5000, tolerance: 100 },
  { name: '10K', meters: 10000, tolerance: 200 },
  { name: '10mi', meters: 16093.4, tolerance: 400 },
  { name: 'Half Marathon', meters: 21097.5, tolerance: 500 },
  { name: 'Marathon', meters: 42195, tolerance: 1000 },
];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatPace(secondsPerMile: number): string {
  const mins = Math.floor(secondsPerMile / 60);
  const secs = Math.round(secondsPerMile % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function calculateVDOT(distanceMiles: number, timeSeconds: number): number {
  // Simplified VDOT calculation based on Daniels' formula
  const velocity = distanceMiles / (timeSeconds / 3600); // mph
  const vo2 = velocity * 4.35; // Rough approximation
  return Math.round(vo2);
}

/**
 * Detect best efforts within a single workout using lap data
 */
export function detectBestEffortsInWorkout(
  workout: Workout,
  laps: WorkoutLap[],
  historicalBests?: Map<string, BestEffort>
): BestEffort[] {
  if (!laps || laps.length === 0) return [];

  const efforts: BestEffort[] = [];

  // Sort laps by index to ensure correct order
  const sortedLaps = [...laps].sort((a, b) => a.lapIndex - b.lapIndex);

  // For each standard distance, check all possible consecutive lap combinations
  STANDARD_DISTANCES.forEach(standardDist => {
    // Skip distances longer than the total workout
    if (workout.distanceMeters && workout.distanceMeters < standardDist.meters * 0.9) {
      return;
    }

    // Check all possible consecutive lap combinations
    for (let startIdx = 0; startIdx < sortedLaps.length; startIdx++) {
      let cumulativeDistance = 0;
      let cumulativeTime = 0;

      for (let endIdx = startIdx; endIdx < sortedLaps.length; endIdx++) {
        const lap = sortedLaps[endIdx];
        cumulativeDistance += lap.distanceMeters || 0;
        cumulativeTime += lap.elapsedTimeSeconds || 0;

        // Check if we're close to the standard distance
        const distanceDiff = Math.abs(cumulativeDistance - standardDist.meters);
        if (distanceDiff <= standardDist.tolerance) {
          // Found a match!
          const distanceMiles = cumulativeDistance / 1609.34;
          const paceSecondsPerMile = cumulativeTime / distanceMiles;

          // Check if it's a PR
          const historicalBest = historicalBests?.get(standardDist.name);
          const isPR = !historicalBest || cumulativeTime < historicalBest.timeSeconds;
          const improvementSeconds = historicalBest
            ? historicalBest.timeSeconds - cumulativeTime
            : undefined;

          efforts.push({
            workoutId: workout.id,
            workoutDate: workout.date,
            distance: standardDist.name,
            distanceMeters: cumulativeDistance,
            timeSeconds: cumulativeTime,
            timeFormatted: formatTime(cumulativeTime),
            pace: formatPace(paceSecondsPerMile),
            startLapIndex: sortedLaps[startIdx].lapIndex,
            endLapIndex: sortedLaps[endIdx].lapIndex,
            isPR,
            improvementSeconds,
            equivalentVDOT: calculateVDOT(distanceMiles, cumulativeTime),
          });

          // Only keep the fastest effort for each distance in this workout
          break; // Move to next starting point
        }

        // If we've exceeded the distance significantly, no point continuing
        if (cumulativeDistance > standardDist.meters + standardDist.tolerance) {
          break;
        }
      }
    }
  });

  // Keep only the best effort for each distance
  const bestByDistance = new Map<string, BestEffort>();
  efforts.forEach(effort => {
    const existing = bestByDistance.get(effort.distance);
    if (!existing || effort.timeSeconds < existing.timeSeconds) {
      bestByDistance.set(effort.distance, effort);
    }
  });

  return Array.from(bestByDistance.values());
}

/**
 * Analyze multiple workouts for best efforts
 */
export function analyzeWorkoutsForBestEfforts(
  workouts: Array<{ workout: Workout; laps: WorkoutLap[] }>
): EffortAnalysis {
  // Track all-time bests by distance
  const allTimeBests = new Map<string, BestEffort[]>();
  const recentPRs: BestEffort[] = [];
  const notifications: string[] = [];

  // Process workouts chronologically (oldest first)
  const sortedWorkouts = [...workouts].sort((a, b) =>
    new Date(a.workout.date).getTime() - new Date(b.workout.date).getTime()
  );

  sortedWorkouts.forEach(({ workout, laps }) => {
    // Get current bests for comparison
    const currentBests = new Map<string, BestEffort>();
    allTimeBests.forEach((efforts, distance) => {
      if (efforts.length > 0) {
        currentBests.set(distance, efforts[0]); // First is fastest
      }
    });

    // Detect efforts in this workout
    const efforts = detectBestEffortsInWorkout(workout, laps, currentBests);

    // Update all-time bests
    efforts.forEach(effort => {
      const distanceEfforts = allTimeBests.get(effort.distance) || [];

      // Insert in sorted order (fastest first)
      const insertIndex = distanceEfforts.findIndex(e => e.timeSeconds > effort.timeSeconds);
      if (insertIndex === -1) {
        distanceEfforts.push(effort);
      } else {
        distanceEfforts.splice(insertIndex, 0, effort);
      }

      // Keep top 10 for each distance
      if (distanceEfforts.length > 10) {
        distanceEfforts.length = 10;
      }

      allTimeBests.set(effort.distance, distanceEfforts);

      // Track recent PRs (last 30 days)
      const daysSince = (new Date().getTime() - new Date(workout.date).getTime()) / (1000 * 60 * 60 * 24);
      if (effort.isPR && daysSince <= 30) {
        recentPRs.push(effort);
      }

      // Generate notifications
      if (effort.isPR && daysSince <= 7) {
        if (effort.improvementSeconds && effort.improvementSeconds > 0) {
          notifications.push(
            `New ${effort.distance} PR: ${effort.timeFormatted} (${Math.round(effort.improvementSeconds)}s faster!)`
          );
        } else {
          notifications.push(
            `New ${effort.distance} PR: ${effort.timeFormatted}`
          );
        }
      }
    });
  });

  // Compile final results
  const allBestEfforts: BestEffort[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allTimeBests.forEach((efforts, distance) => {
    efforts.forEach((effort, index) => {
      allBestEfforts.push({
        ...effort,
        rankAllTime: index + 1,
      });
    });
  });

  // Sort notifications by recency
  recentPRs.sort((a, b) =>
    new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime()
  );

  return {
    bestEfforts: allBestEfforts,
    recentPRs,
    notifications,
  };
}

/**
 * Find potential PR attempts in a workout (fast segments that weren't quite PRs)
 */
export function findNearMisses(
  workout: Workout,
  laps: WorkoutLap[],
  historicalBests: Map<string, BestEffort>,
  thresholdPercent: number = 1.02 // Within 2% of PR
): Array<{
  distance: string;
  timeSeconds: number;
  missedBySeconds: number;
  missedByPercent: number;
}> {
  const efforts = detectBestEffortsInWorkout(workout, laps, historicalBests);
  const nearMisses: Array<{
    distance: string;
    timeSeconds: number;
    missedBySeconds: number;
    missedByPercent: number;
  }> = [];

  efforts.forEach(effort => {
    if (!effort.isPR) {
      const best = historicalBests.get(effort.distance);
      if (best) {
        const percentOfPR = effort.timeSeconds / best.timeSeconds;
        if (percentOfPR <= thresholdPercent) {
          nearMisses.push({
            distance: effort.distance,
            timeSeconds: effort.timeSeconds,
            missedBySeconds: effort.timeSeconds - best.timeSeconds,
            missedByPercent: (percentOfPR - 1) * 100,
          });
        }
      }
    }
  });

  return nearMisses;
}

/**
 * Get motivational insights based on best efforts
 */
export function getBestEffortInsights(analysis: EffortAnalysis): string[] {
  const insights: string[] = [];

  // Recent PR streak
  const prDates = new Set(analysis.recentPRs.map(pr => pr.workoutDate));
  if (prDates.size >= 3) {
    insights.push(`You're on fire! ${prDates.size} PRs in the last 30 days!`);
  }

  // Distance specialization
  const prsByDistance = new Map<string, number>();
  analysis.recentPRs.forEach(pr => {
    prsByDistance.set(pr.distance, (prsByDistance.get(pr.distance) || 0) + 1);
  });

  const mostImprovedDistance = Array.from(prsByDistance.entries())
    .sort((a, b) => b[1] - a[1])[0];

  if (mostImprovedDistance && mostImprovedDistance[1] >= 2) {
    insights.push(
      `${mostImprovedDistance[0]} specialist! ${mostImprovedDistance[1]} PRs at this distance recently.`
    );
  }

  // Improvement trend
  const totalImprovement = analysis.recentPRs
    .filter(pr => pr.improvementSeconds)
    .reduce((sum, pr) => sum + (pr.improvementSeconds || 0), 0);

  if (totalImprovement > 60) {
    insights.push(
      `You've saved ${Math.round(totalImprovement)} seconds across all PRs. Consistent progress!`
    );
  }

  return insights;
}