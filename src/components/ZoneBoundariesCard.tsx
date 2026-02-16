'use client';

import { useState, useEffect } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { getCurrentZoneBoundaries, type CurrentZoneBoundariesResult } from '@/actions/zone-boundaries';

export function ZoneBoundariesCard() {
  const [data, setData] = useState<CurrentZoneBoundariesResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentZoneBoundaries().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-dream-500" />
          Classifier Zones
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Layers className="w-5 h-5 text-dream-500" />
          Classifier Zones
        </h2>
        <span className="text-xs text-textTertiary">
          {data.vdot ? `Settings VDOT ${data.vdot}` : 'Manual paces'}
        </span>
      </div>

      <div className="space-y-3">
        {data.zones.map((zone) => (
          <div key={zone.zone} className="flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${zone.color}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary">{zone.zone}</span>
                <span className="font-mono text-textSecondary text-sm">{zone.paceRange}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary">
          These pace ranges determine how your splits are auto-categorized. Based on your VDOT in Settings, not the estimated VDOT from best efforts.
        </p>
      </div>
    </div>
  );
}
