import { Skeleton } from '@/components/Skeleton';

export default function WorkoutConfidenceLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-52 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Today's workout card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Confidence gauge card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="text-right">
            <Skeleton className="h-12 w-20 mb-1" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
      </div>

      {/* Factors — positive / negative */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((col) => (
          <div
            key={col}
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm"
          >
            <Skeleton className="h-5 w-36 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <Skeleton className="h-5 w-36 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
