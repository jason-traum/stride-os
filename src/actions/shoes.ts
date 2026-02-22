'use server';

import { db, shoes, workouts } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { NewShoe } from '@/lib/schema';

export async function createShoe(data: {
  name: string;
  brand: string;
  model: string;
  category: string;
  intendedUse?: string[];
  purchaseDate?: string;
  notes?: string;
  profileId?: number;
}) {
  const now = new Date().toISOString();

  const [shoe] = await db.insert(shoes).values({
    name: data.name,
    brand: data.brand,
    model: data.model,
    category: data.category as NewShoe['category'],
    intendedUse: JSON.stringify(data.intendedUse || []),
    purchaseDate: data.purchaseDate || null,
    notes: data.notes || null,
    totalMiles: 0,
    isRetired: false,
    profileId: data.profileId ?? null,
    createdAt: now,
  }).returning();

  revalidatePath('/shoes');
  revalidatePath('/log');

  return shoe;
}

export async function getShoes(includeRetired = false, profileId?: number) {
  if (includeRetired) {
    if (profileId) {
      return db.select().from(shoes).where(eq(shoes.profileId, profileId));
    }
    return db.select().from(shoes);
  }
  if (profileId) {
    return db.select().from(shoes).where(and(eq(shoes.isRetired, false), eq(shoes.profileId, profileId)));
  }
  return db.select().from(shoes).where(eq(shoes.isRetired, false));
}

export async function getAllShoes(profileId?: number) {
  if (profileId) {
    return db.select().from(shoes).where(eq(shoes.profileId, profileId));
  }
  return db.select().from(shoes);
}

export async function getShoe(id: number) {
  const [shoe] = await db.select().from(shoes).where(eq(shoes.id, id));
  return shoe;
}

export async function retireShoe(id: number) {
  await db.update(shoes)
    .set({ isRetired: true })
    .where(eq(shoes.id, id));

  revalidatePath('/shoes');
  revalidatePath('/log');
}

export async function unretireShoe(id: number) {
  await db.update(shoes)
    .set({ isRetired: false })
    .where(eq(shoes.id, id));

  revalidatePath('/shoes');
  revalidatePath('/log');
}

// Fields that are synced from Strava and can be overridden
const STRAVA_SYNCABLE_FIELDS = ['name', 'brand', 'model'] as const;

export async function updateShoe(id: number, data: {
  name?: string;
  brand?: string;
  model?: string;
  category?: string;
  intendedUse?: string[];
  purchaseDate?: string | null;
  notes?: string | null;
}) {
  // Get existing shoe to check for Strava link and current overrides
  const [existing] = await db.select().from(shoes).where(eq(shoes.id, id));
  if (!existing) throw new Error('Shoe not found');

  const updateSet: Record<string, unknown> = {};

  if (data.name !== undefined) updateSet.name = data.name;
  if (data.brand !== undefined) updateSet.brand = data.brand;
  if (data.model !== undefined) updateSet.model = data.model;
  if (data.category !== undefined) updateSet.category = data.category;
  if (data.intendedUse !== undefined) updateSet.intendedUse = JSON.stringify(data.intendedUse);
  if (data.purchaseDate !== undefined) updateSet.purchaseDate = data.purchaseDate;
  if (data.notes !== undefined) updateSet.notes = data.notes;

  // Track overrides for Strava-linked shoes
  if (existing.stravaGearId) {
    const currentOverrides: string[] = existing.stravaOverrides
      ? JSON.parse(existing.stravaOverrides) : [];
    const overrideSet = new Set(currentOverrides);

    for (const field of STRAVA_SYNCABLE_FIELDS) {
      if (data[field] !== undefined && data[field] !== existing[field]) {
        overrideSet.add(field);
      }
    }

    updateSet.stravaOverrides = JSON.stringify(Array.from(overrideSet));
  }

  await db.update(shoes).set(updateSet).where(eq(shoes.id, id));

  revalidatePath('/shoes');
  revalidatePath(`/shoes/${id}`);
  revalidatePath('/log');

  return { success: true };
}

export async function resetShoeOverrides(id: number) {
  await db.update(shoes)
    .set({ stravaOverrides: null })
    .where(eq(shoes.id, id));

  revalidatePath('/shoes');
  revalidatePath(`/shoes/${id}`);
}

export interface ShoeDetailWorkout {
  id: number;
  date: string;
  stravaName: string | null;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  workoutType: string;
}

export interface ShoeDetailData {
  shoe: typeof shoes.$inferSelect;
  workouts: ShoeDetailWorkout[];
}

export async function getShoeDetail(id: number): Promise<ShoeDetailData | null> {
  const [shoe] = await db.select().from(shoes).where(eq(shoes.id, id));
  if (!shoe) return null;

  const shoeWorkouts = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      stravaName: workouts.stravaName,
      distanceMiles: workouts.distanceMiles,
      durationMinutes: workouts.durationMinutes,
      avgPaceSeconds: workouts.avgPaceSeconds,
      avgHr: workouts.avgHr,
      workoutType: workouts.workoutType,
    })
    .from(workouts)
    .where(eq(workouts.shoeId, id))
    .orderBy(desc(workouts.date));

  return { shoe, workouts: shoeWorkouts };
}
