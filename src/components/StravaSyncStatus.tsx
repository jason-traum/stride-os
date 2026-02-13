'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { syncRecentActivities, testStravaConnection } from '@/actions/strava-sync';
import { formatDistanceToNow } from 'date-fns';

export function StravaSyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Test connection on mount
    testConnection();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setError(null);

    const result = await testStravaConnection();

    if (result.success) {
      setStatus(result);
    } else {
      setError(result.error || 'Connection test failed');
    }

    setTesting(false);
  };

  const syncRecent = async (days: number) => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    const result = await syncRecentActivities(days);

    if (result.success) {
      setSuccess(`Synced ${result.imported} new activities (${result.skipped} skipped)`);
      // Refresh status
      await testConnection();
    } else {
      setError(result.error || 'Sync failed');
    }

    setSyncing(false);
  };

  return (
    <div className="p-4 bg-bgSecondary rounded-lg border border-borderPrimary space-y-4">
      <h3 className="font-medium text-primary flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Strava Sync Status
      </h3>

      {/* Connection Status */}
      {testing ? (
        <div className="flex items-center gap-2 text-sm text-textSecondary">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Testing connection...
        </div>
      ) : status?.success ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connected as {status.athlete?.firstname} {status.athlete?.lastname}
          </div>
          {status.lastSync && (
            <div className="flex items-center gap-2 text-textSecondary">
              <Clock className="w-3 h-3" />
              Last sync: {formatDistanceToNow(new Date(status.lastSync), { addSuffix: true })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error || 'Not connected'}
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded text-sm">
          {success}
        </div>
      )}

      {/* Sync Actions */}
      {status?.success && (
        <div className="flex gap-2">
          <button
            onClick={() => syncRecent(1)}
            disabled={syncing}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded text-sm font-medium disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Today'}
          </button>
          <button
            onClick={() => syncRecent(7)}
            disabled={syncing}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded text-sm font-medium disabled:opacity-50"
          >
            Sync Week
          </button>
          <button
            onClick={() => syncRecent(30)}
            disabled={syncing}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded text-sm font-medium disabled:opacity-50"
          >
            Sync Month
          </button>
        </div>
      )}

      {/* Debug Info */}
      <details className="text-xs text-textSecondary">
        <summary className="cursor-pointer hover:text-primary">Debug Info</summary>
        <pre className="mt-2 p-2 bg-bgTertiary rounded overflow-auto">
{JSON.stringify({
  origin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
  clientId: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || 'NOT SET',
  nodeEnv: process.env.NODE_ENV,
  status: status,
}, null, 2)}
        </pre>
      </details>
    </div>
  );
}