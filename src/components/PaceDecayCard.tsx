'use client';

import { useState } from 'react';
import { TrendingDown, TrendingUp, Activity, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaceDecayData {
  overallDecayRate: number | null;
  byDistance: {
    short: number | null;
    medium: number | null;
    long: number | null;
  };
  byType: {
    easy: number | null;
    tempo: number | null;
    interval: number | null;
    long_run: number | null;
  };
  insights: string[];
  recommendations: string[];
}

interface PaceDecayCardProps {
  data: PaceDecayData;
}

export function PaceDecayCard({ data }: PaceDecayCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDecayRate = (rate: number | null) => {
    if (rate === null) return 'No data';
    const perTenPercent = rate * 10;
    const sign = perTenPercent >= 0 ? '+' : '';
    return `${sign}${perTenPercent.toFixed(1)}s/mi`;
  };

  const getDecayIcon = (rate: number | null) => {
    if (rate === null) return null;
    const perTenPercent = rate * 10;

    if (perTenPercent < 2) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (perTenPercent < 5) {
      return <Activity className="w-4 h-4 text-blue-600" />;
    } else {
      return <TrendingDown className="w-4 h-4 text-orange-600" />;
    }
  };

  const getDecayLabel = (rate: number | null) => {
    if (rate === null) return 'No data';
    const perTenPercent = rate * 10;

    if (perTenPercent < 2) return 'Excellent';
    if (perTenPercent < 5) return 'Good';
    if (perTenPercent < 10) return 'Moderate';
    return 'High';
  };

  const hasData = data.overallDecayRate !== null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Pace Decay Analysis
        </h3>
        {hasData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-stone-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-500" />
            )}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {hasData ? (
          <>
            {/* Overall Decay Rate */}
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
              <div>
                <p className="text-sm text-stone-600">Overall Pace Decay</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {formatDecayRate(data.overallDecayRate)}
                  {getDecayIcon(data.overallDecayRate)}
                </p>
                <p className="text-xs text-stone-500 mt-1">per 10% of distance</p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  getDecayLabel(data.overallDecayRate) === 'Excellent' && "bg-green-100 text-green-700",
                  getDecayLabel(data.overallDecayRate) === 'Good' && "bg-blue-100 text-blue-700",
                  getDecayLabel(data.overallDecayRate) === 'Moderate' && "bg-orange-100 text-orange-700",
                  getDecayLabel(data.overallDecayRate) === 'High' && "bg-red-100 text-red-700"
                )}>
                  {getDecayLabel(data.overallDecayRate)}
                </span>
              </div>
            </div>

            {/* Key Insights */}
            {data.insights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-stone-700">Key Insights</h4>
                {data.insights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-stone-600">
                    <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded Details */}
            {expanded && (
              <>
                {/* By Distance */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-stone-700">By Run Distance</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-stone-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-stone-600 mb-1">Short (&lt;5mi)</p>
                      <p className="font-semibold flex items-center justify-center gap-1">
                        {formatDecayRate(data.byDistance.short)}
                        {getDecayIcon(data.byDistance.short)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-stone-600 mb-1">Medium (5-10mi)</p>
                      <p className="font-semibold flex items-center justify-center gap-1">
                        {formatDecayRate(data.byDistance.medium)}
                        {getDecayIcon(data.byDistance.medium)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-stone-600 mb-1">Long (&gt;10mi)</p>
                      <p className="font-semibold flex items-center justify-center gap-1">
                        {formatDecayRate(data.byDistance.long)}
                        {getDecayIcon(data.byDistance.long)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* By Workout Type */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-stone-700">By Workout Type</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-stone-50 p-3 rounded-lg">
                      <p className="text-xs text-stone-600 mb-1">Easy</p>
                      <p className="font-semibold flex items-center gap-1">
                        {formatDecayRate(data.byType.easy)}
                        {getDecayIcon(data.byType.easy)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-lg">
                      <p className="text-xs text-stone-600 mb-1">Tempo</p>
                      <p className="font-semibold flex items-center gap-1">
                        {formatDecayRate(data.byType.tempo)}
                        {getDecayIcon(data.byType.tempo)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-lg">
                      <p className="text-xs text-stone-600 mb-1">Interval</p>
                      <p className="font-semibold flex items-center gap-1">
                        {formatDecayRate(data.byType.interval)}
                        {getDecayIcon(data.byType.interval)}
                      </p>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-lg">
                      <p className="text-xs text-stone-600 mb-1">Long Run</p>
                      <p className="font-semibold flex items-center gap-1">
                        {formatDecayRate(data.byType.long_run)}
                        {getDecayIcon(data.byType.long_run)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {data.recommendations.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-medium text-stone-700">Recommendations</h4>
                    {data.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-stone-600">
                        <span className="text-indigo-600">•</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8 space-y-3">
            <Activity className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-stone-500">No pace data available</p>
            <p className="text-sm text-stone-400">
              Sync workouts with split data from Strava or Garmin to see pace decay analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
}