'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { DreamySheep } from '@/components/DreamySheep';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <DreamySheep
            mood="confused"
            size="lg"
            withSpeechBubble="Baa-d news... I can't find that page! Let's get you back on track."
          />
        </div>

        <h1 className="text-5xl font-bold text-dream-400 mb-2 font-display">404</h1>

        <p className="text-textTertiary mb-8 text-sm">
          This trail doesn&apos;t exist. Maybe it was a dream?
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/today"
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-strong text-secondary rounded-xl font-medium hover:bg-bgTertiary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
