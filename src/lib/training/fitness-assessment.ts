/**
 * Fitness Assessment from Workout History
 *
 * Analyzes actual training data to determine current fitness level
 * for accurate plan generation
 */

import { db, workouts, userSettings } from '@/lib/db';
import { desc, gte, and, eq, sql } from 'drizzle-orm';
import { parseLocalDate } from '@/lib/utils';
import { getCoachingKnowledge } from '@/lib/coach-knowledge';

export interface CurrentFitnessData {
  // Mileage metrics
  currentAvgMileage: number;      // Average weekly mileage (last 4 weeks)
  currentMedianMileage: number;   // Median weekly mileage (more robust to outliers)
  typicalWeeklyMileage: number;   // What we'll use for planning (median if high variance)
  recentPeakMileage: number;      // Peak week in last 8 weeks
  mileageVariance: number;        // Standard deviation of weekly mileage
  hasHighVariance: boolean;       // True if training is inconsistent
  weeklyMileageDetails: number[]; // Actual weekly totals for transparency
  mileageTrend: 'increasing' | 'stable' | 'decreasing';

  // Long run capacity
  longestRecentRun: number;       // Longest run in last 6 weeks
  avgLongRun: number;             // Average long run distance

  // Quality work
  qualityPerWeek: number;         // Quality sessions per week
  hasSpeedwork: boolean;          // Has done intervals/tempo recently

  // Training patterns
  runsPerWeek: number;            // Average runs per week
  isConsistent: boolean;          // Low variance = consistent
  consecutiveWeeks: number;       // Weeks of continuous training

  // Experience indicators
  totalRuns: number;              // Total runs in database
  monthsOfData: number;           // How long they've been logging

  // Fitness metrics
  ctl?: number;                   // Chronic Training Load (if available)
  atl?: number;                   // Acute Training Load
  tsb?: number;                   // Training Stress Balance
  currentVDOT?: number;           // From recent race results

  // Recovery needs
  avgRecoveryDays: number;        // Days between hard efforts
  injuryHistory: string[];        // Recent injuries

  // Recommendations
  suggestedPeakMileage: number;   // Based on history and coaching knowledge
  rampRate: number;               // Safe weekly increase percentage
  confidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Assess current fitness from actual workout history
 */
export async function assessCurrentFitness(profileId: number): Promise<CurrentFitnessData> {
  // Get coaching knowledge for intelligent assessment
  const recoveryKnowledge = getCoachingKnowledge('recovery_adaptation');
  const specialPopKnowledge = getCoachingKnowledge('special_populations');
  const periodizationKnowledge = getCoachingKnowledge('periodization');

  // Fetch workouts from different time windows
  const today = new Date();
  const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(today.getTime() - 56 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);

  const [recentWorkouts, extendedWorkouts, allTimeWorkouts] = await Promise.all([
    // Last 4 weeks for current state
    db.query.workouts.findMany({
      where: and(
        eq(workouts.profileId, profileId),
        gte(workouts.date, fourWeeksAgo.toISOString().split('T')[0])
      ),
      orderBy: [desc(workouts.date)],
    }),

    // Last 8 weeks for trends
    db.query.workouts.findMany({
      where: and(
        eq(workouts.profileId, profileId),
        gte(workouts.date, eightWeeksAgo.toISOString().split('T')[0])
      ),
      orderBy: [desc(workouts.date)],
    }),

    // All time for experience
    db.query.workouts.findMany({
      where: eq(workouts.profileId, profileId),
      orderBy: [desc(workouts.date)],
    }),
  ]);

  // Group workouts by week
  const weeklyMileage = calculateWeeklyMileage(extendedWorkouts);
  const recentWeeklyMileage = weeklyMileage.slice(-4);

  // Calculate mileage metrics using both average and median
  const currentAvgMileage = average(recentWeeklyMileage) || 0;
  const currentMedianMileage = median(recentWeeklyMileage) || 0;
  const recentPeakMileage = weeklyMileage.length > 0 ? Math.max(...weeklyMileage) : 0;
  const mileageVariance = standardDeviation(recentWeeklyMileage);

  // Detect high variance (CV > 0.3 indicates high variability)
  const coefficientOfVariation = currentAvgMileage > 0 ? mileageVariance / currentAvgMileage : 0;
  const hasHighVariance = coefficientOfVariation > 0.3;

  // Use median if variance is high, otherwise use average
  const typicalWeeklyMileage = hasHighVariance ? currentMedianMileage : currentAvgMileage;

  // Determine mileage trend
  const mileageTrend = calculateTrend(weeklyMileage);

  // Store weekly details for transparency
  const weeklyMileageDetails = recentWeeklyMileage;

  // Long run analysis
  const longRuns = extendedWorkouts
    .filter(w => w.distanceMiles >= 8 || w.workoutType === 'long')
    .map(w => w.distanceMiles);
  const recentLongRuns = longRuns.slice(-6);
  const longestRecentRun = recentLongRuns.length > 0 ? Math.max(...recentLongRuns) : 0;
  const avgLongRun = average(longRuns) || 0;

  // Quality work analysis
  const qualityWorkouts = recentWorkouts.filter(w =>
    ['tempo', 'interval', 'threshold', 'race'].includes(w.workoutType || '')
  );
  const qualityPerWeek = (qualityWorkouts.length / 4);
  const hasSpeedwork = qualityWorkouts.length > 0;

  // Training consistency
  const uniqueDaysRecent = new Set(recentWorkouts.map(w => w.date)).size;
  const runsPerWeek = uniqueDaysRecent / 4;
  const isConsistent = !hasHighVariance; // Use our variance calculation

  // Calculate consecutive weeks of training
  const consecutiveWeeks = calculateConsecutiveWeeks(extendedWorkouts);

  // Experience metrics
  const totalRuns = allTimeWorkouts.length;
  const firstRunDate = allTimeWorkouts[allTimeWorkouts.length - 1]?.date;
  const monthsOfData = firstRunDate
    ? Math.floor((today.getTime() - parseLocalDate(firstRunDate).getTime()) / (30 * 24 * 60 * 60 * 1000))
    : 0;

  // Get recent VDOT if available
  const currentVDOT = await getCurrentVDOT(profileId);

  // Calculate recovery patterns
  const avgRecoveryDays = calculateAvgRecoveryDays(recentWorkouts);

  // Get injury history
  const injuryHistory = await getRecentInjuries(profileId);

  // Calculate safe peak mileage based on history and coaching knowledge
  const suggestedPeakMileage = calculateSuggestedPeakMileage({
    currentAvgMileage: typicalWeeklyMileage,
    recentPeakMileage,
    isConsistent,
    monthsOfData,
    injuryHistory,
    hasSpeedwork,
    coachingKnowledge: { recoveryKnowledge, specialPopKnowledge, periodizationKnowledge }
  });

  // Calculate safe ramp rate
  const rampRate = calculateSafeRampRate({
    currentAvgMileage: typicalWeeklyMileage,
    isConsistent,
    consecutiveWeeks,
    injuryHistory,
    monthsOfData,
    coachingKnowledge: { recoveryKnowledge, specialPopKnowledge }
  });

  // Determine confidence level
  const confidenceLevel = determineConfidenceLevel({
    weeklyMileage: recentWeeklyMileage,
    totalRuns,
    consecutiveWeeks,
    monthsOfData
  });

  return {
    currentAvgMileage: Math.round(currentAvgMileage),
    currentMedianMileage: Math.round(currentMedianMileage),
    typicalWeeklyMileage: Math.round(typicalWeeklyMileage),
    recentPeakMileage: Math.round(recentPeakMileage),
    mileageVariance: Math.round(mileageVariance),
    hasHighVariance,
    weeklyMileageDetails: weeklyMileageDetails.map(m => Math.round(m)),
    mileageTrend,
    longestRecentRun: Math.round(longestRecentRun),
    avgLongRun: Math.round(avgLongRun),
    qualityPerWeek: Math.round(qualityPerWeek * 10) / 10,
    hasSpeedwork,
    runsPerWeek: Math.round(runsPerWeek * 10) / 10,
    isConsistent,
    consecutiveWeeks,
    totalRuns,
    monthsOfData,
    currentVDOT,
    avgRecoveryDays,
    injuryHistory,
    suggestedPeakMileage: Math.round(suggestedPeakMileage),
    rampRate,
    confidenceLevel,
  };
}

// Helper functions

function calculateWeeklyMileage(workouts: any[]): number[] {
  const weeklyTotals = new Map<string, number>();

  workouts.forEach(workout => {
    const date = parseLocalDate(workout.date);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];

    weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + workout.distanceMiles);
  });

  // Convert to array and sort by week
  return Array.from(weeklyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, miles]) => miles);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
  return new Date(d.setDate(diff));
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}

function calculateTrend(weeklyMileage: number[]): 'increasing' | 'stable' | 'decreasing' {
  if (weeklyMileage.length < 4) return 'stable';

  const recent = weeklyMileage.slice(-4);
  const older = weeklyMileage.slice(-8, -4);

  const recentAvg = average(recent);
  const olderAvg = average(older);

  const change = (recentAvg - olderAvg) / olderAvg;

  if (change > 0.15) return 'increasing';
  if (change < -0.15) return 'decreasing';
  return 'stable';
}

function calculateConsecutiveWeeks(workouts: any[]): number {
  if (workouts.length === 0) return 0;

  const weeks = new Set<string>();
  workouts.forEach(w => {
    const weekStart = getWeekStart(parseLocalDate(w.date));
    weeks.add(weekStart.toISOString().split('T')[0]);
  });

  const sortedWeeks = Array.from(weeks).sort().reverse();
  let consecutive = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const current = new Date(sortedWeeks[i]);
    const previous = new Date(sortedWeeks[i - 1]);

    const diffDays = (previous.getTime() - current.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays === 7) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

async function getCurrentVDOT(profileId: number): Promise<number | undefined> {
  // Get from user settings or recent race results
  const settings = await db.query.userSettings.findFirst({
    where: eq(db.userSettings.profileId, profileId)
  });

  return settings?.vdot || undefined;
}

function calculateAvgRecoveryDays(workouts: any[]): number {
  const hardWorkouts = workouts
    .filter(w => ['tempo', 'interval', 'threshold', 'long', 'race'].includes(w.workoutType || ''))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (hardWorkouts.length < 2) return 3; // Default

  const gaps: number[] = [];
  for (let i = 1; i < hardWorkouts.length; i++) {
    const current = parseLocalDate(hardWorkouts[i].date);
    const previous = parseLocalDate(hardWorkouts[i - 1].date);
    const daysBetween = Math.round((current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
    gaps.push(daysBetween);
  }

  return Math.round(average(gaps)) || 3;
}

async function getRecentInjuries(profileId: number): Promise<string[]> {
  // This would query injuries table - for now return empty
  return [];
}

function calculateSuggestedPeakMileage(params: {
  currentAvgMileage: number;
  recentPeakMileage: number;
  isConsistent: boolean;
  monthsOfData: number;
  injuryHistory: string[];
  hasSpeedwork: boolean;
  coachingKnowledge: any;
}): number {
  const { currentAvgMileage, recentPeakMileage, isConsistent, monthsOfData, injuryHistory } = params;

  // Base suggestion on proven capacity
  let suggested = Math.max(currentAvgMileage * 1.3, recentPeakMileage * 1.1);

  // Adjust based on consistency
  if (!isConsistent) {
    suggested *= 0.9; // More conservative if inconsistent
  }

  // Adjust based on experience
  if (monthsOfData < 6) {
    suggested = Math.min(suggested, currentAvgMileage * 1.2);
  } else if (monthsOfData > 24) {
    suggested = Math.max(suggested, recentPeakMileage * 1.15);
  }

  // Cap based on injury history
  if (injuryHistory.length > 0) {
    suggested = Math.min(suggested, recentPeakMileage);
  }

  // Apply reasonable limits
  if (currentAvgMileage < 20) {
    suggested = Math.min(suggested, 30); // Don't jump from <20 to >30
  } else if (currentAvgMileage < 40) {
    suggested = Math.min(suggested, 55); // Don't jump from <40 to >55
  }

  return Math.max(suggested, currentAvgMileage + 5); // At least 5 mpw increase
}

function calculateSafeRampRate(params: {
  currentAvgMileage: number;
  isConsistent: boolean;
  consecutiveWeeks: number;
  injuryHistory: string[];
  monthsOfData: number;
  coachingKnowledge: any;
}): number {
  const { currentAvgMileage, isConsistent, consecutiveWeeks, injuryHistory, monthsOfData } = params;

  // Base rate depends on current volume
  let baseRate = 0.10; // 10% default

  // Lower volume can increase faster (percentage-wise)
  if (currentAvgMileage < 20) {
    baseRate = 0.15;
  } else if (currentAvgMileage < 30) {
    baseRate = 0.12;
  } else if (currentAvgMileage > 50) {
    baseRate = 0.08;
  } else if (currentAvgMileage > 70) {
    baseRate = 0.05;
  }

  // Adjust for consistency
  if (!isConsistent) {
    baseRate *= 0.7; // More conservative if inconsistent
  }

  // Adjust for training history
  if (consecutiveWeeks < 8) {
    baseRate *= 0.8; // Still building consistency
  } else if (consecutiveWeeks > 20) {
    baseRate *= 1.1; // Proven durability
  }

  // Adjust for injury history
  if (injuryHistory.length > 0) {
    baseRate *= 0.7; // Much more conservative
  }

  // Returning runner can ramp faster
  if (monthsOfData > 12 && consecutiveWeeks < 8) {
    baseRate *= 1.3; // Experienced runner returning
  }

  return Math.min(Math.max(baseRate, 0.05), 0.20); // 5-20% range
}

function determineConfidenceLevel(params: {
  weeklyMileage: number[];
  totalRuns: number;
  consecutiveWeeks: number;
  monthsOfData: number;
}): 'high' | 'medium' | 'low' {
  const { weeklyMileage, totalRuns, consecutiveWeeks, monthsOfData } = params;

  let score = 0;

  // More data = higher confidence
  if (weeklyMileage.length >= 8) score += 2;
  else if (weeklyMileage.length >= 4) score += 1;

  if (totalRuns >= 50) score += 2;
  else if (totalRuns >= 20) score += 1;

  if (consecutiveWeeks >= 8) score += 2;
  else if (consecutiveWeeks >= 4) score += 1;

  if (monthsOfData >= 6) score += 2;
  else if (monthsOfData >= 3) score += 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Format fitness assessment for display to user
 */
export function formatFitnessAssessment(fitness: CurrentFitnessData): string {
  const confidenceEmoji = {
    high: '✅',
    medium: '⚠️',
    low: '🔍'
  }[fitness.confidenceLevel];

  let assessment = `Based on your recent training (${confidenceEmoji} ${fitness.confidenceLevel} confidence):\n\n`;

  assessment += `**Current State:**\n`;

  if (fitness.hasHighVariance) {
    assessment += `- Your weekly mileage has varied: ${fitness.weeklyMileageDetails.join(', ')} miles\n`;
    assessment += `- Using median of ${fitness.typicalWeeklyMileage} miles/week (more stable than average of ${fitness.currentAvgMileage})\n`;
  } else {
    assessment += `- You've been averaging ${fitness.typicalWeeklyMileage} miles/week over the last month\n`;
  }

  assessment += `- Your longest run was ${fitness.longestRecentRun} miles\n`;
  assessment += `- You're running ${fitness.runsPerWeek} times per week\n`;

  if (fitness.qualityPerWeek > 0) {
    assessment += `- You're doing about ${fitness.qualityPerWeek} quality sessions per week\n`;
  }

  assessment += `\n**Training Pattern:**\n`;
  assessment += `- Your mileage has been ${fitness.mileageTrend}\n`;
  assessment += `- Training consistency: ${fitness.isConsistent ? 'Good ✓' : 'Variable - working on it'}\n`;
  assessment += `- ${fitness.consecutiveWeeks} consecutive weeks of training\n`;

  if (fitness.currentVDOT) {
    assessment += `- Current VDOT: ${fitness.currentVDOT}\n`;
  }

  assessment += `\n**Plan Parameters:**\n`;
  assessment += `- Starting at ${fitness.currentAvgMileage} miles/week (where you are now)\n`;
  assessment += `- Building to ${fitness.suggestedPeakMileage} miles peak (based on your history)\n`;
  assessment += `- Safe progression rate: ${Math.round(fitness.rampRate * 100)}% per week\n`;

  if (fitness.confidenceLevel === 'low') {
    assessment += `\n⚠️ Limited training history - plan will be more conservative`;
  }

  return assessment;
}