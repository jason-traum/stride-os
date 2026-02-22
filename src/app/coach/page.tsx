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
  const messageType = params.type || 'user';

  // Wrap all DB calls in try/catch so the page renders even if the DB is down
  let profileId: number | undefined;
  let messages: ChatMessage[] = [];
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let memories: Awaited<ReturnType<typeof getCoachMemories>> = [];
  let autoCoachPrompt: string | null = null;

  try {
    profileId = await getActiveProfileId();
  } catch (e) {
    console.error('[CoachPage] Failed to get profile:', e);
  }

  try {
    const [msgs, s, mems] = await Promise.all([
      getChatHistory(50, profileId),
      getSettings(profileId),
      profileId ? getCoachMemories(profileId) : Promise.resolve([]),
    ]);
    messages = msgs;
    settings = s;
    memories = mems;
  } catch (e) {
    console.error('[CoachPage] Failed to load chat data:', e);
  }

  const coachName = 'Coach Dreamy';
  const coachColor = settings?.coachColor || 'blue';

  // Auto-detect recent unassessed workout if no pending message
  if (!pendingMessage) {
    try {
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
    } catch (e) {
      console.error('[CoachPage] Failed to check recent workouts:', e);
    }
  }

  const formattedMessages = messages.map((m: ChatMessage) => ({
    id: m.id.toString(),
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.createdAt,
  }));

  const formattedMemories = memories.map((m: { id: number; contextType: string; contextKey: string; contextValue: string; createdAt: string }) => ({
    id: m.id,
    contextType: m.contextType,
    contextKey: m.contextKey,
    contextValue: m.contextValue,
    importance: (m as unknown as { importance?: string }).importance,
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
