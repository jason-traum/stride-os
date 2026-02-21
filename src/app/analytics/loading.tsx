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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Skeleton className="w-3.5 h-3.5 rounded" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Volume Summary */}
      <div className="mb-4">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-bgSecondary rounded-lg border border-borderPrimary p-3 shadow-sm">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-5 w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Recovery / Load / Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-32" />
        ))}
      </div>

      {/* Weekly Mileage Chart */}
      <div className="mb-4">
        <SkeletonChart />
      </div>
    </div>
  );
}
