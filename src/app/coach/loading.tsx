import { Skeleton } from '@/components/Skeleton';

export default function CoachLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Chat messages skeleton */}
      <div className="space-y-4">
        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 max-w-[80%]">
            <Skeleton className="h-24 w-full rounded-2xl rounded-tl-md" />
          </div>
        </div>

        {/* User message */}
        <div className="flex gap-3 justify-end">
          <div className="max-w-[80%]">
            <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-md" />
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 max-w-[80%]">
            <Skeleton className="h-32 w-full rounded-2xl rounded-tl-md" />
          </div>
        </div>

        {/* User message */}
        <div className="flex gap-3 justify-end">
          <div className="max-w-[80%]">
            <Skeleton className="h-10 w-36 rounded-2xl rounded-tr-md" />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="mt-6 pt-4 border-t border-borderPrimary">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
