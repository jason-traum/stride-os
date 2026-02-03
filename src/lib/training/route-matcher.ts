// Route Matcher - Deterministic engine for route-based progress tracking
// Feature 17: Route-Based Progress Tracking

import type { Workout, CanonicalRoute } from '../schema';

export interface RouteFingerprint {
  startLatLng: [number, number] | null;
  endLatLng: [number, number] | null;
  distance: number; // miles
  elevationGain: number; // feet
  boundingBox: [number, number, number, number] | null; // [minLat, minLng, maxLat, maxLng]
  checkpoints?: Array<[number, number]>; // intermediate points for better matching
}

export interface RouteMatch {
  routeId: number;
  routeName: string;
  confidence: number; // 0-1
  matchType: 'exact' | 'similar' | 'partial';
}

export interface RouteComparison {
  workout: Workout;
  route: CanonicalRoute;
  timeDelta: number; // seconds faster/slower than best
  paceDelta: number; // seconds per mile faster/slower
  isPersonalBest: boolean;
  rank: number; // 1 = best, 2 = second best, etc.
}

/**
 * Compute a route fingerprint from workout data
 * Note: For proper fingerprinting, we'd need GPS stream data.
 * This implementation works with available workout metadata.
 */
export function computeRouteFingerprint(workout: Workout): RouteFingerprint | null {
  // Minimum requirements for fingerprinting
  if (!workout.distanceMiles || workout.distanceMiles < 0.5) {
    return null;
  }

  // Get elevation data
  const elevationGain = workout.elevationGainFt || workout.elevationGainFeet || 0;

  // Build fingerprint with available data
  const fingerprint: RouteFingerprint = {
    startLatLng: null,
    endLatLng: null,
    distance: Math.round(workout.distanceMiles * 100) / 100, // Round to 2 decimals
    elevationGain: Math.round(elevationGain),
    boundingBox: null,
  };

  return fingerprint;
}

/**
 * Match a workout's fingerprint against stored canonical routes
 */
export function matchRoute(
  fingerprint: RouteFingerprint,
  routes: CanonicalRoute[]
): RouteMatch | null {
  if (!fingerprint || routes.length === 0) {
    return null;
  }

  let bestMatch: RouteMatch | null = null;
  let bestScore = 0;

  for (const route of routes) {
    const routeFingerprint = parseRouteFingerprint(route.fingerprint);
    if (!routeFingerprint) continue;

    const score = calculateMatchScore(fingerprint, routeFingerprint);

    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestMatch = {
        routeId: route.id,
        routeName: route.name,
        confidence: score,
        matchType: score >= 0.95 ? 'exact' : score >= 0.85 ? 'similar' : 'partial',
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity score between two route fingerprints
 */
function calculateMatchScore(fp1: RouteFingerprint, fp2: RouteFingerprint): number {
  let score = 0;
  let weights = 0;

  // Distance comparison (most important) - 50% weight
  const distanceWeight = 0.5;
  const distanceDiff = Math.abs(fp1.distance - fp2.distance);
  const distanceTolerance = 0.1; // miles
  const distanceScore = Math.max(0, 1 - distanceDiff / distanceTolerance);
  score += distanceScore * distanceWeight;
  weights += distanceWeight;

  // Elevation comparison - 30% weight
  const elevationWeight = 0.3;
  const elevationDiff = Math.abs(fp1.elevationGain - fp2.elevationGain);
  const elevationTolerance = 50; // feet
  const elevationScore = Math.max(0, 1 - elevationDiff / elevationTolerance);
  score += elevationScore * elevationWeight;
  weights += elevationWeight;

  // GPS-based matching (if available) - 20% weight
  if (fp1.startLatLng && fp2.startLatLng && fp1.endLatLng && fp2.endLatLng) {
    const gpsWeight = 0.2;

    // Calculate start point distance
    const startDist = haversineDistance(fp1.startLatLng, fp2.startLatLng);
    const startScore = startDist < 0.1 ? 1 : startDist < 0.5 ? 0.5 : 0;

    // Calculate end point distance
    const endDist = haversineDistance(fp1.endLatLng, fp2.endLatLng);
    const endScore = endDist < 0.1 ? 1 : endDist < 0.5 ? 0.5 : 0;

    score += ((startScore + endScore) / 2) * gpsWeight;
    weights += gpsWeight;
  }

  return weights > 0 ? score / weights : 0;
}

/**
 * Calculate distance between two GPS points using Haversine formula
 * Returns distance in miles
 */
function haversineDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const R = 3959; // Earth's radius in miles
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse a route fingerprint from JSON storage
 */
export function parseRouteFingerprint(json: string): RouteFingerprint | null {
  try {
    return JSON.parse(json) as RouteFingerprint;
  } catch {
    return null;
  }
}

/**
 * Serialize a route fingerprint for storage
 */
export function serializeRouteFingerprint(fp: RouteFingerprint): string {
  return JSON.stringify(fp);
}

/**
 * Create a new canonical route from a workout
 */
export function createCanonicalRouteFromWorkout(
  workout: Workout,
  name?: string
): {
  name: string;
  fingerprint: string;
  distanceMiles: number;
  totalElevationGain: number;
} | null {
  const fingerprint = computeRouteFingerprint(workout);
  if (!fingerprint) return null;

  // Generate a default name if not provided
  const routeName = name ||
    workout.routeName ||
    generateRouteName(fingerprint);

  return {
    name: routeName,
    fingerprint: serializeRouteFingerprint(fingerprint),
    distanceMiles: fingerprint.distance,
    totalElevationGain: fingerprint.elevationGain,
  };
}

/**
 * Generate a default route name based on characteristics
 */
function generateRouteName(fp: RouteFingerprint): string {
  const distanceDesc = fp.distance < 3 ? 'Short' :
                       fp.distance < 5 ? 'Medium' :
                       fp.distance < 8 ? 'Long' : 'Extended';

  const terrainDesc = fp.elevationGain < 100 ? 'Flat' :
                      fp.elevationGain < 200 ? 'Rolling' :
                      fp.elevationGain < 400 ? 'Hilly' : 'Mountainous';

  return `${distanceDesc} ${terrainDesc} Loop`;
}

/**
 * Compare a workout against a canonical route's history
 */
export function compareToRoute(
  workout: Workout,
  route: CanonicalRoute,
  previousWorkouts: Workout[]
): RouteComparison {
  const bestTime = route.bestTimeSeconds || Infinity;
  const bestPace = route.bestPaceSeconds || Infinity;
  const workoutTime = (workout.durationMinutes || 0) * 60;
  const workoutPace = workout.avgPaceSeconds || 0;

  // Check if this is a personal best
  const isPersonalBest = workoutTime < bestTime && workoutTime > 0;

  // Calculate deltas
  const timeDelta = workoutTime - (bestTime === Infinity ? workoutTime : bestTime);
  const paceDelta = workoutPace - (bestPace === Infinity ? workoutPace : bestPace);

  // Calculate rank
  const allTimes = previousWorkouts
    .filter(w => w.durationMinutes)
    .map(w => w.durationMinutes! * 60)
    .concat([workoutTime])
    .sort((a, b) => a - b);

  const rank = allTimes.indexOf(workoutTime) + 1;

  return {
    workout,
    route,
    timeDelta,
    paceDelta,
    isPersonalBest,
    rank,
  };
}

/**
 * Update a canonical route with new workout data
 */
export function updateRouteStats(
  route: CanonicalRoute,
  workout: Workout
): {
  runCount: number;
  bestTimeSeconds: number | null;
  bestPaceSeconds: number | null;
  averageTimeSeconds: number | null;
  averagePaceSeconds: number | null;
} {
  const workoutTime = workout.durationMinutes ? workout.durationMinutes * 60 : null;
  const workoutPace = workout.avgPaceSeconds;

  const newRunCount = (route.runCount || 0) + 1;

  // Update best time
  let bestTime = route.bestTimeSeconds;
  if (workoutTime && (!bestTime || workoutTime < bestTime)) {
    bestTime = workoutTime;
  }

  // Update best pace
  let bestPace = route.bestPaceSeconds;
  if (workoutPace && (!bestPace || workoutPace < bestPace)) {
    bestPace = workoutPace;
  }

  // Update averages (incremental average formula)
  let avgTime = route.averageTimeSeconds;
  if (workoutTime) {
    if (avgTime) {
      avgTime = Math.round(avgTime + (workoutTime - avgTime) / newRunCount);
    } else {
      avgTime = workoutTime;
    }
  }

  let avgPace = route.averagePaceSeconds;
  if (workoutPace) {
    if (avgPace) {
      avgPace = Math.round(avgPace + (workoutPace - avgPace) / newRunCount);
    } else {
      avgPace = workoutPace;
    }
  }

  return {
    runCount: newRunCount,
    bestTimeSeconds: bestTime || null,
    bestPaceSeconds: bestPace || null,
    averageTimeSeconds: avgTime || null,
    averagePaceSeconds: avgPace || null,
  };
}

/**
 * Get route progress summary
 */
export function getRouteProgressSummary(
  route: CanonicalRoute,
  recentWorkouts: Workout[]
): {
  totalRuns: number;
  personalBest: { time: number; pace: number; date: string } | null;
  averageTime: number | null;
  averagePace: number | null;
  improvement: { timePercent: number; description: string } | null;
  recentTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
} {
  const totalRuns = route.runCount || 0;

  // Get PB info
  const personalBest = route.bestTimeSeconds && route.bestPaceSeconds
    ? {
        time: route.bestTimeSeconds,
        pace: route.bestPaceSeconds,
        date: '', // Would need to track this separately
      }
    : null;

  // Calculate trend from recent workouts
  let recentTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';

  if (recentWorkouts.length >= 3) {
    const recentPaces = recentWorkouts
      .slice(0, 5)
      .filter(w => w.avgPaceSeconds)
      .map(w => w.avgPaceSeconds!);

    if (recentPaces.length >= 3) {
      // Compare recent average to older average
      const recentAvg = recentPaces.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const olderAvg = recentPaces.slice(2).reduce((a, b) => a + b, 0) / (recentPaces.length - 2);

      const paceChange = ((olderAvg - recentAvg) / olderAvg) * 100;

      if (paceChange > 2) recentTrend = 'improving';
      else if (paceChange < -2) recentTrend = 'declining';
      else recentTrend = 'stable';
    }
  }

  // Calculate improvement
  let improvement = null;
  if (route.averageTimeSeconds && route.bestTimeSeconds) {
    const timePercent = ((route.averageTimeSeconds - route.bestTimeSeconds) / route.averageTimeSeconds) * 100;
    improvement = {
      timePercent: Math.round(timePercent * 10) / 10,
      description: `Your best is ${Math.round(timePercent)}% faster than your average`,
    };
  }

  return {
    totalRuns,
    personalBest,
    averageTime: route.averageTimeSeconds || null,
    averagePace: route.averagePaceSeconds || null,
    improvement,
    recentTrend,
  };
}

/**
 * Suggest a route name based on workout patterns
 */
export function suggestRouteName(
  workout: Workout,
  existingRoutes: CanonicalRoute[]
): string[] {
  const suggestions: string[] = [];

  // Use route name if available
  if (workout.routeName) {
    suggestions.push(workout.routeName);
  }

  // Generate descriptor-based names
  const fingerprint = computeRouteFingerprint(workout);
  if (fingerprint) {
    suggestions.push(generateRouteName(fingerprint));

    // Add distance-based name
    suggestions.push(`${fingerprint.distance.toFixed(1)}-Mile Route`);

    // If it has significant elevation, add that
    if (fingerprint.elevationGain > 200) {
      suggestions.push(`${fingerprint.distance.toFixed(1)}-Mile Hill Route`);
    }
  }

  // Check for similar existing route names to avoid duplicates
  const existingNames = new Set(existingRoutes.map(r => r.name.toLowerCase()));
  const filtered = suggestions.filter(s => !existingNames.has(s.toLowerCase()));

  return filtered.length > 0 ? filtered : suggestions;
}
