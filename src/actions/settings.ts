'use server';

import { db, userSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { NewUserSettings } from '@/lib/schema';

/** VDOT values outside 15-85 are physically impossible; treat them as null. */
function sanitizeVdot<T extends { vdot?: number | null }>(settings: T): T {
  if (settings.vdot != null && (settings.vdot < 15 || settings.vdot > 85)) {
    return { ...settings, vdot: null };
  }
  return settings;
}

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
      return sanitizeVdot(profileSettings[0]);
    }
  }

  // Fall back to first settings (for backward compatibility)
  const settings = await db.select().from(userSettings).limit(1);

  if (settings[0]) {
    return sanitizeVdot(settings[0]);
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
 * Update coach personalization settings
 */
export async function updateCoachSettings(name: string, color: string, persona?: string, profileId?: number) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (existing) {
    await db.update(userSettings)
      .set({
        coachName: name || 'Coach Dreamy',
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
    coachName: name || 'Coach Dreamy',
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

/**
 * Generic profile field updater.
 * Accepts any partial set of userSettings fields and persists them.
 * Used by the profile page auto-save and coach tools.
 */
export async function updateProfileFields(
  fields: Partial<Omit<NewUserSettings, 'id' | 'createdAt'>>,
  profileId?: number
) {
  const now = new Date().toISOString();
  const existing = await getSettings(profileId);

  if (!existing) {
    return { error: 'No user settings found' };
  }

  // Clamp VDOT if present
  const sanitized = { ...fields };
  if (sanitized.vdot != null) {
    if (sanitized.vdot < 15 || sanitized.vdot > 85) {
      sanitized.vdot = null;
    }
  }

  await db.update(userSettings)
    .set({
      ...sanitized,
      updatedAt: now,
    })
    .where(eq(userSettings.id, existing.id));

  revalidatePath('/profile');
  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/coach');

  return { success: true, updated: Object.keys(fields) };
}
