'use client';

import { Skeleton } from '@/components/Skeleton';

export default function RacingLoading() {
  return (
    <div className="space-y-4">
      {/* Zone boundaries */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-40 w-full rounded" />
      </div>
      {/* Race predictor + goal calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
