'use client';

import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  coachColor?: string;
  auraColorStart?: string | null;
  auraColorEnd?: string | null;
}

// Legacy props kept for compatibility but user bubbles now use a universal style

// Process inline markdown: bold, italic, code, links
function processInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let keyIndex = 0;

  // Combined regex for inline markdown elements
  // Order matters: bold+italic first, then bold, then italic, then code, then links
  const inlineRegex = /(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Bold + Italic (***text***)
      parts.push(
        <strong key={`${keyPrefix}-bi-${keyIndex++}`} className="font-semibold italic">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Bold (**text**)
      parts.push(
        <strong key={`${keyPrefix}-b-${keyIndex++}`} className="font-semibold">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      // Italic (*text*)
      parts.push(
        <em key={`${keyPrefix}-i-${keyIndex++}`} className="italic">
          {match[6]}
        </em>
      );
    } else if (match[7]) {
      // Inline code (`code`)
      parts.push(
        <code key={`${keyPrefix}-c-${keyIndex++}`} className="bg-bgTertiary text-primary px-1.5 py-0.5 rounded text-xs font-mono">
          {match[8]}
        </code>
      );
    } else if (match[9]) {
      // Link ([text](url))
      parts.push(
        <a
          key={`${keyPrefix}-a-${keyIndex++}`}
          href={match[11]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dream-600 hover:text-dream-700 dark:text-dream-300 underline"
        >
          {match[10]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no matches, return original text
  if (parts.length === 0) {
    return [text];
  }

  return parts;
}

// Enhanced markdown renderer for chat messages
function renderMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let elementIndex = 0;

  // Split into blocks by double newlines, but preserve code blocks
  const blocks: string[] = [];
  let currentBlock = '';
  let inCodeBlock = false;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        currentBlock += line;
        blocks.push(currentBlock);
        currentBlock = '';
        inCodeBlock = false;
      } else {
        // Start code block - push previous content first
        if (currentBlock.trim()) {
          blocks.push(currentBlock);
        }
        currentBlock = line + '\n';
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      currentBlock += line + '\n';
    } else if (line === '' && currentBlock.trim()) {
      blocks.push(currentBlock);
      currentBlock = '';
    } else {
      currentBlock += (currentBlock && !currentBlock.endsWith('\n') ? '\n' : '') + line;
    }
  }
  if (currentBlock.trim()) {
    blocks.push(currentBlock);
  }

  for (const block of blocks) {
    const trimmedBlock = block.trim();

    // Code block
    if (trimmedBlock.startsWith('```')) {
      const codeContent = trimmedBlock.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      elements.push(
        <pre key={`code-${elementIndex++}`} className="bg-bgTertiary rounded-lg p-3 overflow-x-auto my-2">
          <code className="text-xs font-mono text-primary whitespace-pre-wrap">
            {codeContent}
          </code>
        </pre>
      );
      continue;
    }

    // Process the block line by line
    const blockLines = trimmedBlock.split('\n');
    let i = 0;

    while (i < blockLines.length) {
      const line = blockLines[i];

      // Headers
      if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={`h4-${elementIndex++}`} className="font-semibold text-primary mt-3 mb-1">
            {processInlineMarkdown(line.slice(5), `h4-${elementIndex}`)}
          </h4>
        );
        i++;
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${elementIndex++}`} className="font-semibold text-primary text-base mt-3 mb-1">
            {processInlineMarkdown(line.slice(4), `h3-${elementIndex}`)}
          </h3>
        );
        i++;
        continue;
      }

      // Bullet list
      if (line.match(/^[\-\*]\s/)) {
        const listItems: React.ReactNode[] = [];
        while (i < blockLines.length && blockLines[i].match(/^[\-\*]\s/)) {
          const itemText = blockLines[i].replace(/^[\-\*]\s/, '');
          listItems.push(
            <li key={`li-${elementIndex}-${listItems.length}`} className="ml-4">
              {processInlineMarkdown(itemText, `li-${elementIndex}-${listItems.length}`)}
            </li>
          );
          i++;
        }
        elements.push(
          <ul key={`ul-${elementIndex++}`} className="list-disc list-outside my-2 space-y-1">
            {listItems}
          </ul>
        );
        continue;
      }

      // Numbered list
      if (line.match(/^\d+\.\s/)) {
        const listItems: React.ReactNode[] = [];
        while (i < blockLines.length && blockLines[i].match(/^\d+\.\s/)) {
          const itemText = blockLines[i].replace(/^\d+\.\s/, '');
          listItems.push(
            <li key={`oli-${elementIndex}-${listItems.length}`} className="ml-4">
              {processInlineMarkdown(itemText, `oli-${elementIndex}-${listItems.length}`)}
            </li>
          );
          i++;
        }
        elements.push(
          <ol key={`ol-${elementIndex++}`} className="list-decimal list-outside my-2 space-y-1">
            {listItems}
          </ol>
        );
        continue;
      }

      // Regular paragraph - collect consecutive non-special lines
      const paragraphLines: string[] = [];
      while (
        i < blockLines.length &&
        !blockLines[i].startsWith('### ') &&
        !blockLines[i].startsWith('#### ') &&
        !blockLines[i].match(/^[\-\*]\s/) &&
        !blockLines[i].match(/^\d+\.\s/) &&
        blockLines[i].trim() !== ''
      ) {
        paragraphLines.push(blockLines[i]);
        i++;
      }

      if (paragraphLines.length > 0) {
        const paragraphContent = paragraphLines.map((pLine, pIdx) => (
          <span key={`pline-${elementIndex}-${pIdx}`}>
            {processInlineMarkdown(pLine, `p-${elementIndex}-${pIdx}`)}
            {pIdx < paragraphLines.length - 1 && <br />}
          </span>
        ));

        elements.push(
          <p key={`p-${elementIndex++}`} className={elements.length > 0 ? 'mt-2' : ''}>
            {paragraphContent}
          </p>
        );
      }

      // Skip empty lines
      while (i < blockLines.length && blockLines[i].trim() === '') {
        i++;
      }
    }
  }

  return elements;
}

export function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  const isUser = role === 'user';

  const renderedContent = useMemo(() => {
    if (isUser) {
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }
    return <div className="text-sm">{renderMarkdown(content)}</div>;
  }, [content, isUser]);

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {isUser ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-surface-2">
          <User className="w-4 h-4 text-white" />
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
          <Image src="/sheep/coach.png" alt="Dreamy coach" width={32} height={32} className="object-contain" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] px-4 py-3 rounded-2xl',
          isUser && 'bg-surface-2 text-white rounded-br-md',
          !isUser && 'bg-bgSecondary text-textPrimary rounded-bl-md shadow-sm border border-borderPrimary'
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-textTertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-textTertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-textTertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          renderedContent
        )}
      </div>
    </div>
  );
}
