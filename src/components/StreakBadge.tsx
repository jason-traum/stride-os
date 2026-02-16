'use client';

import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  if (currentStreak === 0) {
    return null;
  }

  const isHotStreak = currentStreak >= 7;
  const isOnFire = currentStreak >= 14;
  const isNearRecord = currentStreak >= longestStreak - 1 && currentStreak > 1;
  const isNewRecord = currentStreak >= longestStreak && longestStreak > 1;

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
      ${isOnFire
        ? 'bg-gradient-to-r from-violet-500 to-red-500 text-white'
        : isHotStreak
        ? 'bg-rose-900/40 text-rose-300'
        : 'bg-bgTertiary text-textSecondary'
      }
    `}>
      <Flame className={`w-4 h-4 ${isOnFire ? 'animate-pulse' : ''}`} />
      <span>{currentStreak} day streak</span>
      {isNewRecord && (
        <span className="ml-1 text-xs opacity-80">New record!</span>
      )}
      {isNearRecord && !isNewRecord && (
        <span className="ml-1 text-xs opacity-80">Near record!</span>
      )}
    </div>
  );
}
