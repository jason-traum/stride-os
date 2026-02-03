'use server';

import { db, chatMessages } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ChatRole } from '@/lib/schema';

export async function getChatHistory(limit: number = 50, profileId?: number) {
  let query = db.select().from(chatMessages);

  if (profileId) {
    query = query.where(eq(chatMessages.profileId, profileId)) as typeof query;
  }

  const messages = await query
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  // Return in chronological order
  return messages.reverse();
}

export async function saveChatMessage(role: ChatRole, content: string, profileId?: number) {
  const now = new Date().toISOString();

  const [message] = await db.insert(chatMessages).values({
    role,
    content,
    profileId: profileId ?? null,
    createdAt: now,
  }).returning();

  revalidatePath('/coach');

  return message;
}

export async function clearChatHistory(profileId?: number) {
  if (profileId) {
    await db.delete(chatMessages).where(eq(chatMessages.profileId, profileId));
  } else {
    await db.delete(chatMessages);
  }
  revalidatePath('/coach');
}
