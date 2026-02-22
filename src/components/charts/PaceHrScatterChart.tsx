'use client';

import { useState, useMemo } from 'react';
import { type WorkoutSignalPoint } from '@/actions/prediction-dashboard';
import { cn, parseLocalDate, formatPace } from '@/lib/utils';
import { TimeRangeSelector, TIME_RANGES_EXTENDED } from '@/components/shared/TimeRangeSelector';
import { filterByRange, filterOutliersIQR, getWorkoutColor } from '@/lib/chart-utils';

interface PaceHrScatterChartProps {
  signalTimeline: WorkoutSignalPoint[];
}

function ChartLegend({ items, x, y }: { items: { label: string; color: string; type: 'dot' | 'line' }[]; x: number; y: number }) {
  let offsetY = 0;
  return (
    <g>
      {items.map((item, i) => {
        const thisY = y + offsetY;
        offsetY += 10;
        return (
          <g key={i}>
            {item.type === 'dot' ? (
              <circle cx={x + 4} cy={thisY} r={2.5} fill={item.color} opacity={0.8} />
            ) : (
              <line x1={x} y1={thisY} x2={x + 8} y2={thisY} stroke={item.color} strokeWidth={1.2} />
            )}
            <text x={x + 11} y={thisY + 3} fill="var(--chart-axis, #9ca3af)" fontSize="6.5">
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function PaceHrScatterChart({ signalTimeline }: PaceHrScatterChartProps) {
  const [range, setRange] = useState('6M');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(['easy', 'long', 'tempo', 'interval', 'steady', 'marathon']));
  const rangeDays = TIME_RANGES_EXTENDED.find(r => r.label === range)!.days;

  // Build scatter points from cleaned data
  const allPoints = useMemo(() => {
    return signalTimeline
      .filter(s =>
        s.avgHr != null && s.avgHr >= 90 && s.avgHr <= 210 &&
        s.isSteadyState &&
        s.distanceMiles >= 1 &&
        s.durationMinutes >= 15 &&
        (s.elevationAdjustedPace || s.weatherAdjustedPace || s.avgPaceSeconds)
      )
      .map(s => {
        const rawPace = s.elevationAdjustedPace || s.weatherAdjustedPace || s.avgPaceSeconds!;
        return {
          date: s.date,
          pace: rawPace,
          hr: s.avgHr!,
          workoutType: s.workoutType,
          name: s.stravaName,
          distanceMiles: s.distanceMiles,
        };
      })
      .filter(p => p.pace >= 240 && p.pace <= 960);
  }, [signalTimeline]);

  // Apply range + type filters, then outlier removal
  const points = useMemo(() => {
    const ranged = filterByRange(allPoints, rangeDays);
    const typed = ranged.filter(p => activeTypes.has(p.workoutType));
    const cleanPace = filterOutliersIQR(typed, p => p.pace);
    return filterOutliersIQR(cleanPace, p => p.hr);
  }, [allPoints, rangeDays, activeTypes]);

  // Theil-Sen regression: HR = slope * pace + intercept
  const regression = useMemo(() => {
    if (points.length < 5) return null;

    const xs = points.map(p => p.pace);
    const ys = points.map(p => p.hr);
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

    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  }, [points]);

  // Workout types present in the full dataset (for toggles)
  const typesInData = useMemo(() => {
    const types = new Set(allPoints.map(p => p.workoutType));
    return ['easy', 'long', 'steady', 'marathon', 'tempo', 'interval'].filter(t => types.has(t));
  }, [allPoints]);

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (points.length < 5) return null;

  const paces = points.map(p => p.pace);
  const hrs = points.map(p => p.hr);
  const minPace = Math.min(360, ...paces);
  const maxPace = Math.max(600, ...paces);
  const minHr = Math.min(130, ...hrs);
  const maxHr = Math.max(190, ...hrs);
  const paceRange = maxPace - minPace;
  const hrRange = maxHr - minHr;

  const VB_W = 500;
  const VB_H = 260;
  const PAD = { top: 12, bottom: 40, left: 38, right: 12 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  // X axis: faster pace (lower seconds) on RIGHT side
  const getX = (pace: number) => PAD.left + chartW - ((pace - minPace) / paceRange) * chartW;
  const getY = (hr: number) => PAD.top + chartH - ((hr - minHr) / hrRange) * chartH;

  // Grid lines for HR (Y axis)
  const hrStep = hrRange > 40 ? 10 : hrRange > 20 ? 5 : 2;
  const hrGridLines: number[] = [];
  for (let h = Math.ceil(minHr / hrStep) * hrStep; h <= maxHr; h += hrStep) {
    hrGridLines.push(h);
  }

  // Grid lines for Pace (X axis)
  const paceStep = paceRange > 240 ? 60 : 30;
  const paceGridLines: number[] = [];
  for (let p = Math.ceil(minPace / paceStep) * paceStep; p <= maxPace; p += paceStep) {
    paceGridLines.push(p);
  }

  // Regression line endpoints
  const regLine = regression ? {
    x1: getX(minPace),
    y1: getY(regression.slope * minPace + regression.intercept),
    x2: getX(maxPace),
    y2: getY(regression.slope * maxPace + regression.intercept),
  } : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 mt-1">
        <div className="h-px flex-1 bg-borderSecondary" />
        <span className="text-textTertiary uppercase tracking-wide text-xs font-medium">
          Pace vs Heart Rate
        </span>
        <div className="h-px flex-1 bg-borderSecondary" />
      </div>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Controls */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs text-textTertiary">
              Adjusted pace vs HR for steady runs. Tighter cluster = more consistent fitness.
            </p>
            {regression && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-mono font-medium text-dream-500 bg-dream-50 dark:bg-dream-900/20 px-2 py-0.5 rounded">
                  R² = {regression.r2.toFixed(2)}
                </span>
                <span className="text-xs font-mono font-medium text-textTertiary bg-bgTertiary px-2 py-0.5 rounded">
                  {(regression.slope * 60).toFixed(1)} bpm/min
                </span>
              </div>
            )}
          </div>
          <TimeRangeSelector ranges={TIME_RANGES_EXTENDED} selected={range} onChange={setRange} size="xs" />
        </div>

        {/* Type toggles */}
        <div className="flex items-center gap-1.5 mb-3">
          {typesInData.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded font-medium transition-colors border capitalize',
                activeTypes.has(type)
                  ? 'border-transparent text-white'
                  : 'border-borderSecondary text-textTertiary bg-bgTertiary'
              )}
              style={activeTypes.has(type) ? { backgroundColor: getWorkoutColor(type) } : undefined}
            >
              {type}
            </button>
          ))}
          <span className="text-[10px] text-textTertiary ml-auto">{points.length} workouts</span>
        </div>

        {/* Chart */}
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* HR grid lines (horizontal) */}
          {hrGridLines.map(h => (
            <g key={`hr-${h}`}>
              <line
                x1={PAD.left} y1={getY(h)} x2={VB_W - PAD.right} y2={getY(h)}
                stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
              />
              <text x={PAD.left - 4} y={getY(h) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {h}
              </text>
            </g>
          ))}

          {/* Pace grid lines (vertical) */}
          {paceGridLines.map(p => (
            <g key={`pace-${p}`}>
              <line
                x1={getX(p)} y1={PAD.top} x2={getX(p)} y2={PAD.top + chartH}
                stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
              />
              <text x={getX(p)} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {formatPace(p)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={VB_W / 2} y={VB_H - 2} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
            Pace (min/mi) — faster →
          </text>
          <text
            x={8} y={VB_H / 2}
            textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7"
            transform={`rotate(-90, 8, ${VB_H / 2})`}
          >
            Heart Rate (bpm)
          </text>

          {/* Regression line */}
          {regLine && (
            <line
              x1={regLine.x1} y1={regLine.y1} x2={regLine.x2} y2={regLine.y2}
              stroke="var(--accent-brand, #7c6cf0)" strokeWidth="1.2" strokeDasharray="6 3" opacity="0.7"
            />
          )}

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={getX(p.pace)} cy={getY(p.hr)}
              r={2.5}
              fill={getWorkoutColor(p.workoutType)}
              opacity={0.7}
            >
              <title>
                {p.name || p.workoutType}{'\n'}
                {formatPace(p.pace)}/mi · {Math.round(p.hr)} bpm{'\n'}
                {p.distanceMiles.toFixed(1)} mi · {parseLocalDate(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </title>
            </circle>
          ))}

          {/* Legend inside chart — top left */}
          <ChartLegend
            items={[
              ...typesInData.filter(t => activeTypes.has(t)).map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
              ...(regression ? [{ label: `fit (R²=${regression.r2.toFixed(2)})`, color: 'var(--accent-brand, #7c6cf0)', type: 'line' as const }] : []),
            ]}
            x={PAD.left + 4}
            y={PAD.top + 4}
          />
        </svg>
      </div>
    </div>
  );
}
