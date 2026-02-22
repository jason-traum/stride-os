'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ArrowRight } from 'lucide-react';
import { CoachLogo } from './CoachLogo';
import { cn } from '@/lib/utils';

interface QuickCoachInputProps {
  placeholder?: string;
  suggestions?: { label: string; prompt: string }[];
}

export function QuickCoachInput({
  placeholder = "Ask your coach anything...",
  suggestions = [
    { label: "Log run", prompt: "I want to log a run" },
    { label: "Today's workout", prompt: "What's my workout for today?" },
    { label: "How am I doing?", prompt: "How is my training going this week?" },
    { label: "Adjust pace", prompt: "What pace should I run today given the weather?" },
  ]
}: QuickCoachInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (text?: string) => {
    const query = text || input.trim();
    if (!query) return;

    // Navigate to coach with the message pre-filled
    const encodedMessage = encodeURIComponent(query);
    router.push(`/coach?message=${encodedMessage}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
      {/* Input section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <CoachLogo className="w-10 h-10 flex-shrink-0 text-textSecondary" />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              placeholder={placeholder}
              className="w-full px-4 py-3 pr-20 bg-bgTertiary border border-borderPrimary rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dream-500 focus:border-dream-500 min-h-[44px]"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  input.trim()
                    ? 'bg-accentTeal text-white hover:bg-accentTeal-hover'
                    : 'text-tertiary'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions - show when focused or always on desktop */}
      <div className={cn(
        "border-t border-borderSecondary px-4 py-3 bg-bgTertiary transition-all",
        isFocused ? "block" : "hidden md:block"
      )}>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSubmit(suggestion.prompt)}
              className="px-3.5 py-2 bg-bgSecondary border border-borderPrimary hover:border-accentTeal hover:bg-surface-1 text-textSecondary hover:text-accentTeal text-sm rounded-full transition-colors flex items-center gap-1 hover-glow min-h-[36px]"
            >
              {suggestion.label}
              <ArrowRight className="w-3 h-3 text-tertiary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
