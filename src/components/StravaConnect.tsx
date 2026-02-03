'use client';

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Unlink, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { getStravaStatus, disconnectStrava, syncStravaActivities, syncStravaLaps, setStravaAutoSync, type StravaConnectionStatus } from '@/actions/strava';
import { getStravaAuthUrl } from '@/lib/strava';

interface StravaConnectProps {
  initialStatus?: StravaConnectionStatus;
  showSuccess?: boolean;
  showError?: string;
}

export function StravaConnect({ initialStatus, showSuccess, showError }: StravaConnectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<StravaConnectionStatus | null>(initialStatus || null);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [lapSyncResult, setLapSyncResult] = useState<{ synced: number } | null>(null);
  const [error, setError] = useState<string | null>(showError || null);
  const [success, setSuccess] = useState(showSuccess || false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingLaps, setIsSyncingLaps] = useState(false);

  // Fetch status on mount if not provided
  useEffect(() => {
    if (!initialStatus) {
      getStravaStatus().then(setStatus);
    }
  }, [initialStatus]);

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleConnect = () => {
    const redirectUri = `${window.location.origin}/api/strava/callback`;
    const authUrl = getStravaAuthUrl(redirectUri);
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect Strava? Your synced workouts will remain.')) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectStrava();
      if (result.success) {
        setStatus({ isConnected: false, autoSync: true });
        setSuccess(true);
      } else {
        setError(result.error || 'Failed to disconnect');
      }
    });
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    startTransition(async () => {
      const result = await syncStravaActivities();
      setIsSyncing(false);

      if (result.success) {
        setSyncResult({ imported: result.imported, skipped: result.skipped });
        // Refresh status
        const newStatus = await getStravaStatus();
        setStatus(newStatus);
      } else {
        setError(result.error || 'Sync failed');
      }
    });
  };

  const handleFullSync = () => {
    if (!confirm('This will sync all activities from the past year. Continue?')) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    startTransition(async () => {
      const result = await syncStravaActivities({ fullSync: true });
      setIsSyncing(false);

      if (result.success) {
        setSyncResult({ imported: result.imported, skipped: result.skipped });
        const newStatus = await getStravaStatus();
        setStatus(newStatus);
      } else {
        setError(result.error || 'Sync failed');
      }
    });
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    startTransition(async () => {
      const result = await setStravaAutoSync(enabled);
      if (result.success) {
        setStatus(prev => prev ? { ...prev, autoSync: enabled } : null);
      }
    });
  };

  const handleSyncLaps = () => {
    setIsSyncingLaps(true);
    setLapSyncResult(null);
    setError(null);

    startTransition(async () => {
      const result = await syncStravaLaps();
      setIsSyncingLaps(false);

      if (result.success) {
        setLapSyncResult({ synced: result.synced });
      } else {
        setError(result.error || 'Lap sync failed');
      }
    });
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          {status.isConnected ? 'Strava connected successfully!' : 'Strava disconnected'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Synced {syncResult.imported} new {syncResult.imported === 1 ? 'activity' : 'activities'}
          {syncResult.skipped > 0 && `, ${syncResult.skipped} already imported`}
        </div>
      )}

      {/* Lap sync result */}
      {lapSyncResult && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Synced lap data for {lapSyncResult.synced} {lapSyncResult.synced === 1 ? 'activity' : 'activities'}
        </div>
      )}

      {status.isConnected ? (
        /* Connected State */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zm-8.293-6.56l-2.536 5.024L2.026 11.384H.001L4.558 20.1l2.535-5.015 2.534 5.015 4.558-8.716h-2.026l-2.533 5.024-2.532-5.024z"/>
                </svg>
              </div>
              <div>
                <div className="font-medium text-slate-900">Strava Connected</div>
                <div className="text-xs text-slate-500">
                  {status.lastSyncAt
                    ? `Last synced: ${new Date(status.lastSyncAt).toLocaleDateString()}`
                    : 'Not synced yet'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={isPending || isSyncing}
                className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                title="Sync new activities"
              >
                <RefreshCw className={cn('w-5 h-5 text-orange-600', isSyncing && 'animate-spin')} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isPending}
                className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                title="Disconnect Strava"
              >
                <Unlink className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Sync Options */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Auto-sync new activities</div>
              <div className="text-xs text-slate-500">Automatically import runs when you open the app</div>
            </div>
            <button
              onClick={() => handleAutoSyncToggle(!status.autoSync)}
              disabled={isPending}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                status.autoSync ? 'bg-orange-500' : 'bg-slate-300'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  status.autoSync ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          {/* Full sync button */}
          <div className="flex gap-4">
            <button
              onClick={handleFullSync}
              disabled={isPending || isSyncing}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Full sync (last 12 months)
            </button>
            <button
              onClick={handleSyncLaps}
              disabled={isPending || isSyncingLaps}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              {isSyncingLaps && <Loader2 className="w-3 h-3 animate-spin" />}
              Sync lap data
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State */
        <div>
          <button
            onClick={handleConnect}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zm-8.293-6.56l-2.536 5.024L2.026 11.384H.001L4.558 20.1l2.535-5.015 2.534 5.015 4.558-8.716h-2.026l-2.533 5.024-2.532-5.024z"/>
            </svg>
            Connect with Strava
            <ExternalLink className="w-4 h-4" />
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Automatically sync your runs from Strava
          </p>
        </div>
      )}
    </div>
  );
}
