'use server';

import { db, workouts, workoutSegments } from '@/lib/db';
import { desc, gte, and, eq, inArray } from 'drizzle-orm';
import { classifySplitEfforts } from '@/lib/training/effort-classifier';
import { getActiveProfileId } from '@/lib/profile-server';
import {
  calculateWorkoutLoad,
  calculateFitnessMetrics,
  fillDailyLoadGaps,
  type DailyLoad,
} from '@/lib/training/fitness-calculations';
import { parseLocalDate } from '@/lib/utils';

/**
 * Training distribution types
 */
export type TrainingDistribution = 'polarized' | 'pyramidal' | 'threshold' | 'mixed' | 'insufficient';

export interface TrainingDistributionAnalysis {
  distribution: TrainingDistribution;
  description: string;
  recommendation: string;
  zones: {
    zone: string;
    label: string;
    percentage: number;
    minutes: number;
    color: string;
  }[];
  idealComparison: {
    zone: string;
    actual: number;
    ideal: number;
  }[];
  score: number; // 0-100 how well they match their detected pattern
}

export interface WeeklyRollup {
  weekStart: string;
  weekEnd: string;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
  avgPaceSeconds: number | null;
  longRunMiles: number | null;
  qualityWorkouts: number;
  easyMiles: number;
  hardMiles: number;
  elevationGain: number;
  // Fitness metrics (end of week values)
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
}

export interface MonthlyRollup {
  month: string;
  year: number;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
  avgPaceSeconds: number | null;
  longestRun: number | null;
  weeklyAvgMiles: number;
  qualityWorkouts: number;
  races: number;
}

/**
 * Analyze training distribution over a period
 * Classifies as polarized, pyramidal, threshold-focused, or mixed
 */
export async function analyzeTrainingDistribution(days: number = 90): Promise<TrainingDistributionAnalysis> {
  const profileId = await getActiveProfileId();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const dateFilter = gte(workouts.date, cutoffStr);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  if (recentWorkouts.length < 5) {
    return {
      distribution: 'insufficient',
      description: 'Not enough workout data to analyze training distribution',
      recommendation: 'Keep logging workouts to get training distribution insights',
      zones: [],
      idealComparison: [],
      score: 0,
    };
  }

  // Categorize by actual segment effort (not run-level type)
  const wIds = recentWorkouts.map(w => w.id);
  const allSegs = wIds.length > 0
    ? await db.query.workoutSegments.findMany({
        where: inArray(workoutSegments.workoutId, wIds),
      })
    : [];

  // Group segments by workout
  const segsByWorkout = new Map<number, typeof allSegs>();
  for (const seg of allSegs) {
    if (!segsByWorkout.has(seg.workoutId)) segsByWorkout.set(seg.workoutId, []);
    segsByWorkout.get(seg.workoutId)!.push(seg);
  }

  let zone1Minutes = 0; // Recovery/Easy
  let zone2Minutes = 0; // Moderate/Steady
  let zone3Minutes = 0; // Tempo/Threshold/Hard

  for (const w of recentWorkouts) {
    const segs = segsByWorkout.get(w.id);

    if (segs && segs.length >= 2) {
      // Classify each segment by actual effort
      const sorted = [...segs].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const laps = sorted.map(seg => ({
        lapNumber: seg.segmentNumber,
        distanceMiles: seg.distanceMiles || 1,
        durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
        avgPaceSeconds: seg.paceSecondsPerMile || 480,
        avgHeartRate: seg.avgHr,
        maxHeartRate: seg.maxHr,
        elevationGainFeet: seg.elevationGainFt,
        lapType: seg.segmentType || 'steady',
      }));

      const classified = classifySplitEfforts(laps, {
        workoutType: w.workoutType || 'easy',
        avgPaceSeconds: w.avgPaceSeconds,
      });

      for (let i = 0; i < classified.length; i++) {
        const cat = classified[i].category;
        const segMinutes = (sorted[i].durationSeconds || 0) / 60;
        if (cat === 'recovery' || cat === 'easy' || cat === 'warmup' || cat === 'cooldown') {
          zone1Minutes += segMinutes;
        } else if (cat === 'steady' || cat === 'marathon') {
          zone2Minutes += segMinutes;
        } else {
          zone3Minutes += segMinutes;
        }
      }
    } else {
      // No segments — fall back to run-level heuristic
      const minutes = w.durationMinutes || 0;
      const type = w.workoutType || 'easy';
      if (type === 'recovery' || type === 'easy') {
        zone1Minutes += minutes;
      } else if (type === 'long' || type === 'steady') {
        zone1Minutes += minutes * 0.7;
        zone2Minutes += minutes * 0.3;
      } else if (type === 'tempo' || type === 'threshold') {
        zone1Minutes += minutes * 0.3;
        zone3Minutes += minutes * 0.7;
      } else if (type === 'interval' || type === 'race') {
        zone1Minutes += minutes * 0.4;
        zone3Minutes += minutes * 0.6;
      } else {
        zone1Minutes += minutes;
      }
    }
  }

  const totalMinutes = zone1Minutes + zone2Minutes + zone3Minutes;
  if (totalMinutes === 0) {
    return {
      distribution: 'insufficient',
      description: 'No duration data available',
      recommendation: 'Ensure workouts have duration recorded',
      zones: [],
      idealComparison: [],
      score: 0,
    };
  }

  const zone1Pct = (zone1Minutes / totalMinutes) * 100;
  const zone2Pct = (zone2Minutes / totalMinutes) * 100;
  const zone3Pct = (zone3Minutes / totalMinutes) * 100;

  // Determine distribution type
  let distribution: TrainingDistribution;
  let description: string;
  let recommendation: string;
  let score: number;

  // Polarized: ~80% easy, <5% moderate, ~15-20% hard
  // Pyramidal: ~75% easy, ~15% moderate, ~10% hard
  // Threshold: ~65% easy, ~20% moderate, ~15% hard (more tempo work)

  if (zone1Pct >= 75 && zone2Pct <= 10 && zone3Pct >= 12) {
    distribution = 'polarized';
    description = 'Your training follows a polarized distribution - mostly easy running with focused hard sessions';
    recommendation = 'Great approach! Polarized training is highly effective. Keep easy days truly easy.';
    // Score based on how close to 80/5/15
    score = 100 - Math.abs(zone1Pct - 80) - Math.abs(zone2Pct - 5) * 2 - Math.abs(zone3Pct - 15);
  } else if (zone1Pct >= 70 && zone2Pct >= 10 && zone2Pct <= 25 && zone3Pct <= 15) {
    distribution = 'pyramidal';
    description = 'Your training follows a pyramidal distribution - mostly easy, some moderate, less hard';
    recommendation = 'Solid approach for building aerobic base. Consider adding more quality sessions as fitness builds.';
    score = 100 - Math.abs(zone1Pct - 75) - Math.abs(zone2Pct - 15) - Math.abs(zone3Pct - 10);
  } else if (zone3Pct >= 20 || zone2Pct >= 25) {
    distribution = 'threshold';
    description = 'Your training is threshold-focused with significant moderate/hard volume';
    recommendation = 'High intensity approach. Watch for burnout - consider more recovery if feeling fatigued.';
    score = 70; // Threshold-focused is less optimal for most runners
  } else {
    distribution = 'mixed';
    description = 'Your training distribution is mixed without a clear pattern';
    recommendation = 'Consider structuring training more intentionally - polarized or pyramidal approaches tend to work best.';
    score = 50;
  }

  score = Math.max(0, Math.min(100, score));

  const zones = [
    {
      zone: 'zone1',
      label: 'Easy/Recovery',
      percentage: Math.round(zone1Pct),
      minutes: Math.round(zone1Minutes),
      color: 'bg-sky-400',
    },
    {
      zone: 'zone2',
      label: 'Moderate',
      percentage: Math.round(zone2Pct),
      minutes: Math.round(zone2Minutes),
      color: 'bg-indigo-500',
    },
    {
      zone: 'zone3',
      label: 'Hard/Threshold',
      percentage: Math.round(zone3Pct),
      minutes: Math.round(zone3Minutes),
      color: 'bg-red-500',
    },
  ];

  // Ideal comparison based on detected distribution
  const ideals: Record<TrainingDistribution, [number, number, number]> = {
    polarized: [80, 5, 15],
    pyramidal: [75, 15, 10],
    threshold: [65, 20, 15],
    mixed: [75, 10, 15],
    insufficient: [80, 5, 15],
  };

  const ideal = ideals[distribution];
  const idealComparison = [
    { zone: 'Easy', actual: Math.round(zone1Pct), ideal: ideal[0] },
    { zone: 'Moderate', actual: Math.round(zone2Pct), ideal: ideal[1] },
    { zone: 'Hard', actual: Math.round(zone3Pct), ideal: ideal[2] },
  ];

  return {
    distribution,
    description,
    recommendation,
    zones,
    idealComparison,
    score,
  };
}

/**
 * Get weekly rollup stats
 */
export async function getWeeklyRollups(weeks: number = 12): Promise<WeeklyRollup[]> {
  const profileId = await getActiveProfileId();
  const cutoffDate = new Date();
  // Fetch extra data for CTL warmup (42 days)
  cutoffDate.setDate(cutoffDate.getDate() - weeks * 7 - 42);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const dateFilter = gte(workouts.date, cutoffStr);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  // Calculate fitness metrics for all dates
  const workoutLoads: DailyLoad[] = recentWorkouts
    .filter(w => w.durationMinutes && w.durationMinutes > 0)
    .map(w => ({
      date: w.date,
      load: calculateWorkoutLoad(
        w.durationMinutes!,
        w.workoutType || 'easy',
        w.distanceMiles || undefined,
        w.avgPaceSeconds || undefined
      ),
    }));

  const today = new Date().toISOString().split('T')[0];
  const dailyLoads = fillDailyLoadGaps(workoutLoads, cutoffStr, today);
  const fitnessMetrics = calculateFitnessMetrics(dailyLoads);

  // Create a map for quick lookup of fitness metrics by date
  const fitnessMap = new Map(fitnessMetrics.map(m => [m.date, m]));

  // Now calculate weekly rollups with actual cutoff (excluding warmup period)
  const actualCutoffDate = new Date();
  actualCutoffDate.setDate(actualCutoffDate.getDate() - weeks * 7);
  const actualCutoffStr = actualCutoffDate.toISOString().split('T')[0];

  // Group by week
  const weekMap = new Map<string, typeof recentWorkouts>();

  for (const w of recentWorkouts) {
    // Skip workouts before actual cutoff (they were just for CTL warmup)
    if (w.date < actualCutoffStr) continue;

    const date = parseLocalDate(w.date);
    // Get Monday of that week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(w);
  }

  const rollups: WeeklyRollup[] = [];

  for (const [weekStart, weekWorkouts] of weekMap) {
    const monday = new Date(weekStart);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayStr = sunday.toISOString().split('T')[0];

    const totalMiles = weekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
    const totalMinutes = weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const elevationGain = weekWorkouts.reduce((sum, w) => sum + (w.elevationGainFeet || 0), 0);

    // Find long run
    const longRun = weekWorkouts
      .filter(w => w.workoutType === 'long' || (w.distanceMiles && w.distanceMiles >= 8))
      .sort((a, b) => (b.distanceMiles || 0) - (a.distanceMiles || 0))[0];

    // Count quality workouts (tempo, interval, race, threshold)
    const qualityWorkouts = weekWorkouts.filter(w =>
      ['tempo', 'interval', 'race', 'threshold'].includes(w.workoutType || '')
    ).length;

    // Easy vs hard miles
    const easyMiles = weekWorkouts
      .filter(w => ['easy', 'recovery'].includes(w.workoutType || 'easy'))
      .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
    const hardMiles = weekWorkouts
      .filter(w => ['tempo', 'interval', 'race', 'threshold'].includes(w.workoutType || ''))
      .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

    // Average pace (weighted by distance)
    let totalPaceWeight = 0;
    let weightedPaceSum = 0;
    for (const w of weekWorkouts) {
      if (w.avgPaceSeconds && w.distanceMiles) {
        weightedPaceSum += w.avgPaceSeconds * w.distanceMiles;
        totalPaceWeight += w.distanceMiles;
      }
    }

    // Get end-of-week fitness metrics
    const weekEndMetrics = fitnessMap.get(sundayStr);

    rollups.push({
      weekStart,
      weekEnd: sundayStr,
      totalMiles: Math.round(totalMiles * 10) / 10,
      totalMinutes: Math.round(totalMinutes),
      workoutCount: weekWorkouts.length,
      avgPaceSeconds: totalPaceWeight > 0 ? Math.round(weightedPaceSum / totalPaceWeight) : null,
      longRunMiles: longRun?.distanceMiles || null,
      qualityWorkouts,
      easyMiles: Math.round(easyMiles * 10) / 10,
      hardMiles: Math.round(hardMiles * 10) / 10,
      elevationGain: Math.round(elevationGain),
      ctl: weekEndMetrics?.ctl ?? null,
      atl: weekEndMetrics?.atl ?? null,
      tsb: weekEndMetrics?.tsb ?? null,
    });
  }

  // Sort by week start descending
  rollups.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return rollups;
}

/**
 * Get monthly rollup stats
 */
export async function getMonthlyRollups(months: number = 12): Promise<MonthlyRollup[]> {
  const profileId = await getActiveProfileId();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const dateFilter = gte(workouts.date, cutoffStr);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
    orderBy: [desc(workouts.date)],
  });

  // Group by month
  const monthMap = new Map<string, typeof recentWorkouts>();

  for (const w of recentWorkouts) {
    const date = parseLocalDate(w.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(w);
  }

  const rollups: MonthlyRollup[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const [monthKey, monthWorkouts] of monthMap) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;

    const totalMiles = monthWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
    const totalMinutes = monthWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

    // Find longest run
    const longestRun = Math.max(...monthWorkouts.map(w => w.distanceMiles || 0));

    // Count quality workouts
    const qualityWorkouts = monthWorkouts.filter(w =>
      ['tempo', 'interval', 'race', 'threshold'].includes(w.workoutType || '')
    ).length;

    // Count races
    const races = monthWorkouts.filter(w => w.workoutType === 'race').length;

    // Average pace (weighted)
    let totalPaceWeight = 0;
    let weightedPaceSum = 0;
    for (const w of monthWorkouts) {
      if (w.avgPaceSeconds && w.distanceMiles) {
        weightedPaceSum += w.avgPaceSeconds * w.distanceMiles;
        totalPaceWeight += w.distanceMiles;
      }
    }

    // Calculate weeks in month (approximately)
    const weeksInMonth = 4.33;

    rollups.push({
      month: monthNames[monthIndex],
      year,
      totalMiles: Math.round(totalMiles * 10) / 10,
      totalMinutes: Math.round(totalMinutes),
      workoutCount: monthWorkouts.length,
      avgPaceSeconds: totalPaceWeight > 0 ? Math.round(weightedPaceSum / totalPaceWeight) : null,
      longestRun: longestRun > 0 ? Math.round(longestRun * 10) / 10 : null,
      weeklyAvgMiles: Math.round((totalMiles / weeksInMonth) * 10) / 10,
      qualityWorkouts,
      races,
    });
  }

  // Sort by date descending
  rollups.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames.indexOf(b.month) - monthNames.indexOf(a.month);
  });

  return rollups;
}

/**
 * Get training load recommendations based on recent patterns
 */
export async function getTrainingLoadRecommendations(): Promise<{
  currentWeeklyMiles: number;
  recommendedNextWeek: number;
  recommendation: string;
  reason: string;
  trend: 'building' | 'maintaining' | 'recovering' | 'inconsistent';
}> {
  const weeklyData = await getWeeklyRollups(6);

  if (weeklyData.length < 3) {
    return {
      currentWeeklyMiles: weeklyData[0]?.totalMiles || 0,
      recommendedNextWeek: weeklyData[0]?.totalMiles || 20,
      recommendation: 'Keep building consistency',
      reason: 'Not enough data to make specific recommendations yet',
      trend: 'inconsistent',
    };
  }

  const currentWeek = weeklyData[0]?.totalMiles || 0;
  const lastWeek = weeklyData[1]?.totalMiles || 0;
  const twoWeeksAgo = weeklyData[2]?.totalMiles || 0;
  const threeWeeksAgo = weeklyData[3]?.totalMiles || 0;

  // Calculate recent average (excluding current week)
  const recentAvg = (lastWeek + twoWeeksAgo + (threeWeeksAgo || twoWeeksAgo)) / 3;

  // Determine trend
  let trend: 'building' | 'maintaining' | 'recovering' | 'inconsistent';
  let recommendation: string;
  let reason: string;
  let recommendedNextWeek: number;

  const weeklyChange = lastWeek > 0 ? ((currentWeek - lastWeek) / lastWeek) * 100 : 0;

  // Check for 10% rule and recovery patterns
  if (weeklyChange > 15) {
    trend = 'building';
    recommendation = 'Consider a recovery week';
    reason = `You increased ${Math.round(weeklyChange)}% this week. A lighter week helps adaptation.`;
    recommendedNextWeek = Math.round(recentAvg * 0.7);
  } else if (weeklyChange < -20) {
    trend = 'recovering';
    recommendation = 'Good recovery week - ready to build';
    reason = 'After backing off, you can safely increase next week.';
    recommendedNextWeek = Math.round(recentAvg * 1.05);
  } else if (Math.abs(weeklyChange) <= 10) {
    // Check if we've been building for 3+ weeks
    const buildingStreak = lastWeek > twoWeeksAgo && twoWeeksAgo > threeWeeksAgo;

    if (buildingStreak) {
      trend = 'building';
      recommendation = 'Time for a down week';
      reason = '3-4 weeks of building should be followed by recovery.';
      recommendedNextWeek = Math.round(currentWeek * 0.75);
    } else {
      trend = 'maintaining';
      recommendation = 'Safe to increase slightly';
      reason = 'Consistent volume - you can add 5-10% safely.';
      recommendedNextWeek = Math.round(currentWeek * 1.08);
    }
  } else {
    trend = 'inconsistent';
    recommendation = 'Focus on consistency';
    reason = 'Variable mileage - try to maintain steady weekly volume.';
    recommendedNextWeek = Math.round(recentAvg);
  }

  return {
    currentWeeklyMiles: Math.round(currentWeek * 10) / 10,
    recommendedNextWeek: Math.round(recommendedNextWeek * 10) / 10,
    recommendation,
    reason,
    trend,
  };
}
