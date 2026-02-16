import { Skeleton, SkeletonText } from '@/components/Skeleton';

export default function WorkoutDetailLoading() {
  return (
    <div>
      {/* Back button */}
      <div className="mb-4">
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4">
            <Skeleton className="h-3 w-12 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Map placeholder */}
      <div className="mb-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>

      {/* Pace chart placeholder */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 mb-6">
        <Skeleton className="h-5 w-24 mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Splits */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4">
        <Skeleton className="h-5 w-16 mb-4" />
        <div className="space-y-3">
          <SkeletonText lines={5} />
        </div>
      </div>
    </div>
  );
}
