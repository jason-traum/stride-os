'use client';

import { Activity, Info, X } from 'lucide-react';
import { useState } from 'react';

interface PaceZone {
  name: string;
  pace: string;
  description: string;
  color: string;
}

interface VDOTGaugeProps {
  vdot: number | null;
  easyPaceSeconds?: number | null;
  tempoPaceSeconds?: number | null;
  thresholdPaceSeconds?: number | null;
  intervalPaceSeconds?: number | null;
  marathonPaceSeconds?: number | null;
  halfMarathonPaceSeconds?: number | null;
}

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// VDOT ranges: beginner ~30, recreational ~40, competitive ~50, elite ~60+
function getVDOTLevel(vdot: number): { label: string; color: string } {
  if (vdot >= 70) return { label: 'Elite', color: 'text-purple-600' };
  if (vdot >= 60) return { label: 'Highly Competitive', color: 'text-blue-600' };
  if (vdot >= 50) return { label: 'Competitive', color: 'text-green-600' };
  if (vdot >= 40) return { label: 'Recreational', color: 'text-orange-600' };
  if (vdot >= 30) return { label: 'Beginner', color: 'text-slate-600' };
  return { label: 'Just Starting', color: 'text-slate-500' };
}

export function VDOTGauge({
  vdot,
  easyPaceSeconds,
  tempoPaceSeconds,
  thresholdPaceSeconds,
  intervalPaceSeconds,
  marathonPaceSeconds,
  halfMarathonPaceSeconds,
}: VDOTGaugeProps) {
  const [showInfo, setShowInfo] = useState(false);

  if (!vdot) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 text-center">
        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">No VDOT calculated yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Complete onboarding or log a race result to calculate your VDOT and pace zones.
        </p>
      </div>
    );
  }

  const level = getVDOTLevel(vdot);

  // Calculate gauge position (VDOT 25-75 mapped to 0-100%)
  const gaugePercent = Math.max(0, Math.min(100, ((vdot - 25) / 50) * 100));

  const paceZones: PaceZone[] = [
    ...(easyPaceSeconds ? [{
      name: 'Easy',
      pace: formatPace(easyPaceSeconds),
      description: 'Conversational, recovery runs',
      color: 'bg-green-100 text-green-700',
    }] : []),
    ...(marathonPaceSeconds ? [{
      name: 'Marathon',
      pace: formatPace(marathonPaceSeconds),
      description: 'Marathon race pace',
      color: 'bg-blue-100 text-blue-700',
    }] : []),
    ...(halfMarathonPaceSeconds ? [{
      name: 'Half Marathon',
      pace: formatPace(halfMarathonPaceSeconds),
      description: 'Half marathon race pace',
      color: 'bg-cyan-100 text-cyan-700',
    }] : []),
    ...(tempoPaceSeconds ? [{
      name: 'Tempo',
      pace: formatPace(tempoPaceSeconds),
      description: 'Comfortably hard, sustainable',
      color: 'bg-orange-100 text-orange-700',
    }] : []),
    ...(thresholdPaceSeconds ? [{
      name: 'Threshold',
      pace: formatPace(thresholdPaceSeconds),
      description: 'Lactate threshold effort',
      color: 'bg-red-100 text-red-700',
    }] : []),
    ...(intervalPaceSeconds ? [{
      name: 'Interval',
      pace: formatPace(intervalPaceSeconds),
      description: 'VO2max training',
      color: 'bg-purple-100 text-purple-700',
    }] : []),
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-900">Fitness Level (VDOT)</h2>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
        >
          <Info className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* VDOT Gauge */}
      <div className="relative mb-6">
        {/* Arc background */}
        <div className="h-4 bg-gradient-to-r from-slate-200 via-green-200 via-blue-200 to-purple-200 rounded-full overflow-hidden">
          {/* Marker */}
          <div
            className="absolute top-0 w-1 h-6 bg-slate-900 rounded-full transform -translate-x-1/2 -translate-y-1"
            style={{ left: `${gaugePercent}%` }}
          />
        </div>
        {/* Scale labels */}
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          <span>25</span>
          <span>40</span>
          <span>55</span>
          <span>70</span>
        </div>
      </div>

      {/* VDOT Score */}
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-slate-900">{vdot.toFixed(1)}</div>
        <div className={`text-sm font-medium ${level.color}`}>{level.label}</div>
      </div>

      {/* Pace Zones */}
      {paceZones.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Your Pace Zones</h3>
          <div className="grid grid-cols-2 gap-2">
            {paceZones.map((zone) => (
              <div key={zone.name} className={`${zone.color} rounded-lg p-3`}>
                <div className="text-xs font-medium opacity-75">{zone.name}</div>
                <div className="text-lg font-bold">{zone.pace}/mi</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">What is VDOT?</h3>
              <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                VDOT is a measure of your running fitness developed by coach Jack Daniels.
                It&apos;s calculated from your race performances and helps determine your
                optimal training paces.
              </p>
              <p>
                A higher VDOT means faster pace zones. As you train and race, your VDOT
                will increase, reflecting your improved fitness.
              </p>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="font-medium text-slate-700 mb-2">VDOT Ranges:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>Just Starting:</span><span>25-29</span></div>
                  <div className="flex justify-between"><span>Beginner:</span><span>30-39</span></div>
                  <div className="flex justify-between"><span>Recreational:</span><span>40-49</span></div>
                  <div className="flex justify-between"><span>Competitive:</span><span>50-59</span></div>
                  <div className="flex justify-between"><span>Highly Competitive:</span><span>60-69</span></div>
                  <div className="flex justify-between"><span>Elite:</span><span>70+</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
