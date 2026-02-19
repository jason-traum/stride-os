'use client';

import { useState } from 'react';
import {
  Sun,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Thermometer
} from 'lucide-react';
import { cn, formatPace } from '@/lib/utils';
import type { HeatAdaptationData } from '@/lib/heat-adaptation';

interface HeatAdaptationCardProps {
  data: HeatAdaptationData;
  variant?: 'full' | 'compact';
}

export function HeatAdaptationCard({ data, variant = 'full' }: HeatAdaptationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getTrendIcon = () => {
    switch (data.trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'maintaining': return <Minus className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Well Adapted';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Building';
    return 'Not Adapted';
  };

  const getHeatIndexColor = (temp: number) => {
    if (temp >= 90) return 'bg-red-500';
    if (temp >= 80) return 'bg-orange-500';
    if (temp >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (variant === 'compact') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Sun className="w-4 h-4 text-orange-500" />
            Heat Adaptation
          </h3>
          {getTrendIcon()}
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className={cn("text-2xl font-bold", getScoreColor(data.currentScore))}>
            {data.currentScore}%
          </span>
          <span className="text-sm text-textTertiary">{getScoreLabel(data.currentScore)}</span>
        </div>

        {data.recentHeatExposure.count > 0 && (
          <p className="text-xs text-textSecondary">
            {data.recentHeatExposure.count} heat runs in last 14 days
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Sun className="w-5 h-5 text-orange-500" />
          Heat Adaptation Tracker
        </h3>
        {data.adaptationHistory.length > 0 && (
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
        )}
      </div>

      {/* Main Score Display */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-textSecondary mb-1">Adaptation Score</p>
            <div className="flex items-baseline gap-3">
              <span className={cn("text-3xl font-bold", getScoreColor(data.currentScore))}>
                {data.currentScore}%
              </span>
              <span className="text-sm font-medium text-textSecondary">
                {getScoreLabel(data.currentScore)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            {getTrendIcon()}
            <span className="text-xs text-textSecondary mt-1 capitalize">
              {data.trend.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Exposure Stats */}
      {data.recentHeatExposure.count > 0 ? (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-bgTertiary rounded-lg">
            <Thermometer className="w-5 h-5 text-orange-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-primary">
              {data.recentHeatExposure.avgTemp}°F
            </p>
            <p className="text-xs text-textTertiary">Avg Temp</p>
          </div>
          <div className="text-center p-3 bg-bgTertiary rounded-lg">
            <Droplets className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-primary">
              {data.recentHeatExposure.avgHumidity}%
            </p>
            <p className="text-xs text-textTertiary">Avg Humidity</p>
          </div>
          <div className="text-center p-3 bg-bgTertiary rounded-lg">
            <Sun className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-primary">
              {data.recentHeatExposure.count}
            </p>
            <p className="text-xs text-textTertiary">Heat Runs</p>
          </div>
        </div>
      ) : (
        <div className="bg-bgTertiary rounded-lg p-4 mb-4 text-center">
          <AlertTriangle className="w-8 h-8 text-tertiary mx-auto mb-2" />
          <p className="text-sm text-textSecondary">No heat training detected</p>
          <p className="text-xs text-textTertiary mt-1">
            Run in temperatures above 70°F to track adaptation
          </p>
        </div>
      )}

      {/* Heat Index Gauge */}
      {data.heatIndex.current > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-textSecondary mb-2">Current Heat Index</p>
          <div className="relative h-3 bg-bgTertiary rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute h-full transition-all duration-500",
                getHeatIndexColor(data.heatIndex.current)
              )}
              style={{ width: `${Math.min(100, (data.heatIndex.current / 100) * 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-2">
              <span className="text-xs text-textSecondary">Safe</span>
              <span className="text-xs text-textSecondary">Caution</span>
              <span className="text-xs text-textSecondary">Danger</span>
            </div>
          </div>
          <p className="text-xs text-textTertiary mt-1">
            Current: {data.heatIndex.current}°F | Safe Max: {data.heatIndex.safeMax}°F
          </p>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-textSecondary">Recommendations</p>
        {data.recommendations.map((rec, index) => (
          <div key={index} className="flex items-start gap-2 text-sm text-textSecondary">
            <span className="text-orange-500">•</span>
            <span>{rec}</span>
          </div>
        ))}
      </div>

      {/* Expanded History */}
      {expanded && data.adaptationHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-borderSecondary">
          <p className="text-sm font-medium text-textSecondary mb-3">Recent Heat Runs</p>
          <div className="space-y-2">
            {data.adaptationHistory.slice(0, 5).map((run, index) => (
              <div
                key={index}
                className="bg-bgTertiary rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-primary">
                    {new Date(run.date).toLocaleDateString()}
                  </span>
                  <span className="text-textSecondary">
                    {run.duration} min @ {formatPace(run.avgPace)}/mi
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-textTertiary">
                  <span>{run.temp}°F actual</span>
                  <span>{run.apparentTemp}°F feels like</span>
                  <span>{run.humidity}% humidity</span>
                  {run.paceAdjustment > 0 && (
                    <span className="text-orange-600">
                      +{run.paceAdjustment.toFixed(1)}% slower
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}