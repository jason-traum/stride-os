import { Skeleton } from '@/components/Skeleton';

export default function RacesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* Race cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-4 mt-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
