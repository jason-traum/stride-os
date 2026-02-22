import { Skeleton } from '@/components/Skeleton';

export default function LoadDashboardLoading() {
  return (
    <div className="space-y-4">
      {/* Intro card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* Status metric cards — 3-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* CTL/ATL/TSB chart placeholder */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded" />
      </div>

      {/* Mileage ramp + Daily TRIMP side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <Skeleton className="h-5 w-28 mb-4" />
          <Skeleton className="h-36 w-full rounded" />
        </div>
      </div>

      {/* Recovery model card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-5 w-36 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
