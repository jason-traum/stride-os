'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Share2, Check, Link2, Download, ChevronDown, Image } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ShareButtonProps {
  workoutId: number;
  /** Optional workout date string (YYYY-MM-DD) for download filenames */
  workoutDate?: string;
  /** Compact mode shows just an icon button (for header rows) */
  compact?: boolean;
}

async function downloadShareImage(workoutId: number, format: 'story' | 'square', dateStr?: string) {
  const res = await fetch(`/api/share/workout/${workoutId}?format=${format}`);
  if (!res.ok) throw new Error('Failed to generate image');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const datePart = dateStr || new Date().toISOString().slice(0, 10);
  const suffix = format === 'story' ? 'story' : 'post';
  a.download = `dreamy-run-${datePart}-${suffix}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ShareButton({ workoutId, workoutDate, compact = false }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

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

  const handleDownload = useCallback(async (format: 'story' | 'square') => {
    setDownloading(format);
    try {
      await downloadShareImage(workoutId, format, workoutDate);
      const label = format === 'story' ? 'Story' : 'Post';
      showToast(`${label} image downloaded!`, 'success');
    } catch {
      showToast('Download failed. Try again.', 'error');
    } finally {
      setDownloading(null);
      setMenuOpen(false);
    }
  }, [workoutId, workoutDate, showToast]);

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
            downloading={downloading}
            onCopyLink={handleCopyLink}
            onDownload={handleDownload}
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
          downloading={downloading}
          onCopyLink={handleCopyLink}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

function ShareMenu({
  copied,
  downloading,
  onCopyLink,
  onDownload,
}: {
  copied: boolean;
  downloading: string | null;
  onCopyLink: () => void;
  onDownload: (format: 'story' | 'square') => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-surface-2 border border-border-default rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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

      <div className="h-px bg-border-subtle mx-3" />

      {/* Download header */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-textTertiary">
          Download for Instagram
        </span>
      </div>

      {/* IG Story */}
      <button
        onClick={() => onDownload('story')}
        disabled={downloading !== null}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-textSecondary hover:text-textPrimary hover:bg-surface-3 transition-colors disabled:opacity-50"
      >
        {downloading === 'story' ? (
          <div className="w-4 h-4 border-2 border-textTertiary border-t-textPrimary rounded-full animate-spin flex-shrink-0" />
        ) : (
          <Image className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="flex-1 text-left">IG Story</span>
        <span className="text-[10px] text-textTertiary">9:16</span>
      </button>

      {/* IG Post */}
      <button
        onClick={() => onDownload('square')}
        disabled={downloading !== null}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-textSecondary hover:text-textPrimary hover:bg-surface-3 transition-colors disabled:opacity-50"
      >
        {downloading === 'square' ? (
          <div className="w-4 h-4 border-2 border-textTertiary border-t-textPrimary rounded-full animate-spin flex-shrink-0" />
        ) : (
          <Download className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="flex-1 text-left">IG Post</span>
        <span className="text-[10px] text-textTertiary">1:1</span>
      </button>
    </div>
  );
}
