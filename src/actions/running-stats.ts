'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, and, sql, eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate } from '@/lib/utils';

/**
 * Various fun running statistics and insights
 */

export interface RunningStreak {
  currentStreak: number;
  longestStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  lastRunDate: string | null;
  streakStatus: 'active' | 'broken' | 'no_data';
}

export interface RunningMilestones {
  totalMilesAllTime: number;
  totalRunsAllTime: number;
  totalHoursAllTime: number;
  averageRunDistance: number;
  averageRunDuration: number;
  longestRun: { distance: number; date: string; id: number } | null;
  fastestMile: { pace: number; date: string; id: number } | null;
  mostElevation: { elevation: number; date: string; id: number } | null;
  biggestWeek: { miles: number; weekStart: string } | null;
  biggestMonth: { miles: number; month: string } | null;
}

export interface TimeOfDayAnalysis {
  distribution: {
    period: string;
    label: string;
    count: number;
    avgPace: number | null;
    percentage: number;
  }[];
  bestPerformancePeriod: string | null;
  mostCommonPeriod: string | null;
}

export interface WeatherCorrelation {
  tempRanges: {
    range: string;
    avgPace: number | null;
    count: number;
  }[];
  optimalTemp: string | null;
  humidityImpact: {
    low: number | null;
    medium: number | null;
    high: number | null;
  };
}

/**
 * Calculate running streak
 */
export async function getRunningStreak(): Promise<RunningStreak> {
  const profileId = await getActiveProfileId();

  const allWorkouts = await db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
    orderBy: [desc(workouts.date)],
    columns: { date: true },
  });

  if (allWorkouts.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      longestStreakStart: null,
      longestStreakEnd: null,
      lastRunDate: null,
      streakStatus: 'no_data',
    };
  }

  // Get unique dates
  const dates = [...new Set(allWorkouts.map(w => w.date))].sort((a, b) => b.localeCompare(a));
  const lastRunDate = dates[0];

  // Check if streak is active (ran today or yesterday)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const streakActive = lastRunDate === today || lastRunDate === yesterday;

  // Calculate current streak
  let currentStreak = 0;
  if (streakActive) {
    const checkDate = new Date(lastRunDate);
    for (const date of dates) {
      const dateStr = new Date(checkDate).toISOString().split('T')[0];
      if (date === dateStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date < dateStr) {
        // Skip ahead if we're past this date
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;

  // Sort dates ascending for streak calculation
  const sortedDates = [...dates].sort();

  let streakCount = 1;
  let streakStart = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays === 1) {
      streakCount++;
    } else {
      if (streakCount > longestStreak) {
        longestStreak = streakCount;
        longestStreakStart = streakStart;
        longestStreakEnd = sortedDates[i - 1];
      }
      streakCount = 1;
      streakStart = sortedDates[i];
    }
  }

  // Check final streak
  if (streakCount > longestStreak) {
    longestStreak = streakCount;
    longestStreakStart = streakStart;
    longestStreakEnd = sortedDates[sortedDates.length - 1];
  }

  return {
    currentStreak,
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
    lastRunDate,
    streakStatus: streakActive ? 'active' : 'broken',
  };
}

/**
 * Get all-time running milestones
 */
export async function getRunningMilestones(): Promise<RunningMilestones> {
  const profileId = await getActiveProfileId();

  const allWorkouts = await db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
    orderBy: [desc(workouts.date)],
  });

  if (allWorkouts.length === 0) {
    return {
      totalMilesAllTime: 0,
      totalRunsAllTime: 0,
      totalHoursAllTime: 0,
      averageRunDistance: 0,
      averageRunDuration: 0,
      longestRun: null,
      fastestMile: null,
      mostElevation: null,
      biggestWeek: null,
      biggestMonth: null,
    };
  }

  const totalMiles = allWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = allWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  // Find records
  const longestRunWorkout = allWorkouts
    .filter(w => w.distanceMiles)
    .sort((a, b) => (b.distanceMiles || 0) - (a.distanceMiles || 0))[0];

  const fastestMileWorkout = allWorkouts
    .filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 180) // Filter unrealistic
    .sort((a, b) => (a.avgPaceSeconds || 999) - (b.avgPaceSeconds || 999))[0];

  const mostElevationWorkout = allWorkouts
    .filter(w => w.elevationGainFeet)
    .sort((a, b) => (b.elevationGainFeet || 0) - (a.elevationGainFeet || 0))[0];

  // Calculate biggest week
  const weekMap = new Map<string, number>();
  for (const w of allWorkouts) {
    const date = parseLocalDate(w.date);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + (w.distanceMiles || 0));
  }

  let biggestWeek: { miles: number; weekStart: string } | null = null;
  for (const [weekStart, miles] of weekMap) {
    if (!biggestWeek || miles > biggestWeek.miles) {
      biggestWeek = { miles: Math.round(miles * 10) / 10, weekStart };
    }
  }

  // Calculate biggest month
  const monthMap = new Map<string, number>();
  for (const w of allWorkouts) {
    const date = parseLocalDate(w.date);
    const monthKey = `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (w.distanceMiles || 0));
  }

  let biggestMonth: { miles: number; month: string } | null = null;
  for (const [month, miles] of monthMap) {
    if (!biggestMonth || miles > biggestMonth.miles) {
      biggestMonth = { miles: Math.round(miles * 10) / 10, month };
    }
  }

  return {
    totalMilesAllTime: Math.round(totalMiles * 10) / 10,
    totalRunsAllTime: allWorkouts.length,
    totalHoursAllTime: Math.round(totalMinutes / 60 * 10) / 10,
    averageRunDistance: Math.round((totalMiles / allWorkouts.length) * 10) / 10,
    averageRunDuration: Math.round(totalMinutes / allWorkouts.length),
    longestRun: longestRunWorkout ? {
      distance: Math.round((longestRunWorkout.distanceMiles || 0) * 10) / 10,
      date: longestRunWorkout.date,
      id: longestRunWorkout.id,
    } : null,
    fastestMile: fastestMileWorkout ? {
      pace: fastestMileWorkout.avgPaceSeconds || 0,
      date: fastestMileWorkout.date,
      id: fastestMileWorkout.id,
    } : null,
    mostElevation: mostElevationWorkout ? {
      elevation: mostElevationWorkout.elevationGainFeet || 0,
      date: mostElevationWorkout.date,
      id: mostElevationWorkout.id,
    } : null,
    biggestWeek,
    biggestMonth,
  };
}

/**
 * Analyze time of day patterns
 */
export async function getTimeOfDayAnalysis(): Promise<TimeOfDayAnalysis> {
  // For now, we don't have time data stored, so we'll return a placeholder
  // This would need startTime to be stored in the workouts table

  // Placeholder structure
  const periods = [
    { period: 'early_morning', label: 'Early Morning (5-7am)', count: 0, avgPace: null, percentage: 0 },
    { period: 'morning', label: 'Morning (7-10am)', count: 0, avgPace: null, percentage: 0 },
    { period: 'midday', label: 'Midday (10am-2pm)', count: 0, avgPace: null, percentage: 0 },
    { period: 'afternoon', label: 'Afternoon (2-5pm)', count: 0, avgPace: null, percentage: 0 },
    { period: 'evening', label: 'Evening (5-8pm)', count: 0, avgPace: null, percentage: 0 },
    { period: 'night', label: 'Night (8pm+)', count: 0, avgPace: null, percentage: 0 },
  ];

  return {
    distribution: periods,
    bestPerformancePeriod: null,
    mostCommonPeriod: null,
  };
}

/**
 * Analyze weather correlation with performance
 */
export async function getWeatherCorrelation(): Promise<WeatherCorrelation> {
  const profileId = await getActiveProfileId();
  const dateFilter = gte(workouts.date, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const whereCondition = profileId
    ? and(dateFilter, eq(workouts.profileId, profileId))
    : dateFilter;

  const recentWorkouts = await db.query.workouts.findMany({
    where: whereCondition,
  });

  // Group by temperature ranges
  const tempRanges: { range: string; min: number; max: number; workouts: typeof recentWorkouts }[] = [
    { range: 'Cold (<40°F)', min: -100, max: 40, workouts: [] },
    { range: 'Cool (40-55°F)', min: 40, max: 55, workouts: [] },
    { range: 'Mild (55-65°F)', min: 55, max: 65, workouts: [] },
    { range: 'Warm (65-75°F)', min: 65, max: 75, workouts: [] },
    { range: 'Hot (75-85°F)', min: 75, max: 85, workouts: [] },
    { range: 'Very Hot (>85°F)', min: 85, max: 200, workouts: [] },
  ];

  for (const w of recentWorkouts) {
    if (w.weatherTempF) {
      for (const range of tempRanges) {
        if (w.weatherTempF >= range.min && w.weatherTempF < range.max) {
          range.workouts.push(w);
          break;
        }
      }
    }
  }

  const distribution = tempRanges.map(range => {
    const paces = range.workouts
      .filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 180 && w.avgPaceSeconds < 900)
      .map(w => w.avgPaceSeconds!);

    const avgPace = paces.length > 0
      ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length)
      : null;

    return {
      range: range.range,
      avgPace,
      count: range.workouts.length,
    };
  });

  // Find optimal temperature (fastest average pace)
  const withData = distribution.filter(d => d.avgPace && d.count >= 3);
  const optimalTemp = withData.length > 0
    ? withData.sort((a, b) => (a.avgPace || 999) - (b.avgPace || 999))[0].range
    : null;

  // Humidity analysis
  const lowHumidity = recentWorkouts.filter(w => w.weatherHumidityPct && w.weatherHumidityPct < 40 && w.avgPaceSeconds);
  const medHumidity = recentWorkouts.filter(w => w.weatherHumidityPct && w.weatherHumidityPct >= 40 && w.weatherHumidityPct < 70 && w.avgPaceSeconds);
  const highHumidity = recentWorkouts.filter(w => w.weatherHumidityPct && w.weatherHumidityPct >= 70 && w.avgPaceSeconds);

  const calcAvgPace = (wks: typeof recentWorkouts) => {
    const paces = wks.filter(w => w.avgPaceSeconds).map(w => w.avgPaceSeconds!);
    return paces.length >= 3 ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) : null;
  };

  return {
    tempRanges: distribution,
    optimalTemp,
    humidityImpact: {
      low: calcAvgPace(lowHumidity),
      medium: calcAvgPace(medHumidity),
      high: calcAvgPace(highHumidity),
    },
  };
}

/**
 * Get day of week distribution
 */
export async function getDayOfWeekDistribution(): Promise<{
  days: { day: string; count: number; miles: number; avgPace: number | null }[];
  mostActiveDay: string | null;
  longestRunDay: string | null;
}> {
  const profileId = await getActiveProfileId();

  const allWorkouts = await db.query.workouts.findMany({
    where: profileId ? eq(workouts.profileId, profileId) : undefined,
  });

  // Monday-first order (JS getDay() returns 0=Sun, so remap)
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const jsDayToIndex = [6, 0, 1, 2, 3, 4, 5]; // Sun→6, Mon→0, Tue→1, ...
  const dayStats = dayNames.map(day => ({
    day,
    count: 0,
    miles: 0,
    paces: [] as number[],
  }));

  for (const w of allWorkouts) {
    const date = parseLocalDate(w.date);
    const dayIndex = jsDayToIndex[date.getDay()];
    dayStats[dayIndex].count++;
    dayStats[dayIndex].miles += w.distanceMiles || 0;
    if (w.avgPaceSeconds) {
      dayStats[dayIndex].paces.push(w.avgPaceSeconds);
    }
  }

  const days = dayStats.map(d => ({
    day: d.day,
    count: d.count,
    miles: Math.round(d.miles * 10) / 10,
    avgPace: d.paces.length > 0
      ? Math.round(d.paces.reduce((a, b) => a + b, 0) / d.paces.length)
      : null,
  }));

  // Use copies so the original array order (Mon-Sun) isn't mutated
  const mostActiveDay = [...days].sort((a, b) => b.count - a.count)[0]?.day || null;
  const longestRunDay = [...days].sort((a, b) => b.miles - a.miles)[0]?.day || null;

  return {
    days,
    mostActiveDay,
    longestRunDay,
  };
}

/**
 * Get fun facts and achievements
 */
export async function getFunFacts(): Promise<{
  facts: { icon: string; label: string; value: string; detail?: string }[];
}> {
  const [milestones, streak, dayDist] = await Promise.all([
    getRunningMilestones(),
    getRunningStreak(),
    getDayOfWeekDistribution(),
  ]);

  const facts: { icon: string; label: string; value: string; detail?: string }[] = [];

  // Total miles equivalent
  if (milestones.totalMilesAllTime >= 100) {
    const marathons = Math.floor(milestones.totalMilesAllTime / 26.2);
    if (marathons >= 1) {
      facts.push({
        icon: '🏃',
        label: 'Marathon Equivalents',
        value: `${marathons} marathons`,
        detail: `You've run the equivalent of ${marathons} full marathons!`,
      });
    }
  }

  // Around the world progress (circumference ~24,901 miles)
  const earthPct = (milestones.totalMilesAllTime / 24901) * 100;
  if (earthPct >= 0.1) {
    facts.push({
      icon: '🌍',
      label: 'Around the World',
      value: `${earthPct.toFixed(2)}%`,
      detail: `You've completed ${earthPct.toFixed(2)}% of running around Earth!`,
    });
  }

  // Streak facts
  if (streak.longestStreak >= 7) {
    facts.push({
      icon: '🔥',
      label: 'Longest Streak',
      value: `${streak.longestStreak} days`,
      detail: streak.longestStreakStart && streak.longestStreakEnd
        ? `From ${formatDate(streak.longestStreakStart)} to ${formatDate(streak.longestStreakEnd)}`
        : undefined,
    });
  }

  // Favorite day
  if (dayDist.mostActiveDay) {
    const dayData = dayDist.days.find(d => d.day === dayDist.mostActiveDay);
    facts.push({
      icon: '📅',
      label: 'Favorite Run Day',
      value: dayDist.mostActiveDay,
      detail: dayData ? `${dayData.count} runs on ${dayData.day}s` : undefined,
    });
  }

  // Total hours
  if (milestones.totalHoursAllTime >= 10) {
    const days = Math.floor(milestones.totalHoursAllTime / 24);
    facts.push({
      icon: '⏱️',
      label: 'Time Running',
      value: days > 0 ? `${days}+ days` : `${Math.round(milestones.totalHoursAllTime)} hours`,
      detail: `${milestones.totalHoursAllTime.toFixed(1)} total hours of running`,
    });
  }

  // Biggest week/month
  if (milestones.biggestWeek) {
    facts.push({
      icon: '📈',
      label: 'Biggest Week Ever',
      value: `${milestones.biggestWeek.miles} mi`,
      detail: `Week of ${formatDate(milestones.biggestWeek.weekStart)}`,
    });
  }

  // Average run
  facts.push({
    icon: '📊',
    label: 'Average Run',
    value: `${milestones.averageRunDistance} mi`,
    detail: `~${milestones.averageRunDuration} minutes per run`,
  });

  return { facts };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
