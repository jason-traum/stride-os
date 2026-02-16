'use client';

import { Skeleton } from '@/components/Skeleton';
import { SkeletonChart } from '@/components/charts/WeeklyMileageChart';
import { DreamySheep } from '@/components/DreamySheep';

export default function AnalyticsLoading() {
  return (
    <div>
      {/* Dreamy thinking sheep */}
      <div className="flex justify-center mb-4">
        <DreamySheep mood="thinking" size="md" />
      </div>

      <div className="mb-6">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      {/* Weekly Mileage Chart */}
      <div className="mb-6">
        <SkeletonChart />
      </div>

      {/* Workout Type Distribution */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm mb-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-8 w-full rounded-full mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Paces */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
