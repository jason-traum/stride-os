import type { Metadata } from 'next';
import { getChatHistory, getCoachMemories } from '@/actions/chat';
import { getSettings } from '@/actions/settings';
import { getWorkouts } from '@/actions/workouts';

export const metadata: Metadata = {
  title: 'AI Coach | Dreamy',
  description: 'Chat with your AI running coach for personalized training advice.',
};

import { CoachPageClient } from './CoachPageClient';
import type { ChatMessage, Assessment } from '@/lib/schema';
import { formatDistance, getWorkoutTypeLabel, getTodayString } from '@/lib/utils';
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

  const coachName = 'Coach Dreamy';
  const coachColor = settings?.coachColor || 'blue';

  // Fetch coach memories
  const memories = profileId ? await getCoachMemories(profileId) : [];

  // Auto-detect recent unassessed workout if no pending message
  let autoCoachPrompt: string | null = null;
  if (!pendingMessage) {
    const recentWorkouts = await getWorkouts(1, profileId);
    const latest = recentWorkouts[0] as (typeof recentWorkouts[0] & { assessment?: Assessment | null }) | undefined;
    if (latest && !latest.assessment) {
      const workoutDate = new Date(latest.date + 'T12:00:00');
      const hoursAgo = (Date.now() - workoutDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 3) {
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
    timestamp: m.createdAt,
  }));

  const formattedMemories = memories.map(m => ({
    id: m.id,
    contextType: m.contextType,
    contextKey: m.contextKey,
    contextValue: m.contextValue,
    importance: m.importance,
    createdAt: m.createdAt,
  }));

  return (
    <CoachPageClient
      initialMessages={formattedMessages}
      onboardingMode={isOnboarding}
      pendingMessage={pendingMessage || autoCoachPrompt}
      pendingMessageType={pendingMessage ? (messageType as 'user' | 'assistant') : 'assistant'}
      coachName={coachName}
      coachColor={coachColor}
      memories={formattedMemories}
    />
  );
}
