'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Share2, Check, Link2, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ShareButtonProps {
  workoutId: number;
  /** Optional workout date string (YYYY-MM-DD) for download filenames */
  workoutDate?: string;
  /** Compact mode shows just an icon button (for header rows) */
  compact?: boolean;
}

// NOTE: Image download (IG Story/Post) removed — the share API returns HTML, not an image.
// To add image downloads, implement server-side image generation with @vercel/og or similar.

export function ShareButton({ workoutId, workoutDate, compact = false }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // The share API route renders a styled HTML share card — it IS the user-facing share page
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/share/workout/${workoutId}`
    : `/api/share/workout/${workoutId}`;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleCopyLink = useCallback(async () => {
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
    setMenuOpen(false);
  }, [shareUrl, showToast]);

  if (compact) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surface-2 transition-colors"
          title="Share workout"
          aria-label="Share workout"
          aria-expanded={menuOpen}
        >
          {copied ? (
            <Check className="w-4 h-4 text-color-success" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
        </button>
        {menuOpen && (
          <ShareMenu
            copied={copied}
            onCopyLink={handleCopyLink}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-textSecondary hover:text-textPrimary bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-default transition-colors"
        title="Share workout"
        aria-expanded={menuOpen}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-color-success" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span>Share</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      {menuOpen && (
        <ShareMenu
          copied={copied}
          onCopyLink={handleCopyLink}
        />
      )}
    </div>
  );
}

function ShareMenu({
  copied,
  onCopyLink,
}: {
  copied: boolean;
  onCopyLink: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-48 bg-surface-2 border border-border-default rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Copy Link */}
      <button
        onClick={onCopyLink}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-textSecondary hover:text-textPrimary hover:bg-surface-3 transition-colors"
      >
        {copied ? (
          <Check className="w-4 h-4 text-color-success flex-shrink-0" />
        ) : (
          <Link2 className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{copied ? 'Link copied!' : 'Copy link'}</span>
      </button>
    </div>
  );
}
