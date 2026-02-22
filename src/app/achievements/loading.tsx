import { Skeleton } from '@/components/Skeleton';

export default function AchievementsLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-44 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Achievement badge grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full mb-3" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
