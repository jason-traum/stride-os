'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { StravaSmartSync } from '@/components/StravaSmartSync';

export default function StravaSyncPage() {
  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/settings"
            className="p-2 hover:bg-surface-interactive-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-textSecondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">Strava Sync Center</h1>
            <p className="text-sm text-textSecondary">Import activities and manage your Strava connection</p>
          </div>
        </div>

        {/* Main Content */}
        <StravaSmartSync />
      </div>
    </div>
  );
}