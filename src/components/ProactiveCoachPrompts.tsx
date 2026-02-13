'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  X,
  ChevronRight,
  AlertCircle,
  Heart,
  Trophy,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { markPromptAddressed } from '@/lib/proactive-coach';
import type { ProactivePrompt } from '@/lib/proactive-coach';

interface ProactiveCoachPromptsProps {
  prompts: ProactivePrompt[];
  variant?: 'inline' | 'modal';
}

export function ProactiveCoachPrompts({ prompts, variant = 'inline' }: ProactiveCoachPromptsProps) {
  const router = useRouter();
  const [dismissedPrompts, setDismissedPrompts] = useState<string[]>([]);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const visiblePrompts = prompts.filter(p => !dismissedPrompts.includes(p.id));

  if (visiblePrompts.length === 0) return null;

  const handleDismiss = async (promptId: string) => {
    setDismissedPrompts([...dismissedPrompts, promptId]);
    await markPromptAddressed(promptId);
  };

  const handleQuickResponse = async (prompt: ProactivePrompt, question: string) => {
    // Navigate to coach with the question pre-filled
    const message = `${prompt.message}\n\n${question}`;
    const encodedMessage = encodeURIComponent(message);
    await markPromptAddressed(prompt.id, question);
    router.push(`/coach?message=${encodedMessage}&type=assistant`);
  };

  const handleChatNow = async (prompt: ProactivePrompt) => {
    const encodedMessage = encodeURIComponent(prompt.message);
    await markPromptAddressed(prompt.id);
    router.push(`/coach?message=${encodedMessage}&type=assistant`);
  };

  const getPromptIcon = (type: ProactivePrompt['type']) => {
    switch (type) {
      case 'post_workout': return Heart;
      case 'check_in': return MessageCircle;
      case 'missing_info': return AlertCircle;
      case 'milestone': return Trophy;
      case 'concern': return AlertCircle;
      default: return Sparkles;
    }
  };

  const getPromptColor = (type: ProactivePrompt['type']) => {
    switch (type) {
      case 'post_workout': return 'from-rose-400 to-rose-500';
      case 'check_in': return 'from-blue-400 to-blue-500';
      case 'missing_info': return 'from-amber-400 to-amber-500';
      case 'milestone': return 'from-purple-400 to-purple-500';
      case 'concern': return 'from-orange-400 to-orange-500';
      default: return 'from-teal-400 to-teal-500';
    }
  };

  if (variant === 'modal' && visiblePrompts.length > 0) {
    const topPrompt = visiblePrompts[0];
    const Icon = getPromptIcon(topPrompt.type);

    return (
      <div className="fixed bottom-4 right-4 max-w-sm w-full z-50 animate-slide-up">
        <div className="bg-bgSecondary rounded-2xl shadow-2xl border border-borderPrimary overflow-hidden">
          {/* Header */}
          <div className={cn(
            "px-4 py-3 text-white bg-gradient-to-r",
            getPromptColor(topPrompt.type)
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                <span className="font-medium">Your Coach</span>
              </div>
              <button
                onClick={() => handleDismiss(topPrompt.id)}
                className="p-1 hover:bg-bgSecondary/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <p className="text-primary">{topPrompt.message}</p>

            {topPrompt.questions && topPrompt.questions.length > 0 && (
              <div className="space-y-2">
                {topPrompt.questions.slice(0, 2).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickResponse(topPrompt, question)}
                    className="w-full text-left p-3 bg-bgTertiary hover:bg-surface-interactive-hover rounded-lg text-sm text-textSecondary transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => handleChatNow(topPrompt)}
              className="btn-primary w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              Chat Now
              <ChevronRight className="w-4 h-4" />
            </button>

            {visiblePrompts.length > 1 && (
              <p className="text-xs text-center text-textTertiary">
                +{visiblePrompts.length - 1} more messages
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className="space-y-3">
      {visiblePrompts.map(prompt => {
        const Icon = getPromptIcon(prompt.type);
        const isExpanded = expandedPrompt === prompt.id;

        return (
          <div
            key={prompt.id}
            className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden hover:shadow-md transition-all"
          >
            <div
              className={cn(
                "px-4 py-3 cursor-pointer",
                isExpanded ? "border-b border-borderSecondary" : ""
              )}
              onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br",
                    getPromptColor(prompt.type)
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-primary line-clamp-2">{prompt.message}</p>
                    {prompt.type === 'milestone' && (
                      <p className="text-xs text-textTertiary mt-1">Tap to celebrate! 🎉</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(prompt.id);
                  }}
                  className="p-1 hover:bg-surface-interactive-hover rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-tertiary" />
                </button>
              </div>
            </div>

            {isExpanded && prompt.questions && prompt.questions.length > 0 && (
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  {prompt.questions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickResponse(prompt, question)}
                      className="w-full text-left p-3 bg-bgTertiary hover:bg-surface-interactive-hover rounded-lg text-sm text-textSecondary transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleChatNow(prompt)}
                  className="btn-primary w-full py-2 rounded-lg text-sm"
                >
                  Start Conversation
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}