'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Chat } from '@/components/Chat';
import { CoachHeader } from './CoachHeader';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface CoachMemory {
  id: number;
  contextType: string;
  contextKey: string;
  contextValue: string;
  importance: string;
  createdAt: string;
}

interface CoachPageClientProps {
  initialMessages: Message[];
  onboardingMode: boolean;
  pendingMessage: string | null;
  pendingMessageType?: 'user' | 'assistant';
  coachName?: string;
  coachColor?: string;
  memories?: CoachMemory[];
}

export function CoachPageClient({
  initialMessages,
  onboardingMode,
  pendingMessage,
  pendingMessageType = 'user',
  coachName = 'Coach Dreamy',
  coachColor = 'blue',
  memories = [],
}: CoachPageClientProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(pendingMessage);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  // Clear the URL query parameter after using it
  useEffect(() => {
    if (pendingMessage) {
      router.replace('/coach', { scroll: false });
    }
  }, [pendingMessage, router]);

  const handlePromptSent = () => {
    setPrompt(null);
  };

  const handlePromptSelect = useCallback((prompt: string) => {
    setExternalPrompt(prompt);
  }, []);

  const handleExternalPromptHandled = useCallback(() => {
    setExternalPrompt(null);
  }, []);

  // Color classes for legacy CoachHeader props
  const colorClasses: Record<string, string> = {};
  const isHexColor = coachColor.startsWith('#');

  return (
    <div className="fixed inset-0 flex flex-col bg-bgTertiary z-30">
      <CoachHeader
        coachColor={coachColor}
        isHexColor={isHexColor}
        colorClasses={colorClasses}
        isOnboarding={onboardingMode}
        coachName={coachName}
        memories={memories}
        onPromptSelect={handlePromptSelect}
      />
      <div className="flex-1 overflow-hidden">
        <Chat
          initialMessages={initialMessages}
          onboardingMode={onboardingMode}
          pendingPrompt={prompt}
          pendingPromptType={pendingMessageType}
          onPendingPromptSent={handlePromptSent}
          coachName={coachName}
          coachColor={coachColor}
          externalPrompt={externalPrompt}
          onExternalPromptHandled={handleExternalPromptHandled}
        />
      </div>
    </div>
  );
}
