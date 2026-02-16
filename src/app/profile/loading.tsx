import { Skeleton } from '@/components/Skeleton';

export default function ProfileLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />

      {/* Profile header */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>

      {/* Form sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm mb-4">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((field) => (
              <div key={field}>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
