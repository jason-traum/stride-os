import { Skeleton } from '@/components/Skeleton';

export default function ReportLoading() {
  return (
    <div className="space-y-6">
      {/* Header with title + date picker + print button */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-20 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Bar chart placeholder */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="flex items-end gap-2 h-32">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex-1">
              <Skeleton
                className="w-full rounded-t"
                style={{ height: `${20 + Math.random() * 60}%` } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-6">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
