'use client';

import { useEffect } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { DreamySheep } from '@/components/DreamySheep';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <DreamySheep
            mood="angry"
            size="lg"
            withSpeechBubble="Something broke and I am NOT happy about it."
          />
        </div>

        <h2 className="text-xl font-semibold text-primary mb-2 font-display">
          Something went wrong
        </h2>

        <p className="text-textTertiary mb-6 text-sm">
          We hit an unexpected wall. Let&apos;s try shaking it off.
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-strong text-secondary rounded-xl font-medium hover:bg-bgTertiary transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-6 p-4 bg-surface-2 rounded-lg text-left">
            <p className="text-xs font-mono text-textTertiary break-all">
              {error.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
