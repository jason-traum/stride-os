// Activity Scanner - Pure function that reviews imported workouts and flags suspicious ones
// This is a data quality scanner that detects junk, glitches, misclassifications, and duplicates.

import type { Workout } from '../schema';

// ── Types ──────────────────────────────────────────────────────────────

export type FlagReason =
  | 'micro'
  | 'gps_glitch'
  | 'walk_tagged_run'
  | 'suspicious_distance'
  | 'duplicate'
  | 'zero_distance'
  | 'indoor_anomaly';

export type FlagSeverity = 'auto_exclude' | 'review' | 'info';

export interface FlaggedActivity {
  workoutId: number;
  date: string;
  name: string | null;
  distanceMiles: number | null;
  durationMinutes: number | null;
  paceSeconds: number | null;
  reason: FlagReason;
  severity: FlagSeverity;
  recommendation: string;
}

export interface ScanResult {
  totalWorkouts: number;
  flaggedCount: number;
  autoExcludeCount: number;
  reviewCount: number;
  infoCount: number;
  flagged: FlaggedActivity[];
}

// ── Thresholds ─────────────────────────────────────────────────────────

const MICRO_DISTANCE_MI = 0.3;
const MICRO_DURATION_MIN = 2;

const PACE_TOO_FAST_SEC = 210;   // 3:30/mi
const PACE_TOO_SLOW_SEC = 1200;  // 20:00/mi
const MAX_SPEED_MPH = 25;

const WALK_PACE_SEC = 960;       // 16:00/mi

const DUPLICATE_DISTANCE_TOLERANCE_MI = 0.1;
const DUPLICATE_DURATION_TOLERANCE_MIN = 1;

// Suspicious distance: pace would need to be under 2:00/mi (120 sec)
const SUSPICIOUS_MIN_PACE_SEC = 120;

// Indoor anomaly: long duration but very short distance
const INDOOR_MAX_DISTANCE_MI = 0.5;
const INDOOR_MIN_DURATION_MIN = 15;

// ── Scanner ────────────────────────────────────────────────────────────

/**
 * Scan an array of workouts and return flagged activities.
 * Pure function: no DB access. The caller queries workouts and passes them in.
 */
export function scanActivities(workouts: Workout[]): ScanResult {
  const flagged: FlaggedActivity[] = [];

  // Sort by date for duplicate detection
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const flags = checkWorkout(w, sorted, i);
    flagged.push(...flags);
  }

  // Deduplicate: if a workout is flagged for multiple reasons, keep the highest severity
  const deduped = deduplicateFlags(flagged);

  return {
    totalWorkouts: workouts.length,
    flaggedCount: deduped.length,
    autoExcludeCount: deduped.filter(f => f.severity === 'auto_exclude').length,
    reviewCount: deduped.filter(f => f.severity === 'review').length,
    infoCount: deduped.filter(f => f.severity === 'info').length,
    flagged: deduped,
  };
}

// ── Individual Checks ──────────────────────────────────────────────────

function checkWorkout(
  w: Workout,
  allWorkouts: Workout[],
  index: number
): FlaggedActivity[] {
  const flags: FlaggedActivity[] = [];
  const name = w.stravaName || w.routeName || null;
  const pace = computePace(w);

  // 1. Zero distance
  if (isZeroDistance(w)) {
    flags.push(makeFlag(w, name, pace, 'zero_distance', 'auto_exclude',
      `This ${formatDur(w.durationMinutes)} activity recorded zero distance. Likely a watch error or non-running activity.`));
  }

  // 2. Micro activities (accidental start/stop)
  if (isMicro(w)) {
    flags.push(makeFlag(w, name, pace, 'micro', 'auto_exclude',
      `This ${formatDist(w.distanceMiles)}, ${formatDur(w.durationMinutes)} activity looks like an accidental start/stop.`));
  }

  // 3. GPS glitches
  const gpsIssue = checkGpsGlitch(w, pace);
  if (gpsIssue) {
    flags.push(makeFlag(w, name, pace, 'gps_glitch', 'review', gpsIssue));
  }

  // 4. Suspicious distance (distance doesn't match duration)
  const suspiciousIssue = checkSuspiciousDistance(w, pace);
  if (suspiciousIssue) {
    flags.push(makeFlag(w, name, pace, 'suspicious_distance', 'review', suspiciousIssue));
  }

  // 5. Walk tagged as run
  if (isWalkTaggedAsRun(w, pace)) {
    flags.push(makeFlag(w, name, pace, 'walk_tagged_run', 'review',
      `Average pace of ${formatPaceSec(pace)} suggests this was a walk, not a run. Consider excluding from training metrics.`));
  }

  // 6. Indoor/treadmill anomaly
  if (isIndoorAnomaly(w)) {
    flags.push(makeFlag(w, name, pace, 'indoor_anomaly', 'info',
      `${formatDist(w.distanceMiles)} in ${formatDur(w.durationMinutes)} with very short distance may be a strength workout or non-running activity tagged as a run.`));
  }

  // 7. Duplicates (compare with nearby workouts)
  const dupFlag = checkDuplicates(w, name, pace, allWorkouts, index);
  if (dupFlag) {
    flags.push(dupFlag);
  }

  return flags;
}

// ── Detection Functions ────────────────────────────────────────────────

function isZeroDistance(w: Workout): boolean {
  const hasDuration = (w.durationMinutes ?? 0) > 0;
  const hasNoDistance = w.distanceMiles === null || w.distanceMiles === undefined || w.distanceMiles === 0;
  return hasDuration && hasNoDistance;
}

function isMicro(w: Workout): boolean {
  const distance = w.distanceMiles ?? 0;
  const duration = w.durationMinutes ?? 0;

  // Don't double-flag zero distance
  if (distance === 0 && duration === 0) return false;

  return (distance > 0 && distance < MICRO_DISTANCE_MI) ||
         (duration > 0 && duration < MICRO_DURATION_MIN && distance < 1);
}

function checkGpsGlitch(w: Workout, pace: number | null): string | null {
  // Check average pace
  if (pace !== null) {
    if (pace < PACE_TOO_FAST_SEC) {
      return `Average pace of ${formatPaceSec(pace)}/mi is unrealistically fast (faster than 3:30/mi). Likely a GPS glitch.`;
    }
    if (pace > PACE_TOO_SLOW_SEC && (w.distanceMiles ?? 0) > MICRO_DISTANCE_MI) {
      return `Average pace of ${formatPaceSec(pace)}/mi is unrealistically slow (slower than 20:00/mi). Possible GPS or data issue.`;
    }
  }

  // Check max speed from Strava
  if (w.stravaMaxSpeed && w.stravaMaxSpeed > MAX_SPEED_MPH) {
    return `Max speed of ${w.stravaMaxSpeed.toFixed(1)} mph exceeds ${MAX_SPEED_MPH} mph. Likely a GPS spike.`;
  }

  return null;
}

function checkSuspiciousDistance(w: Workout, pace: number | null): string | null {
  if (!w.distanceMiles || !w.durationMinutes) return null;
  if (w.distanceMiles < MICRO_DISTANCE_MI) return null; // Already caught by micro check

  if (pace !== null && pace < SUSPICIOUS_MIN_PACE_SEC) {
    return `${formatDist(w.distanceMiles)} in ${formatDur(w.durationMinutes)} implies a ${formatPaceSec(pace)}/mi pace, which is physically impossible. Distance or duration data is wrong.`;
  }

  return null;
}

function isWalkTaggedAsRun(w: Workout, pace: number | null): boolean {
  if (!pace) return false;
  if ((w.distanceMiles ?? 0) < MICRO_DISTANCE_MI) return false;

  // Must be slower than 16:00/mi
  if (pace < WALK_PACE_SEC) return false;

  // If it has a workout type that isn't easy/recovery/other, probably intentional
  const walklikeTypes = ['easy', 'recovery', 'other', 'cross_train'];
  if (w.workoutType && !walklikeTypes.includes(w.workoutType)) return false;

  return true;
}

function isIndoorAnomaly(w: Workout): boolean {
  const distance = w.distanceMiles ?? 0;
  const duration = w.durationMinutes ?? 0;

  if (distance === 0) return false; // Caught by zero_distance
  if (distance >= INDOOR_MAX_DISTANCE_MI) return false;
  if (duration < INDOOR_MIN_DURATION_MIN) return false;

  // Strava treadmill flag doesn't trigger this since that's expected
  if (w.stravaIsTrainer) return false;

  return true;
}

function checkDuplicates(
  w: Workout,
  name: string | null,
  pace: number | null,
  allWorkouts: Workout[],
  index: number
): FlaggedActivity | null {
  // Only look at workouts on the same date
  for (let j = 0; j < allWorkouts.length; j++) {
    if (j === index) continue;
    const other = allWorkouts[j];

    // Same date
    if (w.date !== other.date) continue;

    // Same profile
    if (w.profileId !== other.profileId) continue;

    const distDiff = Math.abs((w.distanceMiles ?? 0) - (other.distanceMiles ?? 0));
    const durDiff = Math.abs((w.durationMinutes ?? 0) - (other.durationMinutes ?? 0));

    if (distDiff <= DUPLICATE_DISTANCE_TOLERANCE_MI && durDiff <= DUPLICATE_DURATION_TOLERANCE_MIN) {
      // Flag the one with the higher ID (presumably the duplicate import)
      if (w.id > other.id) {
        return makeFlag(w, name, pace, 'duplicate', 'review',
          `Very similar to another activity on ${w.date} (${formatDist(other.distanceMiles)}, ${formatDur(other.durationMinutes)}). Likely a duplicate import.`);
      }
    }
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function computePace(w: Workout): number | null {
  // Prefer the stored average pace
  if (w.avgPaceSeconds && w.avgPaceSeconds > 0) return w.avgPaceSeconds;

  // Calculate from distance and duration
  if (w.distanceMiles && w.distanceMiles > 0 && w.durationMinutes && w.durationMinutes > 0) {
    return Math.round((w.durationMinutes * 60) / w.distanceMiles);
  }

  return null;
}

function makeFlag(
  w: Workout,
  name: string | null,
  pace: number | null,
  reason: FlagReason,
  severity: FlagSeverity,
  recommendation: string
): FlaggedActivity {
  return {
    workoutId: w.id,
    date: w.date,
    name,
    distanceMiles: w.distanceMiles,
    durationMinutes: w.durationMinutes,
    paceSeconds: pace,
    reason,
    severity,
    recommendation,
  };
}

/**
 * If a workout is flagged multiple times, keep only the highest-severity flag.
 * Severity order: auto_exclude > review > info
 */
function deduplicateFlags(flags: FlaggedActivity[]): FlaggedActivity[] {
  const byId = new Map<number, FlaggedActivity>();
  const severityRank: Record<FlagSeverity, number> = {
    auto_exclude: 3,
    review: 2,
    info: 1,
  };

  for (const flag of flags) {
    const existing = byId.get(flag.workoutId);
    if (!existing || severityRank[flag.severity] > severityRank[existing.severity]) {
      byId.set(flag.workoutId, flag);
    }
  }

  return Array.from(byId.values());
}

// ── Formatting Helpers ─────────────────────────────────────────────────

function formatDist(miles: number | null | undefined): string {
  if (!miles) return '0 mi';
  return `${miles.toFixed(2)} mi`;
}

function formatDur(minutes: number | null | undefined): string {
  if (!minutes) return '0m';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes}m`;
}

function formatPaceSec(seconds: number | null): string {
  if (!seconds) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
