'use client';

import { useState, useEffect } from 'react';
import { Timer, Target, Gauge, Loader2, Trophy, Zap } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  getRacePredictions,
  getVDOTPaces,
  type RacePredictionResult,
} from '@/actions/race-predictor';

// Format seconds to time string
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Race Predictor Card - shows predicted race times
 */
export function RacePredictorCard() {
  const [result, setResult] = useState<RacePredictionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRacePredictions().then(data => {
      setResult(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-purple-500" />
          Race Predictions
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!result || result.predictions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-purple-500" />
          Race Predictions
        </h2>
        <p className="text-sm text-stone-500">
          Complete some runs at standard distances to get race predictions.
        </p>
      </div>
    );
  }

  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-slate-100 text-slate-800',
    low: 'bg-stone-100 text-stone-600',
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Timer className="w-5 h-5 text-purple-500" />
          Race Predictions
        </h2>
        {result.vdot && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">VDOT</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-bold text-sm">
              {result.vdot}
            </span>
          </div>
        )}
      </div>

      {/* Fitness level badge */}
      {result.fitnessLevel && result.fitnessLevel !== 'Unknown' && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-slate-100 text-purple-700 rounded-lg text-sm font-medium">
            <Gauge className="w-4 h-4" />
            {result.fitnessLevel} Runner
          </span>
        </div>
      )}

      {/* Predictions table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="pb-2 font-medium">Distance</th>
              <th className="pb-2 font-medium">Predicted</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium text-right">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {result.predictions.map((pred) => (
              <tr key={pred.distance} className="border-b border-stone-50">
                <td className="py-3">
                  <span className="font-medium text-stone-900">{pred.distance}</span>
                </td>
                <td className="py-3">
                  <span className="font-mono font-semibold text-stone-900">
                    {formatTime(pred.predictedTimeSeconds)}
                  </span>
                </td>
                <td className="py-3 text-stone-600">
                  {formatPace(pred.predictedPaceSeconds)}/mi
                </td>
                <td className="py-3 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[pred.confidence]}`}>
                    {pred.confidence}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Methodology note */}
      <p className="text-xs text-stone-400 mt-4">
        {result.methodology}
      </p>
    </div>
  );
}

/**
 * VDOT Training Paces Card
 */
export function VDOTPacesCard() {
  const [paces, setPaces] = useState<{
    vdot: number;
    paces: {
      type: string;
      description: string;
      paceRange: string;
      paceSecondsMin: number;
      paceSecondsMax: number;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVDOTPaces().then(data => {
      setPaces(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-rose-500" />
          Training Paces
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!paces) {
    return null;
  }

  const paceColors: Record<string, string> = {
    Easy: 'bg-green-500',
    Marathon: 'bg-teal-500',
    Threshold: 'bg-slate-400',
    Interval: 'bg-rose-400',
    Repetition: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-rose-500" />
          Training Paces
        </h2>
        <span className="text-xs text-stone-500">Based on VDOT {paces.vdot}</span>
      </div>

      <div className="space-y-3">
        {paces.paces.map((pace) => (
          <div key={pace.type} className="flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${paceColors[pace.type] || 'bg-stone-400'}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-900">{pace.type}</span>
                <span className="font-mono text-stone-700">{pace.paceRange}</span>
              </div>
              <p className="text-xs text-stone-500">{pace.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-stone-100">
        <p className="text-xs text-stone-500">
          Paces calculated using Jack Daniels' VDOT running formula based on your race performances.
        </p>
      </div>
    </div>
  );
}

/**
 * Goal Race Calculator - calculate needed training for a goal time
 */
export function GoalRaceCalculator() {
  const [selectedDistance, setSelectedDistance] = useState('5K');
  const [goalMinutes, setGoalMinutes] = useState('');
  const [goalSeconds, setGoalSeconds] = useState('');
  const [result, setResult] = useState<{
    requiredVdot: number;
    currentVdot: number | null;
    gap: number | null;
    trainingPaces: { type: string; pace: string }[];
  } | null>(null);

  const distances = [
    { name: '1 Mile', meters: 1609 },
    { name: '5K', meters: 5000 },
    { name: '10K', meters: 10000 },
    { name: 'Half Marathon', meters: 21097 },
    { name: 'Marathon', meters: 42195 },
    { name: '50K', meters: 50000 },
    { name: '50 Mile', meters: 80467 },
    { name: '100K', meters: 100000 },
    { name: '100 Mile', meters: 160934 },
  ];

  const calculate = async () => {
    const mins = parseInt(goalMinutes) || 0;
    const secs = parseInt(goalSeconds) || 0;
    const totalSeconds = mins * 60 + secs;

    if (totalSeconds <= 0) return;

    const dist = distances.find(d => d.name === selectedDistance);
    if (!dist) return;

    // Calculate required VDOT for this goal
    const velocity = dist.meters / (totalSeconds / 60);
    const time = totalSeconds / 60;
    const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * time) + 0.2989558 * Math.exp(-0.1932605 * time);
    const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
    const requiredVdot = Math.round((vo2 / percentVO2max) * 10) / 10;

    // Get current VDOT
    const predictions = await getRacePredictions();
    const currentVdot = predictions.vdot;

    // Calculate training paces for goal VDOT
    const easyPace = Math.round(29.54 + 5.000663 * Math.pow(86 - requiredVdot, 0.5) * 60);
    const thresholdPace = Math.round(29.54 + 5.000663 * Math.pow(83 - requiredVdot, 0.5) * 60);
    const intervalPace = Math.round(29.54 + 5.000663 * Math.pow(88 - requiredVdot, 0.5) * 60);

    setResult({
      requiredVdot,
      currentVdot,
      gap: currentVdot ? requiredVdot - currentVdot : null,
      trainingPaces: [
        { type: 'Easy', pace: formatPace(easyPace) + '/mi' },
        { type: 'Threshold', pace: formatPace(thresholdPace) + '/mi' },
        { type: 'Interval', pace: formatPace(intervalPace) + '/mi' },
      ],
    });
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-emerald-500" />
        Goal Calculator
      </h2>

      <div className="space-y-4">
        {/* Distance selector */}
        <div>
          <label className="text-sm text-stone-600 block mb-1">Distance</label>
          <select
            value={selectedDistance}
            onChange={(e) => setSelectedDistance(e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {distances.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Goal time input */}
        <div>
          <label className="text-sm text-stone-600 block mb-1">Goal Time</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(e.target.value)}
              placeholder="MM"
              className="w-20 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-stone-400">:</span>
            <input
              type="number"
              value={goalSeconds}
              onChange={(e) => setGoalSeconds(e.target.value)}
              placeholder="SS"
              className="w-20 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={calculate}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              Calculate
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-stone-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">Required VDOT</span>
              <span className="font-bold text-emerald-600">{result.requiredVdot}</span>
            </div>

            {result.currentVdot && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Your Current VDOT</span>
                  <span className="font-bold text-stone-700">{result.currentVdot}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">Gap</span>
                  <span className={`font-bold ${result.gap && result.gap > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                    {result.gap && result.gap > 0 ? `+${result.gap.toFixed(1)} needed` : 'Goal achievable!'}
                  </span>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-stone-200">
              <p className="text-xs text-stone-500 mb-2">Training paces to achieve this goal:</p>
              <div className="space-y-1">
                {result.trainingPaces.map(p => (
                  <div key={p.type} className="flex justify-between text-sm">
                    <span className="text-stone-600">{p.type}</span>
                    <span className="font-mono text-stone-900">{p.pace}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
