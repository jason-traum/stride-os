'use client';

import { useState, useEffect, useMemo } from 'react';
import { Heart, Timer, Loader2, Mountain } from 'lucide-react';
import { getWorkoutStreams } from '@/actions/strava';

interface ActivityStreamChartProps {
  workoutId: number;
  stravaActivityId: number | null;
  easyPaceSeconds?: number; // User's easy pace for dynamic clamping
}

// Downsample data for rendering — averages each bucket instead of point-picking
function downsample(data: number[], maxPoints: number): number[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      if (data[j] > 0) { sum += data[j]; count++; }
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

// Median filter — replaces each point with the median of its window
// Great for removing isolated spikes while preserving real changes
function medianFilter(data: number[], windowSize: number): number[] {
  if (data.length === 0) return [];
  const half = Math.floor(windowSize / 2);
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    const window = data.slice(start, end).filter(v => v > 0).sort((a, b) => a - b);
    result.push(window.length > 0 ? window[Math.floor(window.length / 2)] : 0);
  }
  return result;
}

// Winsorize one tail — cap only the slow end (high pace values)
// Leave the fast end untouched (real fast efforts)
function winsorizeSlowEnd(data: number[], upperPct: number): number[] {
  const valid = data.filter(v => v > 0).sort((a, b) => a - b);
  if (valid.length === 0) return data;
  const upper = valid[Math.floor(valid.length * upperPct)];
  return data.map(v => v <= 0 ? 0 : Math.min(upper, v));
}

// Smooth data with a rolling average (ignoring zeros)
function smooth(data: number[], windowSize: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [];
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      if (data[j] > 0) {
        sum += data[j];
        count++;
      }
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

// Full pace cleaning pipeline:
// 1. Clamp: fast end at 4:00/mi (GPS glitch), slow end dynamic based on easy pace
// 2. Median filter to kill isolated GPS spikes
// 3. Winsorize only the slow end (cap drifting slow paces, keep real fast efforts)
// 4. Smooth with rolling average
function cleanPaceData(raw: number[], easyPaceSeconds?: number): number[] {
  // Step 1: Dynamic clamp based on user's easy pace
  const FASTEST_PACE = 240;  // 4:00/mi — faster is GPS glitch
  // Slow clamp: easy pace + 180s (3 min), or 660s (11:00/mi) default
  const SLOWEST_PACE = easyPaceSeconds ? easyPaceSeconds + 180 : 660;
  let data = raw.map(v => {
    if (v <= 0) return 0;
    if (v < FASTEST_PACE) return FASTEST_PACE;
    if (v > SLOWEST_PACE) return 0; // treat as gap (stopped)
    return v;
  });
  // Step 2: Median filter (window=7) to remove GPS spikes
  data = medianFilter(data, 7);
  // Step 3: Winsorize only the slow end at 95th percentile
  // Leave fast paces untouched — those are real efforts
  data = winsorizeSlowEnd(data, 0.95);
  // Step 4: Smooth with rolling average (window=9)
  data = smooth(data, 9);
  return data;
}

// HR cleaning — lighter touch, HR data is generally cleaner
function cleanHRData(raw: number[]): number[] {
  // Clamp to physiological range
  let data = raw.map(v => (v < 50 || v > 220) ? 0 : v);
  // Median filter (window=5) for isolated spikes
  data = medianFilter(data, 5);
  // Smooth with rolling average
  data = smooth(data, 7);
  return data;
}

function formatPaceValue(secondsPerMile: number): string {
  if (secondsPerMile <= 0 || secondsPerMile > 1800) return '--:--';
  const mins = Math.floor(secondsPerMile / 60);
  const secs = Math.round(secondsPerMile % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getHRZoneColor(hrPercent: number): string {
  if (hrPercent >= 0.9) return '#ef4444';   // Z5 red
  if (hrPercent >= 0.8) return '#f97316';   // Z4 orange
  if (hrPercent >= 0.7) return '#eab308';   // Z3 yellow
  if (hrPercent >= 0.6) return '#7c6cf0';   // Z2 teal
  return '#3b82f6';                          // Z1 blue
}

export function ActivityStreamChart({ workoutId, stravaActivityId, easyPaceSeconds }: ActivityStreamChartProps) {
  const [streamData, setStreamData] = useState<{
    distance: number[];
    heartrate: number[];
    velocity: number[];
    altitude: number[];
    time: number[];
    maxHr: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<'both' | 'pace' | 'hr'>('both');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!stravaActivityId) {
      setLoading(false);
      return;
    }

    getWorkoutStreams(workoutId).then((result) => {
      if (result.success && result.data) {
        setStreamData(result.data);
      } else {
        setError(result.error || 'Failed to load stream data');
      }
      setLoading(false);
    });
  }, [workoutId, stravaActivityId]);

  const chartData = useMemo(() => {
    if (!streamData) return null;

    const maxPoints = 300;
    const hasPace = streamData.velocity.length > 0;
    const hasHR = streamData.heartrate.length > 0;
    const hasAltitude = streamData.altitude.length > 0;

    if (!hasPace && !hasHR) return null;

    // Downsample all streams to same length
    const dist = downsample(streamData.distance, maxPoints);
    // Clean + downsample pace and HR through the full pipeline
    const pace = hasPace ? cleanPaceData(downsample(streamData.velocity, maxPoints), easyPaceSeconds) : [];
    const hr = hasHR ? cleanHRData(downsample(streamData.heartrate, maxPoints)) : [];
    const alt = hasAltitude ? downsample(streamData.altitude, maxPoints) : [];

    const totalDistance = dist[dist.length - 1] || 0;

    // Pace range (from cleaned data)
    const validPaces = pace.filter(p => p > 0);
    const minPace = validPaces.length > 0 ? Math.min(...validPaces) : 300;
    const maxPace = validPaces.length > 0 ? Math.max(...validPaces) : 600;
    const paceRange = maxPace - minPace || 60;
    const pacePaddedMin = minPace - paceRange * 0.1;
    const pacePaddedMax = maxPace + paceRange * 0.1;

    // HR range (from cleaned data)
    const validHRs = hr.filter(h => h > 0);
    const minHR = validHRs.length > 0 ? Math.min(...validHRs) : 100;
    const maxHR = validHRs.length > 0 ? Math.max(...validHRs) : 180;
    const hrRange = maxHR - minHR || 20;
    const hrPaddedMin = minHR - hrRange * 0.1;
    const hrPaddedMax = maxHR + hrRange * 0.1;

    // Altitude range
    const validAlts = alt.filter(a => a > 0);
    const minAlt = validAlts.length > 0 ? Math.min(...validAlts) : 0;
    const maxAlt = validAlts.length > 0 ? Math.max(...validAlts) : 0;
    const altRange = maxAlt - minAlt || 1;
    const elevGain = hasAltitude ? Math.round(alt.reduce((sum, a, i) => {
      if (i === 0) return 0;
      const diff = a - alt[i - 1];
      return sum + (diff > 0 ? diff : 0);
    }, 0)) : 0;
    const elevLoss = hasAltitude ? Math.round(alt.reduce((sum, a, i) => {
      if (i === 0) return 0;
      const diff = a - alt[i - 1];
      return sum + (diff < 0 ? Math.abs(diff) : 0);
    }, 0)) : 0;

    // Avg values
    const avgPace = validPaces.length > 0 ? validPaces.reduce((a, b) => a + b, 0) / validPaces.length : 0;
    const bestPace = validPaces.length > 0 ? Math.min(...validPaces) : 0;
    const avgHR = validHRs.length > 0 ? Math.round(validHRs.reduce((a, b) => a + b, 0) / validHRs.length) : 0;
    const peakHR = validHRs.length > 0 ? Math.round(Math.max(...validHRs)) : 0;

    return {
      dist, pace, hr, alt, totalDistance,
      pacePaddedMin, pacePaddedMax, paceRange: pacePaddedMax - pacePaddedMin,
      hrPaddedMin, hrPaddedMax, hrRange: hrPaddedMax - hrPaddedMin,
      minAlt, maxAlt, altRange,
      hasPace, hasHR, hasAltitude,
      avgPace, bestPace, avgHR, peakHR,
      elevGain, elevLoss,
      maxHr: streamData.maxHr,
    };
  }, [streamData, easyPaceSeconds]);

  if (!stravaActivityId) return null;

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <div className="flex items-center gap-2 text-textSecondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading activity data...</span>
        </div>
      </div>
    );
  }

  if (error || !chartData) return null;

  const { dist, pace, hr, alt, totalDistance, hasPace, hasHR, hasAltitude } = chartData;

  // Chart dimensions
  const width = 1000;
  const height = 200;
  const pad = { top: 10, bottom: 20, left: 0, right: 0 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Build SVG paths
  function buildPath(data: number[], min: number, range: number, invert: boolean = false): string {
    const points: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (dist[i] / totalDistance) * chartW;
      const normalized = (data[i] - min) / range;
      const y = invert
        ? pad.top + normalized * chartH  // Higher pace = slower = higher on chart
        : pad.top + chartH - normalized * chartH;
      if (data[i] > 0) {
        points.push(`${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    }
    return points.join(' ');
  }

  function buildAreaPath(linePath: string): string {
    if (!linePath) return '';
    // Find first and last M/L points
    const parts = linePath.split(/[ML]\s*/).filter(Boolean);
    if (parts.length < 2) return '';
    const firstX = parseFloat(parts[0].split(' ')[0]);
    const lastPart = parts[parts.length - 1].trim().split(' ');
    const lastX = parseFloat(lastPart[0]);
    return `${linePath} L ${lastX} ${height - pad.bottom} L ${firstX} ${height - pad.bottom} Z`;
  }

  const showPace = activeChart !== 'hr' && hasPace;
  const showHR = activeChart !== 'pace' && hasHR;

  const pacePath = showPace ? buildPath(pace, chartData.pacePaddedMin, chartData.paceRange, true) : '';
  const hrPath = showHR ? buildPath(hr, chartData.hrPaddedMin, chartData.hrRange) : '';

  // Elevation profile — rendered as terrain at bottom of chart
  // Uses its own Y mapping: bottom 40% of chart, higher altitude = higher on screen
  const elevPath = hasAltitude ? (() => {
    const elevH = chartH * 0.35; // elevation uses bottom 35% of chart
    const elevTop = pad.top + chartH - elevH;
    const points: string[] = [];
    for (let i = 0; i < alt.length; i++) {
      const x = pad.left + (dist[i] / totalDistance) * chartW;
      const normalized = (alt[i] - chartData.minAlt) / chartData.altRange;
      const y = elevTop + elevH - normalized * elevH;
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  })() : '';

  // Mile markers
  const mileMarkers: number[] = [];
  for (let m = 1; m <= Math.floor(totalDistance); m++) {
    mileMarkers.push(m);
  }

  // Hover info
  const hoverInfo = hoverIndex !== null ? {
    distance: dist[hoverIndex]?.toFixed(2),
    pace: pace[hoverIndex] ? formatPaceValue(pace[hoverIndex]) : null,
    hr: hr[hoverIndex] ? Math.round(hr[hoverIndex]) : null,
    hrPercent: hr[hoverIndex] ? hr[hoverIndex] / chartData.maxHr : 0,
    elev: alt[hoverIndex] ? Math.round(alt[hoverIndex]) : null,
  } : null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-textPrimary">Activity Analysis</h2>
        <div className="flex items-center gap-1 bg-bgTertiary rounded-lg p-0.5">
          {hasPace && hasHR && (
            <button
              onClick={() => setActiveChart('both')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeChart === 'both' ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
              }`}
            >
              Both
            </button>
          )}
          {hasPace && (
            <button
              onClick={() => setActiveChart('pace')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                activeChart === 'pace' ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
              }`}
            >
              <Timer className="w-3 h-3" /> Pace
            </button>
          )}
          {hasHR && (
            <button
              onClick={() => setActiveChart('hr')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                activeChart === 'hr' ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
              }`}
            >
              <Heart className="w-3 h-3" /> HR
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div
        className="relative"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 sm:h-56"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPercent = (e.clientX - rect.left) / rect.width;
            const idx = Math.round(xPercent * (dist.length - 1));
            setHoverIndex(Math.max(0, Math.min(idx, dist.length - 1)));
          }}
        >
          <defs>
            <linearGradient id="streamPaceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="streamHRGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="streamElevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b7280" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6b7280" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Mile markers */}
          {mileMarkers.map(m => {
            const x = pad.left + (m / totalDistance) * chartW;
            return (
              <g key={m}>
                <line
                  x1={x} y1={pad.top} x2={x} y2={height - pad.bottom}
                  stroke="var(--border-secondary)" strokeWidth="0.5" strokeDasharray="4,4"
                />
                <text
                  x={x} y={height - 4}
                  textAnchor="middle" fontSize="9" fill="var(--text-tertiary)"
                >
                  {m}
                </text>
              </g>
            );
          })}

          {/* Elevation profile — terrain behind everything */}
          {hasAltitude && elevPath && (
            <>
              <path d={buildAreaPath(elevPath)} fill="url(#streamElevGradient)" />
              <path d={elevPath} fill="none" stroke="#9ca3af" strokeWidth="0.8" strokeLinejoin="round" opacity="0.3" />
            </>
          )}

          {/* Pace area + line */}
          {showPace && pacePath && (
            <>
              <path d={buildAreaPath(pacePath)} fill="url(#streamPaceGradient)" />
              <path d={pacePath} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
            </>
          )}

          {/* HR area + line */}
          {showHR && hrPath && (
            <>
              <path d={buildAreaPath(hrPath)} fill="url(#streamHRGradient)" />
              <path d={hrPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
            </>
          )}

          {/* Horizontal pace gridlines at each minute mark — rendered on top of fills */}
          {showPace && (() => {
            const lines: React.ReactNode[] = [];
            const startMin = Math.ceil(chartData.pacePaddedMin / 60);
            const endMin = Math.floor(chartData.pacePaddedMax / 60);
            for (let m = startMin; m <= endMin; m++) {
              const paceSeconds = m * 60;
              const normalized = (paceSeconds - chartData.pacePaddedMin) / chartData.paceRange;
              const y = pad.top + normalized * chartH;
              lines.push(
                <g key={`pace-grid-${m}`}>
                  <line
                    x1={pad.left} y1={y} x2={pad.left + chartW} y2={y}
                    stroke="#9ca3af" strokeWidth="0.7" strokeDasharray="4,4" opacity="0.5"
                  />
                  <text
                    x={pad.left + 4} y={y - 3}
                    textAnchor="start" fontSize="9" fill="#9ca3af" opacity="0.8"
                  >
                    {m}:00
                  </text>
                </g>
              );
            }
            return lines;
          })()}

          {/* Hover line */}
          {hoverIndex !== null && (
            <line
              x1={pad.left + (dist[hoverIndex] / totalDistance) * chartW}
              y1={pad.top}
              x2={pad.left + (dist[hoverIndex] / totalDistance) * chartW}
              y2={height - pad.bottom}
              stroke="var(--text-secondary)"
              strokeWidth="1"
              opacity="0.5"
            />
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            className="absolute top-0 bg-bgPrimary/95 backdrop-blur-sm border border-borderPrimary rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none z-10"
            style={{
              left: `${Math.min(85, Math.max(5, (dist[hoverIndex!] / totalDistance) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-textTertiary mb-1">{hoverInfo.distance} mi</div>
            {hoverInfo.pace && (
              <div className="flex items-center gap-1.5 text-orange-500">
                <Timer className="w-3 h-3" />
                <span className="font-semibold">{hoverInfo.pace}/mi</span>
              </div>
            )}
            {hoverInfo.hr && (
              <div className="flex items-center gap-1.5" style={{ color: getHRZoneColor(hoverInfo.hrPercent) }}>
                <Heart className="w-3 h-3" />
                <span className="font-semibold">{hoverInfo.hr} bpm</span>
              </div>
            )}
            {hoverInfo.elev && (
              <div className="flex items-center gap-1.5 text-textSecondary">
                <Mountain className="w-3 h-3" />
                <span className="font-semibold">{hoverInfo.elev} ft</span>
              </div>
            )}
          </div>
        )}

        {/* HR Y-axis labels (right side) */}
        {showHR && (
          <div className="absolute top-0 right-1 h-full flex flex-col justify-between py-2 pointer-events-none">
            <span className="text-[10px] text-red-400">{Math.round(chartData.hrPaddedMax)}</span>
            <span className="text-[10px] text-red-400">{Math.round(chartData.hrPaddedMin)}</span>
          </div>
        )}
      </div>

      {/* X-axis label */}
      <div className="text-center mt-1">
        <span className="text-[10px] text-textTertiary">Distance (miles)</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-borderSecondary text-sm">
        {hasPace && (
          <>
            <div>
              <p className="text-xs text-textTertiary">Avg Pace</p>
              <p className="font-semibold text-orange-500">{formatPaceValue(Math.round(chartData.avgPace))}/mi</p>
            </div>
            <div>
              <p className="text-xs text-textTertiary">Best Pace</p>
              <p className="font-semibold text-orange-500">{formatPaceValue(Math.round(chartData.bestPace))}/mi</p>
            </div>
          </>
        )}
        {hasHR && (
          <>
            <div>
              <p className="text-xs text-textTertiary">Avg HR</p>
              <p className="font-semibold text-red-500">{chartData.avgHR} bpm</p>
            </div>
            <div>
              <p className="text-xs text-textTertiary">Peak HR</p>
              <p className="font-semibold text-red-500">{chartData.peakHR} bpm</p>
            </div>
          </>
        )}
        {hasAltitude && chartData.elevGain > 0 && (
          <>
            <div>
              <p className="text-xs text-textTertiary">Elev Gain</p>
              <p className="font-semibold text-emerald-500">+{chartData.elevGain} ft</p>
            </div>
            <div>
              <p className="text-xs text-textTertiary">Elev Loss</p>
              <p className="font-semibold text-emerald-500">-{chartData.elevLoss} ft</p>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-textTertiary">
        {hasPace && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-orange-500 rounded" />
            <span>Pace</span>
          </div>
        )}
        {hasHR && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-500 rounded" />
            <span>Heart Rate</span>
          </div>
        )}
        {hasAltitude && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-gray-400 rounded" />
            <span>Elevation</span>
          </div>
        )}
      </div>
    </div>
  );
}
