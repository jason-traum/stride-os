'use server';

import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { eq, gte, desc, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
// Removed metrics import - CTL/ATL/TSB calculation not available yet

export interface PerformanceTrend {
  period: 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    mileage: { current: number; previous: number; change: number };
    avgPace: { current: number; previous: number; change: number };
    avgDistance: { current: number; previous: number; change: number };
    workoutCount: { current: number; previous: number; change: number };
    consistency: { current: number; previous: number; change: number };
    intensity: { current: number; previous: number; change: number };
    fitness: { current: number; previous: number; change: number };
  };
  charts: {
    mileageProgression: { date: string; value: number }[];
    paceProgression: { date: string; value: number; type: string }[];
    fitnessProgression: { date: string; ctl: number; atl: number; tsb: number }[];
    workoutDistribution: { type: string; count: number; percentage: number }[];
  };
  achievements: {
    type: 'milestone' | 'improvement' | 'consistency' | 'volume';
    title: string;
    description: string;
    date: string;
    icon: 'trophy' | 'trending-up' | 'calendar' | 'activity';
  }[];
  insights: {
    category: 'positive' | 'neutral' | 'warning';
    message: string;
    recommendation?: string;
  }[];
}

export async function analyzePerformanceTrends(
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<PerformanceTrend> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return getEmptyTrends(period);
    }

    // Calculate date ranges
    const now = new Date();
    const { currentStart, previousStart, chartStart } = getDateRanges(period, now);

    // Fetch workouts for analysis
    const allWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, previousStart.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(workouts.date));

    if (allWorkouts.length === 0) {
      return getEmptyTrends(period);
    }

    // Split workouts into current and previous periods
    const currentWorkouts = allWorkouts.filter(w =>
      new Date(w.date) >= currentStart
    );
    const previousWorkouts = allWorkouts.filter(w =>
      new Date(w.date) >= previousStart && new Date(w.date) < currentStart
    );

    // Calculate metrics
    const metrics = calculateMetrics(currentWorkouts, previousWorkouts);

    // Generate charts
    const chartsData = await generateCharts(
      allWorkouts.filter(w => new Date(w.date) >= chartStart),
      profileId
    );

    // Find achievements
    const achievements = findAchievements(allWorkouts, currentWorkouts);

    // Generate insights
    const insights = generateInsights(metrics, currentWorkouts, achievements);

    return {
      period,
      metrics,
      charts: chartsData,
      achievements,
      insights
    };
  } catch (error) {
    console.error('Error analyzing performance trends:', error);
    return getEmptyTrends(period);
  }
}

function getEmptyTrends(period: PerformanceTrend['period']): PerformanceTrend {
  return {
    period,
    metrics: {
      mileage: { current: 0, previous: 0, change: 0 },
      avgPace: { current: 0, previous: 0, change: 0 },
      avgDistance: { current: 0, previous: 0, change: 0 },
      workoutCount: { current: 0, previous: 0, change: 0 },
      consistency: { current: 0, previous: 0, change: 0 },
      intensity: { current: 0, previous: 0, change: 0 },
      fitness: { current: 0, previous: 0, change: 0 }
    },
    charts: {
      mileageProgression: [],
      paceProgression: [],
      fitnessProgression: [],
      workoutDistribution: []
    },
    achievements: [],
    insights: [{
      category: 'neutral',
      message: 'Start logging workouts to see your performance trends.',
      recommendation: 'Aim for 3-4 runs per week to build consistency.'
    }]
  };
}

function getDateRanges(period: PerformanceTrend['period'], now: Date) {
  const currentStart = new Date(now);
  const previousStart = new Date(now);
  const chartStart = new Date(now);

  switch (period) {
    case 'week':
      currentStart.setDate(now.getDate() - 7);
      previousStart.setDate(now.getDate() - 14);
      chartStart.setDate(now.getDate() - 28);
      break;
    case 'month':
      currentStart.setMonth(now.getMonth() - 1);
      previousStart.setMonth(now.getMonth() - 2);
      chartStart.setMonth(now.getMonth() - 3);
      break;
    case 'quarter':
      currentStart.setMonth(now.getMonth() - 3);
      previousStart.setMonth(now.getMonth() - 6);
      chartStart.setMonth(now.getMonth() - 9);
      break;
    case 'year':
      currentStart.setFullYear(now.getFullYear() - 1);
      previousStart.setFullYear(now.getFullYear() - 2);
      chartStart.setFullYear(now.getFullYear() - 2);
      break;
  }

  return { currentStart, previousStart, chartStart };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateMetrics(current: any[], previous: any[]) {
  // Mileage
  const currentMileage = current.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const previousMileage = previous.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  // Average pace (only for runs with pace data)
  const currentPaces = current.filter(w => w.avgPaceSeconds).map(w => w.avgPaceSeconds);
  const previousPaces = previous.filter(w => w.avgPaceSeconds).map(w => w.avgPaceSeconds);
  const currentAvgPace = currentPaces.length > 0 ?
    currentPaces.reduce((sum, p) => sum + p, 0) / currentPaces.length : 0;
  const previousAvgPace = previousPaces.length > 0 ?
    previousPaces.reduce((sum, p) => sum + p, 0) / previousPaces.length : 0;

  // Average distance
  const currentAvgDist = current.length > 0 ? currentMileage / current.length : 0;
  const previousAvgDist = previous.length > 0 ? previousMileage / previous.length : 0;

  // Consistency (workouts per week)
  const currentWeeks = getWeekCount(current);
  const previousWeeks = getWeekCount(previous);
  const currentConsistency = currentWeeks > 0 ? (current.length / currentWeeks) * 100 / 7 : 0;
  const previousConsistency = previousWeeks > 0 ? (previous.length / previousWeeks) * 100 / 7 : 0;

  // Intensity (% of hard workouts)
  const currentHard = current.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'race'
  ).length;
  const previousHard = previous.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'race'
  ).length;
  const currentIntensity = current.length > 0 ? (currentHard / current.length) * 100 : 0;
  const previousIntensity = previous.length > 0 ? (previousHard / previous.length) * 100 : 0;

  return {
    mileage: {
      current: Math.round(currentMileage),
      previous: Math.round(previousMileage),
      change: previousMileage > 0 ?
        Math.round(((currentMileage - previousMileage) / previousMileage) * 100) : 0
    },
    avgPace: {
      current: Math.round(currentAvgPace),
      previous: Math.round(previousAvgPace),
      change: previousAvgPace > 0 ?
        Math.round(((previousAvgPace - currentAvgPace) / previousAvgPace) * 100) : 0
    },
    avgDistance: {
      current: Math.round(currentAvgDist * 10) / 10,
      previous: Math.round(previousAvgDist * 10) / 10,
      change: previousAvgDist > 0 ?
        Math.round(((currentAvgDist - previousAvgDist) / previousAvgDist) * 100) : 0
    },
    workoutCount: {
      current: current.length,
      previous: previous.length,
      change: previous.length > 0 ?
        Math.round(((current.length - previous.length) / previous.length) * 100) : 0
    },
    consistency: {
      current: Math.round(currentConsistency),
      previous: Math.round(previousConsistency),
      change: Math.round(currentConsistency - previousConsistency)
    },
    intensity: {
      current: Math.round(currentIntensity),
      previous: Math.round(previousIntensity),
      change: Math.round(currentIntensity - previousIntensity)
    },
    fitness: {
      current: 0, // Will be calculated from CTL
      previous: 0,
      change: 0
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWeekCount(workouts: any[]): number {
  if (workouts.length === 0) return 0;
  const dates = workouts.map(w => new Date(w.date));
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  const days = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(days / 7));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
async function generateCharts(workouts: any[], profileId: string) {
  // Mileage progression by week
  const mileageByWeek = new Map<string, number>();
  workouts.forEach(w => {
    const weekStart = getWeekStart(new Date(w.date));
    const key = weekStart.toISOString().split('T')[0];
    mileageByWeek.set(key, (mileageByWeek.get(key) || 0) + (w.distanceMiles || 0));
  });

  const mileageProgression = Array.from(mileageByWeek.entries())
    .map(([date, value]) => ({ date, value: Math.round(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Pace progression by workout type
  const paceProgression = workouts
    .filter(w => w.avgPaceSeconds)
    .map(w => ({
      date: w.date,
      value: w.avgPaceSeconds,
      type: w.workoutType || 'easy'
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Fitness progression (CTL/ATL/TSB) - placeholder for now
  // TODO: Implement calculateTrainingMetrics when metrics module is available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitnessProgression: any[] = [];

  // Workout distribution
  const typeCount = new Map<string, number>();
  workouts.forEach(w => {
    const type = w.workoutType || 'easy';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });

  const total = workouts.length;
  const workoutDistribution = Array.from(typeCount.entries())
    .map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    mileageProgression,
    paceProgression,
    fitnessProgression,
    workoutDistribution
  };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAchievements(allWorkouts: any[], currentWorkouts: any[]): PerformanceTrend['achievements'] {
  const achievements: PerformanceTrend['achievements'] = [];

  // Check for mileage milestones
  const totalMileage = allWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const milestones = [100, 250, 500, 1000, 2000, 5000];
  for (const milestone of milestones) {
    if (totalMileage >= milestone && totalMileage - currentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) < milestone) {
      achievements.push({
        type: 'milestone',
        title: `${milestone} Total Miles!`,
        description: `You've run ${milestone} miles total. Keep up the great work!`,
        date: currentWorkouts[0]?.date || new Date().toISOString(),
        icon: 'trophy'
      });
    }
  }

  // Check for consistency streaks
  const streakDays = calculateStreakDays(currentWorkouts);
  if (streakDays >= 7) {
    achievements.push({
      type: 'consistency',
      title: `${streakDays} Day Streak!`,
      description: `You've been running consistently for ${streakDays} days.`,
      date: currentWorkouts[0]?.date || new Date().toISOString(),
      icon: 'calendar'
    });
  }

  // Check for pace improvements
  const recentPaces = currentWorkouts
    .filter(w => w.avgPaceSeconds && w.workoutType === 'easy')
    .map(w => w.avgPaceSeconds);
  if (recentPaces.length >= 3) {
    const avgRecent = recentPaces.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const avgOlder = recentPaces.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (avgRecent < avgOlder * 0.95) {
      achievements.push({
        type: 'improvement',
        title: 'Pace Improvement!',
        description: 'Your easy pace has improved by 5% or more recently.',
        date: currentWorkouts[0]?.date || new Date().toISOString(),
        icon: 'trending-up'
      });
    }
  }

  // Check for volume increases
  const currentVolume = currentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  if (currentVolume > 0) {
    const weeks = getWeekCount(currentWorkouts);
    const weeklyAvg = currentVolume / weeks;
    if (weeklyAvg >= 20) {
      achievements.push({
        type: 'volume',
        title: `${Math.round(weeklyAvg)} Miles/Week Average`,
        description: 'Great training volume! This builds a strong aerobic base.',
        date: currentWorkouts[0]?.date || new Date().toISOString(),
        icon: 'activity'
      });
    }
  }

  return achievements.slice(0, 5); // Return top 5 achievements
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateStreakDays(workouts: any[]): number {
  if (workouts.length === 0) return 0;

  const sortedDates = workouts
    .map(w => new Date(w.date))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const dayDiff = (sortedDates[i - 1].getTime() - sortedDates[i].getTime()) / (24 * 60 * 60 * 1000);
    if (dayDiff <= 2) { // Allow 1 rest day
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function generateInsights(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentWorkouts: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  achievements: any[]
): PerformanceTrend['insights'] {
  const insights: PerformanceTrend['insights'] = [];

  // Mileage insights
  if (metrics.mileage.change > 50) {
    insights.push({
      category: 'warning',
      message: `Your mileage increased by ${metrics.mileage.change}% - watch for signs of overtraining.`,
      recommendation: 'Consider a recovery week if feeling fatigued.'
    });
  } else if (metrics.mileage.change > 20) {
    insights.push({
      category: 'positive',
      message: `Nice mileage increase of ${metrics.mileage.change}%! You're building fitness.`,
      recommendation: 'Keep the progression gradual to avoid injury.'
    });
  } else if (metrics.mileage.change < -30) {
    insights.push({
      category: 'warning',
      message: `Your mileage dropped by ${Math.abs(metrics.mileage.change)}%.`,
      recommendation: 'If unplanned, try to maintain consistency.'
    });
  }

  // Pace insights
  if (metrics.avgPace.change > 5) {
    insights.push({
      category: 'positive',
      message: `Your average pace improved by ${metrics.avgPace.change}%!`,
      recommendation: 'Great progress! Your fitness is improving.'
    });
  } else if (metrics.avgPace.change < -10) {
    insights.push({
      category: 'warning',
      message: 'Your pace has slowed recently.',
      recommendation: 'This could indicate fatigue. Consider more easy days.'
    });
  }

  // Consistency insights
  if (metrics.consistency.current > 70) {
    insights.push({
      category: 'positive',
      message: `Excellent consistency at ${metrics.consistency.current}%!`,
      recommendation: 'This consistency will drive long-term improvement.'
    });
  } else if (metrics.consistency.current < 30) {
    insights.push({
      category: 'neutral',
      message: 'Your training consistency could improve.',
      recommendation: 'Try scheduling runs at consistent times.'
    });
  }

  // Intensity insights
  if (metrics.intensity.current > 30) {
    insights.push({
      category: 'warning',
      message: `${metrics.intensity.current}% of runs are hard efforts.`,
      recommendation: 'Follow the 80/20 rule - 80% easy, 20% hard.'
    });
  }

  // Achievement-based insights
  if (achievements.length > 0) {
    insights.push({
      category: 'positive',
      message: `You earned ${achievements.length} achievement${achievements.length > 1 ? 's' : ''} recently!`,
      recommendation: 'Keep up the momentum!'
    });
  }

  return insights.slice(0, 5); // Return top 5 insights
}
