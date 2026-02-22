'use client';

import { useState } from 'react';
import { Trophy, Lock, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AchievementsResponse } from '@/actions/achievements';
import type { AchievementCategory, AchievementTier, EarnedAchievement } from '@/lib/achievements';
import { CATEGORY_META, TIER_COLORS } from '@/lib/achievements';

interface Props {
  data: AchievementsResponse;
}

const ALL_CATEGORIES: AchievementCategory[] = ['mileage', 'streak', 'distance', 'speed', 'consistency', 'training'];

function tierLabel(tier?: AchievementTier): string {
  if (!tier) return '';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const pct = target > 0 ? Math.min((progress / target) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-bgTertiary rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-dream-500 to-dream-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AchievementBadge({ achievement, isRecent }: { achievement: EarnedAchievement; isRecent: boolean }) {
  const { result } = achievement;
  const earned = result.earned;
  const tier = achievement.tier || 'bronze';
  const colors = TIER_COLORS[tier];

  return (
    <div
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-300',
        earned
          ? `${colors.bg} ${colors.border} shadow-sm hover:shadow-md`
          : 'bg-bgSecondary/50 border-borderPrimary/50 opacity-60 hover:opacity-80',
        isRecent && earned && 'ring-2 ring-dream-500/50 ring-offset-2 ring-offset-bgPrimary'
      )}
    >
      {/* Most Recent badge */}
      {isRecent && earned && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-dream-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
          <Sparkles className="w-3 h-3" />
          NEW
        </div>
      )}

      {/* Badge icon */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
            earned ? colors.bg : 'bg-bgTertiary'
          )}
        >
          {earned ? (
            <span>{achievement.icon}</span>
          ) : (
            <Lock className="w-5 h-5 text-textTertiary/50" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'text-sm font-semibold truncate',
                earned ? 'text-textPrimary' : 'text-textTertiary'
              )}
            >
              {achievement.name}
            </h3>
            {earned && achievement.tier && (
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', colors.text)}>
                {tierLabel(achievement.tier)}
              </span>
            )}
          </div>
          <p className={cn(
            'text-xs mt-0.5',
            earned ? 'text-textSecondary' : 'text-textTertiary/70'
          )}>
            {achievement.description}
          </p>

          {/* Progress bar for milestone achievements */}
          {result.target && result.progress !== undefined && !earned && (
            <div className="mt-2 space-y-1">
              <ProgressBar progress={result.progress} target={result.target} />
              {result.progressLabel && (
                <p className="text-[10px] text-textTertiary">{result.progressLabel}</p>
              )}
            </div>
          )}

          {/* Earned date and progress label for earned achievements */}
          {earned && (
            <div className="mt-1.5 flex items-center gap-2">
              {result.earnedDate && (
                <span className="text-[10px] text-textTertiary">
                  Earned {new Date(result.earnedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
              {result.progressLabel && (
                <span className="text-[10px] text-textTertiary">
                  {result.progressLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  achievements,
  mostRecentId,
}: {
  category: AchievementCategory;
  achievements: EarnedAchievement[];
  mostRecentId: string | null;
}) {
  const meta = CATEGORY_META[category];
  const earnedCount = achievements.filter(a => a.result.earned).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-textPrimary">{meta.label}</h2>
            <p className="text-[10px] text-textTertiary">{meta.description}</p>
          </div>
        </div>
        <span className="text-xs font-medium text-textTertiary">
          {earnedCount}/{achievements.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {achievements.map(a => (
          <AchievementBadge
            key={a.id}
            achievement={a}
            isRecent={a.id === mostRecentId}
          />
        ))}
      </div>
    </section>
  );
}

export function AchievementsClient({ data }: Props) {
  const [activeFilter, setActiveFilter] = useState<'all' | AchievementCategory>('all');

  const { summary, byCategory, mostRecent } = data;
  const mostRecentId = mostRecent?.id || null;

  const categoriesToShow = activeFilter === 'all'
    ? ALL_CATEGORIES
    : [activeFilter];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/today" className="text-textTertiary hover:text-textPrimary transition-colors md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Trophy className="w-5 h-5 text-dream-400" />
          <h1 className="text-xl font-display font-bold text-textPrimary">Achievements</h1>
        </div>
        <p className="text-sm text-textSecondary">
          Track your running milestones and unlock badges as you progress.
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-textPrimary">{summary.earned}</span>
              <span className="text-sm text-textTertiary">/ {summary.total}</span>
            </div>
            <p className="text-xs text-textTertiary mt-0.5">achievements earned</p>
          </div>
          <div className="relative w-16 h-16">
            {/* Circular progress */}
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-bgTertiary"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(summary.percentage / 100) * 175.93} 175.93`}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-dream-500, #6366f1)" />
                  <stop offset="100%" stopColor="var(--color-dream-400, #818cf8)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-textPrimary">
              {summary.percentage}%
            </span>
          </div>
        </div>

        {/* Most recent achievement highlight */}
        {mostRecent && mostRecent.result.earned && (
          <div className="mt-3 pt-3 border-t border-borderSecondary">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-dream-400" />
              <span className="text-xs text-textTertiary">Latest:</span>
              <span className="text-xs font-medium text-textPrimary">{mostRecent.icon} {mostRecent.name}</span>
              {mostRecent.result.earnedDate && (
                <span className="text-[10px] text-textTertiary ml-auto">
                  {new Date(mostRecent.result.earnedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setActiveFilter('all')}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            activeFilter === 'all'
              ? 'bg-dream-500 text-white'
              : 'bg-bgTertiary text-textSecondary hover:text-textPrimary'
          )}
        >
          All
        </button>
        {ALL_CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          const catAchievements = byCategory[cat];
          const earnedCount = catAchievements.filter(a => a.result.earned).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                activeFilter === cat
                  ? 'bg-dream-500 text-white'
                  : 'bg-bgTertiary text-textSecondary hover:text-textPrimary'
              )}
            >
              {meta.icon} {meta.label.split(' ')[0]} ({earnedCount})
            </button>
          );
        })}
      </div>

      {/* Achievement Sections */}
      <div className="space-y-8">
        {categoriesToShow.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            achievements={byCategory[cat]}
            mostRecentId={mostRecentId}
          />
        ))}
      </div>
    </div>
  );
}
