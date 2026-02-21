'use client';

import { Skeleton } from '@/components/Skeleton';

export default function PerformanceLoading() {
  return (
    <div className="space-y-4">
      {/* Best efforts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
      {/* Pace curve */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
      {/* Pace trend */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
      {/* Economy + split tendency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
      </div>
    </div>
  );
}
