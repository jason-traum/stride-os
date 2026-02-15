import { getChatHistory } from '@/actions/chat';
import { getSettings } from '@/actions/settings';
import { getWorkouts } from '@/actions/workouts';
import { Bot } from 'lucide-react';
import { CoachPageClient } from './CoachPageClient';
import type { ChatMessage, Assessment } from '@/lib/schema';
import { cn, formatDistance, getWorkoutTypeLabel, getTodayString } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';
import { DynamicGreeting } from '@/components/DynamicGreeting';

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

  // Auto-detect recent unassessed workout if no pending message
  let autoCoachPrompt: string | null = null;
  if (!pendingMessage) {
    const recentWorkouts = await getWorkouts(1, profileId);
    const latest = recentWorkouts[0] as (typeof recentWorkouts[0] & { assessment?: Assessment | null }) | undefined;
    if (latest && !latest.assessment) {
      const workoutDate = new Date(latest.date + 'T12:00:00');
      const hoursAgo = (Date.now() - workoutDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 36) {
        const distStr = formatDistance(latest.distanceMiles);
        const typeStr = getWorkoutTypeLabel(latest.workoutType).toLowerCase();
        const todayStr = getTodayString();
        const relTime = latest.date === todayStr ? 'today' : 'recently';
        autoCoachPrompt = `Hey! I noticed you did a ${distStr} mile ${typeStr} ${relTime}. How did it go? Want to do a quick assessment?`;
      }
    }
  }

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
    <div className="h-[calc(100dvh-168px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100vh-80px)] flex flex-col">
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
          <h1 className="text-xl font-display font-semibold text-textPrimary">
            <DynamicGreeting name={settings?.name} />
          </h1>
          <p className="text-sm text-textSecondary">
            {isOnboarding ? "Let's learn more about your training" : `Chat with ${coachName}`}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
        <CoachPageClient
          initialMessages={formattedMessages}
          onboardingMode={isOnboarding}
          pendingMessage={pendingMessage || autoCoachPrompt}
          pendingMessageType={pendingMessage ? (messageType as 'user' | 'assistant') : 'assistant'}
          coachName={coachName}
          coachColor={coachColor}
        />
      </div>
    </div>
  );
}
