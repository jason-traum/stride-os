'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { StravaSmartSync } from '@/components/StravaSmartSync';

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const stravaParam = searchParams.get('strava');
  const messageParam = searchParams.get('message');

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
            <h1 className="text-3xl font-bold text-primary">Strava & Integrations</h1>
            <p className="text-sm text-textSecondary">Connect services, sync activities, and manage integrations</p>
          </div>
        </div>

        {/* Main Content */}
        <StravaSmartSync
          showSuccess={stravaParam === 'success'}
          showError={stravaParam === 'error' ? (messageParam || 'Connection failed') : undefined}
        />
      </div>
    </div>
  );
}
