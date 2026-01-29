'use client';

import { useState, useEffect } from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, CloudFog, Zap, Wind, Droplets,
  Thermometer, Timer, ArrowRight, AlertTriangle, Shirt, ThermometerSun,
  ChevronDown, ChevronUp, Info, X
} from 'lucide-react';
import type { WeatherData } from '@/lib/weather';
import type { ConditionsSeverity } from '@/lib/conditions';
import type { OutfitRecommendation } from '@/lib/outfit';
import type { ClothingItem, WorkoutType } from '@/lib/schema';
import { workoutTypes } from '@/lib/schema';
import { getSeverityColor, getSeverityLabel, calculatePaceAdjustment, parsePaceToSeconds } from '@/lib/conditions';
import { cn } from '@/lib/utils';

interface DailyConditionsCardProps {
  weather: WeatherData;
  severity: ConditionsSeverity;
  outfitRecommendation?: {
    recommendation: OutfitRecommendation;
    matchedItems?: {
      top: ClothingItem[];
      bottom: ClothingItem[];
      gloves: ClothingItem[];
      headwear: ClothingItem[];
      addOns: ClothingItem[];
    };
  } | null;
  acclimatizationScore: number;
  defaultPaceSeconds?: number;
  runWindowLabel?: string | null;
  runWindowTime?: string | null;
  isLiveWeather?: boolean;
  workoutType?: WorkoutType;
  distance?: number;
}

export function DailyConditionsCard({
  weather,
  severity,
  outfitRecommendation,
  acclimatizationScore,
  defaultPaceSeconds,
  runWindowLabel,
  runWindowTime,
  isLiveWeather = true,
  workoutType: initialWorkoutType = 'easy',
  distance = 5,
}: DailyConditionsCardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pace' | 'outfit'>('overview');
  const [paceInput, setPaceInput] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>(initialWorkoutType);
  const [paceSeconds, setPaceSeconds] = useState<number | null>(null);
  const [showVTInfo, setShowVTInfo] = useState(false);
  const [showOutfitTips, setShowOutfitTips] = useState(false);

  const WeatherIcon = getWeatherIcon(weather.condition);

  // Get day name for header
  const getDayName = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Format run window label with day name
  const getFormattedRunWindowLabel = () => {
    if (!runWindowLabel) return null;
    if (isLiveWeather) return runWindowLabel;

    // Replace "This Morning" with "Thursday Morning", etc.
    const dayName = getDayName();
    if (runWindowLabel.includes('Morning')) {
      return `${dayName} Morning`;
    }
    if (runWindowLabel.includes('Evening')) {
      return `${dayName} Evening`;
    }
    if (runWindowLabel.includes('Afternoon')) {
      return `${dayName} Afternoon`;
    }
    return `${dayName} ${runWindowLabel}`;
  };

  // Initialize with default pace
  useEffect(() => {
    if (defaultPaceSeconds && !paceInput) {
      const minutes = Math.floor(defaultPaceSeconds / 60);
      const seconds = defaultPaceSeconds % 60;
      setPaceInput(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      setPaceSeconds(defaultPaceSeconds);
    }
  }, [defaultPaceSeconds, paceInput]);

  const handlePaceChange = (value: string) => {
    setPaceInput(value);
    const parsed = parsePaceToSeconds(value);
    if (parsed !== null) {
      setPaceSeconds(parsed);
    }
  };

  const paceAdjustment = paceSeconds
    ? calculatePaceAdjustment(paceSeconds, severity, workoutType, acclimatizationScore)
    : null;

  const vt = outfitRecommendation?.recommendation.vt;
  const recommendation = outfitRecommendation?.recommendation;
  const matchedItems = outfitRecommendation?.matchedItems;

  const getVTCategory = (temp: number): string => {
    if (temp < 20) return 'Bundle up - multiple warm layers needed';
    if (temp < 35) return 'Layer up - warm base with options';
    if (temp < 50) return 'Light layers - standard running gear';
    if (temp < 65) return 'Minimal layers - shorts weather approaching';
    return 'Minimal clothing - stay cool';
  };

  // Determine which sections to show prominently based on conditions
  const isHot = weather.feelsLike >= 70 || (severity.heatIndex && severity.heatIndex >= 80);
  const isCold = weather.feelsLike <= 45;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <WeatherIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Daily Conditions</h3>
              <p className={cn(
                'text-xs',
                isLiveWeather ? 'text-green-600' : 'text-blue-600'
              )}>
                {isLiveWeather ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {runWindowLabel || 'Live'}
                  </span>
                ) : (
                  <>Forecast for {getFormattedRunWindowLabel()}</>
                )}
              </p>
            </div>
          </div>
          <div className={cn('px-3 py-1 rounded-full text-sm font-medium', getSeverityColor(severity.severityScore))}>
            {getSeverityLabel(severity.severityScore)}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{weather.temperature}°</p>
              <p className="text-xs text-slate-500">Actual</p>
            </div>
            <div className="text-center border-l border-slate-200 pl-3">
              <p className="text-2xl font-bold text-slate-700">{weather.feelsLike}°</p>
              <p className="text-xs text-slate-500">Feels Like</p>
            </div>
            {vt && (
              <div className="text-center border-l border-slate-200 pl-3">
                <p className="text-2xl font-bold text-orange-600">{vt.vibesTemp}°</p>
                <p className="text-xs text-slate-500">Vibes Temp</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-slate-400" />
              {weather.humidity}%
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-slate-400" />
              {weather.windSpeed} mph
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('pace')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'pace'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
            isHot && 'text-orange-600'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Timer className="w-4 h-4" />
            Pace {isHot && <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('outfit')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'outfit'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
            isCold && 'text-purple-600'
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Shirt className="w-4 h-4" />
            Outfit {isCold && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Conditions Description */}
            <div>
              <p className="text-sm text-slate-700">{severity.description}</p>
              {severity.heatIndex && severity.heatIndex > weather.temperature && (
                <p className="text-xs text-orange-600 mt-2">
                  Heat Index: {severity.heatIndex}°F
                </p>
              )}
            </div>

            {/* Quick Recommendations */}
            <div className="grid grid-cols-2 gap-3">
              {/* Pace Summary */}
              {paceAdjustment && (
                <button
                  onClick={() => setActiveTab('pace')}
                  className="p-3 bg-slate-50 rounded-lg text-left hover:bg-slate-100 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-500 mb-1">Pace Adjustment</p>
                  <p className="text-lg font-bold text-blue-600">{paceAdjustment.adjustedPace}</p>
                  {paceAdjustment.adjustmentSeconds > 0 && (
                    <p className="text-xs text-slate-500">+{paceAdjustment.adjustmentSeconds}s/mi</p>
                  )}
                </button>
              )}

              {/* Outfit Summary */}
              {recommendation && (
                <button
                  onClick={() => setActiveTab('outfit')}
                  className="p-3 bg-slate-50 rounded-lg text-left hover:bg-slate-100 transition-colors"
                >
                  <p className="text-xs font-medium text-slate-500 mb-1">What to Wear</p>
                  <p className="text-sm font-medium text-slate-900 line-clamp-2">
                    {recommendation.top.recommendation}
                  </p>
                </button>
              )}
            </div>

            {/* Key Warnings */}
            {paceAdjustment && paceAdjustment.warnings.length > 0 && (
              <div className="space-y-2">
                {paceAdjustment.warnings.slice(0, 1).map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-orange-600 bg-orange-50 p-2 rounded-lg">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{warning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pace Tab */}
        {activeTab === 'pace' && (
          <div className="space-y-4">
            {/* Inputs Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Pace</label>
                <input
                  type="text"
                  value={paceInput}
                  onChange={(e) => handlePaceChange(e.target.value)}
                  placeholder="7:00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-medium"
                />
                <p className="text-xs text-slate-500 mt-1 text-center">min:sec /mile</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Workout Type</label>
                <select
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {workoutTypes.filter(t => t !== 'cross_train' && t !== 'other').map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Adjustment Display */}
            {paceAdjustment && (
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Target</p>
                    <p className="text-2xl font-bold text-slate-400">{paceAdjustment.originalPace}</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-slate-300" />
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Adjusted</p>
                    <p className="text-3xl font-bold text-blue-600">{paceAdjustment.adjustedPace}</p>
                  </div>
                </div>

                {paceAdjustment.adjustmentSeconds > 0 && (
                  <p className="text-sm text-slate-600 text-center mb-3">
                    +{paceAdjustment.adjustmentSeconds} sec/mile due to {paceAdjustment.reason.toLowerCase()}
                  </p>
                )}

                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-sm text-slate-700">{paceAdjustment.recommendation}</p>
                </div>

                {paceAdjustment.warnings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {paceAdjustment.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2 text-orange-600">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!paceSeconds && (
              <p className="text-sm text-slate-500 text-center">
                Enter your target pace (e.g., 8:00) to see the adjusted pace
              </p>
            )}
          </div>
        )}

        {/* Outfit Tab */}
        {activeTab === 'outfit' && recommendation && vt && (
          <div className="space-y-4">
            {/* VT Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-600">Dress for </span>
                <span className="text-lg font-bold text-orange-600">{vt.vibesTemp}°F</span>
                <span className="text-sm text-slate-600"> (Vibes Temp)</span>
              </div>
              <button
                onClick={() => setShowVTInfo(true)}
                className="p-1.5 hover:bg-slate-100 rounded-full"
              >
                <Info className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-500">{vt.breakdown}</p>

            {/* Outfit Recommendations */}
            <div className="space-y-3">
              {/* Top */}
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top</span>
                <p className="text-sm font-medium text-slate-900">{recommendation.top.recommendation}</p>
                {matchedItems && matchedItems.top.length > 0 && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    → {matchedItems.top.map(i => i.name).join(' or ')}
                  </p>
                )}
              </div>

              {/* Bottom */}
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bottom</span>
                <p className="text-sm font-medium text-slate-900">{recommendation.bottom.recommendation}</p>
                {matchedItems && matchedItems.bottom.length > 0 && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    → {matchedItems.bottom.map(i => i.name).join(' or ')}
                  </p>
                )}
              </div>

              {/* Accessories */}
              {(recommendation.gloves.categories.length > 0 || recommendation.headwear.categories.length > 0) && (
                <div className="flex gap-4">
                  {recommendation.gloves.categories.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Gloves</span>
                      <p className="text-sm font-medium text-slate-900">{recommendation.gloves.recommendation}</p>
                    </div>
                  )}
                  {vt.vibesTemp < 30 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Head</span>
                      <p className="text-sm font-medium text-slate-900">{recommendation.headwear.recommendation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Add-ons */}
              {(recommendation.addOns.shell || recommendation.addOns.buff) && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {recommendation.addOns.shell && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        + Shell
                      </span>
                    )}
                    {recommendation.addOns.buff && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                        + Buff
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            {recommendation.warmUpNotes.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowOutfitTips(!showOutfitTips)}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                >
                  {showOutfitTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Tips
                </button>
                {showOutfitTips && (
                  <ul className="mt-2 space-y-1">
                    {recommendation.warmUpNotes.map((note, i) => (
                      <li key={i} className="text-xs text-slate-500 flex items-start gap-1">
                        <span className="text-orange-400">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'outfit' && !recommendation && (
          <p className="text-sm text-slate-500 text-center py-4">
            Outfit recommendations not available
          </p>
        )}
      </div>

      {/* VT Info Modal */}
      {showVTInfo && vt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowVTInfo(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">What is Vibes Temp?</h3>
              <button onClick={() => setShowVTInfo(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Vibes Temp (VT) is the temperature you should &quot;dress like you&apos;re going on a casual walk&quot; in.
              Running generates significant body heat, so VT accounts for how much warmer you&apos;ll feel.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Your VT: {vt.vibesTemp}°</p>
              <p className="text-xs text-slate-500">{vt.breakdown}</p>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <p className="font-medium text-slate-700">VT Guide:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 p-2 rounded"><span className="font-medium">Below 20°</span><br/>Bundle up</div>
                <div className="bg-sky-50 p-2 rounded"><span className="font-medium">20-35°</span><br/>Layer up</div>
                <div className="bg-green-50 p-2 rounded"><span className="font-medium">35-50°</span><br/>Light layers</div>
                <div className="bg-orange-50 p-2 rounded"><span className="font-medium">50+°</span><br/>Minimal</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getWeatherIcon(condition: string) {
  switch (condition) {
    case 'clear':
      return Sun;
    case 'cloudy':
      return Cloud;
    case 'rain':
    case 'drizzle':
      return CloudRain;
    case 'snow':
      return CloudSnow;
    case 'fog':
      return CloudFog;
    case 'thunderstorm':
      return Zap;
    default:
      return Cloud;
  }
}
