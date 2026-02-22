/**
 * Personalized Recovery Model
 *
 * Estimates how recovered a runner is based on their individual training patterns,
 * not generic formulas. Learns from the runner's own data:
 *
 * 1. Analyzes historical training-to-recovery patterns:
 *    - After hard workouts, how many easy days before next quality session?
 *    - What's their typical performance after different rest periods?
 *    - Do they recover faster from certain types of stress (intervals vs long runs)?
 *
 * 2. Models individual recovery rate by looking at:
 *    - Time between quality sessions and whether the next one was good
 *    - HR recovery patterns (elevated resting HR = still fatigued)
 *    - Performance degradation when stacking hard days
 *    - Age factor (older runners recover slower)
 *
 * Pure algorithm -- no DB queries. Takes workout data in, returns recovery analysis.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type WorkoutCategory =
  | 'easy'
  | 'recovery'
  | 'long'
  | 'tempo'
  | 'threshold'
  | 'interval'
  | 'race'
  | 'hills'
  | 'fartlek'
  | 'cross_train'
  | 'other';

export interface RecoveryWorkout {
  date: string;           // YYYY-MM-DD
  category: WorkoutCategory;
  trimp: number;          // Training Impulse score
  durationMinutes: number;
  averageHR?: number;     // Average heart rate (optional)
  /** Optional: was this session subjectively 'good', 'ok', or 'bad'? */
  quality?: 'good' | 'ok' | 'bad';
}

export interface RecoveryModelInput {
  workouts: RecoveryWorkout[];  // Last 90 days, sorted by date (oldest first)
  userAge?: number;             // Optional age for age-adjusted recovery
  currentWeeklyTrimp?: number;  // Current average TRIMP/week
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type PersonalRecoveryRate = 'fast' | 'average' | 'slow';

export interface RecoveryAnalysis {
  /** Estimated hours until fully recovered from last hard session */
  estimatedRecoveryHours: number;
  /** Current recovery state (0-100, higher = more recovered) */
  recoveryScore: number;
  /** Ready for another quality/hard session? */
  readyForQuality: boolean;
  /** Learned from their data: how fast they recover relative to norms */
  personalRecoveryRate: PersonalRecoveryRate;
  /** Confidence in the model (0-1), based on data quantity and quality */
  confidence: number;
  /** Actionable recommendations based on individual patterns */
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A pair of consecutive quality sessions used to learn recovery patterns */
interface QualitySessionPair {
  first: RecoveryWorkout;
  second: RecoveryWorkout;
  gapHours: number;
  easyDaysBetween: number;
  secondWasGood: boolean;
}

/** Recovery profile for a specific stress type */
interface StressTypeProfile {
  type: 'intervals' | 'long_runs' | 'threshold' | 'general_hard';
  avgRecoveryHours: number;
  successRate: number;   // fraction of next sessions rated 'good' or 'ok'
  sampleCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Categories considered "quality" / hard sessions */
const QUALITY_CATEGORIES = new Set<WorkoutCategory>([
  'tempo', 'threshold', 'interval', 'race', 'hills', 'fartlek',
]);

/** Categories considered "easy" */
const EASY_CATEGORIES = new Set<WorkoutCategory>([
  'easy', 'recovery', 'cross_train',
]);

/** Long runs are a special hard-session variant */
const LONG_RUN_CATEGORY: WorkoutCategory = 'long';

/** Baseline recovery hours by category when we have no individual data */
const BASELINE_RECOVERY_HOURS: Record<string, number> = {
  interval: 48,
  threshold: 42,
  tempo: 36,
  race: 72,
  hills: 42,
  fartlek: 36,
  long: 48,
  easy: 12,
  recovery: 8,
  cross_train: 12,
  other: 24,
};

/** Age adjustment factors: recovery slows with age */
const AGE_RECOVERY_MULTIPLIER = (age: number): number => {
  if (age <= 30) return 1.0;
  if (age <= 40) return 1.0 + (age - 30) * 0.015;  // +1.5% per year 30-40
  if (age <= 50) return 1.15 + (age - 40) * 0.02;   // +2% per year 40-50
  return 1.35 + (age - 50) * 0.025;                  // +2.5% per year 50+
};

/** TRIMP thresholds for high-load sessions */
const HIGH_TRIMP_THRESHOLD = 120;
const VERY_HIGH_TRIMP_THRESHOLD = 180;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

function hoursBetween(dateA: string, dateB: string): number {
  const a = parseDate(dateA);
  const b = parseDate(dateB);
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function daysBetween(dateA: string, dateB: string): number {
  return hoursBetween(dateA, dateB) / 24;
}

function isQualitySession(w: RecoveryWorkout): boolean {
  if (QUALITY_CATEGORIES.has(w.category)) return true;
  if (w.category === 'long' && w.durationMinutes >= 75) return true;
  // High-TRIMP sessions count as quality regardless of label
  if (w.trimp >= HIGH_TRIMP_THRESHOLD) return true;
  return false;
}

function isEasySession(w: RecoveryWorkout): boolean {
  return EASY_CATEGORIES.has(w.category) && w.trimp < HIGH_TRIMP_THRESHOLD;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Extract pairs of consecutive quality sessions to learn recovery patterns.
 * For each pair, we record:
 * - how many hours/easy days between them
 * - whether the second session went well
 */
export function extractQualityPairs(workouts: RecoveryWorkout[]): QualitySessionPair[] {
  const pairs: QualitySessionPair[] = [];
  const qualitySessions = workouts.filter(isQualitySession);

  for (let i = 0; i < qualitySessions.length - 1; i++) {
    const first = qualitySessions[i];
    const second = qualitySessions[i + 1];
    const gapHours = hoursBetween(first.date, second.date);

    // Count easy days between the two quality sessions
    const easyDaysBetween = workouts.filter(w => {
      const wDate = parseDate(w.date).getTime();
      const firstDate = parseDate(first.date).getTime();
      const secondDate = parseDate(second.date).getTime();
      return wDate > firstDate && wDate < secondDate && isEasySession(w);
    }).length;

    // Determine if the second session was "good"
    // Priority: explicit quality rating > inferred from TRIMP consistency
    let secondWasGood: boolean;
    if (second.quality) {
      secondWasGood = second.quality === 'good' || second.quality === 'ok';
    } else {
      // Infer: if TRIMP is within reasonable range and no huge drop, it was okay
      // A bad follow-up session typically has much lower TRIMP than expected
      const trimpRatio = first.trimp > 0 ? second.trimp / first.trimp : 1;
      secondWasGood = trimpRatio >= 0.6;
    }

    pairs.push({ first, second, gapHours, easyDaysBetween, secondWasGood });
  }

  return pairs;
}

/**
 * Analyze what gap produces good follow-up sessions.
 * Returns the minimum gap (hours) that yields a success rate >= threshold.
 */
function findOptimalGap(
  pairs: QualitySessionPair[],
  successThreshold: number = 0.7
): { optimalGapHours: number; avgGap: number; dataPoints: number } {
  if (pairs.length === 0) {
    return { optimalGapHours: 48, avgGap: 48, dataPoints: 0 };
  }

  // Sort pairs by gap hours
  const sorted = [...pairs].sort((a, b) => a.gapHours - b.gapHours);
  const avgGap = sorted.reduce((sum, p) => sum + p.gapHours, 0) / sorted.length;

  // Sliding analysis: find the smallest gap where cumulative success rate >= threshold
  let successes = 0;
  let total = 0;
  let optimalGapHours = avgGap; // default to average

  for (const pair of sorted) {
    total++;
    if (pair.secondWasGood) successes++;
    const rate = successes / total;

    if (rate >= successThreshold && total >= 3) {
      optimalGapHours = pair.gapHours;
      break;
    }
  }

  return { optimalGapHours, avgGap, dataPoints: pairs.length };
}

/**
 * Build recovery profiles by stress type.
 * Groups quality session pairs by what type of stress the first session was,
 * then calculates recovery stats for each type.
 */
export function buildStressTypeProfiles(
  pairs: QualitySessionPair[]
): StressTypeProfile[] {
  const buckets = new Map<string, QualitySessionPair[]>();

  for (const pair of pairs) {
    let type: StressTypeProfile['type'];
    const cat = pair.first.category;

    if (cat === 'interval' || cat === 'fartlek') {
      type = 'intervals';
    } else if (cat === 'long') {
      type = 'long_runs';
    } else if (cat === 'threshold' || cat === 'tempo') {
      type = 'threshold';
    } else {
      type = 'general_hard';
    }

    const existing = buckets.get(type) || [];
    existing.push(pair);
    buckets.set(type, existing);
  }

  const profiles: StressTypeProfile[] = [];
  for (const [type, typePairs] of Array.from(buckets)) {
    const avgHours = typePairs.reduce((s: number, p: QualitySessionPair) => s + p.gapHours, 0) / typePairs.length;
    const goodCount = typePairs.filter((p: QualitySessionPair) => p.secondWasGood).length;
    const successRate = goodCount / typePairs.length;

    profiles.push({
      type: type as StressTypeProfile['type'],
      avgRecoveryHours: Math.round(avgHours),
      successRate: Math.round(successRate * 100) / 100,
      sampleCount: typePairs.length,
    });
  }

  return profiles;
}

/**
 * Detect performance degradation from stacking hard days.
 * Looks at cases where quality sessions happened within 24h of each other
 * and measures how often the second session suffered.
 */
function detectStackingPenalty(pairs: QualitySessionPair[]): {
  stackingDetected: boolean;
  degradationRate: number;
  sampleCount: number;
} {
  const stackedPairs = pairs.filter(p => p.gapHours <= 28); // ~1 day buffer
  if (stackedPairs.length < 2) {
    return { stackingDetected: false, degradationRate: 0, sampleCount: 0 };
  }

  const badFollowUps = stackedPairs.filter(p => !p.secondWasGood).length;
  const degradationRate = badFollowUps / stackedPairs.length;

  return {
    stackingDetected: degradationRate > 0.5,
    degradationRate: Math.round(degradationRate * 100) / 100,
    sampleCount: stackedPairs.length,
  };
}

/**
 * Analyze HR patterns for fatigue signals.
 * Looks at average HR across easy runs: elevated easy-run HR suggests lingering fatigue.
 */
function analyzeHRPatterns(workouts: RecoveryWorkout[]): {
  hrTrendFatigued: boolean;
  recentEasyHR: number | null;
  baselineEasyHR: number | null;
} {
  const easyRuns = workouts.filter(
    w => isEasySession(w) && w.averageHR && w.averageHR > 0
  );

  if (easyRuns.length < 4) {
    return { hrTrendFatigued: false, recentEasyHR: null, baselineEasyHR: null };
  }

  // Split into older (first 60%) and recent (last 40%)
  const splitIdx = Math.floor(easyRuns.length * 0.6);
  const olderRuns = easyRuns.slice(0, splitIdx);
  const recentRuns = easyRuns.slice(splitIdx);

  const baselineHR = olderRuns.reduce((s, r) => s + r.averageHR!, 0) / olderRuns.length;
  const recentHR = recentRuns.reduce((s, r) => s + r.averageHR!, 0) / recentRuns.length;

  // Elevated by 5+ BPM on easy runs suggests accumulated fatigue
  const hrTrendFatigued = recentHR - baselineHR >= 5;

  return {
    hrTrendFatigued,
    recentEasyHR: Math.round(recentHR),
    baselineEasyHR: Math.round(baselineHR),
  };
}

/**
 * Determine the runner's personal recovery rate relative to norms.
 * Compares their observed optimal recovery gap to population baselines.
 */
function classifyRecoveryRate(
  optimalGapHours: number,
  age: number | undefined
): PersonalRecoveryRate {
  // Baseline: ~48h is "average" for quality session spacing
  const ageMultiplier = age ? AGE_RECOVERY_MULTIPLIER(age) : 1.0;
  const ageAdjustedBaseline = 48 * ageMultiplier;

  // Compare their actual gap to age-adjusted expectation
  const ratio = optimalGapHours / ageAdjustedBaseline;

  if (ratio < 0.8) return 'fast';
  if (ratio > 1.2) return 'slow';
  return 'average';
}

/**
 * Calculate current recovery score (0-100) based on time since last hard session
 * and individual recovery rate.
 */
function calculateRecoveryScore(
  hoursSinceLastHard: number,
  estimatedRecoveryHours: number,
  hrFatigued: boolean,
  recentTrimpLoad: number,
  avgWeeklyTrimp: number | undefined
): number {
  // Base score: exponential recovery curve
  // At 0h = 0, at estimatedRecoveryHours = ~80, at 1.5x = ~95
  const recoveryFraction = 1 - Math.exp(-2.5 * hoursSinceLastHard / estimatedRecoveryHours);
  let score = recoveryFraction * 100;

  // Penalty for elevated HR (fatigue signal)
  if (hrFatigued) {
    score -= 10;
  }

  // Penalty for being overloaded (recent TRIMP much higher than average)
  if (avgWeeklyTrimp && avgWeeklyTrimp > 0) {
    const loadRatio = recentTrimpLoad / avgWeeklyTrimp;
    if (loadRatio > 1.3) {
      score -= (loadRatio - 1.3) * 15; // -15 per 100% over average
    }
  }

  return Math.round(clamp(score, 0, 100));
}

/**
 * Generate personalized recommendations based on the analysis.
 */
function generateRecommendations(
  recoveryScore: number,
  readyForQuality: boolean,
  stressProfiles: StressTypeProfile[],
  stackingPenalty: { stackingDetected: boolean; degradationRate: number },
  hrAnalysis: { hrTrendFatigued: boolean; recentEasyHR: number | null; baselineEasyHR: number | null },
  optimalGapHours: number,
  lastHardCategory: WorkoutCategory | null,
  personalRate: PersonalRecoveryRate,
  pairs: QualitySessionPair[]
): string[] {
  const recs: string[] = [];

  // Gap recommendation
  const gapDays = Math.round(optimalGapHours / 24 * 10) / 10;
  if (pairs.length >= 3) {
    recs.push(
      `Your data suggests ${gapDays >= 2 ? Math.round(gapDays) : gapDays} days between hard sessions works best for you`
    );
  }

  // Stress type specific
  for (const profile of stressProfiles) {
    if (profile.sampleCount >= 3) {
      const hours = profile.avgRecoveryHours;
      const label = profile.type === 'intervals' ? 'interval sessions'
        : profile.type === 'long_runs' ? 'long runs'
        : profile.type === 'threshold' ? 'threshold sessions'
        : 'hard workouts';

      if (profile.successRate < 0.6) {
        recs.push(`You may need more recovery after ${label} (${Math.round(hours)}h avg gap, only ${Math.round(profile.successRate * 100)}% of follow-ups went well)`);
      } else if (profile.successRate >= 0.85) {
        recs.push(`You recover well from ${label} -- ${Math.round(hours)}h is typically enough`);
      }
    }
  }

  // Stacking warning
  if (stackingPenalty.stackingDetected) {
    recs.push(
      `Back-to-back hard days hurt your performance ${Math.round(stackingPenalty.degradationRate * 100)}% of the time -- avoid stacking quality sessions`
    );
  }

  // HR fatigue
  if (hrAnalysis.hrTrendFatigued && hrAnalysis.recentEasyHR && hrAnalysis.baselineEasyHR) {
    recs.push(
      `Your easy-run HR is elevated (${hrAnalysis.recentEasyHR} vs baseline ${hrAnalysis.baselineEasyHR} bpm) -- consider an extra rest day`
    );
  }

  // Current state
  if (!readyForQuality && recoveryScore < 50) {
    recs.push('Recovery is low -- prioritize easy running, sleep, and nutrition today');
  } else if (readyForQuality && recoveryScore >= 80) {
    recs.push('You are well-recovered and ready for a quality session');
  }

  // Last hard session specific
  if (lastHardCategory) {
    const baselineHours = BASELINE_RECOVERY_HOURS[lastHardCategory] || 36;
    if (lastHardCategory === 'race') {
      recs.push('Post-race recovery: take at least 3 easy days before your next hard effort');
    } else if (lastHardCategory === 'long' && baselineHours >= 48) {
      recs.push('Long run recovery: the next day should be easy or off');
    }
  }

  // Recovery rate insight
  if (pairs.length >= 5) {
    if (personalRate === 'fast') {
      recs.push('Your recovery rate is faster than average for your age -- you can handle slightly higher frequency');
    } else if (personalRate === 'slow') {
      recs.push('Your recovery rate is slower than average -- prioritize spacing out hard sessions and sleep quality');
    }
  }

  return recs;
}

/**
 * Calculate model confidence based on data quantity and quality.
 */
function calculateConfidence(
  totalWorkouts: number,
  qualityPairs: number,
  hasHRData: boolean,
  hasQualityRatings: boolean
): number {
  // Base: number of workouts (need at least 20 for moderate confidence)
  let confidence = Math.min(0.4, totalWorkouts / 50);

  // Quality pairs are the most valuable signal
  confidence += Math.min(0.35, qualityPairs / 15 * 0.35);

  // HR data adds certainty
  if (hasHRData) confidence += 0.1;

  // Explicit quality ratings are very valuable
  if (hasQualityRatings) confidence += 0.15;

  return Math.round(clamp(confidence, 0, 1) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze a runner's recovery patterns and return personalized recovery metrics.
 *
 * @param input - Recent workouts (ideally 90 days), optional age and weekly TRIMP
 * @returns RecoveryAnalysis with personalized recovery estimates
 */
export function analyzeRecovery(input: RecoveryModelInput): RecoveryAnalysis {
  const { workouts, userAge, currentWeeklyTrimp } = input;

  // Sort workouts by date (defensive)
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  // ---- Edge case: no workouts ----
  if (sorted.length === 0) {
    return {
      estimatedRecoveryHours: 48,
      recoveryScore: 100,
      readyForQuality: true,
      personalRecoveryRate: 'average',
      confidence: 0,
      recommendations: ['Not enough training data to personalize recovery estimates'],
    };
  }

  // ---- Extract quality session pairs ----
  const pairs = extractQualityPairs(sorted);

  // ---- Build stress type profiles ----
  const stressProfiles = buildStressTypeProfiles(pairs);

  // ---- Find optimal gap ----
  const { optimalGapHours, dataPoints: gapDataPoints } = findOptimalGap(pairs);

  // ---- Detect stacking penalty ----
  const stackingPenalty = detectStackingPenalty(pairs);

  // ---- Analyze HR patterns ----
  const hrAnalysis = analyzeHRPatterns(sorted);

  // ---- Classify personal recovery rate ----
  const personalRate = classifyRecoveryRate(optimalGapHours, userAge);

  // ---- Calculate estimated recovery hours for the last hard session ----
  const lastHardSession = [...sorted]
    .reverse()
    .find(w => isQualitySession(w));

  let estimatedRecoveryHours: number;
  let lastHardCategory: WorkoutCategory | null = null;

  if (lastHardSession) {
    lastHardCategory = lastHardSession.category;

    // Start with the category baseline
    const baseline = BASELINE_RECOVERY_HOURS[lastHardCategory] || 36;

    // If we have learned data, blend learned and baseline
    if (gapDataPoints >= 3) {
      // Weight learned data more heavily with more observations
      const learnedWeight = Math.min(0.8, gapDataPoints / 10);
      estimatedRecoveryHours = baseline * (1 - learnedWeight) + optimalGapHours * learnedWeight;
    } else {
      estimatedRecoveryHours = baseline;
    }

    // Adjust for TRIMP intensity of the specific session
    if (lastHardSession.trimp >= VERY_HIGH_TRIMP_THRESHOLD) {
      estimatedRecoveryHours *= 1.2;
    } else if (lastHardSession.trimp >= HIGH_TRIMP_THRESHOLD) {
      estimatedRecoveryHours *= 1.1;
    }

    // Age adjustment
    if (userAge) {
      estimatedRecoveryHours *= AGE_RECOVERY_MULTIPLIER(userAge);
    }

    estimatedRecoveryHours = Math.round(estimatedRecoveryHours);
  } else {
    // No hard sessions found: fully recovered
    estimatedRecoveryHours = 0;
  }

  // ---- Calculate recovery score ----
  let hoursSinceLastHard = 0;
  if (lastHardSession) {
    const now = new Date();
    const lastDate = parseDate(lastHardSession.date);
    hoursSinceLastHard = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    // Clamp to non-negative (future-dated workouts shouldn't break us)
    hoursSinceLastHard = Math.max(0, hoursSinceLastHard);
  }

  // Calculate recent 7-day TRIMP
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentTrimpLoad = sorted
    .filter(w => parseDate(w.date).getTime() >= sevenDaysAgo.getTime())
    .reduce((sum, w) => sum + w.trimp, 0);

  const recoveryScore = lastHardSession
    ? calculateRecoveryScore(
        hoursSinceLastHard,
        estimatedRecoveryHours || 48,
        hrAnalysis.hrTrendFatigued,
        recentTrimpLoad,
        currentWeeklyTrimp
      )
    : 100;

  // ---- Ready for quality? ----
  const readyForQuality = recoveryScore >= 65 && hoursSinceLastHard >= estimatedRecoveryHours * 0.75;

  // ---- Calculate confidence ----
  const hasHRData = sorted.some(w => w.averageHR && w.averageHR > 0);
  const hasQualityRatings = sorted.some(w => w.quality !== undefined);
  const confidence = calculateConfidence(sorted.length, pairs.length, hasHRData, hasQualityRatings);

  // ---- Generate recommendations ----
  const recommendations = generateRecommendations(
    recoveryScore,
    readyForQuality,
    stressProfiles,
    stackingPenalty,
    hrAnalysis,
    optimalGapHours,
    lastHardCategory,
    personalRate,
    pairs
  );

  return {
    estimatedRecoveryHours,
    recoveryScore,
    readyForQuality,
    personalRecoveryRate: personalRate,
    confidence,
    recommendations,
  };
}
