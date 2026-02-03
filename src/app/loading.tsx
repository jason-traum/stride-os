export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-32 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-10 w-10 bg-slate-200 rounded-full" />
      </div>

      {/* Main content skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/2 bg-slate-100 rounded" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="h-4 w-20 bg-slate-100 rounded mb-2" />
          <div className="h-8 w-16 bg-slate-200 rounded" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="h-4 w-20 bg-slate-100 rounded mb-2" />
          <div className="h-8 w-16 bg-slate-200 rounded" />
        </div>
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
              <div className="h-8 w-16 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
