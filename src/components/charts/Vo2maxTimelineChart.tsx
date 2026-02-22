'use client';

import { useState, useMemo } from 'react';
import { type WorkoutSignalPoint } from '@/actions/prediction-dashboard';
import { cn, parseLocalDate } from '@/lib/utils';
import { TimeRangeSelector, TIME_RANGES_EXTENDED } from '@/components/shared/TimeRangeSelector';
import { WorkoutTypeFilter } from '@/components/shared/WorkoutTypeFilter';
import { filterByRange, filterOutliersIQR, computeDateLabels, getWorkoutColor } from '@/lib/chart-utils';

interface Vo2maxTimelineChartProps {
  signalTimeline: WorkoutSignalPoint[];
  blendedVdot: number;
}

export function Vo2maxTimelineChart({ signalTimeline, blendedVdot }: Vo2maxTimelineChartProps) {
  const [range, setRange] = useState('6M');
  const rangeDays = TIME_RANGES_EXTENDED.find(r => r.label === range)!.days;
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const allVo2Points = useMemo(() => {
    return signalTimeline
      .filter((s) => s.effectiveVo2max != null && s.isSteadyState &&
        (s.avgHr == null || s.avgHr >= 90))
      .map((s) => ({
        date: s.date,
        vo2max: s.effectiveVo2max!,
        workoutType: s.workoutType,
        distanceMiles: s.distanceMiles,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

  // Initialize selected types when data is available
  const availableTypes = useMemo(() => {
    const types = new Set(allVo2Points.map(p => p.workoutType));
    return Array.from(types);
  }, [allVo2Points]);

  // Auto-init selectedTypes on first render with data
  useMemo(() => {
    if (selectedTypes.size === 0 && availableTypes.length > 0) {
      setSelectedTypes(new Set(availableTypes));
    }
  }, [availableTypes, selectedTypes.size]);

  const vo2Points = useMemo(() => {
    const ranged = filterByRange(allVo2Points, rangeDays);
    const typed = selectedTypes.size > 0
      ? ranged.filter(p => selectedTypes.has(p.workoutType))
      : ranged;
    return filterOutliersIQR(typed, p => p.vo2max);
  }, [allVo2Points, rangeDays, selectedTypes]);

  if (vo2Points.length < 3) return null;

  const vdots = vo2Points.map((p) => p.vo2max);
  const minV = Math.min(...vdots) - 2;
  const maxV = Math.max(...vdots) + 2;
  const rangeV = maxV - minV || 5;

  // 7-day rolling average
  const rollingAvg = vo2Points.map((p, i) => {
    const cutoff = new Date(p.date);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const window = vo2Points.filter((q, j) => j <= i && q.date >= cutoffStr);
    return window.reduce((s, q) => s + q.vo2max, 0) / window.length;
  });

  const VB_W = 500;
  const VB_H = 195;
  const PAD = { top: 10, bottom: 40, left: 40, right: 10 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number) => PAD.left + (i / (vo2Points.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minV) / rangeV) * chartH;

  // Grid lines
  const gridStep = rangeV > 10 ? 5 : rangeV > 4 ? 2 : 1;
  const gridLines: number[] = [];
  for (let v = Math.ceil(minV / gridStep) * gridStep; v <= maxV; v += gridStep) {
    gridLines.push(v);
  }

  // Rolling avg path
  const avgPath = rollingAvg
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`)
    .join(' ');

  // Blended VDOT line
  const blendedY = getY(blendedVdot);

  const dateLabels = computeDateLabels(vo2Points, getX, rangeDays);

  // Workout types present (for legend)
  const typesPresent = (() => {
    const types = new Set(vo2Points.map(p => p.workoutType));
    return ['easy', 'long', 'tempo', 'interval'].filter(t => types.has(t));
  })();

  const legendItems = [
    ...typesPresent.map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
    { label: '7d avg', color: 'var(--accent-brand, #7c6cf0)', type: 'line' as const },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 mt-1">
        <div className="h-px flex-1 bg-borderSecondary" />
        <span className="text-textTertiary uppercase tracking-wide text-xs font-medium">
          Effective VO2max (from HR)
        </span>
        <div className="h-px flex-1 bg-borderSecondary" />
      </div>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-textTertiary">
            Each dot is a workout&apos;s estimated VO2max from pace + heart rate.{' '}
            7-day rolling average. Not the same as VDOT (which uses race data).
          </p>
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

        <div className="relative">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left} y1={getY(v)} x2={VB_W - PAD.right} y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
                />
                <text x={PAD.left - 4} y={getY(v) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="8">
                  {v}
                </text>
              </g>
            ))}

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

            {/* Blended VDOT reference line */}
            {blendedY >= PAD.top && blendedY <= PAD.top + chartH && (
              <line
                x1={PAD.left} y1={blendedY} x2={VB_W - PAD.right} y2={blendedY}
                stroke="var(--accent-brand, #7c6cf0)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6"
              />
            )}

            {/* Rolling average line */}
            <path d={avgPath} fill="none" stroke="var(--accent-brand, #7c6cf0)" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Individual data points */}
            {vo2Points.map((p, i) => (
              <circle
                key={i}
                cx={getX(i)} cy={getY(p.vo2max)} r={2}
                fill={getWorkoutColor(p.workoutType)} opacity={0.7}
              >
                <title>
                  {p.date}: VO2max {p.vo2max.toFixed(1)} ({p.workoutType}{p.name ? ` — ${p.name}` : ''})
                </title>
              </circle>
            ))}
          </svg>
        </div>
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
