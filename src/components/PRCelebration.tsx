'use client';

import { useState, useEffect, useRef } from 'react';
import { Trophy, Share2, Check, ChevronRight, TrendingUp, Download, Image } from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { PRCelebration as PRCelebrationData } from '@/actions/pr-celebrations';

interface PRCelebrationProps {
  celebrations: PRCelebrationData[];
}

function formatEffortTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatImprovementTime(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
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
  a.download = `dreamy-pr-${datePart}-${suffix}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSS confetti: generate random positioned colored dots
function ConfettiEffect() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    left: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
  }>>([]);

  useEffect(() => {
    const colors = [
      '#fbbf24', '#f59e0b', '#d97706', // amber/gold
      '#fcd34d', '#fde68a',             // light gold
      '#ef4444', '#22c55e', '#3b82f6',  // red, green, blue accents
      '#a78bfa', '#f0a06c',             // brand colors
    ];
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.2 + Math.random() * 1.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg) scale(1);
            opacity: 1;
          }
          40% {
            opacity: 1;
          }
          100% {
            transform: translateY(120px) rotate(720deg) scale(0.2);
            opacity: 0;
          }
        }
        .confetti-particle {
          position: absolute;
          top: -8px;
          border-radius: 2px;
          pointer-events: none;
          animation: confetti-fall var(--duration) ease-out var(--delay) forwards;
          opacity: 0;
          animation-fill-mode: forwards;
          z-index: 10;
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            ['--delay' as string]: `${p.delay}s`,
            ['--duration' as string]: `${p.duration}s`,
          }}
        />
      ))}
    </>
  );
}

export function PRCelebration({ celebrations }: PRCelebrationProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const hasAnimated = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!hasAnimated.current && celebrations.length > 0) {
      hasAnimated.current = true;
      setShowConfetti(true);
      // Remove confetti after animation completes
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [celebrations]);

  if (celebrations.length === 0) return null;

  async function handleShare(celebration: PRCelebrationData) {
    const shareUrl = `${window.location.origin}/api/share/pr/${celebration.bestEffortId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(celebration.bestEffortId);
      showToast('Link copied!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      if (navigator.share) {
        await navigator.share({
          title: `New ${celebration.distanceLabel} PR | Dreamy`,
          url: shareUrl,
        });
      }
    }
  }

  async function handleDownload(celebration: PRCelebrationData, format: 'story' | 'square') {
    const key = `${celebration.bestEffortId}-${format}`;
    setDownloading(key);
    try {
      await downloadShareImage(celebration.workoutId, format, celebration.date);
      const label = format === 'story' ? 'Story' : 'Post';
      showToast(`${label} image downloaded!`, 'success');
    } catch {
      showToast('Download failed. Try again.', 'error');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-3">
      {celebrations.map((pr, index) => (
        <div
          key={pr.bestEffortId}
          className="relative bg-bgSecondary rounded-xl border border-amber-500/30 shadow-sm overflow-hidden"
        >
          {/* Confetti overlay (first card only) */}
          {index === 0 && showConfetti && <ConfettiEffect />}

          {/* Gold accent gradient bar */}
          <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-400">
                    New {pr.distanceLabel} PR!
                  </div>
                  <div className="text-[11px] text-textTertiary">
                    {formatDate(pr.date)}
                    {pr.workoutName && ` \u00B7 ${pr.workoutName}`}
                  </div>
                </div>
              </div>
              {pr.improvementPct !== null && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px] font-medium text-emerald-400">
                    {pr.improvementPct.toFixed(1)}% faster
                  </span>
                </div>
              )}
            </div>

            {/* Time comparison */}
            <div className="bg-bgPrimary rounded-lg p-3">
              <div className="flex items-center justify-between">
                {/* New time (prominent) */}
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-amber-400 tracking-tight">
                    {formatEffortTime(pr.newTimeSeconds)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">
                    New PR
                  </div>
                </div>

                {/* Arrow & improvement */}
                {pr.oldTimeSeconds !== null && pr.improvementSeconds !== null && (
                  <>
                    <div className="flex flex-col items-center px-3">
                      <div className="text-emerald-400 text-xs font-semibold">
                        -{formatImprovementTime(pr.improvementSeconds)}
                      </div>
                      <ChevronRight className="w-4 h-4 text-textTertiary rotate-180" />
                    </div>

                    {/* Old time */}
                    <div className="text-center flex-1">
                      <div className="text-lg font-semibold text-textSecondary tracking-tight">
                        {formatEffortTime(pr.oldTimeSeconds)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">
                        Previous
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* VDOT row */}
              {pr.newVdot > 0 && (
                <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-borderSecondary">
                  <span className="text-xs text-textTertiary">VDOT</span>
                  <span className="text-sm font-bold text-amber-400">{pr.newVdot.toFixed(1)}</span>
                  {pr.vdotChange !== null && pr.vdotChange !== 0 && (
                    <span className={`text-xs font-medium ${pr.vdotChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pr.vdotChange > 0 ? '+' : ''}{pr.vdotChange.toFixed(1)}
                    </span>
                  )}
                  {pr.oldVdot !== null && pr.oldVdot > 0 && (
                    <span className="text-xs text-textTertiary">
                      (was {pr.oldVdot.toFixed(1)})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Share & Download buttons */}
            <div className="flex gap-2 mt-3">
              {/* Share link button */}
              <button
                onClick={() => handleShare(pr)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/5 transition-colors border border-amber-500/20"
              >
                {copiedId === pr.bestEffortId ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Link copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Share PR
                  </>
                )}
              </button>

              {/* Download IG Story */}
              <button
                onClick={() => handleDownload(pr, 'story')}
                disabled={downloading !== null}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/5 transition-colors border border-amber-500/20 disabled:opacity-50"
                title="Download for IG Story (9:16)"
              >
                {downloading === `${pr.bestEffortId}-story` ? (
                  <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : (
                  <Image className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Story</span>
              </button>

              {/* Download IG Post */}
              <button
                onClick={() => handleDownload(pr, 'square')}
                disabled={downloading !== null}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/5 transition-colors border border-amber-500/20 disabled:opacity-50"
                title="Download for IG Post (1:1)"
              >
                {downloading === `${pr.bestEffortId}-square` ? (
                  <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Post</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
