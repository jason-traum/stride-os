'use client';

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Unlink, Check, AlertCircle, ExternalLink, Loader2, Key, HelpCircle } from 'lucide-react';
import {
  getIntervalsStatus,
  disconnectIntervals,
  syncIntervalsActivities,
  setIntervalsAutoSync,
  connectIntervals,
  type IntervalsConnectionStatus,
} from '@/actions/intervals';

interface IntervalsConnectProps {
  initialStatus?: IntervalsConnectionStatus;
}

export function IntervalsConnect({ initialStatus }: IntervalsConnectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<IntervalsConnectionStatus | null>(initialStatus || null);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Connection form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Fetch status on mount if not provided
  useEffect(() => {
    if (!initialStatus) {
      getIntervalsStatus().then(setStatus);
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
    if (!athleteId.trim() || !apiKey.trim()) {
      setError('Please enter both Athlete ID and API Key');
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await connectIntervals(athleteId.trim(), apiKey.trim());

      if (result.success) {
        setSuccess(true);
        setShowConnectForm(false);
        setAthleteId('');
        setApiKey('');

        // Refresh status
        const newStatus = await getIntervalsStatus();
        setStatus(newStatus);

        // Start initial sync
        syncIntervalsActivities().catch(console.error);
      } else {
        setError(result.error || 'Connection failed');
      }
    });
  };

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect Intervals.icu? Your synced workouts will remain.')) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectIntervals();
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
      const result = await syncIntervalsActivities();
      setIsSyncing(false);

      if (result.success) {
        setSyncResult({ imported: result.imported, skipped: result.skipped });
        const newStatus = await getIntervalsStatus();
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
      const result = await syncIntervalsActivities({ fullSync: true });
      setIsSyncing(false);

      if (result.success) {
        setSyncResult({ imported: result.imported, skipped: result.skipped });
        const newStatus = await getIntervalsStatus();
        setStatus(newStatus);
      } else {
        setError(result.error || 'Sync failed');
      }
    });
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    startTransition(async () => {
      const result = await setIntervalsAutoSync(enabled);
      if (result.success) {
        setStatus(prev => prev ? { ...prev, autoSync: enabled } : null);
      }
    });
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6 pt-6 border-t border-borderPrimary">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">i</span>
        </div>
        <span className="font-medium text-primary">Intervals.icu</span>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          {status.isConnected ? 'Intervals.icu connected successfully!' : 'Intervals.icu disconnected'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className="flex items-center gap-2 p-3 bg-surface-1 text-teal-700 dark:text-teal-300 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Synced {syncResult.imported} new {syncResult.imported === 1 ? 'activity' : 'activities'}
          {syncResult.skipped > 0 && `, ${syncResult.skipped} already imported`}
        </div>
      )}

      {status.isConnected ? (
        /* Connected State */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">i</span>
              </div>
              <div>
                <div className="font-medium text-primary">Intervals.icu Connected</div>
                <div className="text-xs text-textTertiary">
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
                className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                title="Sync new activities"
              >
                <RefreshCw className={cn('w-5 h-5 text-indigo-600', isSyncing && 'animate-spin')} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isPending}
                className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                title="Disconnect Intervals.icu"
              >
                <Unlink className="w-5 h-5 text-textTertiary" />
              </button>
            </div>
          </div>

          {/* Sync Options */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-textSecondary">Auto-sync new activities</div>
              <div className="text-xs text-textTertiary">Automatically import runs when you open the app</div>
            </div>
            <button
              onClick={() => handleAutoSyncToggle(!status.autoSync)}
              disabled={isPending}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                status.autoSync ? 'bg-indigo-500' : 'bg-bgTertiary'
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
          <button
            onClick={handleFullSync}
            disabled={isPending || isSyncing}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Full sync (last 12 months)
          </button>
        </div>
      ) : showConnectForm ? (
        /* Connection Form */
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <p className="text-sm text-textSecondary">
              Enter your Intervals.icu credentials to sync activities.
            </p>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-1 text-tertiary hover:text-textSecondary"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {showHelp && (
            <div className="p-3 bg-surface-1 rounded-lg text-sm text-textSecondary">
              <p className="font-medium mb-2">How to find your credentials:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Go to <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">intervals.icu/settings</a></li>
                <li>Your <strong>Athlete ID</strong> is shown at the top (e.g., &quot;i12345&quot;)</li>
                <li>Scroll to &quot;API Access&quot; and create an <strong>API Key</strong></li>
                <li>Copy both values and paste them below</li>
              </ol>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">
                Athlete ID
              </label>
              <input
                type="text"
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                placeholder="i12345"
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key"
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={isPending || !athleteId.trim() || !apiKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              Connect
            </button>
            <button
              onClick={() => {
                setShowConnectForm(false);
                setError(null);
              }}
              className="px-4 py-2 border border-strong text-textSecondary rounded-xl font-medium hover:bg-bgTertiary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State */
        <div>
          <button
            onClick={() => setShowConnectForm(true)}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="w-5 h-5 bg-bgSecondary/20 rounded flex items-center justify-center">
              <span className="text-xs font-bold">i</span>
            </div>
            Connect Intervals.icu
            <ExternalLink className="w-4 h-4" />
          </button>
          <p className="text-xs text-textTertiary mt-2 text-center">
            Sync activities and get advanced fitness metrics
          </p>
        </div>
      )}
    </div>
  );
}
