'use server';

import { db } from '@/lib/db';
import { userSettings, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Ensure user settings exist by creating them from profile data if missing
 */
export async function ensureUserSettings(profileId: number) {
  try {
    // Check if settings already exist
    const existingSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.profileId, profileId),
    });

    if (existingSettings) {
      return existingSettings;
    }

    // Get profile data
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Create settings from profile data
    const [newSettings] = await db.insert(userSettings).values({
      profileId,
      // Map profile fields to settings
      currentWeeklyMileage: profile.weeklyMileage || 0,
      easyPaceSeconds: profile.easyPaceSeconds || 600, // Default 10:00/mi
      tempoPaceSeconds: profile.tempoPaceSeconds || 480, // Default 8:00/mi
      thresholdPaceSeconds: profile.thresholdPaceSeconds || profile.lactateThreshold ? Math.round(profile.lactateThreshold * 60) : 450,
      intervalPaceSeconds: profile.intervalPaceSeconds || 420, // Default 7:00/mi
      marathonPaceSeconds: profile.marathonPaceSeconds || 540, // Default 9:00/mi

      // Heart rate zones
      maxHR: profile.maxHR || (profile.age ? 220 - profile.age : 180),
      restingHR: profile.restingHR || 60,

      // Training preferences from profile
      preferredWorkoutTime: profile.preferredWorkoutTime || 'morning',
      trainingPhilosophy: profile.trainingPhilosophy || 'balanced',

      // Other settings with defaults
      unitPreference: 'miles',
      weekStartsOn: 1, // Monday
      autoDetectWorkouts: false,
      shareActivities: false,
      emailNotifications: true,
      pushNotifications: true,

      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return newSettings;
  } catch (error) {
    console.error('Error ensuring user settings:', error);
    throw error;
  }
}