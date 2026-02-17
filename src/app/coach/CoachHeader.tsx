'use client';

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { ChaseAvatar } from '@/components/ChaseAvatar';

interface CoachHeaderProps {
  coachColor: string;
  isHexColor: boolean;
  colorClasses: Record<string, string>;
  isOnboarding: boolean;
  coachName: string;
  userName?: string | null;
}

const CHASE_INTRO_SEEN_KEY = 'chase-intro-seen';

function ChaseInfoContent() {
  return (
    <div className="space-y-3 text-sm text-textSecondary">
      <p>
        I&apos;m built on <span className="text-primary font-medium">20+ coaching philosophies</span> — Daniels, Lydiard, Pfitzinger, Hansons, and more — so I can pull from the best of all of them instead of locking you into one.
      </p>
      <p>
        Tempos, progressions, fartleks, threshold work, cruise intervals, long run variations — more workout types than you&apos;ll ever need, and I know when to use each one.
      </p>
      <p>
        But I&apos;m not here to hand you a plan and disappear. Tell me how a run felt, and I&apos;ll adjust what comes next. The more we talk, the better I get at coaching you.
      </p>
      <p className="text-primary font-medium">
        Ready when you are.
      </p>
      <Link
        href="/coach/guide"
        className="inline-flex items-center gap-1 text-dream-400 font-medium hover:underline text-sm mt-1"
      >
        Learn how to get the most out of Coach Dreamy →
      </Link>
    </div>
  );
}

export function CoachHeader({ coachColor, isHexColor, colorClasses, isOnboarding, coachName, userName }: CoachHeaderProps) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Show welcome popup on first visit
  useEffect(() => {
    if (!isOnboarding && !localStorage.getItem(CHASE_INTRO_SEEN_KEY)) {
      setShowWelcome(true);
    }
  }, [isOnboarding]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(CHASE_INTRO_SEEN_KEY, 'true');
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <ChaseAvatar size="sm" className="w-10 h-10" />
        <div className="flex-1">
          <h1 className="text-xl font-display font-semibold text-textPrimary">
            Coach
          </h1>
          <p className="text-sm text-textSecondary">
            {isOnboarding ? "Let's learn more about your training" : `Chat with ${coachName}`}
          </p>
        </div>
        {!isOnboarding && (
          <button
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center hover:bg-amber-500/30 transition-colors"
          >
            <Info className="w-4 h-4 text-amber-500" />
          </button>
        )}
      </div>

      {/* Persistent info panel */}
      {showInfoPanel && (
        <div className="mb-4 p-4 bg-surface-1 rounded-xl border border-borderPrimary animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <ChaseAvatar size="sm" />
              <div>
                <h3 className="font-semibold text-primary text-sm">About Coach Dreamy</h3>
                <p className="text-xs text-textTertiary">Your AI running coach</p>
              </div>
            </div>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1 hover:bg-bgTertiary rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-textTertiary" />
            </button>
          </div>
          <ChaseInfoContent />
        </div>
      )}

      {/* First-time welcome popup */}
      {showWelcome && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={dismissWelcome} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-bgSecondary rounded-2xl border border-borderPrimary shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-300">
            <div className="text-center mb-5">
              <ChaseAvatar size="lg" className="mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-primary">
                Hey! I&apos;m Coach Dreamy.
              </h2>
              <p className="text-sm text-textTertiary mt-1">Your AI running coach</p>
            </div>
            <ChaseInfoContent />
            <button
              onClick={dismissWelcome}
              className="w-full mt-5 py-2.5 bg-dream-500 hover:bg-dream-600 text-white rounded-xl font-medium transition-colors"
            >
              Let&apos;s go
            </button>
          </div>
        </>
      )}
    </>
  );
}
