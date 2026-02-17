'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Chat } from './Chat';
import { MessageCircle, X, Zap, ArrowRight, History, Info } from 'lucide-react';
import { CoachLogo } from './CoachLogo';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  { icon: '', label: 'Log a run', prompt: 'I want to log a run' },
  { icon: '', label: "Today's workout", prompt: "What's my workout for today?" },
  { icon: '', label: 'Weekly summary', prompt: 'Give me a summary of my training this week' },
  { icon: '', label: 'Pace advice', prompt: 'What pace should I run today given the weather?' },
];

interface FloatingChatProps {
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// Truncate text to a maximum length
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function FloatingChat({ initialMessages = [] }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [messages] = useState(initialMessages);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const pathname = usePathname();

  // Hide on coach and onboarding pages
  const isHiddenPage = pathname === '/coach' || pathname === '/onboarding' || pathname === '/';

  // Check if there's an existing conversation to continue
  const hasConversation = messages.length > 0;
  const lastAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .pop();
  const lastMessagePreview = lastAssistantMessage
    ? truncateText(lastAssistantMessage.content.replace(/[#*_`]/g, ''), 60)
    : null;

  const handleQuickPrompt = (prompt: string) => {
    setPendingPrompt(prompt);
    setShowQuickActions(false);
    setIsOpen(true);
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (isHiddenPage) {
    return null;
  }

  return (
    <>
      {/* Quick Actions Popup */}
      {showQuickActions && !isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowQuickActions(false)}
          />
          <div className="fixed bottom-36 md:bottom-24 left-4 right-4 md:left-auto md:right-6 z-50 bg-bgSecondary rounded-xl shadow-lg border border-borderPrimary p-3 md:w-72 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {/* Continue Conversation - shown if there's existing chat history */}
            {hasConversation && (
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  setIsOpen(true);
                }}
                className="w-full flex items-center gap-3 p-3 mb-3 rounded-lg bg-gradient-to-r from-dream-900/30 to-dream-800/20 border border-dream-700 hover:border-dream-600 transition-colors group"
              >
                <div className="w-8 h-8 bg-dream-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <History className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-dream-300">Continue conversation</span>
                    <ArrowRight className="w-3 h-3 text-dream-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  {lastMessagePreview && (
                    <p className="text-xs text-textTertiary truncate mt-0.5">{lastMessagePreview}</p>
                  )}
                </div>
              </button>
            )}

            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-borderSecondary">
              <Zap className="w-4 h-4 text-rose-500" />
              <span className="font-medium text-primary text-sm">
                {hasConversation ? 'Or start fresh' : 'Quick Actions'}
              </span>
            </div>
            <div className="space-y-1">
              {QUICK_PROMPTS.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bgTertiary text-left transition-colors"
                >
                  <span className="text-sm text-textSecondary">{item.label}</span>
                </button>
              ))}
            </div>
            {!hasConversation && (
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  setIsOpen(true);
                }}
                className="w-full mt-2 pt-2 border-t border-borderSecondary flex items-center justify-center gap-2 py-2 text-sm text-dream-300 font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                Open full chat
              </button>
            )}
          </div>
        </>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setShowQuickActions(!showQuickActions)}
        onDoubleClick={() => {
          setShowQuickActions(false);
          setIsOpen(true);
        }}
        className={cn(
          'fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          showQuickActions
            ? 'bg-surface-3'
            : 'bg-gradient-to-br from-rose-400 to-rose-500 hover:from-violet-600 hover:to-rose-600',
          'hover:scale-105 active:scale-95',
          isOpen && 'opacity-0 pointer-events-none'
        )}
      >
        {showQuickActions ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <CoachLogo className="w-8 h-8 text-white" />
        )}
        {/* Conversation indicator dot */}
        {hasConversation && !showQuickActions && !isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-dream-400 rounded-full border-2 border-borderSecondary flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-bgSecondary rounded-full" />
          </span>
        )}
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-out Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-bgSecondary shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borderPrimary">
          <div className="flex items-center gap-3">
            <CoachLogo className="w-9 h-9 text-textSecondary" />
            <div>
              <h2 className="font-semibold text-primary">Chat with Coach Dreamy</h2>
              <p className="text-xs text-textTertiary">Your running coach</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/coach/guide"
              className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center hover:bg-amber-500/30 transition-colors"
            >
              <Info className="w-4 h-4 text-amber-500" />
            </a>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-full hover:bg-surface-interactive-hover flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-textTertiary" />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {isOpen && (
            <Chat
              initialMessages={messages}
              compact
              pendingPrompt={pendingPrompt}
              onPendingPromptSent={() => setPendingPrompt(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
