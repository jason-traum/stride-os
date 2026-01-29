'use server';

import { db, chatMessages } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ChatRole } from '@/lib/schema';

export async function getChatHistory(limit: number = 50) {
  const messages = await db.select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  // Return in chronological order
  return messages.reverse();
}

export async function saveChatMessage(role: ChatRole, content: string) {
  const now = new Date().toISOString();

  const [message] = await db.insert(chatMessages).values({
    role,
    content,
    createdAt: now,
  }).returning();

  revalidatePath('/coach');

  return message;
}

export async function clearChatHistory() {
  await db.delete(chatMessages);
  revalidatePath('/coach');
}
