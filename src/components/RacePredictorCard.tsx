'use client';

import { useState } from 'react';
import {
  Trophy,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Clock,
  TrendingUp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RacePrediction {
  distance: string;
  distanceMiles: number;
  predictedTime: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  basedOn: {
    type: 'recent_race' | 'workout' | 'vo2max' | 'training_pace';
    description: string;
    date?: string;
  };
  pacePerMile: string;
  comparisonToGoal?: {
    goalTime: number;
    difference: number;
    achievable: boolean;
  };
}

interface RacePredictorResult {
  predictions: RacePrediction[];
  vo2max: number | null;
  recentRacePerformance: {
    distance: string;
    time: number;
    date: string;
  } | null;
  fitnessIndicators: {
    weeklyMileage: number;
    longRunDistance: number;
    speedWorkFrequency: number;
    consistency: number;
  };
  recommendations: string[];
}

interface RacePredictorCardProps {
  data: RacePredictorResult;
  variant?: 'full' | 'compact';
}

export function RacePredictorCard({ data, variant = 'full' }: RacePredictorCardProps) {
  const [expandedDistance, setExpandedDistance] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.round((minutes % 1) * 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-950';
      case 'medium': return 'text-yellow-600 bg-yellow-950';
      case 'low': return 'text-orange-600 bg-orange-950';
      default: return 'text-textSecondary bg-bgTertiary';
    }
  };

  const getDistanceIcon = (distance: string) => {
    if (distance.includes('5K')) return '5K';
    if (distance.includes('10K')) return '10K';
    if (distance.includes('Half')) return 'HM';
    if (distance.includes('Marathon')) return 'M';
    return '--';
  };

  if (data.predictions.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-tertiary mx-auto mb-3" />
          <p className="text-textTertiary">Not enough data for predictions</p>
          <p className="text-sm text-tertiary mt-1">
            Log more workouts or a recent race to see predictions
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    const mainPrediction = data.predictions.find(p => p.comparisonToGoal) || data.predictions[0];

    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary">Race Predictions</h3>
          <Trophy className="w-4 h-4 text-yellow-500" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-textSecondary">{getDistanceIcon(mainPrediction.distance)}</span>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">
                {formatTime(mainPrediction.predictedTime)}
              </p>
              <p className="text-xs text-textTertiary">{mainPrediction.distance}</p>
            </div>
          </div>

          {mainPrediction.comparisonToGoal && (
            <div className={cn(
              "text-xs p-2 rounded-lg flex items-center gap-1",
              mainPrediction.comparisonToGoal.achievable
                ? "bg-green-950 text-green-300"
                : "bg-orange-950 text-orange-300"
            )}>
              {mainPrediction.comparisonToGoal.achievable ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              Goal: {formatTime(mainPrediction.comparisonToGoal.goalTime)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Race Predictions
        </h3>
        {data.vo2max && (
          <span className="text-sm text-textTertiary">
            VO₂ Max: {Math.round(data.vo2max)}
          </span>
        )}
      </div>

      {/* Predictions Grid */}
      <div className="grid gap-3 mb-4">
        {data.predictions.map((prediction) => (
          <div
            key={prediction.distance}
            className="border border-borderPrimary rounded-lg p-4 hover:border-accentTeal transition-colors cursor-pointer"
            onClick={() => setExpandedDistance(
              expandedDistance === prediction.distance ? null : prediction.distance
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-textSecondary">{getDistanceIcon(prediction.distance)}</span>
                <div>
                  <p className="font-semibold text-primary">{prediction.distance}</p>
                  <p className="text-sm text-textTertiary">{prediction.pacePerMile}/mi</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold text-primary">
                  {formatTime(prediction.predictedTime)}
                </p>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  getConfidenceColor(prediction.confidenceLevel)
                )}>
                  {prediction.confidenceLevel} confidence
                </span>
              </div>
            </div>

            {/* Goal Comparison */}
            {prediction.comparisonToGoal && (
              <div className="mt-3 pt-3 border-t border-borderSecondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-textSecondary">Goal</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatTime(prediction.comparisonToGoal.goalTime)}
                    </span>
                    {prediction.comparisonToGoal.achievable ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                <div className="mt-1">
                  <div className="h-2 bg-bgTertiary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        prediction.comparisonToGoal.achievable
                          ? "bg-green-500"
                          : "bg-orange-500"
                      )}
                      style={{
                        width: `${Math.min(100, (prediction.comparisonToGoal.goalTime / prediction.predictedTime) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Expanded Details */}
            {expandedDistance === prediction.distance && (
              <div className="mt-3 pt-3 border-t border-borderSecondary space-y-2">
                <div className="flex items-center gap-2 text-sm text-textSecondary">
                  <Zap className="w-4 h-4" />
                  <span>{prediction.basedOn.description}</span>
                  {prediction.basedOn.date && (
                    <span className="text-tertiary">
                      • {new Date(prediction.basedOn.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fitness Indicators */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between py-2 text-sm font-medium text-textSecondary hover:text-primary transition-colors"
      >
        <span>Fitness Indicators</span>
        {showDetails ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {showDetails && (
        <>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-bgTertiary rounded-lg p-3">
              <p className="text-xs text-textTertiary mb-1">Weekly Mileage</p>
              <p className="text-lg font-semibold text-primary">
                {Math.round(data.fitnessIndicators.weeklyMileage)} mi
              </p>
            </div>
            <div className="bg-bgTertiary rounded-lg p-3">
              <p className="text-xs text-textTertiary mb-1">Long Run</p>
              <p className="text-lg font-semibold text-primary">
                {data.fitnessIndicators.longRunDistance.toFixed(1)} mi
              </p>
            </div>
            <div className="bg-bgTertiary rounded-lg p-3">
              <p className="text-xs text-textTertiary mb-1">Speed Work</p>
              <p className="text-lg font-semibold text-primary">
                {Math.round(data.fitnessIndicators.speedWorkFrequency)}%
              </p>
            </div>
            <div className="bg-bgTertiary rounded-lg p-3">
              <p className="text-xs text-textTertiary mb-1">Consistency</p>
              <p className="text-lg font-semibold text-primary">
                {data.fitnessIndicators.consistency}%
              </p>
            </div>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-textSecondary">Recommendations</p>
              {data.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-textSecondary">
                  <TrendingUp className="w-4 h-4 text-dream-600 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}