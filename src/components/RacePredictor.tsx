'use client';

import { useState, useEffect } from 'react';
import { Timer, Target, Gauge, Loader2, Zap } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  getComprehensiveRacePredictions,
  getVDOTPaces,
  type MultiSignalPrediction,
} from '@/actions/race-predictor';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';

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
  const [result, setResult] = useState<MultiSignalPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getComprehensiveRacePredictions()
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load race predictions:', err);
        setError('Could not load race predictions');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-dream-500" />
          Race Predictions
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-dream-500" />
          Race Predictions
        </h2>
        <p className="text-sm text-rose-500">{error}</p>
      </div>
    );
  }

  if (!result || result.predictions.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-dream-500" />
          Race Predictions
        </h2>
        <p className="text-sm text-textTertiary">
          Complete some runs at standard distances to get race predictions.
        </p>
      </div>
    );
  }

  const fitnessLevel = result.vdot >= 70 ? 'Elite'
    : result.vdot >= 60 ? 'Highly Competitive'
    : result.vdot >= 55 ? 'Competitive'
    : result.vdot >= 50 ? 'Advanced'
    : result.vdot >= 45 ? 'Intermediate'
    : result.vdot >= 40 ? 'Developing'
    : result.vdot >= 35 ? 'Beginner'
    : 'Novice';

  const confidenceColors = {
    high: 'bg-bgTertiary text-textSecondary',
    medium: 'bg-surface-2 text-secondary',
    low: 'bg-bgTertiary text-textTertiary',
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Timer className="w-5 h-5 text-dream-500" />
          Race Predictions
        </h2>
        {result.vdot && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-textTertiary">VDOT</span>
            <span className="px-2 py-1 bg-dream-100 text-dream-700 rounded font-bold text-sm">
              {Math.round(result.vdot * 10) / 10}
            </span>
          </div>
        )}
      </div>

      {/* Fitness level badge */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-dream-100 to-slate-100 text-dream-700 rounded-lg text-sm font-medium">
          <Gauge className="w-4 h-4" />
          {fitnessLevel} Runner
        </span>
      </div>

      {/* Predictions table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
              <th className="pb-2 font-medium">Distance</th>
              <th className="pb-2 font-medium">Predicted</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium text-right">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {result.predictions.map((pred) => (
              <tr key={pred.distance} className="border-b border-borderSecondary">
                <td className="py-3">
                  <span className="font-medium text-primary">{pred.distance}</span>
                </td>
                <td className="py-3">
                  <span className="font-mono font-semibold text-primary">
                    {formatTime(pred.predictedSeconds)}
                  </span>
                </td>
                <td className="py-3 text-textSecondary">
                  {formatPace(pred.pacePerMile)}/mi
                </td>
                <td className="py-3 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[result.confidence]}`}>
                    {result.confidence}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Methodology note */}
      <p className="text-xs text-tertiary mt-4">
        {result.dataQuality.signalsUsed} signal{result.dataQuality.signalsUsed !== 1 ? 's' : ''} blended
        {result.formDescription ? ` · ${result.formDescription}` : ''}
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
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-rose-500" />
          Training Paces
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!paces) {
    return null;
  }

  const paceColors: Record<string, string> = {
    Easy: 'bg-sky-400',
    Steady: 'bg-sky-500',
    Marathon: 'bg-blue-500',
    Threshold: 'bg-violet-500',
    Interval: 'bg-red-500',
    Repetition: 'bg-rose-600',
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Zap className="w-5 h-5 text-rose-500" />
          Training Paces
        </h2>
        <span className="text-xs text-textTertiary">Based on VDOT {paces.vdot}</span>
      </div>

      <div className="space-y-3">
        {paces.paces.map((pace) => (
          <div key={pace.type} className="flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${paceColors[pace.type] || 'bg-surface-3'}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary">{pace.type}</span>
                <span className="font-mono text-textSecondary">{pace.paceRange}</span>
              </div>
              <p className="text-xs text-textTertiary">{pace.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary">
          Paces calculated using Jack Daniels&apos; VDOT running formula based on your race performances.
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
  const [goalHours, setGoalHours] = useState('');
  const [goalMinutes, setGoalMinutes] = useState('');
  const [goalSeconds, setGoalSeconds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    requiredVdot: number;
    currentVdot: number | null;
    gap: number | null;
    trainingPaces: { type: string; pace: string }[];
  } | null>(null);

  const distances = [
    { name: '1 Mile', meters: 1609, needsHours: false },
    { name: '5K', meters: 5000, needsHours: false },
    { name: '10K', meters: 10000, needsHours: false },
    { name: 'Half Marathon', meters: 21097, needsHours: true },
    { name: 'Marathon', meters: 42195, needsHours: true },
  ];

  const needsHours = distances.find(d => d.name === selectedDistance)?.needsHours ?? false;

  const calculate = async () => {
    setError(null);
    const hrs = parseInt(goalHours) || 0;
    const mins = parseInt(goalMinutes) || 0;
    const secs = parseInt(goalSeconds) || 0;
    const totalSeconds = hrs * 3600 + mins * 60 + secs;

    if (totalSeconds <= 0) {
      setError('Enter a goal time');
      return;
    }

    const dist = distances.find(d => d.name === selectedDistance);
    if (!dist) return;

    // Calculate required VDOT using canonical Daniels formula
    const requiredVdot = calculateVDOT(dist.meters, totalSeconds);

    // Calculate training paces using proper Daniels pace zones
    const paces = calculatePaceZones(requiredVdot);

    // Get current VDOT for comparison
    let currentVdot: number | null = null;
    try {
      setLoading(true);
      const predictions = await getComprehensiveRacePredictions();
      currentVdot = predictions?.vdot ? Math.round(predictions.vdot * 10) / 10 : null;
    } catch {
      // No current VDOT available
    } finally {
      setLoading(false);
    }

    setResult({
      requiredVdot,
      currentVdot,
      gap: currentVdot ? Math.round((requiredVdot - currentVdot) * 10) / 10 : null,
      trainingPaces: [
        { type: 'Easy', pace: formatPace(paces.easy) + '/mi' },
        { type: 'Marathon', pace: formatPace(paces.marathon) + '/mi' },
        { type: 'Tempo', pace: formatPace(paces.tempo) + '/mi' },
        { type: 'Threshold', pace: formatPace(paces.threshold) + '/mi' },
        { type: 'Interval', pace: formatPace(paces.interval) + '/mi' },
      ],
    });
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-emerald-500" />
        Goal Calculator
      </h2>

      <div className="space-y-4">
        {/* Distance selector */}
        <div>
          <label className="text-sm text-textSecondary block mb-1">Distance</label>
          <select
            value={selectedDistance}
            onChange={(e) => { setSelectedDistance(e.target.value); setResult(null); setError(null); }}
            className="w-full px-3 py-2 border border-borderPrimary rounded-lg bg-bgSecondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dream-500"
          >
            {distances.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Goal time input */}
        <div>
          <label className="text-sm text-textSecondary block mb-1">Goal Time</label>
          <div className="flex items-center gap-2">
            {needsHours && (
              <>
                <input
                  type="number"
                  min="0"
                  value={goalHours}
                  onChange={(e) => setGoalHours(e.target.value)}
                  placeholder="HH"
                  className="w-16 px-3 py-2 border border-borderPrimary rounded-lg bg-bgSecondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dream-500"
                />
                <span className="text-tertiary">:</span>
              </>
            )}
            <input
              type="number"
              min="0"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(e.target.value)}
              placeholder="MM"
              className="w-16 px-3 py-2 border border-borderPrimary rounded-lg bg-bgSecondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dream-500"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={goalSeconds}
              onChange={(e) => setGoalSeconds(e.target.value)}
              placeholder="SS"
              className="w-16 px-3 py-2 border border-borderPrimary rounded-lg bg-bgSecondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-dream-500"
            />
            <button
              onClick={calculate}
              disabled={loading}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              {loading ? 'Calculating...' : 'Calculate'}
            </button>
          </div>
          {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
        </div>

        {/* Results */}
        {result && (
          <div className="bg-bgTertiary rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-textSecondary">Required VDOT</span>
              <span className="font-bold text-emerald-600">{result.requiredVdot}</span>
            </div>

            {result.currentVdot && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-textSecondary">Your Current VDOT</span>
                  <span className="font-bold text-textSecondary">{result.currentVdot}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-textSecondary">Gap</span>
                  <span className={`font-bold ${result.gap && result.gap > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                    {result.gap && result.gap > 0 ? `+${result.gap.toFixed(1)} VDOT needed` : 'Goal achievable!'}
                  </span>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-borderPrimary">
              <p className="text-xs text-textTertiary mb-2">Training paces to achieve this goal:</p>
              <div className="space-y-1">
                {result.trainingPaces.map(p => (
                  <div key={p.type} className="flex justify-between text-sm">
                    <span className="text-textSecondary">{p.type}</span>
                    <span className="font-mono text-primary">{p.pace}</span>
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
