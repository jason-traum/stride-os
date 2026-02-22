'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lightbulb, X, ChevronRight } from 'lucide-react';
import type { UserSettings } from '@/lib/schema';

interface SmartProfilePromptProps {
  settings: UserSettings;
  hasGoalRace: boolean;
  hasRaceResults: boolean;
}

interface ProfilePromptDef {
  /** Unique key used for localStorage dismissal tracking */
  id: string;
  /** Function to check if this field is missing */
  isMissing: (settings: UserSettings, context: { hasGoalRace: boolean; hasRaceResults: boolean }) => boolean;
  /** The coaching benefit message */
  message: string;
  /** CTA label */
  cta: string;
  /** Link destination */
  href: string;
}

/**
 * Priority-ordered list of profile prompts.
 * Earlier items are shown first when their field is missing.
 * Each prompt explains WHY this field matters for coaching quality.
 */
const PROFILE_PROMPTS: ProfilePromptDef[] = [
  {
    id: 'age',
    isMissing: (s) => s.age === null || s.age === undefined,
    message: 'Adding your age helps calculate accurate heart rate zones and max HR.',
    cta: 'Update Profile',
    href: '/profile',
  },
  {
    id: 'vdot-race',
    isMissing: (s, ctx) => !s.vdot && !ctx.hasRaceResults,
    message: 'A recent race result would calibrate your VDOT and all training paces.',
    cta: 'Add Race Result',
    href: '/races',
  },
  {
    id: 'weekly-mileage',
    isMissing: (s) => s.currentWeeklyMileage === null || s.currentWeeklyMileage === undefined,
    message: 'Your current weekly mileage helps build a safe, progressive training plan.',
    cta: 'Set Mileage',
    href: '/profile',
  },
  {
    id: 'goal-race',
    isMissing: (_s, ctx) => !ctx.hasGoalRace,
    message: 'Setting a goal race unlocks periodized training and race-day countdown.',
    cta: 'Set Goal Race',
    href: '/races',
  },
  {
    id: 'years-running',
    isMissing: (s) => s.yearsRunning === null || s.yearsRunning === undefined,
    message: 'Your running experience helps tune workout complexity and progression rate.',
    cta: 'Update Profile',
    href: '/profile',
  },
  {
    id: 'resting-hr',
    isMissing: (s) => s.restingHr === null || s.restingHr === undefined,
    message: 'Resting heart rate improves heart rate zone accuracy and recovery tracking.',
    cta: 'Update Profile',
    href: '/profile',
  },
  {
    id: 'peak-mileage-target',
    isMissing: (s) => s.peakWeeklyMileageTarget === null || s.peakWeeklyMileageTarget === undefined,
    message: 'A peak mileage target helps your coach plan progressive volume buildup.',
    cta: 'Set Target',
    href: '/profile',
  },
  {
    id: 'location',
    isMissing: (s) => s.latitude === null || s.latitude === undefined,
    message: 'Your location enables weather-adjusted pacing and outfit recommendations.',
    cta: 'Set Location',
    href: '/profile',
  },
];

const DISMISS_STORAGE_KEY = 'smartProfilePromptDismissed';

function getDismissedPrompts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function dismissPrompt(id: string) {
  const dismissed = getDismissedPrompts();
  dismissed[id] = Date.now();
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissed));
}

function isPromptDismissed(id: string): boolean {
  const dismissed = getDismissedPrompts();
  if (!dismissed[id]) return false;
  // Re-show after 7 days in case user forgot
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - dismissed[id] < sevenDaysMs;
}

export function SmartProfilePrompt({ settings, hasGoalRace, hasRaceResults }: SmartProfilePromptProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const context = { hasGoalRace, hasRaceResults };

  // Find the highest-priority missing & non-dismissed prompt
  const activePrompt = PROFILE_PROMPTS.find(
    (p) => p.isMissing(settings, context) && !isPromptDismissed(p.id) && dismissed !== p.id
  );

  if (!activePrompt) return null;

  const handleDismiss = () => {
    dismissPrompt(activePrompt.id);
    setDismissed(activePrompt.id);
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-amber-500/15 rounded-lg flex-shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-textSecondary leading-snug">
            {activePrompt.message}
          </p>
          <Link
            href={activePrompt.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-accentTeal hover:text-accentTeal/80 mt-1.5 transition-colors"
          >
            {activePrompt.cta}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-textTertiary hover:text-textSecondary transition-colors flex-shrink-0"
          title="Dismiss for now"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
