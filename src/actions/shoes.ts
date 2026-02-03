'use server';

import { db, shoes } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
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

export async function deleteShoe(id: number) {
  await db.delete(shoes).where(eq(shoes.id, id));

  revalidatePath('/shoes');
  revalidatePath('/log');
}
