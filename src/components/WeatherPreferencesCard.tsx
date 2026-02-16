'use client';

import { useState } from 'react';
import {
  Cloud,
  Thermometer,
  Droplets,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lightbulb,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeatherPreferenceAnalysis } from '@/lib/weather-preferences';

interface WeatherPreferencesCardProps {
  data: WeatherPreferenceAnalysis;
  variant?: 'full' | 'compact';
}

export function WeatherPreferencesCard({ data, variant = 'full' }: WeatherPreferencesCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-green-600 bg-green-950';
      case 'good': return 'text-blue-600 bg-blue-950';
      case 'average': return 'text-yellow-600 bg-yellow-950';
      case 'poor': return 'text-red-600 bg-red-950';
      default: return 'text-textSecondary bg-bgTertiary';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'preference': return <Award className="w-4 h-4 text-blue-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'tip': return <Lightbulb className="w-4 h-4 text-green-600" />;
      default: return <Cloud className="w-4 h-4 text-textSecondary" />;
    }
  };

  if (variant === 'compact') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Cloud className="w-4 h-4 text-dream-600" />
            Weather Preferences
          </h3>
          {data.insights.length > 0 && (
            <span className="text-xs text-textTertiary">
              {data.insights.length} insights
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-textSecondary flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              Ideal temp
            </span>
            <span className="font-medium text-primary">
              {data.optimalConditions.temperature.ideal}°F
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-textSecondary flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              Ideal humidity
            </span>
            <span className="font-medium text-primary">
              {data.optimalConditions.humidity.ideal}%
            </span>
          </div>
        </div>

        {data.insights.length > 0 && (
          <p className="text-xs text-textSecondary mt-3 line-clamp-2">
            {data.insights[0].message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Cloud className="w-5 h-5 text-dream-600" />
          Weather Performance Analysis
        </h3>
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

      {/* Optimal Conditions */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-textSecondary mb-3">Your Optimal Conditions</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-textSecondary">Temperature</span>
            </div>
            <p className="text-xl font-bold text-primary">
              {data.optimalConditions.temperature.ideal}°F
            </p>
            <p className="text-xs text-textTertiary">
              {data.optimalConditions.temperature.min}-{data.optimalConditions.temperature.max}°F range
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-textSecondary">Humidity</span>
            </div>
            <p className="text-xl font-bold text-primary">
              {data.optimalConditions.humidity.ideal}%
            </p>
            <p className="text-xs text-textTertiary">
              {data.optimalConditions.humidity.min}-{data.optimalConditions.humidity.max}% range
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-4 h-4 text-cyan-600" />
              <span className="text-xs text-textSecondary">Feels Like</span>
            </div>
            <p className="text-xl font-bold text-primary">
              {data.optimalConditions.apparentTemp.ideal}°F
            </p>
            <p className="text-xs text-textTertiary">
              {data.optimalConditions.apparentTemp.min}-{data.optimalConditions.apparentTemp.max}°F range
            </p>
          </div>
        </div>
      </div>

      {/* Performance by Conditions */}
      {data.performanceByConditions.length > 0 && (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-medium text-textSecondary">Performance by Conditions</h4>
          {data.performanceByConditions.slice(0, expanded ? undefined : 3).map((condition, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-bgTertiary rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  getPerformanceColor(condition.performance)
                )}>
                  {condition.performance}
                </span>
                <div>
                  <p className="text-sm font-medium text-primary">{condition.condition}</p>
                  <p className="text-xs text-textSecondary">{condition.sampleSize} workouts</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-primary flex items-center gap-1">
                  {condition.avgPaceAdjustment > 0 ? (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  )}
                  {Math.abs(condition.avgPaceAdjustment)}%
                </p>
                {condition.avgHRIncrease !== 0 && (
                  <p className="text-xs text-textSecondary">
                    {condition.avgHRIncrease > 0 ? '+' : ''}{condition.avgHRIncrease} bpm
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-textSecondary">Insights</h4>
          {data.insights.slice(0, expanded ? undefined : 2).map((insight, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {getInsightIcon(insight.type)}
              <span className="text-textSecondary">{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Impact Analysis (expanded view) */}
      {expanded && (
        <>
          {/* Temperature Impact */}
          {data.weatherImpact.temperature.length > 0 && (
            <div className="border-t border-borderSecondary pt-4 mb-4">
              <h4 className="text-sm font-medium text-textSecondary mb-3">Temperature Impact</h4>
              <div className="space-y-2">
                {data.weatherImpact.temperature.map((temp, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-textSecondary">{temp.range}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-textTertiary">{temp.workouts} runs</span>
                      <span className={cn(
                        "font-medium",
                        temp.impact > 10 ? "text-red-600" :
                        temp.impact < -10 ? "text-green-600" :
                        "text-primary"
                      )}>
                        {temp.impact > 0 ? '+' : ''}{temp.impact}s/mi
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best/Worst Workouts */}
          <div className="grid grid-cols-2 gap-4 border-t border-borderSecondary pt-4">
            {data.bestWorkouts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-textSecondary mb-2 text-green-300">
                  Best Weather Workouts
                </h4>
                <div className="space-y-1">
                  {data.bestWorkouts.map((workout, index) => (
                    <div key={index} className="text-xs text-textSecondary">
                      <span className="font-medium">{workout.temp}°F</span>
                      <span className="text-tertiary"> / </span>
                      <span>{workout.humidity}%</span>
                      <span className="text-green-600 ml-1">
                        ({workout.paceVsBaseline}% faster)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.worstWorkouts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-textSecondary mb-2 text-red-300">
                  Challenging Weather
                </h4>
                <div className="space-y-1">
                  {data.worstWorkouts.map((workout, index) => (
                    <div key={index} className="text-xs text-textSecondary">
                      <span className="font-medium">{workout.temp}°F</span>
                      <span className="text-tertiary"> / </span>
                      <span>{workout.humidity}%</span>
                      <span className="text-red-600 ml-1">
                        ({workout.paceVsBaseline}% slower)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}