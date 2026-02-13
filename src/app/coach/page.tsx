import { getChatHistory } from '@/actions/chat';
import { getSettings } from '@/actions/settings';
import { Bot } from 'lucide-react';
import { CoachPageClient } from './CoachPageClient';
import type { ChatMessage } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';

interface CoachPageProps {
  searchParams: Promise<{ onboarding?: string; message?: string; type?: string }>;
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const params = await searchParams;
  const isOnboarding = params.onboarding === 'true';
  const pendingMessage = params.message ? decodeURIComponent(params.message) : null;
  const messageType = params.type || 'user'; // Default to user message
  const profileId = await getActiveProfileId();
  const messages: ChatMessage[] = await getChatHistory(50, profileId);
  const settings = await getSettings(profileId);

  const coachName = settings?.coachName || 'Coach';
  const coachColor = settings?.coachColor || 'blue';

  const formattedMessages = messages.map((m: ChatMessage) => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Check if it's a hex color or a named color
  const isHexColor = coachColor.startsWith('#');

  const colorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-br from-teal-400 to-teal-600',
    green: 'bg-gradient-to-br from-green-400 to-green-600',
    purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
    orange: 'bg-gradient-to-br from-rose-400 to-rose-500',
    red: 'bg-gradient-to-br from-red-400 to-red-600',
    teal: 'bg-gradient-to-br from-teal-400 to-teal-600',
  };

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            !isHexColor && (colorClasses[coachColor] || colorClasses.blue)
          )}
          style={isHexColor ? { backgroundColor: coachColor } : undefined}
        >
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display font-semibold text-textPrimary">{coachName}</h1>
          <p className="text-sm text-textSecondary">
            {isOnboarding ? "Let's learn more about your training" : 'Your AI running assistant'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
        <CoachPageClient
          initialMessages={formattedMessages}
          onboardingMode={isOnboarding}
          pendingMessage={pendingMessage}
          pendingMessageType={messageType as 'user' | 'assistant'}
          coachName={coachName}
          coachColor={coachColor}
        />
      </div>
    </div>
  );
}
