import { Skeleton } from '@/components/Skeleton';

export default function ReadinessLoading() {
  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Skeleton className="h-4 w-28 mb-3" />
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Two readiness cards side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Detailed card */}
        <div>
          <Skeleton className="h-5 w-32 mb-3" />
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-10 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-full mb-4 rounded-full" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Simple card */}
        <div>
          <Skeleton className="h-5 w-28 mb-3" />
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* Explanation cards */}
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm"
            >
              <Skeleton className="h-5 w-36 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
