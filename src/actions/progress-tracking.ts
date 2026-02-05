'use server';

import { db, workouts } from '@/lib/db';
import { desc, asc, gte, eq } from 'drizzle-orm';
import { parseLocalDate } from '@/lib/utils';

/**
 * Progress tracking and cumulative stats
 */

export interface PRTimeline {
  prs: {
    distance: string;
    distanceMiles: number;
    time: number;
    pace: number;
    date: string;
    workoutId: number;
    previousBest: number | null;
    improvement: number | null;
  }[];
}

export interface CumulativeProgress {
  monthly: {
    month: string;
    year: number;
    totalMiles: number;
    cumulativeMiles: number;
    workoutCount: number;
    avgPace: number | null;
  }[];
  yearlyComparison: {
    year: number;
    totalMiles: number;
    totalRuns: number;
    avgPace: number | null;
  }[];
}

export interface ProgressMilestones {
  milestoneDates: {
    milestone: number;
    date: string;
    daysToReach: number;
  }[];
  projectedMilestones: {
    milestone: number;
    projectedDate: string;
    daysRemaining: number;
  }[];
}

// Standard distances for PR tracking
const PR_DISTANCES = [
  { name: '1 Mile', miles: 1, tolerance: 0.08 },
  { name: '5K', miles: 3.107, tolerance: 0.12 },
  { name: '10K', miles: 6.214, tolerance: 0.2 },
  { name: 'Half Marathon', miles: 13.109, tolerance: 0.3 },
  { name: 'Marathon', miles: 26.219, tolerance: 0.5 },
];

/**
 * Get timeline of when PRs were set
 */
export async function getPRTimeline(): Promise<PRTimeline> {
  const allWorkouts = await db.query.workouts.findMany({
    where: gte(workouts.distanceMiles, 0.9),
    orderBy: [asc(workouts.date)],
  });

  const prs: PRTimeline['prs'] = [];
  const bestByDistance = new Map<string, { time: number; date: string }>();

  for (const w of allWorkouts) {
    if (!w.distanceMiles || !w.avgPaceSeconds) continue;

    // Check each standard distance
    for (const dist of PR_DISTANCES) {
      const diff = Math.abs(w.distanceMiles - dist.miles);
      if (diff > dist.tolerance) continue;

      const estimatedTime = Math.round(w.avgPaceSeconds * dist.miles);
      const existing = bestByDistance.get(dist.name);

      if (!existing || estimatedTime < existing.time) {
        const improvement = existing ? existing.time - estimatedTime : null;

        prs.push({
          distance: dist.name,
          distanceMiles: dist.miles,
          time: estimatedTime,
          pace: w.avgPaceSeconds,
          date: w.date,
          workoutId: w.id,
          previousBest: existing?.time || null,
          improvement,
        });

        bestByDistance.set(dist.name, { time: estimatedTime, date: w.date });
      }
    }
  }

  // Sort by date descending (most recent first)
  prs.sort((a, b) => b.date.localeCompare(a.date));

  return { prs };
}

/**
 * Get cumulative progress data
 */
export async function getCumulativeProgress(): Promise<CumulativeProgress> {
  const allWorkouts = await db.query.workouts.findMany({
    orderBy: [asc(workouts.date)],
  });

  // Group by month
  const monthlyData = new Map<string, {
    month: string;
    year: number;
    miles: number;
    count: number;
    paces: number[];
  }>();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const w of allWorkouts) {
    const date = parseLocalDate(w.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    if (!monthlyData.has(key)) {
      monthlyData.set(key, { month, year, miles: 0, count: 0, paces: [] });
    }

    const data = monthlyData.get(key)!;
    data.miles += w.distanceMiles || 0;
    data.count++;
    if (w.avgPaceSeconds) {
      data.paces.push(w.avgPaceSeconds);
    }
  }

  // Calculate cumulative and format
  let cumulativeMiles = 0;
  const monthly = [...monthlyData.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, data]) => {
      cumulativeMiles += data.miles;
      return {
        month: data.month,
        year: data.year,
        totalMiles: Math.round(data.miles * 10) / 10,
        cumulativeMiles: Math.round(cumulativeMiles * 10) / 10,
        workoutCount: data.count,
        avgPace: data.paces.length > 0
          ? Math.round(data.paces.reduce((a, b) => a + b, 0) / data.paces.length)
          : null,
      };
    });

  // Yearly comparison
  const yearlyData = new Map<number, { miles: number; runs: number; paces: number[] }>();

  for (const w of allWorkouts) {
    const year = parseLocalDate(w.date).getFullYear();

    if (!yearlyData.has(year)) {
      yearlyData.set(year, { miles: 0, runs: 0, paces: [] });
    }

    const data = yearlyData.get(year)!;
    data.miles += w.distanceMiles || 0;
    data.runs++;
    if (w.avgPaceSeconds) {
      data.paces.push(w.avgPaceSeconds);
    }
  }

  const yearlyComparison = [...yearlyData.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, data]) => ({
      year,
      totalMiles: Math.round(data.miles * 10) / 10,
      totalRuns: data.runs,
      avgPace: data.paces.length > 0
        ? Math.round(data.paces.reduce((a, b) => a + b, 0) / data.paces.length)
        : null,
    }));

  return { monthly, yearlyComparison };
}

/**
 * Get milestone progress tracking
 */
export async function getProgressMilestones(): Promise<ProgressMilestones> {
  const allWorkouts = await db.query.workouts.findMany({
    orderBy: [asc(workouts.date)],
  });

  if (allWorkouts.length === 0) {
    return { milestoneDates: [], projectedMilestones: [] };
  }

  const milestoneTargets = [100, 250, 500, 1000, 2000, 5000];
  const milestoneDates: ProgressMilestones['milestoneDates'] = [];

  const firstDate = parseLocalDate(allWorkouts[0].date);
  let cumulativeMiles = 0;
  const milestonesReached = new Set<number>();

  for (const w of allWorkouts) {
    cumulativeMiles += w.distanceMiles || 0;

    for (const target of milestoneTargets) {
      if (cumulativeMiles >= target && !milestonesReached.has(target)) {
        milestonesReached.add(target);
        const workoutDate = parseLocalDate(w.date);
        const daysToReach = Math.round((workoutDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

        milestoneDates.push({
          milestone: target,
          date: w.date,
          daysToReach,
        });
      }
    }
  }

  // Project future milestones
  const projectedMilestones: ProgressMilestones['projectedMilestones'] = [];
  const totalDays = (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  const milesPerDay = cumulativeMiles / totalDays;

  for (const target of milestoneTargets) {
    if (!milestonesReached.has(target)) {
      const milesRemaining = target - cumulativeMiles;
      const daysRemaining = Math.ceil(milesRemaining / milesPerDay);
      const projectedDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

      projectedMilestones.push({
        milestone: target,
        projectedDate: projectedDate.toISOString().split('T')[0],
        daysRemaining,
      });
    }
  }

  return { milestoneDates, projectedMilestones };
}

/**
 * Get pace progression over time
 */
export async function getPaceProgression(workoutType: string = 'easy'): Promise<{
  data: {
    date: string;
    pace: number;
    movingAvg: number;
  }[];
  trend: 'improving' | 'stable' | 'declining';
  totalImprovement: number | null;
}> {
  const typeWorkouts = await db.query.workouts.findMany({
    where: eq(workouts.workoutType, workoutType),
    orderBy: [asc(workouts.date)],
  });

  const paceData = typeWorkouts
    .filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 180 && w.avgPaceSeconds < 900)
    .map(w => ({
      date: w.date,
      pace: w.avgPaceSeconds!,
    }));

  if (paceData.length < 3) {
    return { data: [], trend: 'stable', totalImprovement: null };
  }

  // Calculate 5-workout moving average
  const data = paceData.map((d, i) => {
    const windowStart = Math.max(0, i - 4);
    const window = paceData.slice(windowStart, i + 1);
    const avg = window.reduce((sum, p) => sum + p.pace, 0) / window.length;

    return {
      date: d.date,
      pace: d.pace,
      movingAvg: Math.round(avg),
    };
  });

  // Calculate trend
  const firstAvg = data.slice(0, 5).reduce((sum, d) => sum + d.pace, 0) / Math.min(5, data.length);
  const lastAvg = data.slice(-5).reduce((sum, d) => sum + d.pace, 0) / Math.min(5, data.length);
  const improvement = firstAvg - lastAvg;

  let trend: 'improving' | 'stable' | 'declining';
  if (improvement > 10) trend = 'improving';
  else if (improvement < -10) trend = 'declining';
  else trend = 'stable';

  return {
    data,
    trend,
    totalImprovement: data.length >= 5 ? Math.round(improvement) : null,
  };
}
