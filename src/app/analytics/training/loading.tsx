'use client';

import { Skeleton } from '@/components/Skeleton';

export default function TrainingLoading() {
  return (
    <div className="space-y-4">
      {/* Weekly mileage + recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-36 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-44 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
      </div>
      {/* Two-column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
        </div>
      </div>
      {/* VDOT timeline */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm h-48" />
    </div>
  );
}
