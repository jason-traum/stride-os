'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { QUICK_ACTIONS } from '@/lib/coach-prompt';
import { saveChatMessage } from '@/actions/chat';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  initialMessages?: Message[];
  compact?: boolean;
  onboardingMode?: boolean;
  pendingPrompt?: string | null;
  onPendingPromptSent?: () => void;
}

export function Chat({
  initialMessages = [],
  compact = false,
  onboardingMode = false,
  pendingPrompt = null,
  onPendingPromptSent
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Track onboarding trigger using ref to avoid dependency issues
  const onboardingTriggered = useRef(false);
  const pendingPromptHandled = useRef(false);

  // Auto-trigger onboarding conversation - defined early but we use a ref to track
  useEffect(() => {
    if (onboardingMode && !onboardingTriggered.current && messages.length === 0 && !isLoading) {
      onboardingTriggered.current = true;
      // Automatically send the onboarding greeting
      const onboardingMessage = "Hi! I just finished setting up my profile. What else would you like to know about me to help with my training?";
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        handleSubmit(onboardingMessage);
      }, 100);
    }
  }, [onboardingMode, messages.length, isLoading]);

  // Handle pending prompt from quick actions
  useEffect(() => {
    if (pendingPrompt && !pendingPromptHandled.current && !isLoading) {
      pendingPromptHandled.current = true;
      handleSubmit(pendingPrompt);
      onPendingPromptSent?.();
    }
  }, [pendingPrompt, isLoading]);

  // Reset the pending prompt handled ref when pendingPrompt changes
  useEffect(() => {
    if (!pendingPrompt) {
      pendingPromptHandled.current = false;
    }
  }, [pendingPrompt]);

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Save user message to database
    await saveChatMessage('user', text);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          newMessage: text,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'text') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                // Save assistant message to database
                if (fullContent) {
                  await saveChatMessage('assistant', fullContent);
                  setMessages(prev => [
                    ...prev,
                    {
                      id: `assistant-${Date.now()}`,
                      role: 'assistant',
                      content: fullContent,
                    },
                  ]);
                }
                setStreamingContent('');
              } else if (data.type === 'error') {
                setMessages(prev => [
                  ...prev,
                  {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.content || 'Sorry, something went wrong. Please try again.',
                  },
                ]);
                setStreamingContent('');
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "Hmm, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (message: string) => {
    handleSubmit(message);
  };

  return (
    <div className={cn('flex flex-col', compact ? 'h-full' : 'h-[calc(100vh-200px)]')}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🏃</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Hey! I&apos;m your running coach.</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              I can help you log runs, analyze your training, plan workouts, and answer questions about your data.
            </p>
          </div>
        )}

        {messages.map(message => (
          <ChatMessage key={message.id} role={message.role} content={message.content} />
        ))}

        {isLoading && streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} />
        )}

        {isLoading && !streamingContent && (
          <ChatMessage role="assistant" content="" isLoading />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(action.message)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-full transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your coach..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
              input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
