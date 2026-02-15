'use server';

import { db, clothingItems, ClothingItem } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ClothingCategory, NewClothingItem } from '@/lib/schema';

export async function getClothingItems(includeInactive = false, profileId?: number) {
  let items: ClothingItem[];

  if (profileId) {
    items = await db.select().from(clothingItems).where(eq(clothingItems.profileId, profileId));
  } else {
    items = await db.select().from(clothingItems);
  }

  return includeInactive ? items : items.filter((item: ClothingItem) => item.isActive);
}

export async function getClothingItem(id: number) {
  const [item] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
  return item || null;
}

export async function createClothingItem(data: {
  name: string;
  category: ClothingCategory;
  warmthRating: number;
  notes?: string;
  profileId?: number;
}) {
  const now = new Date().toISOString();

  const [item] = await db.insert(clothingItems).values({
    name: data.name,
    category: data.category,
    warmthRating: Math.min(5, Math.max(1, data.warmthRating)),
    notes: data.notes || null,
    isActive: true,
    profileId: data.profileId ?? null,
    createdAt: now,
  }).returning();

  revalidatePath('/wardrobe');
  revalidatePath('/today');

  return item;
}

export async function updateClothingItem(id: number, data: {
  name?: string;
  category?: ClothingCategory;
  warmthRating?: number;
  isActive?: boolean;
  notes?: string;
}) {
  const updateData: Partial<NewClothingItem> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.warmthRating !== undefined) updateData.warmthRating = Math.min(5, Math.max(1, data.warmthRating));
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const [item] = await db.update(clothingItems)
    .set(updateData)
    .where(eq(clothingItems.id, id))
    .returning();

  revalidatePath('/wardrobe');
  revalidatePath('/today');

  return item;
}

export async function deleteClothingItem(id: number) {
  await db.delete(clothingItems).where(eq(clothingItems.id, id));

  revalidatePath('/wardrobe');
  revalidatePath('/today');
}

export async function toggleClothingItemActive(id: number) {
  const item = await getClothingItem(id);
  if (!item) return null;

  return updateClothingItem(id, { isActive: !item.isActive });
}
