'use client';

import { Skeleton } from '@/components/Skeleton';

export default function ProgressLoading() {
  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <Skeleton className="h-5 w-28 mb-3" />
            <Skeleton className="h-32 w-full rounded" />
          </div>
        ))}
      </div>
      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-32 w-full rounded" />
          </div>
        ))}
      </div>
      {/* Bottom rows */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-32" />
        ))}
      </div>
    </div>
  );
}
