// Data Quality Checker - Deterministic engine for assessing workout data integrity
// Feature 16: Data Integrity Report

import type { Workout, WorkoutSegment } from '../schema';

export type GPSQuality = 'good' | 'noisy' | 'missing';
export type HRQuality = 'good' | 'dropouts' | 'erratic' | 'missing';
export type PaceReliability = 'good' | 'treadmill' | 'gps_drift';

export interface DataQualityFlags {
  gpsQuality: GPSQuality;
  hrQuality: HRQuality;
  paceReliability: PaceReliability;
  flags: string[];
  overallScore: number; // 0-100
  recommendations: string[];
}

export interface DataQualityDetails {
  gps: {
    quality: GPSQuality;
    issues: string[];
    suspiciousSplits: number[];
  };
  hr: {
    quality: HRQuality;
    issues: string[];
    dropoutCount: number;
    spikeCount: number;
  };
  pace: {
    reliability: PaceReliability;
    issues: string[];
    varianceScore: number;
  };
}

/**
 * Check data quality for a workout
 */
export function checkDataQuality(
  workout: Workout,
  segments?: WorkoutSegment[]
): DataQualityFlags {
  const flags: string[] = [];
  const recommendations: string[] = [];

  // Analyze GPS quality
  const gpsAnalysis = analyzeGPSQuality(workout, segments);
  const gpsQuality = gpsAnalysis.quality;
  flags.push(...gpsAnalysis.flags);
  recommendations.push(...gpsAnalysis.recommendations);

  // Analyze HR quality
  const hrAnalysis = analyzeHRQuality(workout, segments);
  const hrQuality = hrAnalysis.quality;
  flags.push(...hrAnalysis.flags);
  recommendations.push(...hrAnalysis.recommendations);

  // Analyze pace reliability
  const paceAnalysis = analyzePaceReliability(workout, segments);
  const paceReliability = paceAnalysis.reliability;
  flags.push(...paceAnalysis.flags);
  recommendations.push(...paceAnalysis.recommendations);

  // Calculate overall score
  const overallScore = calculateOverallScore(gpsQuality, hrQuality, paceReliability);

  return {
    gpsQuality,
    hrQuality,
    paceReliability,
    flags,
    overallScore,
    recommendations,
  };
}

/**
 * Analyze GPS data quality
 */
function analyzeGPSQuality(
  workout: Workout,
  segments?: WorkoutSegment[]
): {
  quality: GPSQuality;
  flags: string[];
  recommendations: string[];
} {
  const flags: string[] = [];
  const recommendations: string[] = [];

  // Check if we have GPS data at all
  if (!workout.distanceMiles) {
    return {
      quality: 'missing',
      flags: ['no_gps_data'],
      recommendations: ['Ensure GPS is enabled on your watch/phone before starting'],
    };
  }

  // Check for treadmill run (usually indicated by source or lack of elevation)
  const isTreadmill = workout.source === 'manual' &&
    !workout.elevationGainFt &&
    !workout.elevationGainFeet &&
    !workout.routeName;

  if (isTreadmill) {
    return {
      quality: 'missing',
      flags: ['treadmill_no_gps'],
      recommendations: [],
    };
  }

  // Analyze segment data for quality issues
  if (segments && segments.length > 0) {
    const paces = segments
      .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0)
      .map(s => s.paceSecondsPerMile!);

    if (paces.length >= 3) {
      // Check for sudden pace spikes (GPS drift/tunnel)
      const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
      const suspiciousSplits = paces.filter(p =>
        p < avgPace * 0.5 || p > avgPace * 2
      ).length;

      if (suspiciousSplits > paces.length * 0.2) {
        flags.push('gps_signal_loss');
        recommendations.push('Significant GPS dropouts detected - check for tunnels or tall buildings');
        return { quality: 'noisy', flags, recommendations };
      }

      if (suspiciousSplits > 0) {
        flags.push('gps_minor_issues');
      }

      // Check for unrealistic speeds (possible GPS drift)
      const hasUnrealisticSpeeds = paces.some(p => p < 180); // Sub-3:00/mi is unrealistic
      if (hasUnrealisticSpeeds) {
        flags.push('gps_drift_detected');
        recommendations.push('GPS drift detected - some split paces appear unrealistic');
        return { quality: 'noisy', flags, recommendations };
      }
    }
  }

  // Cross-validate distance vs duration
  if (workout.distanceMiles && workout.durationMinutes) {
    const calculatedPace = (workout.durationMinutes * 60) / workout.distanceMiles;
    const recordedPace = workout.avgPaceSeconds;

    // If there's a significant mismatch, flag it
    if (recordedPace && Math.abs(calculatedPace - recordedPace) > 30) {
      flags.push('distance_time_mismatch');
    }
  }

  // Check for reasonable distance given time
  if (workout.distanceMiles && workout.durationMinutes) {
    const minPace = (workout.durationMinutes * 60) / workout.distanceMiles;

    // Flag if average pace is faster than world record marathon pace
    if (minPace < 240) { // 4:00/mi
      flags.push('unrealistic_distance');
      recommendations.push('Recorded distance seems too high for duration - verify GPS accuracy');
      return { quality: 'noisy', flags, recommendations };
    }
  }

  if (flags.length > 0) {
    return { quality: 'noisy', flags, recommendations };
  }

  return { quality: 'good', flags: [], recommendations: [] };
}

/**
 * Analyze heart rate data quality
 */
function analyzeHRQuality(
  workout: Workout,
  segments?: WorkoutSegment[]
): {
  quality: HRQuality;
  flags: string[];
  recommendations: string[];
} {
  const flags: string[] = [];
  const recommendations: string[] = [];

  // Check if we have HR data
  const avgHr = workout.avgHr || workout.avgHeartRate;
  if (!avgHr) {
    return {
      quality: 'missing',
      flags: ['no_hr_data'],
      recommendations: ['Consider using a heart rate monitor for better training insights'],
    };
  }

  // Check for obviously invalid HR values
  if (avgHr < 80) {
    flags.push('hr_unrealistically_low');
    recommendations.push('Average HR seems too low - check sensor placement');
    return { quality: 'erratic', flags, recommendations };
  }

  if (avgHr > 220) {
    flags.push('hr_unrealistically_high');
    recommendations.push('Average HR exceeds physiological maximum - possible sensor error');
    return { quality: 'erratic', flags, recommendations };
  }

  // Check max HR vs avg HR relationship
  const maxHr = workout.maxHr;
  if (maxHr) {
    if (maxHr > 250) {
      flags.push('max_hr_spike');
      recommendations.push('Max HR spike detected - may be sensor interference');
      return { quality: 'erratic', flags, recommendations };
    }

    if (maxHr < avgHr) {
      flags.push('hr_data_inconsistent');
      return { quality: 'erratic', flags, recommendations };
    }

    // Very small difference between avg and max suggests steady state
    // Very large difference might indicate dropouts or spikes
    const hrRange = maxHr - avgHr;
    if (hrRange > 80) {
      flags.push('hr_high_variance');
      // This could be legitimate for intervals, so just flag it
    }
  }

  // Analyze segment HR data
  if (segments && segments.length > 0) {
    const hrValues = segments
      .filter(s => s.avgHr && s.avgHr > 0)
      .map(s => s.avgHr!);

    if (hrValues.length > 0) {
      // Check for dropouts (sudden drops to very low HR)
      const dropouts = hrValues.filter(hr => hr < 60).length;
      if (dropouts > 0) {
        flags.push('hr_dropouts');
        recommendations.push(`${dropouts} segment(s) show HR dropouts - check strap/sensor contact`);
        return { quality: 'dropouts', flags, recommendations };
      }

      // Check for spikes
      const avgSegmentHr = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
      const spikes = hrValues.filter(hr => hr > avgSegmentHr * 1.3).length;
      if (spikes > hrValues.length * 0.1) {
        flags.push('hr_spikes');
      }
    }
  }

  if (flags.some(f => f.includes('erratic') || f.includes('spike'))) {
    return { quality: 'erratic', flags, recommendations };
  }

  if (flags.some(f => f.includes('dropout'))) {
    return { quality: 'dropouts', flags, recommendations };
  }

  return { quality: 'good', flags: [], recommendations: [] };
}

/**
 * Analyze pace data reliability
 */
function analyzePaceReliability(
  workout: Workout,
  segments?: WorkoutSegment[]
): {
  reliability: PaceReliability;
  flags: string[];
  recommendations: string[];
} {
  const flags: string[] = [];
  const recommendations: string[] = [];

  // Check for treadmill indicators
  const isTreadmill =
    (workout.source === 'manual' && !workout.elevationGainFt && !workout.elevationGainFeet) ||
    workout.notes?.toLowerCase().includes('treadmill') ||
    workout.routeName?.toLowerCase().includes('treadmill');

  if (isTreadmill) {
    flags.push('treadmill_pace');
    recommendations.push('Treadmill pace may differ from outdoor - use for relative comparison only');
    return { reliability: 'treadmill', flags, recommendations };
  }

  // Analyze pace variance from segments
  if (segments && segments.length >= 3) {
    const paces = segments
      .filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0)
      .map(s => s.paceSecondsPerMile!);

    if (paces.length >= 3) {
      const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
      const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / paces.length;
      const cv = Math.sqrt(variance) / avgPace;

      // High variance could indicate GPS drift
      if (cv > 0.25) {
        flags.push('pace_high_variance');

        // Check if it's likely GPS issues (unrealistic individual splits)
        const unrealisticSplits = paces.filter(p => p < 240 || p > 900).length;
        if (unrealisticSplits > 0) {
          flags.push('gps_drift');
          recommendations.push('Pace data shows possible GPS drift - take split times with caution');
          return { reliability: 'gps_drift', flags, recommendations };
        }
      }

      // Check for sudden jumps that don't correlate with effort
      for (let i = 1; i < paces.length; i++) {
        const change = Math.abs(paces[i] - paces[i - 1]);
        if (change > 120) { // More than 2 min/mi change
          flags.push('pace_discontinuity');
        }
      }
    }
  }

  // Cross-validate calculated pace vs recorded
  if (workout.distanceMiles && workout.durationMinutes && workout.avgPaceSeconds) {
    const calculatedPace = (workout.durationMinutes * 60) / workout.distanceMiles;
    const diff = Math.abs(calculatedPace - workout.avgPaceSeconds);

    if (diff > 15) {
      flags.push('pace_calculation_mismatch');
    }
  }

  if (flags.some(f => f.includes('gps_drift'))) {
    return { reliability: 'gps_drift', flags, recommendations };
  }

  return { reliability: 'good', flags, recommendations };
}

/**
 * Calculate overall data quality score
 */
function calculateOverallScore(
  gpsQuality: GPSQuality,
  hrQuality: HRQuality,
  paceReliability: PaceReliability
): number {
  const gpsScore = gpsQuality === 'good' ? 100 : gpsQuality === 'noisy' ? 60 : 30;
  const hrScore = hrQuality === 'good' ? 100 :
                  hrQuality === 'dropouts' ? 70 :
                  hrQuality === 'erratic' ? 50 : 40;
  const paceScore = paceReliability === 'good' ? 100 :
                    paceReliability === 'treadmill' ? 80 : 50;

  // Weighted average (GPS most important for outdoor runs)
  return Math.round(gpsScore * 0.4 + hrScore * 0.3 + paceScore * 0.3);
}

/**
 * Serialize data quality flags for storage
 */
export function serializeDataQualityFlags(flags: DataQualityFlags): string {
  return JSON.stringify({
    gps: flags.gpsQuality,
    hr: flags.hrQuality,
    pace: flags.paceReliability,
    flags: flags.flags,
    score: flags.overallScore,
  });
}

/**
 * Parse data quality flags from storage
 */
export function parseDataQualityFlags(json: string): Partial<DataQualityFlags> | null {
  try {
    const data = JSON.parse(json);
    return {
      gpsQuality: data.gps,
      hrQuality: data.hr,
      paceReliability: data.pace,
      flags: data.flags,
      overallScore: data.score,
    };
  } catch {
    return null;
  }
}

/**
 * Get a human-readable data quality summary
 */
export function getDataQualitySummary(flags: DataQualityFlags): string {
  if (flags.overallScore >= 90) {
    return 'Excellent data quality - all metrics reliable';
  }
  if (flags.overallScore >= 75) {
    return 'Good data quality with minor issues';
  }
  if (flags.overallScore >= 60) {
    return 'Some data quality concerns - ' + flags.flags.slice(0, 2).join(', ');
  }
  return 'Data quality issues detected - use metrics with caution';
}
