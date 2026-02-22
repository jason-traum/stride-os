'use server';

// Re-export all public APIs from focused modules.
// This file preserves backward compatibility — callers can continue importing from './analytics'.

// Core analytics data + types
export {
  getAnalyticsData,
} from './analytics-core';
export type {
  WeeklyStatsBase,
  WeeklyStats,
  WorkoutTypeDistribution,
  AnalyticsData,
} from './analytics-core';

// Weekly stats, streaks, volume
export {
  getWeeklyStats,
  getRunningStreak,
  getVolumeSummaryData,
  getWeeklyVolumeData,
} from './analytics-weekly';
export type { WeeklyVolumeEntry } from './analytics-weekly';

// Daily activity, calendar, training focus
export {
  getDailyActivityData,
  getCalendarData,
  getTrainingFocusData,
} from './analytics-activity';
export type {
  DailyActivityData,
  CalendarWorkoutDay,
} from './analytics-activity';
