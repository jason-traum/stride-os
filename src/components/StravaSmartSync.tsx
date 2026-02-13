'use client';

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Unlink, Check, AlertCircle, ExternalLink, Loader2, Key, Zap, Database, Calendar, Clock, Download, GitCompare } from 'lucide-react';
import { disconnectStrava, syncStravaActivities, syncStravaLaps, setStravaAutoSync, type StravaConnectionStatus } from '@/actions/strava';
import { getStravaStatus } from '@/actions/strava-fix';
import { getStravaAuthUrl } from '@/lib/strava-client';
import { StravaConnectButton, StravaAttribution } from './StravaAttribution';
import { StravaManualConnect } from './StravaManualConnect';
import { connectStravaManual } from '@/actions/strava-manual';
import { backfillStravaIds, getMissingStravaIdStats, type BackfillResult } from '@/actions/backfill-strava';
import { format, subDays } from 'date-fns';
import { debugStravaBackfill } from '@/actions/strava-debug';

interface StravaSmartSyncProps {
  initialStatus?: StravaConnectionStatus;
  showSuccess?: boolean;
  showError?: string;
}

export function StravaSmartSync({ initialStatus, showSuccess, showError }: StravaSmartSyncProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<StravaConnectionStatus | null>(initialStatus || null);
  const [error, setError] = useState<string | null>(showError || null);
  const [success, setSuccess] = useState(showSuccess || false);
  const [useManualMode, setUseManualMode] = useState(false);

  // Sync states
  const [syncMode, setSyncMode] = useState<'sync' | 'backfill'>('sync');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [isSyncingLaps, setIsSyncingLaps] = useState(false);
  const [lapSyncResult, setLapSyncResult] = useState<{ synced: number } | null>(null);

  // Backfill states
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMissingStravaIdStats>> | null>(null);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [sliderValue, setSliderValue] = useState(7);
  const [debugInfo, setDebugInfo] = useState<Awaited<ReturnType<typeof debugStravaBackfill>> | null>(null);
  const [forceRematch, setForceRematch] = useState(false);

  // Calculate days from slider (reused from backfill)
  const calculateDays = (value: number): number => {
    if (value <= 30) return value;
    else if (value <= 42) {
      const monthIndex = value - 30;
      return 30 * (monthIndex + 1);
    } else {
      const index = value - 42;
      return 30 * (15 + (index * 3));
    }
  };

  const getDaysFromSlider = (): number => calculateDays(sliderValue);

  const getDateRangeDisplay = (): { days: number; startDate: string; label: string } => {
    const days = getDaysFromSlider();
    const startDate = format(subDays(new Date(), days), 'MMM d, yyyy');
    let label: string;
    if (days <= 30) {
      label = `${days} day${days > 1 ? 's' : ''}`;
    } else if (days <= 365) {
      const months = Math.round(days / 30);
      label = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.round(days / 365 * 10) / 10;
      label = `${years} year${years > 1 ? 's' : ''}`;
    }
    return { days, startDate, label };
  };

  // Fetch status on mount
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
    try {
      const redirectUri = `${window.location.origin}/api/strava/callback`;
      const authUrl = getStravaAuthUrl(redirectUri);
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to connect to Strava:', err);
      setError(err.message || 'Failed to connect to Strava');
    }
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

    const days = getDaysFromSlider();
    const since = new Date();
    since.setDate(since.getDate() - days);

    startTransition(async () => {
      const result = await syncStravaActivities({ since: since.toISOString() });
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

  const checkStats = async () => {
    setChecking(true);
    try {
      const s = await getMissingStravaIdStats();
      setStats(s);
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
    setChecking(false);
  };

  const runBackfill = async (dryRun: boolean) => {
    setLoading(true);
    setBackfillResult(null);
    const days = getDaysFromSlider();

    try {
      const r = await backfillStravaIds({
        daysBack: days,
        dryRun,
        resyncExistingLaps: forceRematch
      });
      setBackfillResult(r);
      if (!dryRun && r.matched > 0) {
        await checkStats();
      }
    } catch (error) {
      setBackfillResult({
        matched: 0,
        lapsAdded: 0,
        errors: [`Failed: ${error}`],
        details: [],
      });
    }
    setLoading(false);
  };

  const { days, startDate, label } = getDateRangeDisplay();

  if (!status) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
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
        <div className="flex items-center gap-2 p-3 bg-slate-50 text-teal-700 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Imported {syncResult.imported} new {syncResult.imported === 1 ? 'activity' : 'activities'}
          {syncResult.skipped > 0 && `, ${syncResult.skipped} already imported`}
        </div>
      )}

      {/* Lap sync result */}
      {lapSyncResult && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 text-teal-700 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Synced lap data for {lapSyncResult.synced} {lapSyncResult.synced === 1 ? 'activity' : 'activities'}
        </div>
      )}

      {status.isConnected ? (
        /* Connected State */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zm-8.293-6.56l-2.536 5.024L2.026 11.384H.001L4.558 20.1l2.535-5.015 2.534 5.015 4.558-8.716h-2.026l-2.533 5.024-2.532-5.024z"/>
                </svg>
              </div>
              <div>
                <div className="font-medium text-stone-900">Strava Connected</div>
                <div className="text-xs text-stone-500">
                  {status.lastSyncAt
                    ? `Last synced: ${new Date(status.lastSyncAt).toLocaleDateString()}`
                    : 'Not synced yet'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSync(false)}
                disabled={isPending || isSyncing}
                className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                title="Sync recent activities"
              >
                <RefreshCw className={cn('w-5 h-5 text-[#FC4C02]', isSyncing && 'animate-spin')} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isPending}
                className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                title="Disconnect Strava"
              >
                <Unlink className="w-5 h-5 text-stone-500" />
              </button>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">Sync & Match Activities</h3>
              <div className="flex gap-1 p-1 bg-stone-100 rounded-lg">
                <button
                  onClick={() => setSyncMode('sync')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    syncMode === 'sync'
                      ? "bg-white shadow-sm text-[#FC4C02]"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  <Download className="w-4 h-4" />
                  Import
                </button>
                <button
                  onClick={() => setSyncMode('backfill')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    syncMode === 'backfill'
                      ? "bg-white shadow-sm text-[#FC4C02]"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  <GitCompare className="w-4 h-4" />
                  Match
                </button>
              </div>
            </div>

            {syncMode === 'sync' ? (
              /* Sync Mode */
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Import activities FROM Strava</strong> → Your training log
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Use this to download your runs from Strava into the app
                  </p>
                </div>

                {/* Auto-sync option */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-stone-700">Auto-sync new activities</div>
                    <div className="text-xs text-stone-500">Automatically import runs when you open the app</div>
                  </div>
                  <button
                    onClick={() => handleAutoSyncToggle(!status.autoSync)}
                    disabled={isPending}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors',
                      status.autoSync ? 'bg-[#FC4C02]' : 'bg-stone-300'
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

                {/* Time Range Slider - Same as backfill */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-stone-700">Import Range</label>
                    <div className="text-sm text-[#FC4C02] font-semibold">{label}</div>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="48"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-stone-300 via-stone-400 to-stone-500 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-stone-700 [&::-webkit-slider-thumb]:border-2
                      [&::-webkit-slider-thumb]:border-stone-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-stone-700 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-600
                      [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
                  />

                  <div className="mt-2 text-sm text-stone-600 bg-stone-50 rounded-lg p-2">
                    <Calendar className="w-4 h-4 text-stone-400 inline mr-1" />
                    Import activities from {startDate} to today
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-stone-500">Quick select:</span>
                  {[
                    { value: 7, label: '1 week' },
                    { value: 30, label: '1 month' },
                    { value: 33, label: '3 months' },
                    { value: 36, label: '6 months' },
                    { value: 42, label: '1 year' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setSliderValue(preset.value)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        sliderValue === preset.value
                          ? 'bg-[#FC4C02] text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Sync button */}
                <button
                  onClick={handleSync}
                  disabled={isPending || isSyncing}
                  className="w-full px-4 py-3 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Import {label} of Activities
                    </>
                  )}
                </button>

                <button
                  onClick={handleSyncLaps}
                  disabled={isPending || isSyncingLaps}
                  className="text-sm text-[#FC4C02] hover:text-[#E34402] font-medium flex items-center gap-1"
                >
                  {isSyncingLaps && <Loader2 className="w-3 h-3 animate-spin" />}
                  Sync lap data for existing activities
                </button>
              </div>
            ) : (
              /* Backfill Mode */
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Match existing workouts</strong> to Strava activities
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Use this to link manual entries with their Strava counterparts and fetch lap data
                  </p>
                </div>

                {/* Stats */}
                {stats ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-stone-50 rounded-lg p-3">
                      <p className="text-stone-500 text-xs">With Strava ID</p>
                      <p className="text-lg font-semibold text-stone-900">{stats.withStravaId}</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-3">
                      <p className="text-stone-500 text-xs">Missing Strava ID</p>
                      <p className="text-lg font-semibold text-[#FC4C02]">{stats.withoutStravaId}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={checkStats}
                    disabled={checking}
                    className="w-full px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
                  >
                    {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Check Status
                  </button>
                )}

                {/* Time Range Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-stone-700">Time Range</label>
                    <div className="text-sm text-[#FC4C02] font-semibold">{label}</div>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="48"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-stone-300 via-stone-400 to-stone-500 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-stone-700 [&::-webkit-slider-thumb]:border-2
                      [&::-webkit-slider-thumb]:border-stone-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-stone-700 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-600
                      [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
                  />

                  <div className="mt-2 text-sm text-stone-600 bg-stone-50 rounded-lg p-2">
                    <Calendar className="w-4 h-4 text-stone-400 inline mr-1" />
                    {startDate} to today
                  </div>
                </div>

                {/* Force rematch option */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="forceRematch"
                    checked={forceRematch}
                    onChange={(e) => setForceRematch(e.target.checked)}
                    className="w-4 h-4 text-[#FC4C02] border-stone-300 rounded focus:ring-[#FC4C02]"
                  />
                  <label htmlFor="forceRematch" className="text-sm text-stone-700">
                    Force rematch (ignore existing Strava IDs)
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => runBackfill(true)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Preview ({days} days)
                  </button>
                  <button
                    onClick={() => runBackfill(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FC4C02] rounded-lg hover:bg-[#E34402] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                    Run Match
                  </button>
                </div>

                {/* Backfill Results */}
                {backfillResult && (
                  <div className={`p-3 rounded-lg ${backfillResult.errors.length > 0 ? 'bg-rose-50' : 'bg-teal-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {backfillResult.errors.length > 0 ? (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Check className="w-4 h-4 text-teal-600" />
                      )}
                      <span className={`text-sm font-medium ${backfillResult.errors.length > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                        {backfillResult.matched} matched, {backfillResult.lapsAdded} laps added
                      </span>
                    </div>

                    {backfillResult.errors.length > 0 && (
                      <div className="text-xs text-rose-600 space-y-1">
                        {backfillResult.errors.map((e, i) => (
                          <p key={i}>{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Debug section */}
                <div className="p-3 bg-amber-50 rounded-lg">
                  <button
                    onClick={async () => {
                      const debug = await debugStravaBackfill(getDaysFromSlider());
                      setDebugInfo(debug);
                    }}
                    className="text-sm text-amber-700 font-medium hover:underline"
                  >
                    🐛 Debug: Why no matches?
                  </button>

                  {debugInfo && (
                    <div className="mt-3 text-xs text-amber-800 space-y-1">
                      <p>Total workouts: {debugInfo.totalWorkouts}</p>
                      <p className="font-semibold">Without Strava ID: {debugInfo.withoutStravaId}</p>
                      <p>{debugInfo.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Disconnected State */
        <div className="space-y-4">
          {/* Connection Mode Toggle */}
          <div className="flex items-center justify-center gap-4 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setUseManualMode(false)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                !useManualMode
                  ? "bg-white shadow text-[#FC4C02] font-medium"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              <Zap className="w-4 h-4" />
              Quick Connect
            </button>
            <button
              onClick={() => setUseManualMode(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                useManualMode
                  ? "bg-white shadow text-[#FC4C02] font-medium"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              <Key className="w-4 h-4" />
              Manual API Keys
            </button>
          </div>

          {useManualMode ? (
            <StravaManualConnect
              onConnect={async (credentials) => {
                const result = await connectStravaManual(credentials);
                if (result.success) {
                  setStatus({ isConnected: true, autoSync: true });
                  setSuccess(true);
                  return true;
                } else {
                  setError(result.error || 'Failed to connect');
                  return false;
                }
              }}
            />
          ) : (
            <>
              <div className="w-full">
                <StravaConnectButton />
              </div>

              {/* Manual instructions if button fails */}
              <div className="text-sm text-stone-600 space-y-1">
                <p>Having trouble? Make sure:</p>
                <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                  <li>Pop-up blockers are disabled</li>
                  <li>You're logged into Strava</li>
                  <li>Or try the Manual API Keys option above</li>
                </ul>
              </div>
            </>
          )}

          <div className="mt-3 pt-3 border-t border-stone-100">
            <a
              href="/strava-manual-setup"
              className="text-sm text-[#FC4C02] hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View detailed setup guide
            </a>
          </div>

          <StravaAttribution className="justify-center" />
        </div>
      )}
    </div>
  );
}