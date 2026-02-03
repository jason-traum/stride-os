'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface ActivityData {
  date: string;
  miles: number;
  workoutType?: string;
  avgPaceSeconds?: number;
  avgHr?: number;
  rpe?: number;
  durationMinutes?: number;
  trimp?: number;
}

// Color modes for the heatmap
type ColorMode = 'type' | 'mileage' | 'trimp' | 'rpe';

// Depth modifier options
type DepthMode = 'mileage' | 'duration' | 'trimp' | 'none';

interface ActivityHeatmapProps {
  data: ActivityData[];
  months?: number;
  userThresholdPace?: number; // User's threshold pace in seconds/mile
  userEasyPace?: number; // User's easy pace in seconds/mile
  userMaxHr?: number;
  userRestingHr?: number;
  defaultColorMode?: ColorMode;
  defaultDepthMode?: DepthMode;
}

// Color anchors for the continuous color system (Type mode)
// Hue represents quality ratio (% of run at/above tempo effort)
const COLOR_ANCHORS = {
  pure_easy: { h: 210, s: 60, l: 55 },    // Slate blue — 0% quality
  moderate: { h: 185, s: 55, l: 50 },     // Teal — ~25% quality
  mixed: { h: 160, s: 50, l: 48 },        // Teal-green — ~50% quality
  mostly_hard: { h: 35, s: 75, l: 50 },   // Amber — ~70% quality
  pure_hard: { h: 20, s: 80, l: 48 },     // Deep amber/orange — 90%+ quality
  race: { h: 45, s: 85, l: 55 },          // Gold — races
};

// Color scales for different modes
const MILEAGE_COLORS = {
  low: { h: 200, s: 70, l: 70 },      // Light blue
  medium: { h: 200, s: 75, l: 55 },   // Medium blue
  high: { h: 200, s: 80, l: 40 },     // Dark blue
};

const TRIMP_COLORS = {
  low: { h: 140, s: 60, l: 70 },      // Light green
  medium: { h: 140, s: 70, l: 50 },   // Medium green
  high: { h: 140, s: 80, l: 35 },     // Dark green
};

const RPE_COLORS = {
  easy: { h: 120, s: 50, l: 60 },     // Green (RPE 1-4)
  moderate: { h: 45, s: 70, l: 55 },  // Yellow/amber (RPE 5-6)
  hard: { h: 20, s: 75, l: 50 },      // Orange (RPE 7-8)
  max: { h: 0, s: 80, l: 45 },        // Red (RPE 9-10)
};

// Workout type colors (for Type mode, categorical)
const WORKOUT_TYPE_COLORS: Record<string, { h: number; s: number; l: number }> = {
  easy: { h: 210, s: 60, l: 55 },       // Blue
  recovery: { h: 210, s: 40, l: 70 },   // Light blue
  long_run: { h: 270, s: 50, l: 55 },   // Purple
  long: { h: 270, s: 50, l: 55 },       // Purple
  tempo: { h: 35, s: 75, l: 50 },       // Amber
  threshold: { h: 20, s: 80, l: 48 },   // Orange
  interval: { h: 0, s: 70, l: 50 },     // Red
  intervals: { h: 0, s: 70, l: 50 },    // Red
  fartlek: { h: 330, s: 60, l: 50 },    // Pink
  race: { h: 45, s: 85, l: 55 },        // Gold
  shakeout: { h: 180, s: 50, l: 55 },   // Teal
  cross_training: { h: 160, s: 40, l: 50 }, // Green-teal
  hill_repeats: { h: 15, s: 75, l: 45 },    // Deep orange
  progression: { h: 280, s: 60, l: 50 },    // Violet
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute quality ratio from workout data
 * Returns 0-1 where 0 = pure easy, 1 = pure hard
 */
function computeQualityRatio(
  workout: ActivityData,
  thresholdPace: number,
  easyPace: number,
  maxHr: number = 185,
  restingHr: number = 50
): number {
  // Workout type base values - these serve as baseline hints
  const typeHints: Record<string, number> = {
    easy: 0.1,
    recovery: 0.05,
    long: 0.2,
    steady: 0.4,
    tempo: 0.7,
    threshold: 0.75,
    interval: 0.65,
    race: 0.95,
  };

  // Start with workout type hint as baseline
  const typeHint = workout.workoutType ? (typeHints[workout.workoutType] ?? 0.15) : 0.15;

  // If it's explicitly a race, return high quality
  if (workout.workoutType === 'race') return 0.95;

  // If it's explicitly recovery, return very low
  if (workout.workoutType === 'recovery') return 0.05;

  // Collect quality signals
  const signals: number[] = [];
  let weights: number[] = [];

  // Pace-based quality (weight: 0.4)
  if (workout.avgPaceSeconds && thresholdPace && easyPace && easyPace > thresholdPace) {
    // Extend range: very slow pace (easy + 90sec) = 0, threshold = 1
    const extendedEasy = easyPace + 90; // Allow for truly easy recovery runs
    const range = extendedEasy - thresholdPace;
    const paceRatio = (extendedEasy - workout.avgPaceSeconds) / range;
    signals.push(Math.max(0, Math.min(1, paceRatio)));
    weights.push(0.4);
  }

  // HR-based quality (weight: 0.4)
  if (workout.avgHr && maxHr && restingHr && maxHr > restingHr) {
    // HR zones: resting = 0, max = 1
    // Most easy runs are 60-70% of max HR, tempo is 80-85%
    const hrRange = maxHr - restingHr;
    const hrRatio = (workout.avgHr - restingHr) / hrRange;
    // Scale so that 65% HRR = ~0.2, 80% HRR = ~0.6
    const scaledHr = Math.max(0, Math.min(1, (hrRatio - 0.5) * 2));
    signals.push(scaledHr);
    weights.push(0.4);
  }

  // RPE-based quality (weight: 0.3)
  if (workout.rpe) {
    const rpeRatio = Math.max(0, Math.min(1, (workout.rpe - 3) / 7));
    signals.push(rpeRatio);
    weights.push(0.3);
  }

  // If we have no physiological data, use type hint with small variation based on duration
  if (signals.length === 0) {
    // Longer workouts at same type tend to be slightly harder
    const durationBonus = workout.durationMinutes
      ? Math.min(0.1, (workout.durationMinutes - 30) / 300)
      : 0;
    return Math.max(0, Math.min(1, typeHint + durationBonus));
  }

  // Weighted average of signals
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = signals.reduce((sum, sig, i) => sum + sig * weights[i], 0);
  const dataQuality = weightedSum / totalWeight;

  // Blend data-based quality with type hint (70% data, 30% type hint)
  // This prevents all easy runs from being identical blue
  const blendedQuality = dataQuality * 0.7 + typeHint * 0.3;

  return Math.max(0, Math.min(1, blendedQuality));
}

/**
 * Get run color hue based on quality ratio
 */
function getRunHue(qualityRatio: number, isRace: boolean): { h: number; s: number; l: number } {
  if (isRace) return COLOR_ANCHORS.race;

  const stops = [
    { at: 0.0, color: COLOR_ANCHORS.pure_easy },
    { at: 0.25, color: COLOR_ANCHORS.moderate },
    { at: 0.50, color: COLOR_ANCHORS.mixed },
    { at: 0.70, color: COLOR_ANCHORS.mostly_hard },
    { at: 1.0, color: COLOR_ANCHORS.pure_hard },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (qualityRatio <= stops[i + 1].at) {
      const t = (qualityRatio - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return {
        h: lerp(stops[i].color.h, stops[i + 1].color.h, t),
        s: lerp(stops[i].color.s, stops[i + 1].color.s, t),
        l: lerp(stops[i].color.l, stops[i + 1].color.l, t),
      };
    }
  }
  return COLOR_ANCHORS.pure_hard;
}

/**
 * Get opacity based on mileage relative to user's range
 */
function getRunOpacity(miles: number, minMiles: number, maxMiles: number): number {
  if (maxMiles <= minMiles) return 0.6;
  const normalized = (miles - minMiles) / (maxMiles - minMiles);
  // Map to opacity range: 0.35 (faintest visible) to 1.0 (fully saturated)
  return Math.max(0.35, Math.min(1.0, 0.35 + normalized * 0.65));
}

/**
 * Get the final color for a workout
 */
function getWorkoutColor(
  workout: ActivityData,
  thresholdPace: number,
  easyPace: number,
  minMiles: number,
  maxMiles: number,
  maxHr?: number,
  restingHr?: number
): string {
  const qualityRatio = computeQualityRatio(workout, thresholdPace, easyPace, maxHr, restingHr);
  const { h, s, l } = getRunHue(qualityRatio, workout.workoutType === 'race');
  const opacity = getRunOpacity(workout.miles, minMiles, maxMiles);

  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${opacity.toFixed(2)})`;
}

// Format date for tooltip
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Get quality label for tooltip
function getQualityLabel(qualityRatio: number): string {
  if (qualityRatio < 0.15) return 'Easy';
  if (qualityRatio < 0.35) return 'Moderate';
  if (qualityRatio < 0.55) return 'Mixed';
  if (qualityRatio < 0.75) return 'Hard';
  return 'Very Hard';
}

/**
 * Get color for mileage mode
 */
function getMileageColor(miles: number, minMiles: number, maxMiles: number): { h: number; s: number; l: number } {
  if (maxMiles <= minMiles) return MILEAGE_COLORS.medium;
  const ratio = (miles - minMiles) / (maxMiles - minMiles);

  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return {
      h: lerp(MILEAGE_COLORS.low.h, MILEAGE_COLORS.medium.h, t),
      s: lerp(MILEAGE_COLORS.low.s, MILEAGE_COLORS.medium.s, t),
      l: lerp(MILEAGE_COLORS.low.l, MILEAGE_COLORS.medium.l, t),
    };
  } else {
    const t = (ratio - 0.33) / 0.67;
    return {
      h: lerp(MILEAGE_COLORS.medium.h, MILEAGE_COLORS.high.h, t),
      s: lerp(MILEAGE_COLORS.medium.s, MILEAGE_COLORS.high.s, t),
      l: lerp(MILEAGE_COLORS.medium.l, MILEAGE_COLORS.high.l, t),
    };
  }
}

/**
 * Get color for TRIMP mode
 */
function getTrimpColor(trimp: number, minTrimp: number, maxTrimp: number): { h: number; s: number; l: number } {
  if (maxTrimp <= minTrimp) return TRIMP_COLORS.medium;
  const ratio = (trimp - minTrimp) / (maxTrimp - minTrimp);

  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return {
      h: lerp(TRIMP_COLORS.low.h, TRIMP_COLORS.medium.h, t),
      s: lerp(TRIMP_COLORS.low.s, TRIMP_COLORS.medium.s, t),
      l: lerp(TRIMP_COLORS.low.l, TRIMP_COLORS.medium.l, t),
    };
  } else {
    const t = (ratio - 0.33) / 0.67;
    return {
      h: lerp(TRIMP_COLORS.medium.h, TRIMP_COLORS.high.h, t),
      s: lerp(TRIMP_COLORS.medium.s, TRIMP_COLORS.high.s, t),
      l: lerp(TRIMP_COLORS.medium.l, TRIMP_COLORS.high.l, t),
    };
  }
}

/**
 * Get color for RPE mode
 */
function getRpeColor(rpe: number): { h: number; s: number; l: number } {
  if (rpe <= 4) {
    const t = (rpe - 1) / 3;
    return {
      h: RPE_COLORS.easy.h,
      s: lerp(40, RPE_COLORS.easy.s, t),
      l: lerp(75, RPE_COLORS.easy.l, t),
    };
  } else if (rpe <= 6) {
    const t = (rpe - 4) / 2;
    return {
      h: lerp(RPE_COLORS.easy.h, RPE_COLORS.moderate.h, t),
      s: lerp(RPE_COLORS.easy.s, RPE_COLORS.moderate.s, t),
      l: lerp(RPE_COLORS.easy.l, RPE_COLORS.moderate.l, t),
    };
  } else if (rpe <= 8) {
    const t = (rpe - 6) / 2;
    return {
      h: lerp(RPE_COLORS.moderate.h, RPE_COLORS.hard.h, t),
      s: lerp(RPE_COLORS.moderate.s, RPE_COLORS.hard.s, t),
      l: lerp(RPE_COLORS.moderate.l, RPE_COLORS.hard.l, t),
    };
  } else {
    const t = (rpe - 8) / 2;
    return {
      h: lerp(RPE_COLORS.hard.h, RPE_COLORS.max.h, t),
      s: lerp(RPE_COLORS.hard.s, RPE_COLORS.max.s, t),
      l: lerp(RPE_COLORS.hard.l, RPE_COLORS.max.l, t),
    };
  }
}

/**
 * Get color for workout type mode (categorical)
 */
function getTypeColor(workoutType: string | undefined): { h: number; s: number; l: number } {
  if (!workoutType) return COLOR_ANCHORS.pure_easy;
  const normalizedType = workoutType.toLowerCase().replace(/[\s-]/g, '_');
  return WORKOUT_TYPE_COLORS[normalizedType] || COLOR_ANCHORS.pure_easy;
}

/**
 * Get depth/opacity based on selected depth mode
 */
function getDepthOpacity(
  workout: ActivityData,
  depthMode: DepthMode,
  stats: {
    minMiles: number;
    maxMiles: number;
    minDuration: number;
    maxDuration: number;
    minTrimp: number;
    maxTrimp: number;
  }
): number {
  if (depthMode === 'none') return 1;

  let value: number;
  let min: number;
  let max: number;

  switch (depthMode) {
    case 'mileage':
      value = workout.miles;
      min = stats.minMiles;
      max = stats.maxMiles;
      break;
    case 'duration':
      value = workout.durationMinutes || 0;
      min = stats.minDuration;
      max = stats.maxDuration;
      break;
    case 'trimp':
      value = workout.trimp || 0;
      min = stats.minTrimp;
      max = stats.maxTrimp;
      break;
    default:
      return 1;
  }

  if (max <= min) return 0.6;
  const normalized = (value - min) / (max - min);
  return Math.max(0.35, Math.min(1.0, 0.35 + normalized * 0.65));
}

export function ActivityHeatmap({
  data,
  months = 12,
  userThresholdPace = 420, // Default 7:00/mi
  userEasyPace = 540, // Default 9:00/mi
  userMaxHr = 185,
  userRestingHr = 50,
  defaultColorMode = 'type',
  defaultDepthMode = 'mileage',
}: ActivityHeatmapProps) {
  const [colorMode, setColorMode] = useState<ColorMode>(defaultColorMode);
  const [depthMode, setDepthMode] = useState<DepthMode>(defaultDepthMode);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    miles: number;
    workoutType?: string;
    qualityRatio: number;
    rpe?: number;
    trimp?: number;
    durationMinutes?: number;
    x: number;
    y: number;
  } | null>(null);

  // Build the heatmap grid with Monday on top (index 0) and Sunday on bottom (index 6)
  const { grid, stats, totalMiles, activeDays, monthLabels } = useMemo(() => {
    // Create a map of date -> activity data
    const dataMap = new Map<string, ActivityData>();
    for (const d of data) {
      const existing = dataMap.get(d.date);
      if (existing) {
        // Merge multiple activities on same day
        dataMap.set(d.date, {
          ...d,
          miles: existing.miles + d.miles,
          durationMinutes: (existing.durationMinutes || 0) + (d.durationMinutes || 0),
          trimp: (existing.trimp || 0) + (d.trimp || 0),
        });
      } else {
        dataMap.set(d.date, d);
      }
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Go back to the previous Monday (Monday = 1)
    const startDayOfWeek = startDate.getDay();
    const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Build grid (columns = weeks, rows = days of week starting Monday)
    const weekList: Array<Array<ActivityData | null>> = [];
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let currentDate = new Date(startDate);
    let maxMilesVal = 0;
    let minMilesVal = Infinity;
    let maxDurationVal = 0;
    let minDurationVal = Infinity;
    let maxTrimpVal = 0;
    let minTrimpVal = Infinity;
    let maxRpeVal = 0;
    let minRpeVal = Infinity;
    let totalMilesVal = 0;
    let activeDaysCount = 0;
    let lastMonth = -1;
    let weekIndex = 0;

    while (currentDate <= endDate) {
      const week: Array<ActivityData | null> = [];

      // Track month changes for labels
      const currentMonth = currentDate.getMonth();
      if (currentMonth !== lastMonth) {
        labels.push({
          month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex,
        });
        lastMonth = currentMonth;
      }

      // Days 0-6: Monday to Sunday
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        // Convert our Monday=0 index to JavaScript's Sunday=0 system
        const targetJsDay = dayOffset === 6 ? 0 : dayOffset + 1; // Mon=1, Tue=2, ... Sun=0
        const currentJsDay = currentDate.getDay();

        if (currentJsDay === targetJsDay && currentDate <= endDate && currentDate >= startDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const activity = dataMap.get(dateStr);

          if (activity && activity.miles > 0) {
            week.push(activity);
            activeDaysCount++;
            totalMilesVal += activity.miles;
            maxMilesVal = Math.max(maxMilesVal, activity.miles);
            minMilesVal = Math.min(minMilesVal, activity.miles);
            if (activity.durationMinutes) {
              maxDurationVal = Math.max(maxDurationVal, activity.durationMinutes);
              minDurationVal = Math.min(minDurationVal, activity.durationMinutes);
            }
            if (activity.trimp) {
              maxTrimpVal = Math.max(maxTrimpVal, activity.trimp);
              minTrimpVal = Math.min(minTrimpVal, activity.trimp);
            }
            if (activity.rpe) {
              maxRpeVal = Math.max(maxRpeVal, activity.rpe);
              minRpeVal = Math.min(minRpeVal, activity.rpe);
            }
          } else {
            week.push({ date: dateStr, miles: 0 });
          }

          currentDate.setDate(currentDate.getDate() + 1);
        } else {
          week.push(null);
        }
      }

      weekList.push(week);
      weekIndex++;
    }

    // If no activities, set reasonable defaults
    if (minMilesVal === Infinity) minMilesVal = 0;
    if (maxMilesVal === 0) maxMilesVal = 10;
    if (minDurationVal === Infinity) minDurationVal = 0;
    if (maxDurationVal === 0) maxDurationVal = 60;
    if (minTrimpVal === Infinity) minTrimpVal = 0;
    if (maxTrimpVal === 0) maxTrimpVal = 100;
    if (minRpeVal === Infinity) minRpeVal = 1;
    if (maxRpeVal === 0) maxRpeVal = 10;

    return {
      grid: weekList,
      stats: {
        maxMiles: maxMilesVal,
        minMiles: minMilesVal,
        maxDuration: maxDurationVal,
        minDuration: minDurationVal,
        maxTrimp: maxTrimpVal,
        minTrimp: minTrimpVal,
        maxRpe: maxRpeVal,
        minRpe: minRpeVal,
      },
      totalMiles: Math.round(totalMilesVal * 10) / 10,
      activeDays: activeDaysCount,
      monthLabels: labels,
    };
  }, [data, months]);

  // Day labels: Monday on top, Sunday on bottom
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  // Get color for a workout based on current color mode
  const getColorForWorkout = (workout: ActivityData) => {
    let hsl: { h: number; s: number; l: number };

    switch (colorMode) {
      case 'type':
        // Use workout type color if available, otherwise compute quality ratio
        if (workout.workoutType) {
          hsl = getTypeColor(workout.workoutType);
        } else {
          const qualityRatio = computeQualityRatio(workout, userThresholdPace, userEasyPace, userMaxHr, userRestingHr);
          hsl = getRunHue(qualityRatio, false);
        }
        break;
      case 'mileage':
        hsl = getMileageColor(workout.miles, stats.minMiles, stats.maxMiles);
        break;
      case 'trimp':
        hsl = getTrimpColor(workout.trimp || 0, stats.minTrimp, stats.maxTrimp);
        break;
      case 'rpe':
        hsl = getRpeColor(workout.rpe || 5);
        break;
      default:
        hsl = COLOR_ANCHORS.pure_easy;
    }

    const opacity = getDepthOpacity(workout, depthMode, stats);
    return `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%, ${opacity.toFixed(2)})`;
  };

  // Render dynamic legend based on color mode
  const renderLegend = () => {
    switch (colorMode) {
      case 'type':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Easy</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(210, 60%, 55%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(185, 55%, 50%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(160, 50%, 48%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(35, 75%, 50%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(20, 80%, 48%)` }} />
            </div>
            <span>Hard</span>
          </div>
        );
      case 'mileage':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{stats.minMiles.toFixed(1)} mi</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(200, 70%, 70%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(200, 73%, 62%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(200, 75%, 55%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(200, 78%, 47%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(200, 80%, 40%)` }} />
            </div>
            <span>{stats.maxMiles.toFixed(1)} mi</span>
          </div>
        );
      case 'trimp':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Low</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(140, 60%, 70%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(140, 65%, 60%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(140, 70%, 50%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(140, 75%, 42%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(140, 80%, 35%)` }} />
            </div>
            <span>High</span>
          </div>
        );
      case 'rpe':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>1</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(120, 50%, 60%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(80, 55%, 55%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(45, 70%, 55%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(20, 75%, 50%)` }} />
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(0, 80%, 45%)` }} />
            </div>
            <span>10</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Activity Heatmap</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalMiles} miles over {activeDays} days
          </p>
        </div>
        {/* Dynamic Legend */}
        {renderLegend()}
      </div>

      {/* Color Mode Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500">Color by:</span>
        <div className="flex gap-1">
          {(['type', 'mileage', 'trimp', 'rpe'] as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={cn(
                'px-2 py-1 text-xs rounded-md transition-colors capitalize',
                colorMode === mode
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {mode === 'trimp' ? 'TRIMP' : mode === 'rpe' ? 'RPE' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-8 relative h-4">
        {monthLabels.map((label, i) => (
          <span
            key={i}
            className="text-[10px] text-slate-400 absolute"
            style={{
              left: `${(label.weekIndex / grid.length) * 100}%`,
            }}
          >
            {label.month}
          </span>
        ))}
      </div>

      {/* Grid container */}
      <div className="flex overflow-x-auto">
        {/* Day labels - Monday on top, Sunday on bottom */}
        <div className="flex flex-col gap-[2px] mr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-[10px] text-[9px] text-slate-400 leading-[10px] w-6 text-right pr-1">
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div
          className="flex gap-[2px] relative"
          onMouseLeave={() => setHoveredDay(null)}
        >
          {grid.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[2px]">
              {week.map((day, dayIdx) => {
                if (!day) {
                  return <div key={dayIdx} className="w-[10px] h-[10px]" />;
                }

                const hasActivity = day.miles > 0;
                const qualityRatio = hasActivity
                  ? computeQualityRatio(day, userThresholdPace, userEasyPace, userMaxHr, userRestingHr)
                  : 0;
                const color = hasActivity ? getColorForWorkout(day) : undefined;

                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      'w-[10px] h-[10px] rounded-[2px] transition-all duration-150',
                      hasActivity
                        ? 'cursor-pointer hover:ring-1 hover:ring-slate-400 hover:ring-offset-1'
                        : 'bg-slate-800/20'
                    )}
                    style={hasActivity ? { backgroundColor: color } : undefined}
                    onMouseEnter={(e) => {
                      if (hasActivity) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay({
                          date: day.date,
                          miles: day.miles,
                          workoutType: day.workoutType,
                          qualityRatio,
                          rpe: day.rpe,
                          trimp: day.trimp,
                          durationMinutes: day.durationMinutes,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }
                    }}
                  />
                );
              })}
            </div>
          ))}

          {/* Tooltip */}
          {hoveredDay && (
            <div
              className="fixed bg-slate-900 text-white text-xs rounded-lg px-2.5 py-2 shadow-lg pointer-events-none z-50 whitespace-nowrap"
              style={{
                left: hoveredDay.x,
                top: hoveredDay.y - 60,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-medium">{formatDate(hoveredDay.date)}</div>
              <div className="text-slate-300">
                {hoveredDay.miles > 0 ? (
                  <>
                    <span className="text-white font-medium">{hoveredDay.miles.toFixed(1)} mi</span>
                    {hoveredDay.workoutType && (
                      <span className="ml-1 capitalize">· {hoveredDay.workoutType.replace(/_/g, ' ')}</span>
                    )}
                    {hoveredDay.durationMinutes && (
                      <span className="ml-1">· {Math.round(hoveredDay.durationMinutes)} min</span>
                    )}
                    <div className="text-[10px] mt-0.5 space-x-2">
                      {colorMode === 'type' && (
                        <span>Intensity: {getQualityLabel(hoveredDay.qualityRatio)} ({Math.round(hoveredDay.qualityRatio * 100)}%)</span>
                      )}
                      {colorMode === 'trimp' && hoveredDay.trimp !== undefined && (
                        <span>TRIMP: {Math.round(hoveredDay.trimp)}</span>
                      )}
                      {colorMode === 'rpe' && hoveredDay.rpe !== undefined && (
                        <span>RPE: {hoveredDay.rpe}/10</span>
                      )}
                      {colorMode === 'mileage' && (
                        <span>Distance: {hoveredDay.miles.toFixed(1)} mi</span>
                      )}
                    </div>
                  </>
                ) : (
                  'Rest day'
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Depth/Opacity Controls */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Depth by:</span>
          <div className="flex gap-1">
            {(['mileage', 'duration', 'trimp', 'none'] as DepthMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDepthMode(mode)}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded transition-colors capitalize',
                  depthMode === mode
                    ? 'bg-slate-200 text-slate-700 font-medium'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {mode === 'trimp' ? 'TRIMP' : mode}
              </button>
            ))}
          </div>
        </div>
        {depthMode !== 'none' && (
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5 items-center">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400/35" />
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400/55" />
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400/75" />
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
            </div>
            <span className="text-slate-400 ml-1">
              {depthMode === 'mileage' && `${stats.minMiles.toFixed(1)} - ${stats.maxMiles.toFixed(1)} mi`}
              {depthMode === 'duration' && `${Math.round(stats.minDuration)} - ${Math.round(stats.maxDuration)} min`}
              {depthMode === 'trimp' && `${Math.round(stats.minTrimp)} - ${Math.round(stats.maxTrimp)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
