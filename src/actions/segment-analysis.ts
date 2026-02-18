'use server';

import { getWorkoutStreams } from '@/actions/strava';
import { getCachedWorkoutStreams } from '@/lib/workout-stream-cache';
import { calculateVDOT } from '@/lib/training/vdot-calculator';

export interface BestVdotSegment {
  startSeconds: number;
  endSeconds: number;
  distanceMiles: number;
  durationSeconds: number;
  paceSecondsPerMile: number;
  vdot: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  gpsGapCount: number;
  hrDriftPct: number | null;
  hrStdDev: number | null;
  quality: {
    gpsIntegrity: number;
    hrStability: number;
    hrPlausibility: number;
  };
}

export interface BestVdotSegmentResult {
  success: boolean;
  source: 'cached' | 'live' | 'none';
  minDistanceMiles: number;
  candidateCount: number;
  bestSegment?: BestVdotSegment;
  message?: string;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function analyzeWindowQuality(params: {
  distance: number[];
  time: number[];
  hr: number[];
  start: number;
  end: number;
}): {
  gpsIntegrity: number;
  hrStability: number;
  hrPlausibility: number;
  gpsGapCount: number;
  hrDriftPct: number | null;
  hrStdDev: number | null;
} {
  const { distance, time, hr, start, end } = params;
  const points = end - start + 1;

  let gpsGapCount = 0;
  for (let i = start + 1; i <= end; i++) {
    const dt = time[i] - time[i - 1];
    const dd = distance[i] - distance[i - 1];
    if (!Number.isFinite(dt) || !Number.isFinite(dd)) continue;
    if (dt > 3) gpsGapCount++;
    if (dt > 0 && dd / dt > 0.02) gpsGapCount++;
    if (dd < -0.001) gpsGapCount++;
  }

  const gpsIntegrity = clamp01(1 - gpsGapCount / Math.max(2, points / 10));

  const hrSlice = hr.slice(start, end + 1).filter((v) => Number.isFinite(v) && v > 60 && v < 220);
  if (hrSlice.length < Math.max(6, Math.floor(points * 0.35))) {
    return {
      gpsIntegrity,
      hrStability: 0.55,
      hrPlausibility: 0.6,
      gpsGapCount,
      hrDriftPct: null,
      hrStdDev: null,
    };
  }

  const meanHr = avg(hrSlice);
  const sigma = stdDev(hrSlice, meanHr);
  const cv = meanHr > 0 ? sigma / meanHr : 0;

  const third = Math.max(2, Math.floor(hrSlice.length / 3));
  const firstHr = avg(hrSlice.slice(0, third));
  const lastHr = avg(hrSlice.slice(hrSlice.length - third));
  const driftPct = firstHr > 0 ? ((lastHr - firstHr) / firstHr) * 100 : 0;

  const hrStability = clamp01(1 - cv * 2.8 - Math.abs(driftPct) / 55);
  const hrPlausibility = clamp01(
    1
    - (meanHr < 100 ? (100 - meanHr) / 80 : 0)
    - (meanHr > 198 ? (meanHr - 198) / 50 : 0)
  );

  return {
    gpsIntegrity,
    hrStability,
    hrPlausibility,
    gpsGapCount,
    hrDriftPct: driftPct,
    hrStdDev: sigma,
  };
}

export async function getBestVdotSegmentScore(
  workoutId: number,
  options?: {
    minDistanceMeters?: number;
    maxDistanceMiles?: number;
  }
): Promise<BestVdotSegmentResult> {
  const minDistanceMiles = Math.max((options?.minDistanceMeters || 800) / 1609.34, 0.3);
  const maxDistanceMiles = options?.maxDistanceMiles || 3.2;

  const cached = await getCachedWorkoutStreams(workoutId);
  let streamSource: 'cached' | 'live' | 'none' = 'none';
  let streamData = cached?.data;

  if (streamData) {
    streamSource = 'cached';
  } else {
    const live = await getWorkoutStreams(workoutId);
    if (!live.success || !live.data) {
      return {
        success: false,
        source: 'none',
        minDistanceMiles,
        candidateCount: 0,
        message: live.error || 'No stream data available',
      };
    }
    streamData = live.data;
    streamSource = 'live';
  }

  const distance = streamData.distance || [];
  const time = streamData.time || [];
  const hr = streamData.heartrate || [];
  const n = Math.min(distance.length, time.length);
  if (n < 20) {
    return {
      success: false,
      source: streamSource,
      minDistanceMiles,
      candidateCount: 0,
      message: 'Not enough stream points for segment analysis',
    };
  }

  const dist = distance.slice(0, n);
  const sec = time.slice(0, n);
  const heart = hr.slice(0, n);

  let best: BestVdotSegment | undefined;
  let candidateCount = 0;

  for (let start = 0; start < n - 10; start += 3) {
    for (let end = start + 6; end < n; end += 2) {
      const distanceMiles = dist[end] - dist[start];
      if (distanceMiles < minDistanceMiles) continue;
      if (distanceMiles > maxDistanceMiles) break;

      const durationSeconds = sec[end] - sec[start];
      if (durationSeconds < 140 || durationSeconds > 60 * 35) continue;
      if (durationSeconds <= 0) continue;

      const paceSecondsPerMile = durationSeconds / distanceMiles;
      if (!Number.isFinite(paceSecondsPerMile) || paceSecondsPerMile <= 180 || paceSecondsPerMile > 1200) continue;

      const quality = analyzeWindowQuality({
        distance: dist,
        time: sec,
        hr: heart,
        start,
        end,
      });

      // Hard quality floor: exclude noisy GPS windows.
      if (quality.gpsIntegrity < 0.45) continue;

      const vdot = calculateVDOT(distanceMiles * 1609.34, durationSeconds);
      if (!Number.isFinite(vdot) || vdot < 15 || vdot > 90) continue;

      const qualityScore = (
        quality.gpsIntegrity * 0.5
        + quality.hrStability * 0.35
        + quality.hrPlausibility * 0.15
      );

      const score = vdot * qualityScore;
      const confidence: 'low' | 'medium' | 'high' =
        qualityScore >= 0.8 ? 'high' : qualityScore >= 0.62 ? 'medium' : 'low';

      candidateCount++;
      const candidate: BestVdotSegment = {
        startSeconds: sec[start],
        endSeconds: sec[end],
        distanceMiles: Math.round(distanceMiles * 1000) / 1000,
        durationSeconds: Math.round(durationSeconds),
        paceSecondsPerMile: Math.round(paceSecondsPerMile),
        vdot: Math.round(vdot * 10) / 10,
        score: Math.round(score * 10) / 10,
        confidence,
        gpsGapCount: quality.gpsGapCount,
        hrDriftPct: quality.hrDriftPct != null ? Math.round(quality.hrDriftPct * 10) / 10 : null,
        hrStdDev: quality.hrStdDev != null ? Math.round(quality.hrStdDev * 10) / 10 : null,
        quality: {
          gpsIntegrity: Math.round(quality.gpsIntegrity * 100) / 100,
          hrStability: Math.round(quality.hrStability * 100) / 100,
          hrPlausibility: Math.round(quality.hrPlausibility * 100) / 100,
        },
      };

      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return {
      success: false,
      source: streamSource,
      minDistanceMiles,
      candidateCount,
      message: 'No valid segment passed quality gates (distance/GPS/HR).',
    };
  }

  return {
    success: true,
    source: streamSource,
    minDistanceMiles,
    candidateCount,
    bestSegment: best,
  };
}
