import { getChatHistory } from '@/actions/chat';
import { Bot } from 'lucide-react';
import { CoachPageClient } from './CoachPageClient';
import type { ChatMessage } from '@/lib/schema';

interface CoachPageProps {
  searchParams: Promise<{ onboarding?: string; message?: string }>;
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const params = await searchParams;
  const isOnboarding = params.onboarding === 'true';
  const pendingMessage = params.message ? decodeURIComponent(params.message) : null;
  const messages: ChatMessage[] = await getChatHistory(50);

  const formattedMessages = messages.map((m: ChatMessage) => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Coach</h1>
          <p className="text-sm text-slate-500">
            {isOnboarding ? "Let's learn more about your training" : 'Your AI running assistant'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <CoachPageClient
          initialMessages={formattedMessages}
          onboardingMode={isOnboarding}
          pendingMessage={pendingMessage}
        />
      </div>
    </div>
  );
}
