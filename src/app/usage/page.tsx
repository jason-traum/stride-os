'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ApiUsageStats } from '@/actions/api-usage';
import { Loader2, TrendingUp, DollarSign, Cpu } from 'lucide-react';

export default function UsagePage() {
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/usage?days=${days}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatTokens = (value: number) => {
    if (value > 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value > 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-dream-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p className="text-tertiary">Failed to load usage data.</p>
      </div>
    );
  }

  // Transform data for the chart
  const chartData = stats.daily.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: day.totalCost,
    requests: day.requestCount,
    opus: day.byModel['claude-opus-4-20250514']?.cost || 0,
    sonnet: day.byModel['claude-sonnet-4-5-20250929']?.cost || 0,
    haiku: day.byModel['claude-haiku-4-5-20251001']?.cost || 0,
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">API Usage</h1>
        <p className="text-textSecondary">Monitor your AI coach API usage and costs</p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setDays(7)}
          className={`px-4 py-2 rounded-lg ${days === 7 ? 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md' : 'bg-surface-2 text-secondary hover:bg-surface-2'}`}
        >
          7 days
        </button>
        <button
          onClick={() => setDays(30)}
          className={`px-4 py-2 rounded-lg ${days === 30 ? 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md' : 'bg-surface-2 text-secondary hover:bg-surface-2'}`}
        >
          30 days
        </button>
        <button
          onClick={() => setDays(90)}
          className={`px-4 py-2 rounded-lg ${days === 90 ? 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md' : 'bg-surface-2 text-secondary hover:bg-surface-2'}`}
        >
          90 days
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-1 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-secondary">Weekly Total</h3>
            <DollarSign className="w-5 h-5 text-dream-600" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(stats.weeklyTotal.cost)}</p>
          <p className="text-sm text-tertiary mt-1">
            {formatTokens(stats.weeklyTotal.tokens)} tokens • {stats.weeklyTotal.requests} requests
          </p>
        </div>

        <div className="bg-surface-1 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-secondary">Monthly Total</h3>
            <TrendingUp className="w-5 h-5 text-dream-600" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(stats.monthlyTotal.cost)}</p>
          <p className="text-sm text-tertiary mt-1">
            {formatTokens(stats.monthlyTotal.tokens)} tokens • {stats.monthlyTotal.requests} requests
          </p>
        </div>

        <div className="bg-surface-1 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-secondary">Average per Day</h3>
            <Cpu className="w-5 h-5 text-dream-600" />
          </div>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(stats.monthlyTotal.cost / 30)}
          </p>
          <p className="text-sm text-tertiary mt-1">
            ~{Math.round(stats.monthlyTotal.requests / 30)} requests/day
          </p>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div className="bg-surface-1 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Daily Usage</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Bar dataKey="opus" stackId="a" fill="#8b5cf6" name="Opus" />
            <Bar dataKey="sonnet" stackId="a" fill="#06b6d4" name="Sonnet" />
            <Bar dataKey="haiku" stackId="a" fill="#10b981" name="Haiku" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Model Breakdown */}
      <div className="bg-surface-1 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Model Usage Breakdown</h2>
        <div className="space-y-4">
          {Object.entries(
            stats.daily.reduce((acc, day) => {
              Object.entries(day.byModel).forEach(([model, data]) => {
                if (!acc[model]) {
                  acc[model] = { cost: 0, tokens: 0, requests: 0 };
                }
                acc[model].cost += data.cost;
                acc[model].tokens += data.tokens;
                acc[model].requests += data.requests;
              });
              return acc;
            }, {} as Record<string, { cost: number; tokens: number; requests: number }>)
          ).map(([model, data]) => (
            <div key={model} className="flex items-center justify-between p-4 bg-surface-1 rounded-lg">
              <div>
                <h3 className="font-medium text-primary">
                  {model.includes('opus') ? 'Claude Opus' :
                   model.includes('sonnet') ? 'Claude Sonnet' :
                   model.includes('haiku') ? 'Claude Haiku' : model}
                </h3>
                <p className="text-sm text-secondary">
                  {data.requests} requests • {formatTokens(data.tokens)} tokens
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">{formatCurrency(data.cost)}</p>
                <p className="text-sm text-secondary">
                  {((data.cost / stats.monthlyTotal.cost) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-950 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-300 mb-2">Cost Optimization Tips</h3>
        <ul className="space-y-2 text-blue-400">
          <li>• Use <code className="bg-blue-900 px-1 rounded">/model:haiku</code> for simple queries to save ~60x on costs</li>
          <li>• Claude automatically routes to cheaper models when appropriate</li>
          <li>• Complex analysis and plan generation require Opus for best results</li>
          <li>• The coach uses Sonnet by default for balanced cost/performance</li>
        </ul>
      </div>
    </div>
  );
}
