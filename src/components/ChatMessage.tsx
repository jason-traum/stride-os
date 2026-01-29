'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import { useMemo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

// Simple markdown renderer for chat messages
function renderMarkdown(text: string): React.ReactNode[] {
  // Split into paragraphs (double newline or single newline)
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    // Handle single line breaks within paragraphs
    const lines = paragraph.split(/\n/);

    const renderedLines = lines.map((line, lIndex) => {
      // Process inline markdown (bold)
      const parts: React.ReactNode[] = [];
      let keyIndex = 0;

      // Match **bold** text
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index));
        }
        // Add bold text
        parts.push(
          <strong key={`bold-${pIndex}-${lIndex}-${keyIndex++}`} className="font-semibold">
            {match[1]}
          </strong>
        );
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text after last match
      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }

      // If no matches, just return the line
      if (parts.length === 0) {
        parts.push(line);
      }

      return (
        <span key={`line-${pIndex}-${lIndex}`}>
          {parts}
          {lIndex < lines.length - 1 && <br />}
        </span>
      );
    });

    return (
      <p key={`p-${pIndex}`} className={pIndex > 0 ? 'mt-3' : ''}>
        {renderedLines}
      </p>
    );
  });
}

export function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  const isUser = role === 'user';

  const renderedContent = useMemo(() => {
    if (isUser) {
      // User messages: simple whitespace preservation
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }
    // Assistant messages: render markdown
    return <div className="text-sm">{renderMarkdown(content)}</div>;
  }, [content, isUser]);

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-orange-400 to-orange-600'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-900'
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          renderedContent
        )}
      </div>
    </div>
  );
}
