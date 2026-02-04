'use client';

import { useState } from 'react';

// Body regions for the front and back views
const BODY_REGIONS = {
  front: [
    { id: 'left_quad', label: 'L Quad', x: 35, y: 45, width: 12, height: 18 },
    { id: 'right_quad', label: 'R Quad', x: 53, y: 45, width: 12, height: 18 },
    { id: 'left_shin', label: 'L Shin', x: 36, y: 65, width: 10, height: 15 },
    { id: 'right_shin', label: 'R Shin', x: 54, y: 65, width: 10, height: 15 },
    { id: 'left_knee', label: 'L Knee', x: 37, y: 58, width: 8, height: 8 },
    { id: 'right_knee', label: 'R Knee', x: 55, y: 58, width: 8, height: 8 },
    { id: 'left_ankle', label: 'L Ankle', x: 37, y: 82, width: 8, height: 6 },
    { id: 'right_ankle', label: 'R Ankle', x: 55, y: 82, width: 8, height: 6 },
    { id: 'left_foot', label: 'L Foot', x: 35, y: 88, width: 10, height: 8 },
    { id: 'right_foot', label: 'R Foot', x: 55, y: 88, width: 10, height: 8 },
    { id: 'left_hip', label: 'L Hip', x: 32, y: 38, width: 10, height: 8 },
    { id: 'right_hip', label: 'R Hip', x: 58, y: 38, width: 10, height: 8 },
  ],
  back: [
    { id: 'left_hamstring', label: 'L Hamstring', x: 35, y: 45, width: 12, height: 16 },
    { id: 'right_hamstring', label: 'R Hamstring', x: 53, y: 45, width: 12, height: 16 },
    { id: 'left_calf', label: 'L Calf', x: 36, y: 65, width: 10, height: 15 },
    { id: 'right_calf', label: 'R Calf', x: 54, y: 65, width: 10, height: 15 },
    { id: 'left_glute', label: 'L Glute', x: 35, y: 35, width: 12, height: 10 },
    { id: 'right_glute', label: 'R Glute', x: 53, y: 35, width: 12, height: 10 },
    { id: 'left_it_band', label: 'L IT Band', x: 28, y: 45, width: 6, height: 18 },
    { id: 'right_it_band', label: 'R IT Band', x: 66, y: 45, width: 6, height: 18 },
    { id: 'lower_back', label: 'Lower Back', x: 42, y: 28, width: 16, height: 10 },
    { id: 'upper_back', label: 'Upper Back', x: 40, y: 15, width: 20, height: 12 },
  ],
};

type BodyRegionId = string;
type Severity = 0 | 1 | 2 | 3;

interface SorenessMapProps {
  value: Record<BodyRegionId, Severity>;
  onChange: (value: Record<BodyRegionId, Severity>) => void;
  readonly?: boolean;
}

const SEVERITY_COLORS = {
  0: 'fill-stone-100 stroke-stone-300',
  1: 'fill-yellow-100 stroke-yellow-400',
  2: 'fill-orange-200 stroke-orange-500',
  3: 'fill-red-300 stroke-red-600',
};

const SEVERITY_LABELS = ['None', 'Mild', 'Moderate', 'Severe'];

export function SorenessMap({ value, onChange, readonly }: SorenessMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const [selectedRegion, setSelectedRegion] = useState<BodyRegionId | null>(null);

  const handleRegionClick = (regionId: BodyRegionId) => {
    if (readonly) return;
    setSelectedRegion(regionId);
  };

  const handleSeveritySelect = (severity: Severity) => {
    if (!selectedRegion) return;
    onChange({
      ...value,
      [selectedRegion]: severity,
    });
    setSelectedRegion(null);
  };

  const regions = BODY_REGIONS[view];

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setView('front')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'front'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView('back')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'back'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Back
        </button>
      </div>

      {/* Body Map */}
      <div className="relative bg-stone-50 rounded-xl p-4">
        <svg viewBox="0 0 100 100" className="w-full max-w-[250px] mx-auto">
          {/* Simple body outline */}
          <ellipse cx="50" cy="12" rx="8" ry="10" className="fill-stone-200 stroke-stone-300" />
          <rect x="40" y="20" width="20" height="25" rx="3" className="fill-stone-200 stroke-stone-300" />
          <rect x="30" y="40" width="40" height="20" rx="2" className="fill-stone-200 stroke-stone-300" />
          <rect x="32" y="58" width="16" height="35" rx="3" className="fill-stone-200 stroke-stone-300" />
          <rect x="52" y="58" width="16" height="35" rx="3" className="fill-stone-200 stroke-stone-300" />

          {/* Interactive regions */}
          {regions.map((region) => {
            const severity = value[region.id] || 0;
            const isSelected = selectedRegion === region.id;

            return (
              <g key={region.id}>
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx="2"
                  className={`${SEVERITY_COLORS[severity as Severity]} cursor-pointer transition-all ${
                    isSelected ? 'stroke-amber-500 stroke-2' : ''
                  } ${!readonly ? 'hover:opacity-80' : ''}`}
                  onClick={() => handleRegionClick(region.id)}
                />
              </g>
            );
          })}
        </svg>

        {/* Region labels - show on hover/touch */}
        <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-stone-500">
          Tap a region to mark soreness
        </div>
      </div>

      {/* Severity Selector */}
      {selectedRegion && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-lg">
          <p className="text-sm font-medium text-stone-700 mb-3">
            {BODY_REGIONS.front.find(r => r.id === selectedRegion)?.label ||
             BODY_REGIONS.back.find(r => r.id === selectedRegion)?.label}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((sev) => (
              <button
                key={sev}
                onClick={() => handleSeveritySelect(sev as Severity)}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  value[selectedRegion] === sev
                    ? 'ring-2 ring-amber-500'
                    : ''
                } ${
                  sev === 0
                    ? 'bg-stone-100 text-stone-600'
                    : sev === 1
                    ? 'bg-yellow-100 text-yellow-700'
                    : sev === 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {SEVERITY_LABELS[sev]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedRegion(null)}
            className="mt-3 w-full py-2 text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs">
        {SEVERITY_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div
              className={`w-3 h-3 rounded ${
                i === 0
                  ? 'bg-stone-100 border border-stone-300'
                  : i === 1
                  ? 'bg-yellow-100 border border-yellow-400'
                  : i === 2
                  ? 'bg-orange-200 border border-orange-500'
                  : 'bg-red-300 border border-red-600'
              }`}
            />
            <span className="text-stone-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Summary of marked regions */}
      {Object.entries(value).filter(([_, sev]) => sev > 0).length > 0 && (
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs font-medium text-stone-600 mb-2">Marked Areas:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(value)
              .filter(([_, sev]) => sev > 0)
              .map(([regionId, sev]) => {
                const region =
                  BODY_REGIONS.front.find((r) => r.id === regionId) ||
                  BODY_REGIONS.back.find((r) => r.id === regionId);
                return (
                  <span
                    key={regionId}
                    className={`text-xs px-2 py-1 rounded ${
                      sev === 1
                        ? 'bg-yellow-100 text-yellow-700'
                        : sev === 2
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {region?.label}: {SEVERITY_LABELS[sev as number]}
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
