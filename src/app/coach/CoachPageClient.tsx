'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chat } from '@/components/Chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CoachPageClientProps {
  initialMessages: Message[];
  onboardingMode: boolean;
  pendingMessage: string | null;
  pendingMessageType?: 'user' | 'assistant';
  coachName?: string;
  coachColor?: string;
}

export function CoachPageClient({
  initialMessages,
  onboardingMode,
  pendingMessage,
  pendingMessageType = 'user',
  coachName = 'Coach Dreamy',
  coachColor = 'blue'
}: CoachPageClientProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(pendingMessage);

  // Clear the URL query parameter after using it
  useEffect(() => {
    if (pendingMessage) {
      // Replace the URL without the message parameter to avoid re-sending on refresh
      router.replace('/coach', { scroll: false });
    }
  }, [pendingMessage, router]);

  const handlePromptSent = () => {
    setPrompt(null);
  };

  return (
    <Chat
      initialMessages={initialMessages}
      onboardingMode={onboardingMode}
      pendingPrompt={prompt}
      pendingPromptType={pendingMessageType}
      onPendingPromptSent={handlePromptSent}
      coachName={coachName}
      coachColor={coachColor}
    />
  );
}
