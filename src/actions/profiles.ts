'use server';

import { db } from '@/lib/db';
import { profiles, userSettings, workouts } from '@/lib/schema';
import { eq, sql, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { Profile } from '@/lib/schema';

export type ProfileWithStats = Profile & {
  workoutCount: number;
  totalMiles: number;
};

/**
 * Get all profiles with workout stats
 */
export async function getProfiles(): Promise<ProfileWithStats[]> {
  const allProfiles = await db.select().from(profiles);

  // Get stats for each profile
  const profilesWithStats = await Promise.all(
    allProfiles.map(async (profile: Profile) => {
      // Count workouts for this specific profile
      const workoutStats = await db
        .select({
          count: count(),
          totalMiles: sql<number>`COALESCE(SUM(${workouts.distanceMiles}), 0)`,
        })
        .from(workouts)
        .where(eq(workouts.profileId, profile.id));

      return {
        ...profile,
        workoutCount: workoutStats[0]?.count ?? 0,
        totalMiles: Math.round(workoutStats[0]?.totalMiles ?? 0),
      };
    })
  );

  return profilesWithStats;
}

/**
 * Get a single profile by ID
 */
export async function getProfile(id: number): Promise<Profile | null> {
  const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Create a new profile
 */
export async function createProfile(data: {
  name: string;
  type: 'personal' | 'demo';
  avatarColor?: string;
  isProtected?: boolean;
}): Promise<Profile> {
  const now = new Date().toISOString();

  const [profile] = await db.insert(profiles).values({
    name: data.name,
    type: data.type,
    avatarColor: data.avatarColor || getRandomColor(),
    isProtected: data.isProtected || false,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Create default settings for this profile
  await db.insert(userSettings).values({
    profileId: profile.id,
    name: data.name,
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    heatAcclimatizationScore: 50,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/');
  return profile;
}

/**
 * Update a profile
 */
export async function updateProfile(
  id: number,
  data: Partial<Pick<Profile, 'name' | 'avatarColor' | 'auraColorStart' | 'auraColorEnd'>>
): Promise<Profile | null> {
  const now = new Date().toISOString();

  const [updated] = await db
    .update(profiles)
    .set({
      ...data,
      updatedAt: now,
    })
    .where(eq(profiles.id, id))
    .returning();

  revalidatePath('/');
  return updated || null;
}

/**
 * Delete a profile (cannot delete protected profiles)
 */
export async function deleteProfile(id: number): Promise<{ success: boolean; error?: string }> {
  // Check if profile is protected
  const profile = await getProfile(id);
  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }
  if (profile.isProtected) {
    return { success: false, error: 'Cannot delete protected profile' };
  }

  // Delete associated settings first
  await db.delete(userSettings).where(eq(userSettings.profileId, id));

  // Delete the profile
  await db.delete(profiles).where(eq(profiles.id, id));

  revalidatePath('/');
  return { success: true };
}

/**
 * Seed the demo profile with sample data
 */
export async function seedDemoProfile(): Promise<Profile> {
  const now = new Date().toISOString();

  // Check if demo profile already exists
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.type, 'demo'))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  // Create demo profile
  const [demoProfile] = await db.insert(profiles).values({
    name: 'Demo Runner',
    type: 'demo',
    avatarColor: '#f59e0b', // Amber/yellow for demo
    isProtected: true, // Cannot be deleted
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Create demo settings
  await db.insert(userSettings).values({
    profileId: demoProfile.id,
    name: 'Demo Runner',
    onboardingCompleted: true,
    age: 32,
    gender: 'male',
    yearsRunning: 4,
    currentWeeklyMileage: 35,
    currentLongRunMax: 14,
    runsPerWeekCurrent: 5,
    runsPerWeekTarget: 5,
    peakWeeklyMileageTarget: 50,
    weeklyVolumeTargetMiles: 40,
    preferredLongRunDay: 'saturday',
    preferredQualityDays: '["tuesday","thursday"]',
    planAggressiveness: 'moderate',
    qualitySessionsPerWeek: 2,
    vdot: 45,
    easyPaceSeconds: 540,
    tempoPaceSeconds: 450,
    thresholdPaceSeconds: 420,
    intervalPaceSeconds: 375,
    marathonPaceSeconds: 480,
    halfMarathonPaceSeconds: 450,
    temperaturePreference: 'neutral',
    trainBy: 'mixed',
    stressLevel: 'moderate',
    typicalSleepHours: 7,
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/');
  return demoProfile;
}

/**
 * Initialize default profiles if none exist
 * Creates a "Jason" personal profile and a "Demo Runner" demo profile
 */
export async function initializeDefaultProfiles(): Promise<void> {
  const existingProfiles = await db.select().from(profiles);

  if (existingProfiles.length > 0) {
    return; // Already initialized
  }

  const now = new Date().toISOString();

  // Check if there's existing userSettings without a profileId
  const existingSettings = await db
    .select()
    .from(userSettings)
    .limit(1);

  // Create "Jason" personal profile
  const [jasonProfile] = await db.insert(profiles).values({
    name: 'Jason',
    type: 'personal',
    avatarColor: '#3b82f6', // Blue
    isProtected: false,
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Link existing settings to Jason's profile if they exist
  if (existingSettings[0]) {
    await db
      .update(userSettings)
      .set({ profileId: jasonProfile.id })
      .where(eq(userSettings.id, existingSettings[0].id));
  } else {
    // Create default settings for Jason
    await db.insert(userSettings).values({
      profileId: jasonProfile.id,
      name: 'Jason',
      latitude: 40.7336,
      longitude: -74.0027,
      cityName: 'West Village, New York',
      heatAcclimatizationScore: 50,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create demo profile
  await seedDemoProfile();
}

/**
 * Get settings for a specific profile
 */
export async function getProfileSettings(profileId: number) {
  const settings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.profileId, profileId))
    .limit(1);

  return settings[0] || null;
}

/**
 * Regenerate aura colors from current user settings
 */
export async function regenerateAuraColors(profileId: number): Promise<{ start: string; end: string } | null> {
  const { generateAura } = await import('@/lib/aura-color');

  const settings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.profileId, profileId))
    .limit(1);

  if (!settings[0]) return null;

  const aura = generateAura(settings[0]);

  await db
    .update(profiles)
    .set({
      auraColorStart: aura.start,
      auraColorEnd: aura.end,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profiles.id, profileId));

  revalidatePath('/');
  return aura;
}

// Helper function to generate random avatar colors
function getRandomColor(): string {
  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#6366f1', // Indigo
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
