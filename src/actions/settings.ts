'use server';

import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { NewUserSettings } from '@/lib/schema';

export async function getSettings() {
  const settings = await db.select().from(userSettings).limit(1);

  if (settings[0]) {
    return settings[0];
  }

  // Create default settings with NYC West Village location
  const now = new Date().toISOString();
  const [defaultSettings] = await db.insert(userSettings).values({
    name: '',
    latitude: 40.7336,
    longitude: -74.0027,
    cityName: 'West Village, New York',
    heatAcclimatizationScore: 50,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return defaultSettings;
}

export async function createOrUpdateSettings(data: {
  name: string;
  preferredLongRunDay?: string;
  preferredWorkoutDays?: string[];
  weeklyVolumeTargetMiles?: number;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  heatAcclimatizationScore?: number;
  defaultTargetPaceSeconds?: number;
}) {
  const now = new Date().toISOString();
  const existing = await getSettings();

  if (existing) {
    await db.update(userSettings)
      .set({
        name: data.name,
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
}) {
  const now = new Date().toISOString();
  const existing = await getSettings();

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

export async function updateAcclimatization(score: number) {
  const now = new Date().toISOString();
  const existing = await getSettings();

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

export async function updateDefaultPace(paceSeconds: number) {
  const now = new Date().toISOString();
  const existing = await getSettings();

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

export async function updateTemperaturePreference(preference: 'runs_cold' | 'neutral' | 'runs_hot') {
  const now = new Date().toISOString();
  const existing = await getSettings();

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
