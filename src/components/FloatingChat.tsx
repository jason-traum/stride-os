'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Chat } from './Chat';
import { MessageCircle, X, Bot, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  { icon: '📝', label: 'Log a run', prompt: 'I want to log a run' },
  { icon: '🎯', label: "Today's workout", prompt: "What's my workout for today?" },
  { icon: '📊', label: 'Weekly summary', prompt: 'Give me a summary of my training this week' },
  { icon: '🌡️', label: 'Pace advice', prompt: 'What pace should I run today given the weather?' },
];

interface FloatingChatProps {
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export function FloatingChat({ initialMessages = [] }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [messages] = useState(initialMessages);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const pathname = usePathname();

  // Hide on coach and onboarding pages
  const isHiddenPage = pathname === '/coach' || pathname === '/onboarding';

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
          <div className="fixed bottom-36 md:bottom-24 left-4 right-4 md:left-auto md:right-6 z-50 bg-white rounded-xl shadow-lg border border-stone-200 p-3 md:w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-100">
              <Zap className="w-4 h-4 text-rose-500" />
              <span className="font-medium text-stone-900 text-sm">Quick Actions</span>
            </div>
            <div className="space-y-1">
              {QUICK_PROMPTS.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 text-left transition-colors"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-stone-700">{item.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowQuickActions(false);
                setIsOpen(true);
              }}
              className="w-full mt-2 pt-2 border-t border-stone-100 flex items-center justify-center gap-2 py-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Open full chat
            </button>
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
            ? 'bg-stone-700'
            : 'bg-gradient-to-br from-rose-400 to-rose-500 hover:from-violet-600 hover:to-rose-600',
          'hover:scale-105 active:scale-95',
          isOpen && 'opacity-0 pointer-events-none'
        )}
      >
        {showQuickActions ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Bot className="w-6 h-6 text-white" />
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
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Coach</h2>
              <p className="text-xs text-stone-500">AI running assistant</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
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
