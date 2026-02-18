export interface MileSplit {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
}

export interface LapLike {
  distanceMiles: number;
  durationSeconds: number;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  elevationGainFeet?: number | null;
}

export interface StreamLike {
  distance: number[];
  time: number[];
  heartrate?: number[];
  altitude?: number[];
}

const EPS = 1e-6;

function roundDistanceMiles(distanceMiles: number): number {
  return Math.round(distanceMiles * 100) / 100;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFineGrainedLapData(laps: LapLike[]): boolean {
  const distances = laps
    .map((lap) => lap.distanceMiles)
    .filter((distance) => isFinitePositive(distance))
    .sort((a, b) => a - b);

  if (distances.length < 2) return false;

  const mid = Math.floor(distances.length / 2);
  const median = distances.length % 2 === 0
    ? (distances[mid - 1] + distances[mid]) / 2
    : distances[mid];

  // Accept mile/km/short-lap inputs. Reject very coarse laps (e.g., one 8-mi chunk).
  return median <= 1.25 || distances.some((d) => d <= 0.8);
}

export function buildInterpolatedMileSplitsFromLaps(laps: LapLike[]): MileSplit[] {
  if (!isFineGrainedLapData(laps)) {
    return [];
  }

  const splits: MileSplit[] = [];
  let currentMileDistance = 0;
  let currentMileTime = 0;
  let currentMileHrWeighted = 0;
  let currentMileHrWeight = 0;
  let currentMileElev = 0;
  let currentMileMaxHr: number | null = null;
  let mileNumber = 1;

  for (const lap of laps) {
    const lapDistance = Math.max(lap.distanceMiles || 0, 0);
    const lapDuration = Math.max(lap.durationSeconds || 0, 0);
    if (lapDistance <= 0 || lapDuration <= 0) continue;

    const secPerMile = lapDuration / lapDistance;
    let remainingDistance = lapDistance;

    while (remainingDistance > EPS) {
      const neededToFinishMile = Math.max(1 - currentMileDistance, 0);
      const takeDistance = Math.min(remainingDistance, neededToFinishMile);
      const portion = takeDistance / lapDistance;
      const takeTime = secPerMile * takeDistance;

      currentMileDistance += takeDistance;
      currentMileTime += takeTime;

      if (lap.avgHeartRate && lap.avgHeartRate > 0) {
        currentMileHrWeighted += lap.avgHeartRate * takeDistance;
        currentMileHrWeight += takeDistance;
      }
      if (lap.maxHeartRate && lap.maxHeartRate > 0) {
        currentMileMaxHr = currentMileMaxHr == null ? lap.maxHeartRate : Math.max(currentMileMaxHr, lap.maxHeartRate);
      }
      if (lap.elevationGainFeet) {
        currentMileElev += lap.elevationGainFeet * portion;
      }

      remainingDistance -= takeDistance;

      if (currentMileDistance >= 1 - EPS) {
        splits.push({
          lapNumber: mileNumber,
          distanceMiles: 1,
          durationSeconds: Math.round(currentMileTime),
          avgPaceSeconds: Math.round(currentMileTime),
          avgHeartRate: currentMileHrWeight > 0 ? Math.round(currentMileHrWeighted / currentMileHrWeight) : null,
          maxHeartRate: currentMileMaxHr,
          elevationGainFeet: Math.round(currentMileElev),
          lapType: 'interpolated_mile_lap',
        });
        mileNumber += 1;
        currentMileDistance = 0;
        currentMileTime = 0;
        currentMileHrWeighted = 0;
        currentMileHrWeight = 0;
        currentMileElev = 0;
        currentMileMaxHr = null;
      }
    }
  }

  if (currentMileDistance > 1e-4) {
    const pace = currentMileDistance > 0 ? currentMileTime / currentMileDistance : 0;
    splits.push({
      lapNumber: mileNumber,
      distanceMiles: roundDistanceMiles(currentMileDistance),
      durationSeconds: Math.round(currentMileTime),
      avgPaceSeconds: Math.round(pace),
      avgHeartRate: currentMileHrWeight > 0 ? Math.round(currentMileHrWeighted / currentMileHrWeight) : null,
      maxHeartRate: currentMileMaxHr,
      elevationGainFeet: Math.round(currentMileElev),
      lapType: 'interpolated_partial_lap',
    });
  }

  return splits;
}

type StreamPoint = {
  distanceMiles: number;
  elapsedSeconds: number;
  heartRate: number | null;
  altitudeFeet: number | null;
};

function buildMonotonicPoints(stream: StreamLike): StreamPoint[] {
  const n = Math.min(stream.distance.length, stream.time.length);
  if (n < 2) return [];

  const points: StreamPoint[] = [];
  for (let i = 0; i < n; i++) {
    const distanceMiles = stream.distance[i];
    const elapsedSeconds = stream.time[i];
    if (!Number.isFinite(distanceMiles) || !Number.isFinite(elapsedSeconds)) continue;

    const heartRate = stream.heartrate && i < stream.heartrate.length && Number.isFinite(stream.heartrate[i])
      ? stream.heartrate[i]
      : null;
    const altitudeFeet = stream.altitude && i < stream.altitude.length && Number.isFinite(stream.altitude[i])
      ? stream.altitude[i]
      : null;

    const last = points[points.length - 1];
    if (last) {
      if (distanceMiles < last.distanceMiles - EPS) continue;
      if (elapsedSeconds < last.elapsedSeconds - EPS) continue;
      if (
        Math.abs(distanceMiles - last.distanceMiles) <= EPS
        && Math.abs(elapsedSeconds - last.elapsedSeconds) <= EPS
      ) {
        continue;
      }
    }

    points.push({
      distanceMiles,
      elapsedSeconds,
      heartRate,
      altitudeFeet,
    });
  }

  if (points.length < 2) return [];

  const startDistance = points[0].distanceMiles;
  const startTime = points[0].elapsedSeconds;
  return points.map((point) => ({
    ...point,
    distanceMiles: Math.max(0, point.distanceMiles - startDistance),
    elapsedSeconds: Math.max(0, point.elapsedSeconds - startTime),
  }));
}

function interpolateTimeAtDistance(points: StreamPoint[], targetDistanceMiles: number): number {
  if (targetDistanceMiles <= points[0].distanceMiles) return points[0].elapsedSeconds;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (curr.distanceMiles + EPS < targetDistanceMiles) continue;

    const segmentDistance = curr.distanceMiles - prev.distanceMiles;
    if (segmentDistance <= EPS) return curr.elapsedSeconds;

    const ratio = Math.max(0, Math.min(1, (targetDistanceMiles - prev.distanceMiles) / segmentDistance));
    return prev.elapsedSeconds + ratio * (curr.elapsedSeconds - prev.elapsedSeconds);
  }

  return points[points.length - 1].elapsedSeconds;
}

function summarizeHeartRate(points: StreamPoint[], startTime: number, endTime: number): {
  avgHeartRate: number | null;
  maxHeartRate: number | null;
} {
  const hrValues: number[] = [];
  for (const point of points) {
    if (point.elapsedSeconds < startTime || point.elapsedSeconds > endTime) continue;
    if (!point.heartRate || point.heartRate <= 40 || point.heartRate >= 240) continue;
    hrValues.push(point.heartRate);
  }

  if (hrValues.length === 0) {
    return { avgHeartRate: null, maxHeartRate: null };
  }

  const avgHeartRate = Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length);
  const maxHeartRate = Math.max(...hrValues);
  return { avgHeartRate, maxHeartRate };
}

function summarizeElevationGain(points: StreamPoint[], startTime: number, endTime: number): number | null {
  let gain = 0;
  let hasAltitude = false;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (curr.elapsedSeconds <= startTime || prev.elapsedSeconds >= endTime) continue;
    if (prev.altitudeFeet == null || curr.altitudeFeet == null) continue;

    hasAltitude = true;
    const dt = curr.elapsedSeconds - prev.elapsedSeconds;
    if (dt <= EPS) continue;

    const overlapStart = Math.max(startTime, prev.elapsedSeconds);
    const overlapEnd = Math.min(endTime, curr.elapsedSeconds);
    const overlap = overlapEnd - overlapStart;
    if (overlap <= EPS) continue;

    const altitudeDelta = curr.altitudeFeet - prev.altitudeFeet;
    if (altitudeDelta > 0) {
      gain += altitudeDelta * (overlap / dt);
    }
  }

  return hasAltitude ? Math.round(gain) : null;
}

export function buildInterpolatedMileSplitsFromStream(stream: StreamLike): MileSplit[] {
  const points = buildMonotonicPoints(stream);
  if (points.length < 2) return [];

  const totalDistance = points[points.length - 1].distanceMiles;
  const fullMiles = Math.floor(totalDistance + EPS);
  if (fullMiles <= 0 && totalDistance < 0.2) return [];

  const boundaries: number[] = [0];
  for (let mile = 1; mile <= fullMiles; mile++) boundaries.push(mile);
  if (totalDistance - fullMiles > 1e-4) boundaries.push(totalDistance);

  const splits: MileSplit[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const startDistance = boundaries[i - 1];
    const endDistance = boundaries[i];
    const distanceMiles = endDistance - startDistance;
    if (distanceMiles <= EPS) continue;

    const startTime = interpolateTimeAtDistance(points, startDistance);
    const endTime = interpolateTimeAtDistance(points, endDistance);
    const durationSeconds = endTime - startTime;
    if (durationSeconds <= EPS) continue;

    const paceSeconds = durationSeconds / distanceMiles;
    if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) continue;

    const hrSummary = summarizeHeartRate(points, startTime, endTime);
    const elevationGain = summarizeElevationGain(points, startTime, endTime);
    const isFullMile = Math.abs(distanceMiles - 1) < 0.01;

    splits.push({
      lapNumber: i,
      distanceMiles: isFullMile ? 1 : roundDistanceMiles(distanceMiles),
      durationSeconds: Math.round(durationSeconds),
      avgPaceSeconds: Math.round(paceSeconds),
      avgHeartRate: hrSummary.avgHeartRate,
      maxHeartRate: hrSummary.maxHeartRate,
      elevationGainFeet: elevationGain,
      lapType: isFullMile ? 'interpolated_mile_stream' : 'interpolated_partial_stream',
    });
  }

  return splits;
}
