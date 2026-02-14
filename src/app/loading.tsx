export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-bgTertiary rounded-lg" />
          <div className="h-4 w-32 bg-bgTertiary rounded mt-2" />
        </div>
        <div className="h-10 w-10 bg-bgTertiary rounded-full" />
      </div>

      {/* Main content skeleton */}
      <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
        <div className="h-6 w-40 bg-bgTertiary rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-bgTertiary rounded" />
          <div className="h-4 w-3/4 bg-bgTertiary rounded" />
          <div className="h-4 w-1/2 bg-bgTertiary rounded" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
          <div className="h-4 w-20 bg-bgTertiary rounded mb-2" />
          <div className="h-8 w-16 bg-bgTertiary rounded" />
        </div>
        <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
          <div className="h-4 w-20 bg-bgTertiary rounded mb-2" />
          <div className="h-8 w-16 bg-bgTertiary rounded" />
        </div>
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-bgTertiary rounded" />
                <div className="h-3 w-48 bg-bgTertiary rounded" />
              </div>
              <div className="h-8 w-16 bg-bgTertiary rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
