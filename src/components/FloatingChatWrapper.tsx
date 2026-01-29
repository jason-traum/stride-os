import { getChatHistory } from '@/actions/chat';
import { FloatingChat } from './FloatingChat';
import type { ChatMessage } from '@/lib/schema';

export async function FloatingChatWrapper() {
  const messages: ChatMessage[] = await getChatHistory(20);

  const formattedMessages = messages.map((m: ChatMessage) => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return <FloatingChat initialMessages={formattedMessages} />;
}
