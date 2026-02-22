'use server';

import { db, workouts } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';
import { getRunningStreak } from '@/actions/analytics';
import {
  evaluateAchievements,
  getAchievementsByCategory,
  type EarnedAchievement,
  type AchievementCategory,
} from '@/lib/achievements';

export interface AchievementsResponse {
  /** All achievements with their evaluation results */
  achievements: EarnedAchievement[];
  /** Achievements grouped by category */
  byCategory: Record<AchievementCategory, EarnedAchievement[]>;
  /** Summary stats */
  summary: {
    total: number;
    earned: number;
    percentage: number;
  };
  /** Most recently earned achievement (if any) */
  mostRecent: EarnedAchievement | null;
}

/**
 * Evaluate all achievements for the active profile.
 * Fetches all workouts + streak data, then runs the achievement engine.
 */
export const checkAchievements = createProfileAction(
  async (profileId: number): Promise<AchievementsResponse> => {
    // Fetch all workouts for this profile, sorted ascending by date
    const allWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.profileId, profileId),
      orderBy: [asc(workouts.date)],
    });

    // Get streak data
    const streakData = await getRunningStreak(profileId);

    // Run the achievement engine
    const achievements = evaluateAchievements({
      workouts: allWorkouts,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
    });

    // Group by category
    const byCategory = getAchievementsByCategory(achievements);

    // Calculate summary
    const earned = achievements.filter(a => a.result.earned);
    const total = achievements.length;
    const percentage = total > 0 ? Math.round((earned.length / total) * 100) : 0;

    // Find most recently earned achievement (by earnedDate)
    let mostRecent: EarnedAchievement | null = null;
    for (const a of earned) {
      if (a.result.earnedDate) {
        if (!mostRecent || a.result.earnedDate > (mostRecent.result.earnedDate || '')) {
          mostRecent = a;
        }
      }
    }

    return {
      achievements,
      byCategory,
      summary: { total, earned: earned.length, percentage },
      mostRecent,
    };
  },
  'checkAchievements'
);
