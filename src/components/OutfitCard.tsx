'use client';

import { useState } from 'react';
import type { OutfitRecommendation } from '@/lib/outfit';
import type { ClothingItem, WorkoutType } from '@/lib/schema';
import { Shirt, ThermometerSun, ChevronDown, ChevronUp, Wind, Droplets, Info, X } from 'lucide-react';

interface OutfitCardProps {
  recommendation: OutfitRecommendation;
  matchedItems?: {
    top: ClothingItem[];
    bottom: ClothingItem[];
    gloves: ClothingItem[];
    headwear: ClothingItem[];
    addOns: ClothingItem[];
  };
  weather: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    condition: string;
  };
  workoutType: WorkoutType;
  distance: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OutfitCard({ recommendation, matchedItems, weather, workoutType, distance }: OutfitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVTInfo, setShowVTInfo] = useState(false);
  const vt = recommendation.vt;

  // Get VT category description
  const getVTCategory = (temp: number): string => {
    if (temp < 20) return 'Bundle up - multiple warm layers needed';
    if (temp < 35) return 'Layer up - warm base with options';
    if (temp < 50) return 'Light layers - standard running gear';
    if (temp < 65) return 'Minimal layers - shorts weather approaching';
    return 'Minimal clothing - stay cool';
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shirt className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-stone-900">What to Wear</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVTInfo(true)}
              className="px-2 py-1 bg-orange-100 rounded-lg flex items-center gap-1 hover:bg-orange-200 transition-colors"
            >
              <span className="text-sm font-medium text-orange-700">
                VT {vt.vibesTemp}°
              </span>
              <Info className="w-3.5 h-3.5 text-orange-500" />
            </button>
          </div>
        </div>
      </div>

      {/* VT Info Modal */}
      {showVTInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowVTInfo(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">What is Vibes Temp?</h3>
              <button onClick={() => setShowVTInfo(false)} className="p-1 hover:bg-stone-100 rounded-full">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              Vibes Temp (VT) adjusts the &quot;feels like&quot; temperature based on your effort level,
              distance, and personal preference to give you better outfit recommendations.
            </p>
            <div className="bg-stone-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-stone-700 mb-2">Your VT: {vt.vibesTemp}°</p>
              <p className="text-xs text-stone-500">{vt.breakdown}</p>
            </div>
            <div className="space-y-2 text-xs text-stone-600">
              <p className="font-medium text-stone-700">VT Guide:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 p-2 rounded"><span className="font-medium">Below 20°</span><br/>Bundle up</div>
                <div className="bg-sky-50 p-2 rounded"><span className="font-medium">20-35°</span><br/>Layer up</div>
                <div className="bg-green-50 p-2 rounded"><span className="font-medium">35-50°</span><br/>Light layers</div>
                <div className="bg-orange-50 p-2 rounded"><span className="font-medium">50+°</span><br/>Minimal</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VT Breakdown */}
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-stone-600">
            <span className="flex items-center gap-1">
              <ThermometerSun className="w-4 h-4 text-stone-400" />
              Feels {weather.feelsLike}°F
            </span>
            <span className="flex items-center gap-1">
              <Droplets className="w-4 h-4 text-stone-400" />
              {weather.humidity}%
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-4 h-4 text-stone-400" />
              {weather.windSpeed} mph
            </span>
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          <span className="font-medium text-stone-600">{getVTCategory(vt.vibesTemp)}</span>
          {' • '}{vt.breakdown}
        </p>
      </div>

      {/* Quick Summary */}
      <div className="px-4 py-4">
        <div className="space-y-3">
          {/* Top */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Top</span>
              <p className="text-sm font-medium text-stone-900">{recommendation.top.recommendation}</p>
              {matchedItems && matchedItems.top.length > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  → {matchedItems.top.map(i => i.name).join(' or ')}
                </p>
              )}
            </div>
          </div>

          {/* Bottom */}
          <div>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Bottom</span>
            <p className="text-sm font-medium text-stone-900">{recommendation.bottom.recommendation}</p>
            {matchedItems && matchedItems.bottom.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                → {matchedItems.bottom.map(i => i.name).join(' or ')}
              </p>
            )}
          </div>

          {/* Accessories */}
          {(recommendation.gloves.categories.length > 0 || recommendation.headwear.categories.length > 0) && (
            <div className="flex gap-4">
              {recommendation.gloves.categories.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Gloves</span>
                  <p className="text-sm font-medium text-stone-900">{recommendation.gloves.recommendation}</p>
                </div>
              )}
              {vt.vibesTemp < 30 && (
                <div>
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Head</span>
                  <p className="text-sm font-medium text-stone-900">{recommendation.headwear.recommendation}</p>
                </div>
              )}
            </div>
          )}

          {/* Add-ons */}
          {(recommendation.addOns.shell || recommendation.addOns.buff) && (
            <div className="pt-2 border-t border-stone-100">
              <div className="flex flex-wrap gap-2">
                {recommendation.addOns.shell && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                    + Shell
                  </span>
                )}
                {recommendation.addOns.buff && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                    + Buff
                  </span>
                )}
              </div>
              {recommendation.addOns.notes.length > 0 && (
                <p className="text-xs text-stone-500 mt-1">
                  {recommendation.addOns.notes.join('. ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Warm-up Notes */}
        {recommendation.warmUpNotes.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Tips
            </button>
            {isExpanded && (
              <ul className="mt-2 space-y-1">
                {recommendation.warmUpNotes.map((note, i) => (
                  <li key={i} className="text-xs text-stone-500 flex items-start gap-1">
                    <span className="text-orange-400">•</span>
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
