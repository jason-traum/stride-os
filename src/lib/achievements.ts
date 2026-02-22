/**
 * Achievement Engine for Dreamy
 *
 * Computes achievements on-the-fly from workout data.
 * No persistence layer needed — achievements are derived from existing tables.
 *
 * Each achievement defines:
 *   - id: unique string key
 *   - name: display name
 *   - description: what it means
 *   - icon: emoji for badge display
 *   - category: grouping for the UI
 *   - tier: optional difficulty/prestige level
 *   - check: function that evaluates the condition and returns { earned, date?, progress? }
 */

import type { Workout } from './schema';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AchievementCategory =
  | 'mileage'
  | 'streak'
  | 'distance'
  | 'speed'
  | 'consistency'
  | 'training';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface AchievementResult {
  earned: boolean;
  /** ISO date string when the achievement was first earned */
  earnedDate?: string;
  /** Progress toward the goal (0-1 for percentage, or raw number for milestones) */
  progress?: number;
  /** The target value for milestone-type achievements */
  target?: number;
  /** Human-readable progress label, e.g. "742 / 1,000 mi" */
  progressLabel?: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier?: AchievementTier;
  check: (data: AchievementData) => AchievementResult;
}

export interface EarnedAchievement extends AchievementDefinition {
  result: AchievementResult;
}

/** All the data needed to evaluate achievements, pre-fetched once. */
export interface AchievementData {
  /** All workouts for the profile, sorted by date ascending */
  workouts: Workout[];
  /** Current running streak in days */
  currentStreak: number;
  /** Longest running streak ever */
  longestStreak: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function totalRunMiles(workouts: Workout[]): number {
  return workouts
    .filter(w => w.activityType === 'run')
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
}

function runWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter(w => w.activityType === 'run');
}

/** Find the date when cumulative miles first crossed a threshold */
function milestoneDateForMiles(workouts: Workout[], threshold: number): string | undefined {
  let cumulative = 0;
  for (const w of workouts) {
    if (w.activityType !== 'run') continue;
    cumulative += w.distanceMiles || 0;
    if (cumulative >= threshold) return w.date;
  }
  return undefined;
}

/** Find the first workout matching a distance range (in miles) */
function firstWorkoutAtDistance(
  workouts: Workout[],
  minMiles: number,
  maxMiles: number
): Workout | undefined {
  return workouts.find(
    w => w.activityType === 'run' && w.distanceMiles && w.distanceMiles >= minMiles && w.distanceMiles <= maxMiles
  );
}

/** Find the first workout at or above a distance (in miles) */
function firstWorkoutAtLeast(workouts: Workout[], minMiles: number): Workout | undefined {
  return workouts.find(
    w => w.activityType === 'run' && w.distanceMiles && w.distanceMiles >= minMiles
  );
}

/** Convert seconds to MM:SS string */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Convert seconds to H:MM:SS string */
function formatLongTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Count workouts of a given type */
function countByType(workouts: Workout[], type: string): number {
  return workouts.filter(w => w.workoutType === type && w.activityType === 'run').length;
}

/** Count long runs (>= 10 miles, easy/long type or any run >= 13.1 mi) */
function countLongRuns(workouts: Workout[]): number {
  return workouts.filter(
    w => w.activityType === 'run' && w.distanceMiles && w.distanceMiles >= 10
  ).length;
}

/** Count quality sessions (tempo, threshold, interval, repetition) */
function countQualitySessions(workouts: Workout[]): number {
  const qualityTypes = ['tempo', 'threshold', 'interval', 'repetition'];
  return workouts.filter(
    w => w.activityType === 'run' && qualityTypes.includes(w.workoutType || '')
  ).length;
}

/** Parse start time to get hour (0-23) from startTimeLocal "HH:MM" */
function getStartHour(w: Workout): number | null {
  if (!w.startTimeLocal) return null;
  const parts = w.startTimeLocal.split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  return isNaN(hour) ? null : hour;
}

/** Count runs before a given hour */
function countRunsBefore(workouts: Workout[], hour: number): number {
  return workouts.filter(w => {
    if (w.activityType !== 'run') return false;
    const h = getStartHour(w);
    return h !== null && h < hour;
  }).length;
}

/** Count runs at or after a given hour */
function countRunsAfter(workouts: Workout[], hour: number): number {
  return workouts.filter(w => {
    if (w.activityType !== 'run') return false;
    const h = getStartHour(w);
    return h !== null && h >= hour;
  }).length;
}

/** Count runs in adverse weather conditions */
function countAdverseWeatherRuns(workouts: Workout[]): number {
  const adverseConditions = ['rain', 'snow', 'thunderstorm'];
  const hotThreshold = 85; // Fahrenheit
  return workouts.filter(w => {
    if (w.activityType !== 'run') return false;
    const isAdverseCondition = w.weatherConditions && adverseConditions.includes(w.weatherConditions);
    const isHot = w.weatherTempF && w.weatherTempF >= hotThreshold;
    return isAdverseCondition || isHot;
  }).length;
}

/**
 * Find the fastest finish time for a given distance range.
 * Returns the finish time in seconds and the workout, or undefined.
 */
function fastestFinishForDistance(
  workouts: Workout[],
  minMiles: number,
  maxMiles: number
): { seconds: number; workout: Workout } | undefined {
  let best: { seconds: number; workout: Workout } | undefined;
  for (const w of workouts) {
    if (w.activityType !== 'run') continue;
    if (!w.distanceMiles || !w.durationMinutes) continue;
    if (w.distanceMiles < minMiles || w.distanceMiles > maxMiles) continue;
    const seconds = w.durationMinutes * 60;
    if (!best || seconds < best.seconds) {
      best = { seconds, workout: w };
    }
  }
  return best;
}

// ─── Achievement Definitions ────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ═══ MILEAGE MILESTONES ═══
  {
    id: 'first_run',
    name: 'First Steps',
    description: 'Log your first run',
    icon: '👟',
    category: 'mileage',
    tier: 'bronze',
    check: (data) => {
      const runs = runWorkouts(data.workouts);
      return {
        earned: runs.length > 0,
        earnedDate: runs[0]?.date,
        progress: Math.min(runs.length, 1),
        target: 1,
        progressLabel: `${Math.min(runs.length, 1)} / 1 run`,
      };
    },
  },
  {
    id: 'miles_100',
    name: 'Centurion',
    description: 'Run 100 total miles',
    icon: '💯',
    category: 'mileage',
    tier: 'bronze',
    check: (data) => {
      const total = totalRunMiles(data.workouts);
      const earnedDate = milestoneDateForMiles(data.workouts, 100);
      return {
        earned: total >= 100,
        earnedDate,
        progress: Math.min(total, 100),
        target: 100,
        progressLabel: `${Math.round(total).toLocaleString()} / 100 mi`,
      };
    },
  },
  {
    id: 'miles_500',
    name: 'Road Warrior',
    description: 'Run 500 total miles',
    icon: '🛤️',
    category: 'mileage',
    tier: 'silver',
    check: (data) => {
      const total = totalRunMiles(data.workouts);
      const earnedDate = milestoneDateForMiles(data.workouts, 500);
      return {
        earned: total >= 500,
        earnedDate,
        progress: Math.min(total, 500),
        target: 500,
        progressLabel: `${Math.round(total).toLocaleString()} / 500 mi`,
      };
    },
  },
  {
    id: 'miles_1000',
    name: 'Thousand Miler',
    description: 'Run 1,000 total miles',
    icon: '🏔️',
    category: 'mileage',
    tier: 'gold',
    check: (data) => {
      const total = totalRunMiles(data.workouts);
      const earnedDate = milestoneDateForMiles(data.workouts, 1000);
      return {
        earned: total >= 1000,
        earnedDate,
        progress: Math.min(total, 1000),
        target: 1000,
        progressLabel: `${Math.round(total).toLocaleString()} / 1,000 mi`,
      };
    },
  },
  {
    id: 'miles_2000',
    name: 'Legend',
    description: 'Run 2,000 total miles',
    icon: '🌟',
    category: 'mileage',
    tier: 'diamond',
    check: (data) => {
      const total = totalRunMiles(data.workouts);
      const earnedDate = milestoneDateForMiles(data.workouts, 2000);
      return {
        earned: total >= 2000,
        earnedDate,
        progress: Math.min(total, 2000),
        target: 2000,
        progressLabel: `${Math.round(total).toLocaleString()} / 2,000 mi`,
      };
    },
  },

  // ═══ STREAK ACHIEVEMENTS ═══
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Run 7 days in a row',
    icon: '🔥',
    category: 'streak',
    tier: 'bronze',
    check: (data) => {
      const best = Math.max(data.currentStreak, data.longestStreak);
      return {
        earned: best >= 7,
        progress: Math.min(data.currentStreak, 7),
        target: 7,
        progressLabel: `${Math.min(data.currentStreak, 7)} / 7 days`,
      };
    },
  },
  {
    id: 'streak_30',
    name: 'Iron Will',
    description: 'Run 30 days in a row',
    icon: '⛓️',
    category: 'streak',
    tier: 'silver',
    check: (data) => {
      const best = Math.max(data.currentStreak, data.longestStreak);
      return {
        earned: best >= 30,
        progress: Math.min(data.currentStreak, 30),
        target: 30,
        progressLabel: `${Math.min(data.currentStreak, 30)} / 30 days`,
      };
    },
  },
  {
    id: 'streak_100',
    name: 'Unstoppable',
    description: 'Run 100 days in a row',
    icon: '💎',
    category: 'streak',
    tier: 'diamond',
    check: (data) => {
      const best = Math.max(data.currentStreak, data.longestStreak);
      return {
        earned: best >= 100,
        progress: Math.min(data.currentStreak, 100),
        target: 100,
        progressLabel: `${Math.min(data.currentStreak, 100)} / 100 days`,
      };
    },
  },

  // ═══ DISTANCE ACHIEVEMENTS ═══
  {
    id: 'first_10k',
    name: 'Double Digits',
    description: 'Complete your first 10K (6.2+ miles)',
    icon: '🏃',
    category: 'distance',
    tier: 'bronze',
    check: (data) => {
      const match = firstWorkoutAtLeast(data.workouts, 6.2);
      const longestRun = Math.max(0, ...runWorkouts(data.workouts).map(w => w.distanceMiles || 0));
      return {
        earned: !!match,
        earnedDate: match?.date,
        progress: Math.min(longestRun, 6.2),
        target: 6.2,
        progressLabel: `Longest: ${longestRun.toFixed(1)} mi`,
      };
    },
  },
  {
    id: 'first_half',
    name: 'Half Way There',
    description: 'Complete your first half marathon (13.1+ miles)',
    icon: '🏅',
    category: 'distance',
    tier: 'silver',
    check: (data) => {
      const match = firstWorkoutAtLeast(data.workouts, 13.1);
      const longestRun = Math.max(0, ...runWorkouts(data.workouts).map(w => w.distanceMiles || 0));
      return {
        earned: !!match,
        earnedDate: match?.date,
        progress: Math.min(longestRun, 13.1),
        target: 13.1,
        progressLabel: `Longest: ${longestRun.toFixed(1)} mi`,
      };
    },
  },
  {
    id: 'first_marathon',
    name: 'Marathoner',
    description: 'Complete your first marathon (26.2+ miles)',
    icon: '🥇',
    category: 'distance',
    tier: 'gold',
    check: (data) => {
      const match = firstWorkoutAtLeast(data.workouts, 26.2);
      const longestRun = Math.max(0, ...runWorkouts(data.workouts).map(w => w.distanceMiles || 0));
      return {
        earned: !!match,
        earnedDate: match?.date,
        progress: Math.min(longestRun, 26.2),
        target: 26.2,
        progressLabel: `Longest: ${longestRun.toFixed(1)} mi`,
      };
    },
  },
  {
    id: 'first_ultra',
    name: 'Ultra Beast',
    description: 'Complete an ultramarathon (31+ miles)',
    icon: '🦁',
    category: 'distance',
    tier: 'diamond',
    check: (data) => {
      const match = firstWorkoutAtLeast(data.workouts, 31);
      const longestRun = Math.max(0, ...runWorkouts(data.workouts).map(w => w.distanceMiles || 0));
      return {
        earned: !!match,
        earnedDate: match?.date,
        progress: Math.min(longestRun, 31),
        target: 31,
        progressLabel: `Longest: ${longestRun.toFixed(1)} mi`,
      };
    },
  },

  // ═══ SPEED ACHIEVEMENTS ═══
  // 5K speed tiers (using avgPace * distance ~ finish time)
  {
    id: 'sub30_5k',
    name: 'Sub-30 5K',
    description: 'Finish a 5K in under 30 minutes',
    icon: '⏱️',
    category: 'speed',
    tier: 'bronze',
    check: (data) => {
      // Look for a 5K race/run (3.0-3.3 miles) finished under 30 min
      const result = fastestFinishForDistance(data.workouts, 3.0, 3.3);
      const targetSeconds = 30 * 60;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No 5K recorded' };
    },
  },
  {
    id: 'sub25_5k',
    name: 'Sub-25 5K',
    description: 'Finish a 5K in under 25 minutes',
    icon: '🚀',
    category: 'speed',
    tier: 'silver',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 3.0, 3.3);
      const targetSeconds = 25 * 60;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No 5K recorded' };
    },
  },
  {
    id: 'sub20_5k',
    name: 'Sub-20 5K',
    description: 'Finish a 5K in under 20 minutes',
    icon: '🔥',
    category: 'speed',
    tier: 'gold',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 3.0, 3.3);
      const targetSeconds = 20 * 60;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No 5K recorded' };
    },
  },
  // Half marathon speed
  {
    id: 'sub2_half',
    name: 'Sub-2:00 Half',
    description: 'Finish a half marathon in under 2 hours',
    icon: '🎯',
    category: 'speed',
    tier: 'silver',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 13.0, 13.5);
      const targetSeconds = 2 * 3600;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatLongTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No half marathon recorded' };
    },
  },
  // Marathon speed
  {
    id: 'sub4_marathon',
    name: 'Sub-4:00 Marathon',
    description: 'Finish a marathon in under 4 hours',
    icon: '🏆',
    category: 'speed',
    tier: 'silver',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 26.0, 26.5);
      const targetSeconds = 4 * 3600;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatLongTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No marathon recorded' };
    },
  },
  {
    id: 'sub330_marathon',
    name: 'Sub-3:30 Marathon',
    description: 'Finish a marathon in under 3:30',
    icon: '💨',
    category: 'speed',
    tier: 'gold',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 26.0, 26.5);
      const targetSeconds = 3 * 3600 + 30 * 60;
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatLongTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No marathon recorded' };
    },
  },
  {
    id: 'bq_qualifier',
    name: 'BQ Qualifier',
    description: 'Finish a marathon in under 3:05 (BQ standard for men 18-34)',
    icon: '🦄',
    category: 'speed',
    tier: 'diamond',
    check: (data) => {
      const result = fastestFinishForDistance(data.workouts, 26.0, 26.5);
      const targetSeconds = 3 * 3600 + 5 * 60; // 3:05:00
      if (result) {
        return {
          earned: result.seconds < targetSeconds,
          earnedDate: result.seconds < targetSeconds ? result.workout.date : undefined,
          progress: result.seconds,
          target: targetSeconds,
          progressLabel: `Best: ${formatLongTime(result.seconds)}`,
        };
      }
      return { earned: false, progressLabel: 'No marathon recorded' };
    },
  },

  // ═══ CONSISTENCY ACHIEVEMENTS ═══
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete 5 runs before 7 AM',
    icon: '🌅',
    category: 'consistency',
    tier: 'bronze',
    check: (data) => {
      const count = countRunsBefore(data.workouts, 7);
      return {
        earned: count >= 5,
        progress: Math.min(count, 5),
        target: 5,
        progressLabel: `${Math.min(count, 5)} / 5 early runs`,
      };
    },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete 5 runs after 7 PM',
    icon: '🌙',
    category: 'consistency',
    tier: 'bronze',
    check: (data) => {
      const count = countRunsAfter(data.workouts, 19);
      return {
        earned: count >= 5,
        progress: Math.min(count, 5),
        target: 5,
        progressLabel: `${Math.min(count, 5)} / 5 evening runs`,
      };
    },
  },
  {
    id: 'all_weather',
    name: 'All-Weather Runner',
    description: 'Run in rain, snow, or extreme heat (5 times)',
    icon: '🌧️',
    category: 'consistency',
    tier: 'silver',
    check: (data) => {
      const count = countAdverseWeatherRuns(data.workouts);
      return {
        earned: count >= 5,
        progress: Math.min(count, 5),
        target: 5,
        progressLabel: `${Math.min(count, 5)} / 5 tough weather runs`,
      };
    },
  },
  {
    id: 'century_club',
    name: 'Century Club',
    description: 'Log 100 total runs',
    icon: '📊',
    category: 'consistency',
    tier: 'silver',
    check: (data) => {
      const runs = runWorkouts(data.workouts);
      return {
        earned: runs.length >= 100,
        earnedDate: runs.length >= 100 ? runs[99]?.date : undefined,
        progress: Math.min(runs.length, 100),
        target: 100,
        progressLabel: `${Math.min(runs.length, 100)} / 100 runs`,
      };
    },
  },
  {
    id: 'runs_250',
    name: 'Dedicated',
    description: 'Log 250 total runs',
    icon: '🏋️',
    category: 'consistency',
    tier: 'gold',
    check: (data) => {
      const runs = runWorkouts(data.workouts);
      return {
        earned: runs.length >= 250,
        earnedDate: runs.length >= 250 ? runs[249]?.date : undefined,
        progress: Math.min(runs.length, 250),
        target: 250,
        progressLabel: `${Math.min(runs.length, 250)} / 250 runs`,
      };
    },
  },
  {
    id: 'runs_500',
    name: 'Lifer',
    description: 'Log 500 total runs',
    icon: '👑',
    category: 'consistency',
    tier: 'diamond',
    check: (data) => {
      const runs = runWorkouts(data.workouts);
      return {
        earned: runs.length >= 500,
        earnedDate: runs.length >= 500 ? runs[499]?.date : undefined,
        progress: Math.min(runs.length, 500),
        target: 500,
        progressLabel: `${Math.min(runs.length, 500)} / 500 runs`,
      };
    },
  },

  // ═══ TRAINING ACHIEVEMENTS ═══
  {
    id: 'first_tempo',
    name: 'Tempo Tantrum',
    description: 'Complete your first tempo run',
    icon: '🎵',
    category: 'training',
    tier: 'bronze',
    check: (data) => {
      const tempos = data.workouts.filter(
        w => w.activityType === 'run' && w.workoutType === 'tempo'
      );
      return {
        earned: tempos.length > 0,
        earnedDate: tempos[0]?.date,
        progress: Math.min(tempos.length, 1),
        target: 1,
        progressLabel: tempos.length > 0 ? 'Completed' : 'Not yet',
      };
    },
  },
  {
    id: 'first_intervals',
    name: 'Speed Demon',
    description: 'Complete your first interval workout',
    icon: '⚡',
    category: 'training',
    tier: 'bronze',
    check: (data) => {
      const intervals = data.workouts.filter(
        w => w.activityType === 'run' && (w.workoutType === 'interval' || w.workoutType === 'repetition')
      );
      return {
        earned: intervals.length > 0,
        earnedDate: intervals[0]?.date,
        progress: Math.min(intervals.length, 1),
        target: 1,
        progressLabel: intervals.length > 0 ? 'Completed' : 'Not yet',
      };
    },
  },
  {
    id: 'quality_50',
    name: 'Quality Over Quantity',
    description: 'Complete 50 quality sessions (tempo/threshold/intervals)',
    icon: '🎯',
    category: 'training',
    tier: 'silver',
    check: (data) => {
      const count = countQualitySessions(data.workouts);
      return {
        earned: count >= 50,
        progress: Math.min(count, 50),
        target: 50,
        progressLabel: `${Math.min(count, 50)} / 50 quality sessions`,
      };
    },
  },
  {
    id: 'long_runs_100',
    name: 'The Long Haul',
    description: 'Complete 100 long runs (10+ miles)',
    icon: '🛣️',
    category: 'training',
    tier: 'gold',
    check: (data) => {
      const count = countLongRuns(data.workouts);
      return {
        earned: count >= 100,
        progress: Math.min(count, 100),
        target: 100,
        progressLabel: `${Math.min(count, 100)} / 100 long runs`,
      };
    },
  },
  {
    id: 'first_race',
    name: 'Race Day',
    description: 'Complete your first race',
    icon: '🏁',
    category: 'training',
    tier: 'bronze',
    check: (data) => {
      const races = data.workouts.filter(
        w => w.activityType === 'run' && w.workoutType === 'race'
      );
      return {
        earned: races.length > 0,
        earnedDate: races[0]?.date,
        progress: Math.min(races.length, 1),
        target: 1,
        progressLabel: races.length > 0 ? 'Completed' : 'Not yet',
      };
    },
  },
  {
    id: 'races_10',
    name: 'Serial Racer',
    description: 'Complete 10 races',
    icon: '🏅',
    category: 'training',
    tier: 'silver',
    check: (data) => {
      const races = data.workouts.filter(
        w => w.activityType === 'run' && w.workoutType === 'race'
      );
      return {
        earned: races.length >= 10,
        earnedDate: races.length >= 10 ? races[9]?.date : undefined,
        progress: Math.min(races.length, 10),
        target: 10,
        progressLabel: `${Math.min(races.length, 10)} / 10 races`,
      };
    },
  },
];

// ─── Evaluation ─────────────────────────────────────────────────────────────

/** Run all achievement checks and return the full list with results */
export function evaluateAchievements(data: AchievementData): EarnedAchievement[] {
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    result: achievement.check(data),
  }));
}

/** Get achievements grouped by category */
export function getAchievementsByCategory(achievements: EarnedAchievement[]): Record<AchievementCategory, EarnedAchievement[]> {
  const grouped: Record<AchievementCategory, EarnedAchievement[]> = {
    mileage: [],
    streak: [],
    distance: [],
    speed: [],
    consistency: [],
    training: [],
  };

  for (const a of achievements) {
    grouped[a.category].push(a);
  }

  return grouped;
}

/** Category display metadata */
export const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string; description: string }> = {
  mileage: { label: 'Mileage Milestones', icon: '🏔️', description: 'Total miles logged' },
  streak: { label: 'Streak Achievements', icon: '🔥', description: 'Consecutive day running' },
  distance: { label: 'Distance Firsts', icon: '🏃', description: 'New distance milestones' },
  speed: { label: 'Speed Achievements', icon: '⚡', description: 'Race time goals' },
  consistency: { label: 'Consistency', icon: '📊', description: 'Showing up day after day' },
  training: { label: 'Training', icon: '🎯', description: 'Quality and variety' },
};

/** Tier colors for badge styling */
export const TIER_COLORS: Record<AchievementTier, { bg: string; border: string; text: string }> = {
  bronze: { bg: 'bg-amber-900/20', border: 'border-amber-700/40', text: 'text-amber-400' },
  silver: { bg: 'bg-slate-400/15', border: 'border-slate-400/40', text: 'text-slate-300' },
  gold: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' },
  diamond: { bg: 'bg-cyan-400/20', border: 'border-cyan-400/40', text: 'text-cyan-300' },
};
