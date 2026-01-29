'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import { useMemo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  coachColor?: string;
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

export function ChatMessage({ role, content, isLoading, coachColor = 'blue' }: ChatMessageProps) {
  const isUser = role === 'user';
  const isHexColor = coachColor.startsWith('#');

  const coachColorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-br from-blue-400 to-blue-600',
    green: 'bg-gradient-to-br from-green-400 to-green-600',
    purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
    red: 'bg-gradient-to-br from-red-400 to-red-600',
    teal: 'bg-gradient-to-br from-teal-400 to-teal-600',
  };

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
          isUser ? 'bg-blue-600' : (!isHexColor && (coachColorClasses[coachColor] || coachColorClasses.blue))
        )}
        style={!isUser && isHexColor ? { backgroundColor: coachColor } : undefined}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] px-4 py-3',
          isUser
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
            : 'bg-white text-slate-800 rounded-2xl rounded-bl-md shadow-sm border border-slate-100'
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
