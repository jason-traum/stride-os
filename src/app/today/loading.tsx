'use client';

import { Skeleton, SkeletonText, SkeletonWeatherCard, SkeletonStatsCard } from '@/components/Skeleton';
import { DreamySheep } from '@/components/DreamySheep';

export default function TodayLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <DreamySheep mood="idle" size="sm" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-36" />
          </div>
        </div>
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>

      {/* Ask Coach Input */}
      <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>

      {/* Today's Workout Skeleton */}
      <div className="bg-surface-1 rounded-xl border-2 border-default shadow-sm overflow-hidden">
        <div className="bg-bgTertiary px-4 py-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="p-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <SkeletonText lines={2} className="mb-3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="flex-1 h-11 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Weather Card */}
      <SkeletonWeatherCard />

      {/* Log Run CTA */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Weekly Stats */}
      <SkeletonStatsCard />

      {/* Daily Tip */}
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <SkeletonText lines={2} />
      </div>

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
