// Interval Pattern Detector
// Pure function module that recognizes structured interval patterns from workout segments.
// Detects repeats (8x800m), ladders (400-800-1200-800-400), pyramids, fartlek, etc.
// No DB imports, no side effects.

import type { WorkoutSegment } from '../schema';

// ==================== Types ====================

export type IntervalStructureType =
  | 'repeat'
  | 'ladder'
  | 'pyramid'
  | 'mixed'
  | 'tempo_intervals'
  | 'fartlek'
  | 'unknown';

export interface IntervalPattern {
  type: IntervalStructureType;
  description: string; // Human-readable: "8 x 800m @ 5:45/mi with 200m jog recovery"
  workSegments: number;
  restSegments: number;
  workDistance: { avg: number; total: number }; // meters
  restDistance: { avg: number; total: number }; // meters
  workPace: { avg: number; fastest: number; slowest: number }; // sec/mi
  restPace: { avg: number }; // sec/mi
  consistency: number; // 0-1, how consistent were the work intervals
  restToWorkRatio: number;
}

// ==================== Constants ====================

const METERS_PER_MILE = 1609.344;

// Distance tolerance for clustering segments (10%)
const DISTANCE_CLUSTER_TOLERANCE = 0.10;

// Minimum distance to consider a segment (skip GPS artifacts)
const MIN_SEGMENT_DISTANCE_METERS = 100;

// Pace difference threshold to distinguish work from rest (seconds/mile)
// Work segments are significantly faster than rest segments
const WORK_REST_PACE_GAP = 60; // 60 sec/mi difference

// Standard interval distances in meters for snapping descriptions
// Ordered so that mile-based distances are checked before nearby metric distances.
// This prevents 2 miles (3219m) from snapping to 3K (3000m).
const STANDARD_DISTANCES: { meters: number; label: string }[] = [
  { meters: 200, label: '200m' },
  { meters: 400, label: '400m' },
  { meters: 600, label: '600m' },
  { meters: 800, label: '800m' },
  { meters: 1000, label: '1K' },
  { meters: 1200, label: '1200m' },
  { meters: 1600, label: '1 mile' },
  { meters: 2000, label: '2K' },
  { meters: 2414, label: '1.5 miles' },
  { meters: 3219, label: '2 miles' },
  { meters: 3000, label: '3K' },
  { meters: 4828, label: '3 miles' },
  { meters: 5000, label: '5K' },
];

// Threshold for "tempo intervals" — work segments longer than this
const TEMPO_INTERVAL_THRESHOLD_METERS = 2400; // ~1.5 miles

// ==================== Helpers ====================

function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

function formatPace(secondsPerMile: number): string {
  const mins = Math.floor(secondsPerMile / 60);
  const secs = Math.round(secondsPerMile % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
}

/**
 * Snap a distance in meters to the nearest standard interval distance.
 * Returns the label if within 15% of a standard distance, otherwise
 * formats the raw distance.
 */
function snapToStandardDistance(meters: number): string {
  for (const std of STANDARD_DISTANCES) {
    const ratio = meters / std.meters;
    if (ratio >= 0.85 && ratio <= 1.15) {
      return std.label;
    }
  }
  // No standard match — format as meters or miles
  if (meters < 1500) {
    return `${Math.round(meters)}m`;
  }
  const miles = meters / METERS_PER_MILE;
  if (Math.abs(miles - Math.round(miles)) < 0.1) {
    return `${Math.round(miles)} mile${Math.round(miles) !== 1 ? 's' : ''}`;
  }
  return `${miles.toFixed(1)} miles`;
}

/**
 * Check if two distances are within the clustering tolerance of each other.
 */
function distancesMatch(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  const ratio = Math.max(a, b) / Math.min(a, b);
  return ratio <= (1 + DISTANCE_CLUSTER_TOLERANCE);
}

/**
 * Compute the coefficient of variation for an array of numbers.
 * Returns 0 for empty/single-element arrays.
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// ==================== Segment Analysis ====================

interface AnalyzedSegment {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerMile: number;
  role: 'work' | 'rest' | 'warmup' | 'cooldown' | 'skip';
  original: WorkoutSegment;
}

/**
 * Analyze raw segments into work/rest roles based on pace and position.
 */
function analyzeSegments(segments: WorkoutSegment[]): AnalyzedSegment[] {
  const analyzed: AnalyzedSegment[] = segments.map((seg, i) => {
    const distMeters = milesToMeters(seg.distanceMiles || 0);
    const durSec = seg.durationSeconds || 0;
    const paceSPM = seg.paceSecondsPerMile || 0;

    return {
      index: i,
      distanceMeters: distMeters,
      durationSeconds: durSec,
      paceSecondsPerMile: paceSPM,
      role: 'work' as const, // default, will be refined
      original: seg,
    };
  });

  // Step 1: Mark segments that are too short as skip (GPS artifacts)
  for (const seg of analyzed) {
    if (seg.distanceMeters < MIN_SEGMENT_DISTANCE_METERS) {
      seg.role = 'skip';
    }
  }

  // Step 2: If segments already have paceZone or segmentType from the effort classifier,
  // use that to determine work/rest/warmup/cooldown
  for (const seg of analyzed) {
    if (seg.role === 'skip') continue;

    const type = seg.original.segmentType;
    const zone = seg.original.paceZone;

    if (type === 'warmup' || zone === 'warmup') {
      seg.role = 'warmup';
    } else if (type === 'cooldown' || zone === 'cooldown') {
      seg.role = 'cooldown';
    } else if (type === 'recovery' || zone === 'recovery') {
      seg.role = 'rest';
    }
    // work/steady/intervals stay as 'work' — we'll refine below
  }

  // Step 3: For segments without explicit zone labels, use pace clustering.
  // Identify work vs rest by comparing paces.
  const unlabeled = analyzed.filter(
    s => s.role === 'work' && s.paceSecondsPerMile > 0
  );

  if (unlabeled.length >= 4) {
    // Sort by pace to find a natural split
    const sortedPaces = [...unlabeled].sort((a, b) => a.paceSecondsPerMile - b.paceSecondsPerMile);
    const medianPace = sortedPaces[Math.floor(sortedPaces.length / 2)].paceSecondsPerMile;

    // Find the largest gap in paces
    let maxGap = 0;
    let gapIndex = -1;
    for (let i = 0; i < sortedPaces.length - 1; i++) {
      const gap = sortedPaces[i + 1].paceSecondsPerMile - sortedPaces[i].paceSecondsPerMile;
      if (gap > maxGap) {
        maxGap = gap;
        gapIndex = i;
      }
    }

    // If there's a meaningful pace gap (>= WORK_REST_PACE_GAP), split into work and rest
    if (maxGap >= WORK_REST_PACE_GAP && gapIndex >= 0) {
      const fastThreshold = sortedPaces[gapIndex].paceSecondsPerMile;
      for (const seg of unlabeled) {
        if (seg.paceSecondsPerMile > fastThreshold) {
          seg.role = 'rest';
        }
      }
    }
    // If no big gap, check alternating pattern (fast-slow-fast-slow)
    else if (unlabeled.length >= 4) {
      const alternating = checkAlternatingPattern(unlabeled);
      if (alternating) {
        for (let i = 0; i < unlabeled.length; i++) {
          // In an alternating pattern starting with work, odd indices are rest
          const segInOrder = analyzed.indexOf(unlabeled[i]);
          // Determine based on pace relative to median
          if (unlabeled[i].paceSecondsPerMile > medianPace + 15) {
            unlabeled[i].role = 'rest';
          }
        }
      }
    }
  }

  // Step 4: Detect warmup/cooldown from position and pace if not already labeled.
  // First and last segments that are significantly slower than the work segments
  // get labeled as warmup/cooldown.
  const workSegs = analyzed.filter(s => s.role === 'work');
  if (workSegs.length >= 3) {
    const avgWorkPace =
      workSegs.reduce((sum, s) => sum + s.paceSecondsPerMile, 0) / workSegs.length;

    // Check first segment
    const first = analyzed.find(s => s.role !== 'skip');
    if (first && first.role === 'work' && first.paceSecondsPerMile > avgWorkPace + 30) {
      first.role = 'warmup';
    }

    // Check last segment
    const nonSkipped = analyzed.filter(s => s.role !== 'skip');
    const last = nonSkipped[nonSkipped.length - 1];
    if (last && last.role === 'work' && last.paceSecondsPerMile > avgWorkPace + 30) {
      last.role = 'cooldown';
    }
  }

  return analyzed;
}

/**
 * Check if segments alternate between two distinct pace groups.
 */
function checkAlternatingPattern(segments: AnalyzedSegment[]): boolean {
  if (segments.length < 4) return false;

  // Check if there's a consistent fast-slow-fast-slow pattern
  let alternations = 0;
  for (let i = 1; i < segments.length; i++) {
    const prevPace = segments[i - 1].paceSecondsPerMile;
    const currPace = segments[i].paceSecondsPerMile;
    const diff = Math.abs(currPace - prevPace);
    if (diff > 20) { // at least 20 sec/mi difference to count as alternation
      alternations++;
    }
  }

  // If most transitions are alternations, we have an alternating pattern
  return alternations >= (segments.length - 1) * 0.6;
}

// ==================== Pattern Detection ====================

interface DistanceCluster {
  representativeDistance: number; // meters
  segments: AnalyzedSegment[];
  count: number;
}

/**
 * Cluster work segments by approximate distance.
 */
function clusterByDistance(segments: AnalyzedSegment[]): DistanceCluster[] {
  const clusters: DistanceCluster[] = [];

  for (const seg of segments) {
    let matched = false;
    for (const cluster of clusters) {
      if (distancesMatch(seg.distanceMeters, cluster.representativeDistance)) {
        cluster.segments.push(seg);
        cluster.count++;
        // Update representative to average
        cluster.representativeDistance =
          cluster.segments.reduce((s, seg) => s + seg.distanceMeters, 0) / cluster.segments.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        representativeDistance: seg.distanceMeters,
        segments: [seg],
        count: 1,
      });
    }
  }

  // Sort clusters by count descending (most common distance first)
  clusters.sort((a, b) => b.count - a.count);

  return clusters;
}

/**
 * Detect if work segments form a ladder (ascending or descending distances).
 * Important: only returns ladder/pyramid when distances actually vary significantly.
 * Same-distance repeats must NOT be detected as ladders.
 */
function detectLadder(workSegments: AnalyzedSegment[]): 'ladder' | 'pyramid' | null {
  if (workSegments.length < 3) return null;

  const distances = workSegments.map(s => s.distanceMeters);

  // First check: do the distances actually vary?
  // If all distances cluster to the same value (within tolerance), this is NOT a ladder.
  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);
  if (minDist === 0) return null;
  const distRange = maxDist / minDist;
  if (distRange < 1.25) {
    // Less than 25% variation between shortest and longest — these are repeats, not a ladder
    return null;
  }

  // Check ascending then descending (pyramid)
  // Find the peak index
  let peakIdx = 0;
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] > distances[peakIdx]) {
      peakIdx = i;
    }
  }

  // Pyramid: peak is not at the start or end, ascending before peak, descending after
  if (peakIdx > 0 && peakIdx < distances.length - 1) {
    let isAscending = true;
    for (let i = 1; i <= peakIdx; i++) {
      // Each step must be notably larger (at least 15% growth)
      if (distances[i] < distances[i - 1] * 1.15) {
        isAscending = false;
        break;
      }
    }
    let isDescending = true;
    for (let i = peakIdx + 1; i < distances.length; i++) {
      // Each step must be notably smaller (at least 15% shrinkage)
      if (distances[i] > distances[i - 1] * 0.85) {
        isDescending = false;
        break;
      }
    }
    if (isAscending && isDescending) return 'pyramid';
  }

  // Ladder: strictly ascending or strictly descending with meaningful changes
  let ascending = true;
  let descending = true;
  for (let i = 1; i < distances.length; i++) {
    // Require each step to change by at least 15%
    if (distances[i] < distances[i - 1] * 1.15) ascending = false;
    if (distances[i] > distances[i - 1] * 0.85) descending = false;
  }

  if (ascending && !descending) return 'ladder';
  if (descending && !ascending) return 'ladder';

  // Check for ascending-then-descending (a common "ladder" in running: 400-800-1200-800-400)
  if (workSegments.length >= 4) {
    for (let turn = 1; turn < distances.length - 1; turn++) {
      let ascOk = true;
      for (let i = 1; i <= turn; i++) {
        if (distances[i] < distances[i - 1] * 1.15) { ascOk = false; break; }
      }
      let descOk = true;
      for (let i = turn + 1; i < distances.length; i++) {
        if (distances[i] > distances[i - 1] * 0.85) { descOk = false; break; }
      }
      if (ascOk && descOk) return 'ladder';
    }
  }

  return null;
}

/**
 * Detect if the workout is fartlek-style (varied paces, no consistent rest structure).
 */
function detectFartlek(
  workSegments: AnalyzedSegment[],
  restSegments: AnalyzedSegment[],
): boolean {
  if (workSegments.length < 3) return false;

  // Fartlek characteristics:
  // 1. Varied work distances (high CV)
  // 2. Inconsistent or no rest periods
  // 3. Work paces vary significantly

  const distCV = coefficientOfVariation(workSegments.map(s => s.distanceMeters));
  const paceCV = coefficientOfVariation(workSegments.map(s => s.paceSecondsPerMile));

  // High distance variation + few/no rest segments = fartlek
  const fewRests = restSegments.length < workSegments.length * 0.5;
  const highDistVariation = distCV > 0.3;
  const highPaceVariation = paceCV > 0.1;

  return (highDistVariation && fewRests) || (highPaceVariation && highDistVariation);
}

// ==================== Main Detection ====================

/**
 * Detect interval patterns from workout segments.
 *
 * This is a pure function — no DB access, no side effects.
 * Returns an IntervalPattern describing the detected structure.
 */
export function detectIntervalPattern(segments: WorkoutSegment[]): IntervalPattern {
  // Edge case: too few segments
  if (!segments || segments.length === 0) {
    return unknownPattern('No segments available');
  }

  if (segments.length === 1) {
    return unknownPattern('Single segment — no interval structure detectable');
  }

  // Analyze and classify segments
  const analyzed = analyzeSegments(segments);

  // Filter out skipped segments (GPS artifacts, too short)
  const valid = analyzed.filter(s => s.role !== 'skip');

  if (valid.length < 2) {
    return unknownPattern('Insufficient valid segments after filtering');
  }

  // Separate by role
  const workSegs = valid.filter(s => s.role === 'work');
  const restSegs = valid.filter(s => s.role === 'rest');

  // Need at least 2 work segments to detect a pattern
  if (workSegs.length < 2) {
    // If we have 2-3 total segments but can't distinguish work/rest,
    // try minimal detection
    if (valid.length >= 2 && valid.length <= 3) {
      return unknownPattern(
        `${valid.length} segments detected but unable to distinguish work from rest`
      );
    }
    return unknownPattern('Fewer than 2 work segments identified');
  }

  // Compute work/rest stats
  const workDistances = workSegs.map(s => s.distanceMeters);
  const workPaces = workSegs.map(s => s.paceSecondsPerMile).filter(p => p > 0);
  const restDistances = restSegs.map(s => s.distanceMeters);
  const restPaces = restSegs.map(s => s.paceSecondsPerMile).filter(p => p > 0);

  const avgWorkDist = workDistances.reduce((a, b) => a + b, 0) / workDistances.length;
  const totalWorkDist = workDistances.reduce((a, b) => a + b, 0);
  const avgRestDist = restDistances.length > 0
    ? restDistances.reduce((a, b) => a + b, 0) / restDistances.length
    : 0;
  const totalRestDist = restDistances.reduce((a, b) => a + b, 0);

  const avgWorkPace = workPaces.length > 0
    ? workPaces.reduce((a, b) => a + b, 0) / workPaces.length
    : 0;
  const fastestPace = workPaces.length > 0 ? Math.min(...workPaces) : 0;
  const slowestPace = workPaces.length > 0 ? Math.max(...workPaces) : 0;
  const avgRestPace = restPaces.length > 0
    ? restPaces.reduce((a, b) => a + b, 0) / restPaces.length
    : 0;

  // Consistency: how uniform are the work distances? (1 - CV, clamped to 0-1)
  const distCV = coefficientOfVariation(workDistances);
  const consistency = Math.max(0, Math.min(1, 1 - distCV));

  // Rest-to-work ratio (by duration)
  const totalWorkDur = workSegs.reduce((s, seg) => s + seg.durationSeconds, 0);
  const totalRestDur = restSegs.reduce((s, seg) => s + seg.durationSeconds, 0);
  const restToWorkRatio = totalWorkDur > 0 ? totalRestDur / totalWorkDur : 0;

  // Base result template
  const baseResult: Omit<IntervalPattern, 'type' | 'description'> = {
    workSegments: workSegs.length,
    restSegments: restSegs.length,
    workDistance: { avg: Math.round(avgWorkDist), total: Math.round(totalWorkDist) },
    restDistance: { avg: Math.round(avgRestDist), total: Math.round(totalRestDist) },
    workPace: {
      avg: Math.round(avgWorkPace),
      fastest: Math.round(fastestPace),
      slowest: Math.round(slowestPace),
    },
    restPace: { avg: Math.round(avgRestPace) },
    consistency,
    restToWorkRatio: Math.round(restToWorkRatio * 100) / 100,
  };

  // ===== Pattern detection =====

  // 1. Check for ladder/pyramid
  const ladderResult = detectLadder(workSegs);
  if (ladderResult && workSegs.length >= 3) {
    const distLabels = workSegs.map(s => snapToStandardDistance(s.distanceMeters));
    const description = ladderResult === 'pyramid'
      ? `Pyramid: ${distLabels.join(' - ')} @ ${formatPace(avgWorkPace)}`
      : `Ladder: ${distLabels.join(' - ')} @ ${formatPace(avgWorkPace)}`;
    return { ...baseResult, type: ladderResult, description };
  }

  // 2. Check for fartlek
  if (detectFartlek(workSegs, restSegs)) {
    return {
      ...baseResult,
      type: 'fartlek',
      description: `Fartlek: ${workSegs.length} surges, avg ${snapToStandardDistance(avgWorkDist)} @ ${formatPace(avgWorkPace)}`,
    };
  }

  // 3. Cluster by distance to find repeats
  const clusters = clusterByDistance(workSegs);

  if (clusters.length === 1) {
    // All work segments are approximately the same distance — repeats!
    const count = clusters[0].count;
    const dist = clusters[0].representativeDistance;
    const distLabel = snapToStandardDistance(dist);

    // Check if these are tempo intervals (long repeats)
    const isTempo = dist >= TEMPO_INTERVAL_THRESHOLD_METERS;
    const type: IntervalStructureType = isTempo ? 'tempo_intervals' : 'repeat';

    // Build description
    let description = `${count} x ${distLabel} @ ${formatPace(avgWorkPace)}`;
    if (restSegs.length > 0 && avgRestDist > 0) {
      const restLabel = snapToStandardDistance(avgRestDist);
      const restType = avgRestPace > 0 && avgRestPace < 720 ? 'jog' : 'recovery';
      description += ` with ${restLabel} ${restType}`;
    }

    return { ...baseResult, type, description };
  }

  if (clusters.length === 2) {
    // Two distinct distance groups — mixed interval
    const c1 = clusters[0];
    const c2 = clusters[1];
    const d1 = snapToStandardDistance(c1.representativeDistance);
    const d2 = snapToStandardDistance(c2.representativeDistance);

    return {
      ...baseResult,
      type: 'mixed',
      description: `Mixed: ${c1.count} x ${d1} + ${c2.count} x ${d2} @ ${formatPace(avgWorkPace)}`,
    };
  }

  // 3+ distance clusters with no ladder pattern — mixed or fartlek
  if (clusters.length >= 3) {
    // If most segments cluster into 2-3 groups, it's mixed
    // If they're all different, it's more like fartlek
    const topTwo = clusters.slice(0, 2).reduce((s, c) => s + c.count, 0);
    if (topTwo >= workSegs.length * 0.6) {
      const parts = clusters
        .filter(c => c.count >= 2)
        .map(c => `${c.count} x ${snapToStandardDistance(c.representativeDistance)}`)
        .join(' + ');
      return {
        ...baseResult,
        type: 'mixed',
        description: `Mixed: ${parts || workSegs.length + ' varied intervals'} @ ${formatPace(avgWorkPace)}`,
      };
    }

    return {
      ...baseResult,
      type: 'fartlek',
      description: `Fartlek: ${workSegs.length} surges of varying distance @ ${formatPace(avgWorkPace)}`,
    };
  }

  return { ...baseResult, type: 'unknown', description: 'Unable to determine interval pattern' };
}

/**
 * Build an unknown/minimal pattern result.
 */
function unknownPattern(description: string): IntervalPattern {
  return {
    type: 'unknown',
    description,
    workSegments: 0,
    restSegments: 0,
    workDistance: { avg: 0, total: 0 },
    restDistance: { avg: 0, total: 0 },
    workPace: { avg: 0, fastest: 0, slowest: 0 },
    restPace: { avg: 0 },
    consistency: 0,
    restToWorkRatio: 0,
  };
}
