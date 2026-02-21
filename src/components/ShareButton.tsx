'use client';

import { useState, useCallback } from 'react';
import { Share2, Check, Link2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ShareButtonProps {
  workoutId: number;
  /** Compact mode shows just an icon button (for header rows) */
  compact?: boolean;
}

export function ShareButton({ workoutId, compact = false }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/share/workout/${workoutId}`
    : `/api/share/workout/${workoutId}`;

  const handleShare = useCallback(async () => {
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my run on Dreamy',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Link copied!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      showToast('Link copied!', 'success');
      setTimeout(() => setCopied(false), 2500);
    }
  }, [shareUrl, showToast]);

  if (compact) {
    return (
      <button
        onClick={handleShare}
        className="p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surface-2 transition-colors"
        title="Share workout"
        aria-label="Share workout"
      >
        {copied ? (
          <Check className="w-4 h-4 text-color-success" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-textPrimary bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-default transition-colors"
      title="Share workout"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-color-success" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Link2 className="w-4 h-4" />
          <span>Share</span>
        </>
      )}
    </button>
  );
}
