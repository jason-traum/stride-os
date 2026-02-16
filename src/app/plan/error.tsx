'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function PlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Plan error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-xl font-semibold text-textPrimary mb-2">
          Plan loading failed
        </h2>

        <p className="text-textTertiary mb-6">
          We couldn&apos;t load your training plan. This might be a temporary issue.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <Link
            href="/today"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-borderPrimary text-textSecondary rounded-xl font-medium hover:bg-bgTertiary transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
