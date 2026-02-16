import { Skeleton } from '@/components/Skeleton';

export default function ShoesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-36 mb-1.5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>
            <div className="mt-3">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-28 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
