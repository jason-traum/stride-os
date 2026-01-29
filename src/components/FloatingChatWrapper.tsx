import { getChatHistory } from '@/actions/chat';
import { FloatingChat } from './FloatingChat';

export async function FloatingChatWrapper() {
  const messages = await getChatHistory(20);

  const formattedMessages = messages.map(m => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return <FloatingChat initialMessages={formattedMessages} />;
}
