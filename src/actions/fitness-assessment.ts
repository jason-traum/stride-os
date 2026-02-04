'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte } from 'drizzle-orm';
import { getSettings } from './settings';
import { getRacePredictions } from './race-predictor';

/**
 * Comprehensive fitness assessment
 */

export interface FitnessAssessment {
  overallScore: number; // 0-100
  grade: string; // A+, A, B+, B, C+, C, D, F
  level: string;
  components: {
    name: string;
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'needs_work';
    description: string;
  }[];
  recommendations: string[];
  comparedToLast: {
    period: string;
    change: number;
    trend: 'improving' | 'stable' | 'declining';
  } | null;
}

export interface AgeGradedPerformance {
  age: number;
  bestRecentPace: number;
  distance: string;
  ageGradedPercent: number;
  ageGradedTime: number;
  performanceLevel: string;
}

export interface FitnessAge {
  chronologicalAge: number | null;
  fitnessAge: number;
  fitnessAgeDiff: number | null;
  explanation: string;
}

/**
 * Calculate comprehensive fitness score
 */
export async function getFitnessAssessment(): Promise<FitnessAssessment | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [recentWorkouts, olderWorkouts, settings] = await Promise.all([
    db.query.workouts.findMany({
      where: gte(workouts.date, thirtyDaysAgo.toISOString().split('T')[0]),
      orderBy: [desc(workouts.date)],
    }),
    db.query.workouts.findMany({
      where: gte(workouts.date, sixtyDaysAgo.toISOString().split('T')[0]),
      orderBy: [desc(workouts.date)],
    }),
    getSettings(),
  ]);

  if (recentWorkouts.length < 3) {
    return null;
  }

  const components: FitnessAssessment['components'] = [];
  let totalScore = 0;
  let componentCount = 0;

  // 1. Consistency Score (25% weight)
  const uniqueDays = new Set(recentWorkouts.map(w => w.date)).size;
  const runsPerWeek = (uniqueDays / 30) * 7;
  let consistencyScore = 0;

  if (runsPerWeek >= 5) consistencyScore = 100;
  else if (runsPerWeek >= 4) consistencyScore = 85;
  else if (runsPerWeek >= 3) consistencyScore = 70;
  else if (runsPerWeek >= 2) consistencyScore = 50;
  else consistencyScore = 30;

  components.push({
    name: 'Consistency',
    score: consistencyScore,
    status: consistencyScore >= 80 ? 'excellent' : consistencyScore >= 60 ? 'good' : consistencyScore >= 40 ? 'fair' : 'needs_work',
    description: `${runsPerWeek.toFixed(1)} runs per week`,
  });
  totalScore += consistencyScore * 0.25;
  componentCount++;

  // 2. Volume Score (20% weight)
  const totalMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const weeklyMiles = (totalMiles / 30) * 7;
  let volumeScore = 0;

  if (weeklyMiles >= 40) volumeScore = 100;
  else if (weeklyMiles >= 30) volumeScore = 85;
  else if (weeklyMiles >= 20) volumeScore = 70;
  else if (weeklyMiles >= 15) volumeScore = 55;
  else if (weeklyMiles >= 10) volumeScore = 40;
  else volumeScore = 25;

  components.push({
    name: 'Volume',
    score: volumeScore,
    status: volumeScore >= 80 ? 'excellent' : volumeScore >= 60 ? 'good' : volumeScore >= 40 ? 'fair' : 'needs_work',
    description: `${weeklyMiles.toFixed(1)} miles/week`,
  });
  totalScore += volumeScore * 0.20;
  componentCount++;

  // 3. Quality Work Score (20% weight)
  const qualityWorkouts = recentWorkouts.filter(w =>
    ['tempo', 'interval', 'threshold', 'race'].includes(w.workoutType || '')
  ).length;
  const qualityPct = (qualityWorkouts / recentWorkouts.length) * 100;
  let qualityScore = 0;

  // Optimal is 15-25% quality work
  if (qualityPct >= 15 && qualityPct <= 25) qualityScore = 100;
  else if (qualityPct >= 10 && qualityPct <= 30) qualityScore = 80;
  else if (qualityPct < 10) qualityScore = 50; // Not enough intensity
  else qualityScore = 60; // Too much intensity

  components.push({
    name: 'Quality Balance',
    score: qualityScore,
    status: qualityScore >= 80 ? 'excellent' : qualityScore >= 60 ? 'good' : qualityScore >= 40 ? 'fair' : 'needs_work',
    description: `${Math.round(qualityPct)}% quality workouts`,
  });
  totalScore += qualityScore * 0.20;
  componentCount++;

  // 4. Long Run Score (15% weight)
  const longRuns = recentWorkouts.filter(w =>
    w.workoutType === 'long' || (w.distanceMiles && w.distanceMiles >= 10)
  ).length;
  const longRunPct = (longRuns / 4) * 100; // Expecting ~1 per week
  let longRunScore = Math.min(100, longRunPct);

  components.push({
    name: 'Long Runs',
    score: longRunScore,
    status: longRunScore >= 80 ? 'excellent' : longRunScore >= 60 ? 'good' : longRunScore >= 40 ? 'fair' : 'needs_work',
    description: `${longRuns} long runs in 30 days`,
  });
  totalScore += longRunScore * 0.15;
  componentCount++;

  // 5. Performance Trend (20% weight)
  const recentEasyPaces = recentWorkouts
    .filter(w => w.workoutType === 'easy' && w.avgPaceSeconds)
    .slice(0, 5)
    .map(w => w.avgPaceSeconds!);

  const olderEasyPaces = olderWorkouts
    .filter(w => w.workoutType === 'easy' && w.avgPaceSeconds && new Date(w.date) < thirtyDaysAgo)
    .slice(0, 5)
    .map(w => w.avgPaceSeconds!);

  let trendScore = 60; // Default to neutral
  let trendDesc = 'Stable';

  if (recentEasyPaces.length >= 3 && olderEasyPaces.length >= 3) {
    const recentAvg = recentEasyPaces.reduce((a, b) => a + b, 0) / recentEasyPaces.length;
    const olderAvg = olderEasyPaces.reduce((a, b) => a + b, 0) / olderEasyPaces.length;
    const improvement = olderAvg - recentAvg; // Positive = faster

    if (improvement > 10) {
      trendScore = 100;
      trendDesc = `Improving (-${Math.round(improvement)}s/mi)`;
    } else if (improvement > 5) {
      trendScore = 85;
      trendDesc = `Slightly improving`;
    } else if (improvement >= -5) {
      trendScore = 70;
      trendDesc = 'Stable';
    } else {
      trendScore = 50;
      trendDesc = 'Slight decline';
    }
  }

  components.push({
    name: 'Performance Trend',
    score: trendScore,
    status: trendScore >= 80 ? 'excellent' : trendScore >= 60 ? 'good' : trendScore >= 40 ? 'fair' : 'needs_work',
    description: trendDesc,
  });
  totalScore += trendScore * 0.20;

  // Calculate final score
  const overallScore = Math.round(totalScore);

  // Grade
  let grade: string;
  if (overallScore >= 95) grade = 'A+';
  else if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 85) grade = 'A-';
  else if (overallScore >= 80) grade = 'B+';
  else if (overallScore >= 75) grade = 'B';
  else if (overallScore >= 70) grade = 'B-';
  else if (overallScore >= 65) grade = 'C+';
  else if (overallScore >= 60) grade = 'C';
  else if (overallScore >= 55) grade = 'C-';
  else if (overallScore >= 50) grade = 'D';
  else grade = 'F';

  // Level
  let level: string;
  if (overallScore >= 85) level = 'Advanced';
  else if (overallScore >= 70) level = 'Intermediate';
  else if (overallScore >= 50) level = 'Developing';
  else level = 'Beginner';

  // Recommendations
  const recommendations: string[] = [];

  if (consistencyScore < 70) {
    recommendations.push('Try to run at least 4 times per week for better consistency');
  }
  if (volumeScore < 60) {
    recommendations.push('Gradually increase weekly mileage by 10% to build your base');
  }
  if (qualityPct < 10) {
    recommendations.push('Add one tempo or interval session per week for speed development');
  }
  if (qualityPct > 30) {
    recommendations.push('Consider reducing hard workouts - too much intensity increases injury risk');
  }
  if (longRunScore < 50) {
    recommendations.push('Include a weekly long run for endurance building');
  }
  if (trendScore < 60) {
    recommendations.push('Focus on consistent training to reverse the performance trend');
  }

  if (recommendations.length === 0) {
    recommendations.push('Excellent training! Keep up the great work and consider setting a race goal');
  }

  // Compare to previous period
  let comparedToLast: FitnessAssessment['comparedToLast'] = null;
  // This would need historical assessment data stored to compare

  return {
    overallScore,
    grade,
    level,
    components,
    recommendations: recommendations.slice(0, 3),
    comparedToLast,
  };
}

/**
 * Calculate fitness age based on performance
 * Uses research-backed VDOT percentiles by age
 */
export async function getFitnessAge(): Promise<FitnessAge | null> {
  const [settings, predictions] = await Promise.all([
    getSettings(),
    getRacePredictions(),
  ]);

  if (!predictions.vdot) {
    return null;
  }

  const vdot = predictions.vdot;
  const chronologicalAge = settings?.age || null;

  // VDOT percentiles by age (50th percentile for recreational runners)
  // Based on running research and age-grading tables
  // Higher VDOT = better fitness = younger "fitness age"
  //
  // Reference points (50th percentile recreational male runners):
  // Age 20: VDOT ~48
  // Age 30: VDOT ~46
  // Age 40: VDOT ~43
  // Age 50: VDOT ~40
  // Age 60: VDOT ~37
  // Age 70: VDOT ~33
  //
  // Elite adjustment: elite runners add ~15-20 to these numbers
  // Sedentary: subtract ~10-15 from these numbers

  // Convert VDOT to equivalent age using inverse of decline curve
  // VDOT declines ~0.5-1.0 per year after age 30
  // Formula: fitnessAge = 30 - (vdot - 46) * 2
  // VDOT 46 = age 30, VDOT 56 = age 10 (young/elite), VDOT 36 = age 50

  let fitnessAge: number;

  if (vdot >= 60) {
    // Elite level - cap at "teens"
    fitnessAge = Math.max(18, 30 - (vdot - 46) * 1.5);
  } else if (vdot >= 45) {
    // Good recreational runner
    fitnessAge = 30 - (vdot - 46) * 2;
  } else if (vdot >= 35) {
    // Average/developing runner
    fitnessAge = 30 - (vdot - 46) * 2.5;
  } else {
    // Beginner/sedentary
    fitnessAge = 30 - (vdot - 46) * 3;
  }

  fitnessAge = Math.round(Math.max(18, Math.min(75, fitnessAge)));

  let fitnessAgeDiff: number | null = null;
  let explanation: string;

  if (chronologicalAge) {
    fitnessAgeDiff = fitnessAge - chronologicalAge;

    if (fitnessAgeDiff < -10) {
      explanation = `Outstanding! Your VDOT of ${vdot} means you're performing like someone ${Math.abs(fitnessAgeDiff)} years younger.`;
    } else if (fitnessAgeDiff < -5) {
      explanation = `Great fitness! You're outperforming typical runners your age by several years.`;
    } else if (fitnessAgeDiff <= 5) {
      explanation = `Solid fitness level - you're right where you'd expect for an active ${chronologicalAge}-year-old.`;
    } else if (fitnessAgeDiff <= 10) {
      explanation = `Room to grow - consistent training can help close this gap.`;
    } else {
      explanation = `Building your base will make a big difference. Regular running can dramatically improve your fitness age.`;
    }
  } else {
    explanation = `Your VDOT of ${vdot} suggests cardiovascular fitness typical of a ${fitnessAge}-year-old runner. Add your age in Settings for a personalized comparison.`;
  }

  return {
    chronologicalAge,
    fitnessAge,
    fitnessAgeDiff,
    explanation,
  };
}

/**
 * Get progress towards common running milestones
 */
export async function getMilestoneProgress(): Promise<{
  milestones: {
    name: string;
    description: string;
    current: number;
    target: number;
    percentComplete: number;
    achieved: boolean;
  }[];
}> {
  const allWorkouts = await db.query.workouts.findMany({
    orderBy: [desc(workouts.date)],
  });

  const totalMiles = allWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = allWorkouts.length;
  const thisYear = new Date().getFullYear();
  const thisYearWorkouts = allWorkouts.filter(w => new Date(w.date).getFullYear() === thisYear);
  const ytdMiles = thisYearWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  // Calculate longest streak
  const dates = [...new Set(allWorkouts.map(w => w.date))].sort();
  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  const milestones = [
    { name: '100 Mile Club', description: 'Run 100 total miles', current: totalMiles, target: 100 },
    { name: '500 Mile Club', description: 'Run 500 total miles', current: totalMiles, target: 500 },
    { name: '1000 Mile Club', description: 'Run 1000 total miles', current: totalMiles, target: 1000 },
    { name: 'Century Year', description: 'Run 100 miles in a calendar year', current: ytdMiles, target: 100 },
    { name: '500 Mile Year', description: 'Run 500 miles in a calendar year', current: ytdMiles, target: 500 },
    { name: '1000 Mile Year', description: 'Run 1000 miles in a calendar year', current: ytdMiles, target: 1000 },
    { name: '50 Runs', description: 'Complete 50 runs', current: totalRuns, target: 50 },
    { name: '100 Runs', description: 'Complete 100 runs', current: totalRuns, target: 100 },
    { name: '7 Day Streak', description: 'Run 7 days in a row', current: longestStreak, target: 7 },
    { name: '30 Day Streak', description: 'Run 30 days in a row', current: longestStreak, target: 30 },
  ];

  return {
    milestones: milestones.map(m => ({
      ...m,
      current: Math.round(m.current * 10) / 10,
      percentComplete: Math.min(100, Math.round((m.current / m.target) * 100)),
      achieved: m.current >= m.target,
    })),
  };
}
