'use server';

import { db, userSettings } from '@/lib/db';
import { eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { NewUserSettings } from '@/lib/schema';

/**
 * Get settings for a specific profile, or fall back to the first settings row
 * @param profileId - Optional profile ID to get settings for
 */
export async function getSettings(profileId?: number) {
  // If profileId provided, try to get settings for that profile
  if (profileId !== undefined) {
    const profileSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.profileId, profileId))
      .limit(1);

    if (profileSettings[0]) {
      return profileSettings[0];
    }
  }

  // Fall back to first settings (for backward compatibility)
  const settings = await db.select().from(userSettings).limit(1);

  if (settings[0]) {
    return settings[0];
  }

  // Create default settings with NYC West Village location
  const now = new Date().toISOString();
  const [defaultSettings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId,
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    heatAcclimatizationScore: 50,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return defaultSettings;
}

/**
 * Get settings by profile ID (strict - won't fall back)
 */
export async function getSettingsByProfileId(profileId: number) {
  const settings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.profileId, profileId))
    .limit(1);

  return settings[0] || null;
}

export async function createOrUpdateSettings(data: {
  name: string;
  age?: number;
  preferredLongRunDay?: string;
  preferredWorkoutDays?: string[];
  weeklyVolumeTargetMiles?: number;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  heatAcclimatizationScore?: number;
  defaultTargetPaceSeconds?: number;
  profileId?: number;
}) {
  const now = new Date().toISOString();
  const existing = await getSettings(data.profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        name: data.name,
        age: data.age ?? existing.age,
        preferredLongRunDay: data.preferredLongRunDay as NewUserSettings['preferredLongRunDay'] ?? null,
        preferredWorkoutDays: JSON.stringify(data.preferredWorkoutDays || []),
        weeklyVolumeTargetMiles: data.weeklyVolumeTargetMiles ?? null,
        latitude: data.latitude ?? existing.latitude,
        longitude: data.longitude ?? existing.longitude,
        cityName: data.cityName ?? existing.cityName,
        heatAcclimatizationScore: data.heatAcclimatizationScore ?? existing.heatAcclimatizationScore,
        defaultTargetPaceSeconds: data.defaultTargetPaceSeconds ?? existing.defaultTargetPaceSeconds,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/');
    revalidatePath('/today');
    revalidatePath('/pace-calculator');

    return { ...existing, ...data };
  }

  const [settings] = await db.insert(userSettings).values({
    name: data.name,
    age: data.age ?? null,
    profileId: data.profileId ?? null,
    preferredLongRunDay: data.preferredLongRunDay as NewUserSettings['preferredLongRunDay'] ?? null,
    preferredWorkoutDays: JSON.stringify(data.preferredWorkoutDays || []),
    weeklyVolumeTargetMiles: data.weeklyVolumeTargetMiles ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    cityName: data.cityName ?? null,
    heatAcclimatizationScore: data.heatAcclimatizationScore ?? 50,
    defaultTargetPaceSeconds: data.defaultTargetPaceSeconds ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return settings;
}

export async function updateLocation(data: {
  latitude: number;
  longitude: number;
  cityName: string;
  profileId?: number;
}) {
  const now = new Date().toISOString();
  const existing = await getSettings(data.profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        latitude: data.latitude,
        longitude: data.longitude,
        cityName: data.cityName,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');
    revalidatePath('/pace-calculator');

    return { ...existing, ...data };
  }

  // Create settings if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: data.profileId ?? null,
    latitude: data.latitude,
    longitude: data.longitude,
    cityName: data.cityName,
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return settings;
}

export async function updateAcclimatization(score: number, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        heatAcclimatizationScore: score,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');
    revalidatePath('/pace-calculator');

    return { ...existing, heatAcclimatizationScore: score };
  }

  // Create settings with defaults if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    heatAcclimatizationScore: score,
    // Default to NYC West Village
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return settings;
}

export async function updateDefaultPace(paceSeconds: number, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        defaultTargetPaceSeconds: paceSeconds,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');
    revalidatePath('/pace-calculator');

    return { ...existing, defaultTargetPaceSeconds: paceSeconds };
  }

  // Create settings with defaults if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    defaultTargetPaceSeconds: paceSeconds,
    // Default to NYC West Village
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/pace-calculator');

  return settings;
}

export async function updateTemperaturePreference(preference: 'runs_cold' | 'neutral' | 'runs_hot', profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        temperaturePreference: preference,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');

    return { ...existing, temperaturePreference: preference };
  }

  // Create settings with defaults if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    temperaturePreference: preference,
    // Default to NYC West Village
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');

  return settings;
}

/**
 * Update temperature preference on a 1-9 scale
 * 1 = runs very cold (dress warmer)
 * 5 = neutral
 * 9 = runs very hot (dress lighter)
 */
export async function updateTemperaturePreferenceScale(scale: number, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  // Clamp to valid range
  const clampedScale = Math.max(1, Math.min(9, Math.round(scale)));

  // Also update the legacy enum for backward compatibility
  const legacyPref: 'runs_cold' | 'neutral' | 'runs_hot' =
    clampedScale <= 3 ? 'runs_cold' :
    clampedScale >= 7 ? 'runs_hot' :
    'neutral';

  if (existing) {
    await db.update(userSettings)
      .set({
        temperaturePreferenceScale: clampedScale,
        temperaturePreference: legacyPref,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');

    return { ...existing, temperaturePreferenceScale: clampedScale, temperaturePreference: legacyPref };
  }

  // Create settings with defaults if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    temperaturePreferenceScale: clampedScale,
    temperaturePreference: legacyPref,
    // Default to NYC West Village
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');

  return settings;
}

/**
 * Update default run time
 */
export async function updateDefaultRunTime(hour: number, minute: number, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  // Clamp to valid range
  const clampedHour = Math.max(0, Math.min(23, hour));
  const clampedMinute = Math.max(0, Math.min(59, minute));

  if (existing) {
    await db.update(userSettings)
      .set({
        defaultRunTimeHour: clampedHour,
        defaultRunTimeMinute: clampedMinute,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/today');

    return { ...existing, defaultRunTimeHour: clampedHour, defaultRunTimeMinute: clampedMinute };
  }

  // Create settings with defaults if they don't exist
  const [settings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    defaultRunTimeHour: clampedHour,
    defaultRunTimeMinute: clampedMinute,
    // Default to NYC West Village
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/today');

  return settings;
}

/**
 * Update coach personalization settings
 */
export async function updateCoachSettings(name: string, color: string, persona?: string, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        coachName: name || 'Coach',
        coachColor: color || 'blue',
        coachPersona: persona || 'encouraging',
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/coach');

    return { ...existing, coachName: name, coachColor: color, coachPersona: persona };
  }

  // Create settings with defaults if they don't exist
  const [newSettings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    coachName: name || 'Coach',
    coachColor: color || 'blue',
    coachPersona: persona || 'encouraging',
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/coach');

  return newSettings;
}

/**
 * Update AI provider settings
 */
export async function updateAISettings(
  provider: string,
  claudeModel: string,
  openaiModel: string,
  profileId?: number
) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        aiProvider: provider,
        claudeModel: claudeModel,
        openaiModel: openaiModel,
        updatedAt: now,
      })
      .where(eq(userSettings.id, existing.id));

    revalidatePath('/settings');
    revalidatePath('/coach');

    return { ...existing, aiProvider: provider, claudeModel, openaiModel };
  }

  // Create settings with defaults if they don't exist
  const [newSettings] = await db.insert(userSettings).values({
    name: '',
    profileId: profileId ?? null,
    aiProvider: provider,
    claudeModel: claudeModel,
    openaiModel: openaiModel,
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    createdAt: now,
    updatedAt: now,
  }).returning();

  revalidatePath('/settings');
  revalidatePath('/coach');

  return newSettings;
}
