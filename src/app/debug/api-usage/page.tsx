'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Cloud, Brain, RefreshCw, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

interface ApiStats {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgResponseTime: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  rateLimitHits: number;
}

interface ApiLog {
  id: number;
  service: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: string;
}

interface UsageData {
  period: { days: number; from: string; to: string };
  byService: Record<string, ApiStats>;
  dailyBreakdown: Record<string, Record<string, number>>;
  recentLogs: ApiLog[];
  totalCalls: number;
}

interface StravaRateLimit {
  last15Minutes: number;
  limit15Minutes: number;
  remaining15Minutes: number;
  todayCalls: number;
  dailyLimit: number;
  remainingDaily: number;
  rateLimitHits: number;
}

const serviceConfig = {
  strava: { name: 'Strava', icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50' },
  anthropic: { name: 'Claude AI', icon: Brain, color: 'text-dream-500', bg: 'bg-dream-500/10' },
  intervals: { name: 'Intervals.icu', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  open_meteo: { name: 'Weather', icon: Cloud, color: 'text-cyan-500', bg: 'bg-cyan-50' },
};

export default function ApiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [stravaLimits, setStravaLimits] = useState<StravaRateLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, limitsRes] = await Promise.all([
        fetch(`/api/debug/api-usage?days=${daysBack}`),
        fetch('/api/debug/api-usage/strava-limits'),
      ]);

      if (!usageRes.ok) throw new Error('Failed to fetch usage data');

      const usageData = await usageRes.json();
      setData(usageData);

      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        setStravaLimits(limitsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-bgTertiary flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bgTertiary p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-950 border border-red-800 rounded-xl p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error loading API usage data</span>
            </div>
            <p className="text-sm text-red-500 mt-2">{error}</p>
            <p className="text-xs text-red-400 mt-4">
              Make sure to run: <code className="bg-red-100 px-1 rounded">sqlite3 data/stride.db &quot;CREATE TABLE IF NOT EXISTS api_usage_logs ...&quot;</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bgTertiary p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">API Usage Dashboard</h1>
            <p className="text-sm text-textTertiary">Hidden debug page - track external API calls</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-dream-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Strava Rate Limit Status */}
        {stravaLimits && (
          <div className="bg-surface-1 rounded-xl border border-default p-5">
            <h2 className="font-semibold text-primary flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-orange-500" />
              Strava Rate Limits (Live)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-textTertiary">15-min Window</p>
                <p className="text-2xl font-bold text-primary">
                  {stravaLimits.last15Minutes}
                  <span className="text-sm font-normal text-tertiary">/{stravaLimits.limit15Minutes}</span>
                </p>
                <div className="mt-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stravaLimits.last15Minutes > 80 ? 'bg-red-500' : stravaLimits.last15Minutes > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${(stravaLimits.last15Minutes / stravaLimits.limit15Minutes) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-textTertiary">Remaining (15-min)</p>
                <p className={`text-2xl font-bold ${stravaLimits.remaining15Minutes < 20 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {stravaLimits.remaining15Minutes}
                </p>
              </div>
              <div>
                <p className="text-xs text-textTertiary">Today&apos;s Calls</p>
                <p className="text-2xl font-bold text-primary">
                  {stravaLimits.todayCalls}
                  <span className="text-sm font-normal text-tertiary">/{stravaLimits.dailyLimit}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-textTertiary">429 Errors (15-min)</p>
                <p className={`text-2xl font-bold ${stravaLimits.rateLimitHits > 0 ? 'text-red-600' : 'text-tertiary'}`}>
                  {stravaLimits.rateLimitHits}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data && Object.entries(serviceConfig).map(([key, config]) => {
            const stats = data.byService[key];
            const Icon = config.icon;
            const successRate = stats.totalCalls > 0 ? Math.round((stats.successCalls / stats.totalCalls) * 100) : 0;

            return (
              <div key={key} className="bg-surface-1 rounded-xl border border-default p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <h3 className="font-semibold text-primary">{config.name}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-textTertiary">Total Calls</span>
                    <span className="font-medium">{stats.totalCalls.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-textTertiary">Success Rate</span>
                    <span className={`font-medium ${successRate >= 95 ? 'text-emerald-600' : successRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                      {successRate}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-textTertiary">Avg Response</span>
                    <span className="font-medium">{stats.avgResponseTime}ms</span>
                  </div>
                  {stats.rateLimitHits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-500">Rate Limits</span>
                      <span className="font-medium text-red-600">{stats.rateLimitHits}</span>
                    </div>
                  )}
                  {key === 'anthropic' && stats.totalTokens > 0 && (
                    <>
                      <div className="border-t border-subtle pt-2 mt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-textTertiary">Total Tokens</span>
                          <span className="font-medium">{stats.totalTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-tertiary">
                          <span>In: {stats.inputTokens.toLocaleString()}</span>
                          <span>Out: {stats.outputTokens.toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily Chart */}
        {data && Object.keys(data.dailyBreakdown).length > 0 && (
          <div className="bg-surface-1 rounded-xl border border-default p-5">
            <h2 className="font-semibold text-primary mb-4">Daily API Calls</h2>
            <div className="flex items-end gap-1 h-32">
              {Object.entries(data.dailyBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-14)
                .map(([date, calls]) => {
                  const total = Object.values(calls).reduce((a, b) => a + b, 0);
                  const maxCalls = Math.max(
                    ...Object.values(data.dailyBreakdown).map(d => Object.values(d).reduce((a, b) => a + b, 0))
                  );
                  const height = maxCalls > 0 ? (total / maxCalls) * 100 : 0;

                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-dream-500 rounded-t transition-all hover:bg-dream-600"
                        style={{ height: `${Math.max(4, height)}%` }}
                        title={`${date}: ${total} calls`}
                      />
                      <span className="text-[9px] text-tertiary -rotate-45 origin-left">
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Recent Logs */}
        {data && data.recentLogs.length > 0 && (
          <div className="bg-surface-1 rounded-xl border border-default p-5">
            <h2 className="font-semibold text-primary mb-4">Recent API Calls</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-textTertiary border-b border-subtle">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Service</th>
                    <th className="pb-2 font-medium">Endpoint</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLogs.map((log) => {
                    const config = serviceConfig[log.service as keyof typeof serviceConfig];
                    return (
                      <tr key={log.id} className="border-b border-stone-50 hover:bg-bgTertiary">
                        <td className="py-2 text-textTertiary">
                          {new Date(log.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config?.bg} ${config?.color}`}>
                            {config?.name || log.service}
                          </span>
                        </td>
                        <td className="py-2 font-mono text-xs text-textSecondary max-w-48 truncate">
                          {log.method} {log.endpoint}
                        </td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.statusCode === 429
                                ? 'bg-red-100 text-red-300'
                                : log.statusCode && log.statusCode >= 200 && log.statusCode < 300
                                ? 'bg-emerald-100 text-emerald-700'
                                : log.errorMessage
                                ? 'bg-red-100 text-red-300'
                                : 'bg-stone-100 text-textSecondary'
                            }`}
                          >
                            {log.statusCode || (log.errorMessage ? 'ERR' : 'OK')}
                          </span>
                        </td>
                        <td className="py-2 text-textSecondary">
                          {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                        </td>
                        <td className="py-2 text-textSecondary">
                          {log.tokensUsed ? log.tokensUsed.toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data && data.totalCalls === 0 && (
          <div className="bg-surface-1 rounded-xl border border-default p-12 text-center">
            <Clock className="w-12 h-12 text-tertiary mx-auto mb-4" />
            <h3 className="font-semibold text-primary">No API calls logged yet</h3>
            <p className="text-sm text-textTertiary mt-1">
              API usage will appear here as you use the app
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
