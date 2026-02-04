'use client';

import { cn } from '@/lib/utils';

/**
 * Base Skeleton component with pulse animation
 * Building block for all skeleton variants
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-stone-200 rounded',
        className
      )}
    />
  );
}

/**
 * SkeletonText - For text line placeholders
 * Supports width variants for varied line lengths
 */
interface SkeletonTextProps {
  className?: string;
  width?: 'full' | 'lg' | 'md' | 'sm' | 'xs';
  lines?: number;
}

const widthClasses = {
  full: 'w-full',
  lg: 'w-3/4',
  md: 'w-1/2',
  sm: 'w-1/3',
  xs: 'w-1/4',
};

export function SkeletonText({ className, width = 'full', lines = 1 }: SkeletonTextProps) {
  if (lines === 1) {
    return (
      <Skeleton
        className={cn(
          'h-4',
          widthClasses[width],
          className
        )}
      />
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            // Last line is typically shorter
            i === lines - 1 ? 'w-2/3' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCircle - For avatars, icons, and circular elements
 */
interface SkeletonCircleProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const circleSizes = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
};

export function SkeletonCircle({ className, size = 'md' }: SkeletonCircleProps) {
  return (
    <Skeleton
      className={cn(
        'rounded-full',
        circleSizes[size],
        className
      )}
    />
  );
}

/**
 * SkeletonCard - Generic card loading state
 * Matches existing card styles (rounded-xl, border, shadow-sm)
 */
interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  lines?: number;
}

export function SkeletonCard({ className, hasHeader = true, lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {hasHeader && (
        <div className="px-4 py-3 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <SkeletonCircle size="md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

/**
 * SkeletonWeatherCard - Specific skeleton for DailyConditionsCard
 * Matches the layout: header with icon, quick stats row, tabs, content
 */
interface SkeletonWeatherCardProps {
  className?: string;
}

export function SkeletonWeatherCard({ className }: SkeletonWeatherCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header - matches DailyConditionsCard header style */}
      <div className="px-4 py-3 bg-gradient-to-r from-stone-100 to-stone-50 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Temperature displays */}
            <div className="text-center">
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="text-center border-l border-stone-200 pl-3">
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="text-center border-l border-stone-200 pl-3">
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-stone-200">
        <Skeleton className="flex-1 h-10 rounded-none" />
        <Skeleton className="flex-1 h-10 rounded-none bg-stone-100" />
        <Skeleton className="flex-1 h-10 rounded-none" />
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        <SkeletonText lines={2} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonWorkoutCard - For workout list items
 * Matches WorkoutCard layout with type badge, name, description, and stats
 */
interface SkeletonWorkoutCardProps {
  className?: string;
  compact?: boolean;
}

export function SkeletonWorkoutCard({ className, compact = false }: SkeletonWorkoutCardProps) {
  if (compact) {
    return (
      <div
        className={cn(
          'p-2 rounded-lg border border-stone-200 bg-stone-50',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-stone-200 bg-stone-50 overflow-hidden',
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Date placeholder */}
            <Skeleton className="h-3 w-24 mb-2" />
            {/* Status and title */}
            <div className="flex items-center gap-2 mb-2">
              <SkeletonCircle size="xs" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-10 rounded" />
            </div>
            {/* Description */}
            <SkeletonText lines={2} />
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <SkeletonCircle size="xs" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-1.5">
            <SkeletonCircle size="xs" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex items-center gap-1.5">
            <SkeletonCircle size="xs" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>

        {/* Expand button */}
        <Skeleton className="h-4 w-24 mt-3" />
      </div>
    </div>
  );
}

/**
 * SkeletonStatsCard - For stats/analytics cards
 * Matches WeeklyStatsCard layout with header, main stat, progress bar, and grid
 */
interface SkeletonStatsCardProps {
  className?: string;
}

export function SkeletonStatsCard({ className }: SkeletonStatsCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-stone-200 p-4 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-1">
          <SkeletonCircle size="xs" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Main stat */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Progress bar */}
        <Skeleton className="h-2 w-full rounded-full mb-1" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom stat */}
      <div className="mt-4 pt-3 border-t border-stone-100">
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}
