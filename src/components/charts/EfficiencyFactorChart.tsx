'use client';

import { useState, useMemo } from 'react';
import { type WorkoutSignalPoint } from '@/actions/prediction-dashboard';
import { cn } from '@/lib/utils';
import { TimeRangeSelector, TIME_RANGES_EXTENDED } from '@/components/shared/TimeRangeSelector';
import { WorkoutTypeFilter } from '@/components/shared/WorkoutTypeFilter';
import { filterByRange, filterOutliersIQR, computeDateLabels, getWorkoutColor } from '@/lib/chart-utils';

interface EfficiencyFactorChartProps {
  signalTimeline: WorkoutSignalPoint[];
}

export function EfficiencyFactorChart({ signalTimeline }: EfficiencyFactorChartProps) {
  const [range, setRange] = useState('6M');
  const rangeDays = TIME_RANGES_EXTENDED.find(r => r.label === range)!.days;
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const allEfPoints = useMemo(() => {
    return signalTimeline
      .filter(
        (s) =>
          s.efficiencyFactor != null &&
          s.isSteadyState &&
          s.distanceMiles >= 1 &&
          s.durationMinutes >= 20 &&
          (s.avgHr == null || s.avgHr >= 90)
      )
      .map((s) => ({
        date: s.date,
        ef: s.efficiencyFactor!,
        workoutType: s.workoutType,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

  const availableTypes = useMemo(() => {
    const types = new Set(allEfPoints.map(p => p.workoutType));
    return Array.from(types);
  }, [allEfPoints]);

  // Auto-init selectedTypes
  useMemo(() => {
    if (selectedTypes.size === 0 && availableTypes.length > 0) {
      setSelectedTypes(new Set(availableTypes));
    }
  }, [availableTypes, selectedTypes.size]);

  const efPoints = useMemo(() => {
    const ranged = filterByRange(allEfPoints, rangeDays);
    const typed = selectedTypes.size > 0
      ? ranged.filter(p => selectedTypes.has(p.workoutType))
      : ranged;
    return filterOutliersIQR(typed, p => p.ef);
  }, [allEfPoints, rangeDays, selectedTypes]);

  // Theil-Sen robust regression
  const regression = useMemo(() => {
    if (efPoints.length < 5) return null;

    const firstDate = new Date(efPoints[0].date + 'T12:00:00Z').getTime();
    const xs = efPoints.map((p) => (new Date(p.date + 'T12:00:00Z').getTime() - firstDate) / (1000 * 60 * 60 * 24));
    const ys = efPoints.map((p) => p.ef);
    const n = xs.length;

    const slopes: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
      }
    }

    if (slopes.length === 0) return null;
    slopes.sort((a, b) => a - b);
    const slope = slopes[Math.floor(slopes.length / 2)];

    const intercepts = xs.map((x, i) => ys[i] - slope * x);
    intercepts.sort((a, b) => a - b);
    const intercept = intercepts[Math.floor(intercepts.length / 2)];

    const totalDays = xs[xs.length - 1];
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const pctChange = totalDays > 0 ? ((slope * totalDays) / yMean) * 100 : 0;

    return { slope, intercept, xs, totalDays, pctChange };
  }, [efPoints]);

  if (efPoints.length < 5) return null;

  const efs = efPoints.map((p) => p.ef);
  const minEf = Math.min(...efs) - 0.05;
  const maxEf = Math.max(...efs) + 0.05;
  const rangeEf = maxEf - minEf || 0.2;

  const VB_W = 500;
  const VB_H = 195;
  const PAD = { top: 10, bottom: 40, left: 40, right: 10 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number) => PAD.left + (i / (efPoints.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minEf) / rangeEf) * chartH;

  const improving = regression && regression.pctChange > 0;

  const dateLabels = computeDateLabels(efPoints, getX, rangeDays);

  // Workout types present (for legend)
  const typesPresent = (() => {
    const types = new Set(efPoints.map(p => p.workoutType));
    return ['easy', 'long', 'tempo', 'interval'].filter(t => types.has(t));
  })();

  const legendItems = [
    ...typesPresent.map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
    { label: 'trend', color: improving ? '#22c55e' : '#ef4444', type: 'line' as const },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 mt-1">
        <div className="h-px flex-1 bg-borderSecondary" />
        <span className="text-textTertiary uppercase tracking-wide text-xs font-medium">
          Efficiency Factor Trend
        </span>
        <div className="h-px flex-1 bg-borderSecondary" />
      </div>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-textTertiary">
              Pace / HR ratio for easy/steady runs. Rising EF = improving fitness.
            </p>
            {regression && (
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded flex-shrink-0',
                  improving
                    ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                    : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                )}
              >
                {improving ? '+' : ''}
                {regression.pctChange.toFixed(1)}%
              </span>
            )}
          </div>
          <TimeRangeSelector ranges={TIME_RANGES_EXTENDED} selected={range} onChange={setRange} size="xs" />
        </div>

        {availableTypes.length > 1 && (
          <div className="mb-3">
            <WorkoutTypeFilter
              available={availableTypes}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              size="xs"
            />
          </div>
        )}

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const v = minEf + rangeEf * frac;
            return (
              <g key={frac}>
                <line
                  x1={PAD.left} y1={getY(v)} x2={VB_W - PAD.right} y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
                />
                <text x={PAD.left - 4} y={getY(v) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Date tick marks */}
          {dateLabels.map((dl, i) => (
            <g key={i}>
              <line
                x1={dl.x} y1={PAD.top + chartH} x2={dl.x} y2={PAD.top + chartH + 3}
                stroke="var(--chart-axis, #9ca3af)" strokeWidth="0.5"
              />
              <text x={dl.x} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {dl.label}
              </text>
            </g>
          ))}

          {/* Regression line */}
          {regression && (
            <line
              x1={getX(0)} y1={getY(regression.intercept)}
              x2={getX(efPoints.length - 1)} y2={getY(regression.intercept + regression.slope * regression.totalDays)}
              stroke={improving ? '#22c55e' : '#ef4444'} strokeWidth="1.2" strokeDasharray="6 3" opacity="0.7"
            />
          )}

          {/* Data points */}
          {efPoints.map((p, i) => (
            <circle
              key={i}
              cx={getX(i)} cy={getY(p.ef)} r={2.5}
              fill={getWorkoutColor(p.workoutType)} opacity={0.7}
            >
              <title>
                {p.date}: EF {p.ef.toFixed(3)} ({p.workoutType}{p.name ? ` — ${p.name}` : ''})
              </title>
            </circle>
          ))}
        </svg>
        {/* Legend below chart */}
        <div className="flex flex-wrap gap-3 mt-1.5 justify-center">
          {legendItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-textTertiary capitalize">
              {item.type === 'dot' ? (
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              ) : (
                <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: item.color }} />
              )}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
