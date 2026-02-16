import { Skeleton } from '@/components/Skeleton';

export default function SettingsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-28 mb-6" />

      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-borderPrimary p-4 shadow-sm bg-bgSecondary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded" />
                <div>
                  <Skeleton className="h-5 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
