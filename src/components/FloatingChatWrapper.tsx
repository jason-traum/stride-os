import { getChatHistory } from '@/actions/chat';
import { getActiveProfileId } from '@/lib/profile-server';
import { FloatingChat } from './FloatingChat';
import type { ChatMessage } from '@/lib/schema';

export async function FloatingChatWrapper() {
  const profileId = await getActiveProfileId();
  const messages: ChatMessage[] = await getChatHistory(20, profileId);

  const formattedMessages = messages.map((m: ChatMessage) => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return <FloatingChat initialMessages={formattedMessages} />;
}
