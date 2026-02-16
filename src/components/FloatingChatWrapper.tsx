import dynamic from 'next/dynamic';
import { getChatHistory } from '@/actions/chat';
import { getActiveProfileId } from '@/lib/profile-server';
import type { ChatMessage } from '@/lib/schema';

const FloatingChat = dynamic(() => import('./FloatingChat').then(mod => ({ default: mod.FloatingChat })), {
  ssr: false,
});

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
