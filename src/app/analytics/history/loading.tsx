'use client';

import { Skeleton } from '@/components/Skeleton';

export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      {/* Heatmap */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-28 w-full rounded" />
      </div>
      {/* Calendar + workout types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-64" />
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-64" />
      </div>
      {/* Rollup tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
      </div>
    </div>
  );
}
