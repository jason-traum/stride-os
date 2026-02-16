'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Trophy,
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PerformanceTrend } from '@/lib/performance-trends';

interface PerformanceTrendsCardProps {
  data: PerformanceTrend;
  variant?: 'full' | 'compact';
}

export function PerformanceTrendsCard({ data, variant = 'full' }: PerformanceTrendsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedChart, setSelectedChart] = useState<'mileage' | 'pace' | 'fitness'>('mileage');

  const getTrendIcon = (change: number) => {
    if (Math.abs(change) < 5) return <Minus className="w-4 h-4 text-textTertiary" />;
    return change > 0 ?
      <TrendingUp className="w-4 h-4 text-green-600" /> :
      <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const formatPace = (seconds: number) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case 'trophy': return <Trophy className="w-5 h-5 text-yellow-600" />;
      case 'trending-up': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'calendar': return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'activity': return <Activity className="w-5 h-5 text-dream-500" />;
      default: return <Trophy className="w-5 h-5 text-textSecondary" />;
    }
  };

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'positive': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  if (variant === 'compact') {
    const topMetrics = [
      {
        label: 'Mileage',
        current: data.metrics.mileage.current,
        change: data.metrics.mileage.change,
        unit: 'mi',
        positive: true
      },
      {
        label: 'Avg Pace',
        current: formatPace(data.metrics.avgPace.current),
        change: data.metrics.avgPace.change,
        unit: '',
        positive: true
      },
      {
        label: 'Consistency',
        current: data.metrics.consistency.current,
        change: data.metrics.consistency.change,
        unit: '%',
        positive: true
      }
    ];

    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:shadow-md transition-shadow">
        <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-dream-500" />
          Performance Trends ({data.period})
        </h3>

        <div className="space-y-2">
          {topMetrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-xs text-textSecondary">{metric.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  {metric.current}{metric.unit}
                </span>
                {getTrendIcon(metric.change * (metric.positive ? 1 : -1))}
                <span className={cn(
                  "text-xs",
                  Math.abs(metric.change) < 5 ? "text-textTertiary" :
                  metric.change > 0 ? (metric.positive ? "text-green-600" : "text-red-600") :
                  (metric.positive ? "text-red-600" : "text-green-600")
                )}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {data.achievements.length > 0 && (
          <div className="mt-3 pt-3 border-t border-borderSecondary">
            <p className="text-xs text-textSecondary">
              {data.achievements.length} achievement{data.achievements.length > 1 ? 's' : ''} earned!
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-dream-500" />
          Performance Trends
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={data.period}
            className="text-sm border border-borderPrimary rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-dream-500"
            disabled
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-surface-interactive-hover rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-textTertiary" />
            ) : (
              <ChevronDown className="w-5 h-5 text-textTertiary" />
            )}
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Total Mileage</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{data.metrics.mileage.current} mi</p>
            <div className="flex items-center gap-1">
              {getTrendIcon(data.metrics.mileage.change)}
              <span className={cn(
                "text-xs font-medium",
                Math.abs(data.metrics.mileage.change) < 5 ? "text-textTertiary" :
                data.metrics.mileage.change > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.metrics.mileage.change > 0 ? '+' : ''}{data.metrics.mileage.change}%
              </span>
            </div>
          </div>
          <p className="text-xs text-textTertiary mt-1">vs {data.metrics.mileage.previous} mi</p>
        </div>

        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Average Pace</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{formatPace(data.metrics.avgPace.current)}</p>
            <div className="flex items-center gap-1">
              {getTrendIcon(data.metrics.avgPace.change)}
              <span className={cn(
                "text-xs font-medium",
                Math.abs(data.metrics.avgPace.change) < 5 ? "text-textTertiary" :
                data.metrics.avgPace.change > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.metrics.avgPace.change > 0 ? '+' : ''}{data.metrics.avgPace.change}%
              </span>
            </div>
          </div>
          <p className="text-xs text-textTertiary mt-1">vs {formatPace(data.metrics.avgPace.previous)}</p>
        </div>

        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Consistency</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{data.metrics.consistency.current}%</p>
            <div className="flex items-center gap-1">
              {getTrendIcon(data.metrics.consistency.change)}
              <span className={cn(
                "text-xs font-medium",
                Math.abs(data.metrics.consistency.change) < 5 ? "text-textTertiary" :
                data.metrics.consistency.change > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.metrics.consistency.change > 0 ? '+' : ''}{data.metrics.consistency.change}
              </span>
            </div>
          </div>
          <p className="text-xs text-textTertiary mt-1">runs/week</p>
        </div>

        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Avg Distance</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{data.metrics.avgDistance.current} mi</p>
            <div className="flex items-center gap-1">
              {getTrendIcon(data.metrics.avgDistance.change)}
              <span className={cn(
                "text-xs font-medium",
                Math.abs(data.metrics.avgDistance.change) < 5 ? "text-textTertiary" :
                data.metrics.avgDistance.change > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.metrics.avgDistance.change > 0 ? '+' : ''}{data.metrics.avgDistance.change}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Workouts</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{data.metrics.workoutCount.current}</p>
            <div className="flex items-center gap-1">
              {getTrendIcon(data.metrics.workoutCount.change)}
              <span className={cn(
                "text-xs font-medium",
                Math.abs(data.metrics.workoutCount.change) < 5 ? "text-textTertiary" :
                data.metrics.workoutCount.change > 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.metrics.workoutCount.change > 0 ? '+' : ''}{data.metrics.workoutCount.change}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-bgTertiary rounded-lg p-3">
          <p className="text-xs text-textSecondary mb-1">Intensity</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-primary">{data.metrics.intensity.current}%</p>
            <div className="flex items-center gap-1">
              {data.metrics.intensity.change === 0 ? (
                <Minus className="w-4 h-4 text-textTertiary" />
              ) : (
                <span className={cn(
                  "text-xs font-medium",
                  data.metrics.intensity.current > 25 ? "text-yellow-600" : "text-green-600"
                )}>
                  {data.metrics.intensity.change > 0 ? '+' : ''}{data.metrics.intensity.change}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-textTertiary mt-1">hard efforts</p>
        </div>
      </div>

      {/* Achievements */}
      {data.achievements.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-textSecondary mb-2">Recent Achievements</h4>
          <div className="space-y-2">
            {data.achievements.slice(0, expanded ? undefined : 2).map((achievement, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg">
                {getAchievementIcon(achievement.icon)}
                <div className="flex-1">
                  <p className="font-medium text-primary text-sm">{achievement.title}</p>
                  <p className="text-xs text-textSecondary">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-textSecondary">Insights</h4>
          {data.insights.slice(0, expanded ? undefined : 2).map((insight, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {getInsightIcon(insight.category)}
              <div className="flex-1">
                <p className="text-textSecondary">{insight.message}</p>
                {insight.recommendation && (
                  <p className="text-xs text-textTertiary mt-1">{insight.recommendation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts (expanded view) */}
      {expanded && data.charts && (
        <div className="mt-4 pt-4 border-t border-borderSecondary">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSelectedChart('mileage')}
              className={cn(
                "px-3 py-1 text-sm rounded-lg transition-colors",
                selectedChart === 'mileage' ?
                  "bg-dream-900/40 text-dream-300" :
                  "bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover"
              )}
            >
              Mileage
            </button>
            <button
              onClick={() => setSelectedChart('pace')}
              className={cn(
                "px-3 py-1 text-sm rounded-lg transition-colors",
                selectedChart === 'pace' ?
                  "bg-dream-900/40 text-dream-300" :
                  "bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover"
              )}
            >
              Pace
            </button>
            <button
              onClick={() => setSelectedChart('fitness')}
              className={cn(
                "px-3 py-1 text-sm rounded-lg transition-colors",
                selectedChart === 'fitness' ?
                  "bg-dream-900/40 text-dream-300" :
                  "bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover"
              )}
            >
              Fitness
            </button>
          </div>

          {/* Simplified chart display */}
          <div className="bg-bgTertiary rounded-lg p-4 h-48 flex items-center justify-center text-textTertiary">
            <p className="text-sm">
              {selectedChart === 'mileage' && `${data.charts.mileageProgression.length} weeks of data`}
              {selectedChart === 'pace' && `${data.charts.paceProgression.length} workouts tracked`}
              {selectedChart === 'fitness' && `${data.charts.fitnessProgression.length} days of fitness data`}
            </p>
          </div>

          {/* Workout Distribution */}
          {data.charts.workoutDistribution.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-textSecondary mb-2">Workout Distribution</h4>
              <div className="space-y-2">
                {data.charts.workoutDistribution.map((type, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary">{type.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-bgTertiary rounded-full h-2">
                        <div
                          className="bg-dream-500 h-2 rounded-full"
                          style={{ width: `${type.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-textTertiary w-12 text-right">
                        {type.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}