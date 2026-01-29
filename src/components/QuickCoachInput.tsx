'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Send, ArrowRight } from 'lucide-react';
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Input section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
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
              className="w-full px-4 py-2.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  input.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'text-slate-400'
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
        "border-t border-slate-100 px-4 py-3 bg-slate-50 transition-all",
        isFocused ? "block" : "hidden md:block"
      )}>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSubmit(suggestion.prompt)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 text-sm rounded-full transition-colors flex items-center gap-1"
            >
              {suggestion.label}
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
