import { Skeleton } from '@/components/Skeleton';

export default function RoutesLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-7 w-28 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Summary stats banner */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Route cards */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm"
          >
            {/* Route header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="text-center">
                  <Skeleton className="h-7 w-14 mx-auto mb-1" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
              ))}
            </div>

            {/* Progress chart placeholder */}
            <div className="bg-bgTertiary rounded-lg p-3">
              <Skeleton className="h-3 w-28 mb-2" />
              <div className="flex items-end gap-1 h-16">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <Skeleton key={j} className="flex-1 rounded-t h-full" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
