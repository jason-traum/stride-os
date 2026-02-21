import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Workout Detail | Dreamy',
  description: 'View your workout details including pace, splits, heart rate, and route map.',
};

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWorkout } from '@/actions/workouts';
import { getWorkoutLaps } from '@/actions/laps';
import { getWorkoutStreams } from '@/actions/strava';
import {
  formatDateLong,
  formatDistance,
  formatPace,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
} from '@/lib/utils';
import { getSeverityColor, getSeverityLabel } from '@/lib/conditions';
import { DeleteWorkoutButton } from './DeleteButton';
import { EditWorkoutButton } from './EditButton';
import { ShareButton } from '@/components/ShareButton';
import { ChevronLeft, Thermometer, Droplets, Wind, Heart, TrendingUp, Mountain, Activity, Target } from 'lucide-react';
import { HRZonesChart } from '@/components/HRZonesChart';
import { ZoneDistributionChart } from '@/components/ZoneDistributionChart';
import { TrainingZoneAnalysis } from '@/components/TrainingZoneAnalysis';
import { WorkoutRankingBadge } from '@/components/BestEfforts';
import { SimilarWorkoutsList, WorkoutComparisonCard, RunningPowerCard, EfficiencyMetricsCard } from '@/components/WorkoutComparison';
import { WorkoutExclusionToggle } from '@/components/WorkoutExclusionToggle';
import { PaceChart } from '@/components/PaceChart';
import { HRTrendChart } from '@/components/HRTrendChart';
import { ActivityStreamChart } from '@/components/ActivityStreamChart';
import { LazyRouteMap as RouteMap } from '@/components/RouteMapLazy';
import { ElevationChart } from '@/components/ElevationChart';
import { EnhancedSplits } from '@/components/EnhancedSplits';
import { getSettings } from '@/actions/settings';
import { getBestVdotSegmentScore, type BestVdotSegmentResult } from '@/actions/segment-analysis';
import { BestVdotSegmentCard } from '@/components/BestVdotSegmentCard';
import { WorkoutEffortAnalysis } from '@/components/WorkoutEffortAnalysis';
import { analyzeWorkoutEffort } from '@/actions/workout-analysis';
import { buildInterpolatedMileSplitsFromStream, type MileSplit } from '@/lib/mile-split-interpolation';
import { db, workoutFitnessSignals } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getWeatherPaceAdjustment, calculateAdjustedVDOT } from '@/lib/training/vdot-calculator';

// Format duration from minutes to readable string
function formatDurationFull(minutes: number | null | undefined): string {
  if (!minutes) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.round((minutes % 1) * 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (secs > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${mins}m`;
}

// Format seconds to mm:ss or h:mm:ss
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Calculate training load if not present (simple TRIMP-like estimate)
function estimateTrainingLoad(durationMinutes: number | null, avgHr: number | null, workoutType: string): number | null {
  if (!durationMinutes) return null;

  // Intensity multiplier based on workout type (slowest to fastest)
  const intensityMap: Record<string, number> = {
    recovery: 0.5,
    easy: 0.6,
    steady: 0.7,
    marathon: 0.75,
    tempo: 0.85,
    threshold: 0.9,
    interval: 0.95,
    repetition: 0.98,
    long: 0.65,
    race: 1.0,
    cross_train: 0.55,
    other: 0.65,
  };

  const intensity = intensityMap[workoutType] || 0.65;

  // Simple load calculation: duration * intensity^2 * 100 / 60
  return Math.round(durationMinutes * intensity * intensity * 100 / 60);
}

// HR Zone colors and labels (matched to training zone colors)
const hrZones = [
  { name: 'Recovery', color: 'bg-accentBlue/40', textColor: 'text-accentBlue', min: 0.5, max: 0.6 },
  { name: 'Aerobic', color: 'bg-accentTeal/40', textColor: 'text-accentTeal', min: 0.6, max: 0.7 },
  { name: 'Tempo', color: 'bg-accentOrange/40', textColor: 'text-accentOrange', min: 0.7, max: 0.8 },
  { name: 'Threshold', color: 'bg-accentPink/40', textColor: 'text-accentPink', min: 0.8, max: 0.9 },
  { name: 'VO2max', color: 'bg-accentPurple/40', textColor: 'text-accentPurple', min: 0.9, max: 1.0 },
];

// Estimate HR zone from average HR
function estimateHRZone(avgHr: number, maxHr?: number, age?: number): { zone: number; zoneName: string; color: string } {
  // Use provided max HR, or calculate from age, or use 185 as last resort
  const estimatedMax = maxHr || (age ? 220 - age : 185);
  const hrPercent = avgHr / estimatedMax;

  for (let i = hrZones.length - 1; i >= 0; i--) {
    if (hrPercent >= hrZones[i].min) {
      return { zone: i + 1, zoneName: hrZones[i].name, color: hrZones[i].color };
    }
  }
  return { zone: 1, zoneName: 'Recovery', color: 'bg-textTertiary' };
}

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workout, settings] = await Promise.all([
    getWorkout(parseInt(id)),
    getSettings(),
  ]);

  if (!workout) {
    notFound();
  }

  // Try to get laps
  let laps: Array<{
    lapNumber: number;
    distanceMiles: number;
    durationSeconds: number;
    avgPaceSeconds: number;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    elevationGainFeet: number | null;
    lapType: string;
  }> = [];

  try {
    laps = await getWorkoutLaps(workout.id);
  } catch {
    // Laps not available
  }

  let mileSplits: MileSplit[] | undefined;
  let mileSplitSource: 'stream' | 'laps' | undefined;
  if (workout.source === 'strava') {
    try {
      const streamResult = await getWorkoutStreams(workout.id);
      if (streamResult.success && streamResult.data) {
        const streamMileSplits = buildInterpolatedMileSplitsFromStream({
          distance: streamResult.data.distance,
          time: streamResult.data.time,
          heartrate: streamResult.data.heartrate,
          altitude: streamResult.data.altitude,
        });
        if (streamMileSplits.length > 0) {
          mileSplits = streamMileSplits;
          mileSplitSource = 'stream';
        }
      }
    } catch {
      // Stream interpolation unavailable; component will fall back to laps when possible.
    }
  }

  let bestVdotSegment: BestVdotSegmentResult | null = null;
  if (workout.source === 'strava') {
    try {
      bestVdotSegment = await getBestVdotSegmentScore(workout.id, {
        minDistanceMeters: 800,
        weatherTempF: workout.weatherTempF,
        weatherHumidityPct: workout.weatherHumidityPct,
        elevationGainFt: workout.elevationGainFeet || workout.elevationGainFt,
        distanceMiles: workout.distanceMiles,
      });
    } catch {
      bestVdotSegment = null;
    }
  }

  // Fetch fitness signals for adjusted pace display
  let fitnessSignals: {
    weatherAdjustedPace: number | null;
    elevationAdjustedPace: number | null;
  } | null = null;
  try {
    fitnessSignals = await db.query.workoutFitnessSignals.findFirst({
      where: eq(workoutFitnessSignals.workoutId, workout.id),
      columns: {
        weatherAdjustedPace: true,
        elevationAdjustedPace: true,
      },
    }) ?? null;
  } catch {
    // Non-critical
  }

  // Compute weather adjustment for display
  const weatherAdjustmentSec = (workout.weatherTempF != null && workout.weatherHumidityPct != null)
    ? getWeatherPaceAdjustment(workout.weatherTempF, workout.weatherHumidityPct)
    : 0;

  // Total condition adjustment (weather + elevation) for zone classification
  const elevGainFt = workout.elevationGainFeet || workout.elevationGainFt || 0;
  const distMi = workout.distanceMiles || 0;
  const elevAdjSec = (elevGainFt > 0 && distMi > 0) ? Math.round((elevGainFt / distMi / 100) * 12) : 0;
  const conditionAdjustment = weatherAdjustmentSec + elevAdjSec;

  // Effective pace: best available adjusted pace (weather+elevation combined, or weather-only, or elevation-only)
  let effectivePace: number | null = null;
  if (workout.avgPaceSeconds) {
    const weatherAdj = fitnessSignals?.weatherAdjustedPace ?? null;
    const elevAdj = fitnessSignals?.elevationAdjustedPace ?? null;
    if (weatherAdj && elevAdj) {
      // Both adjustments: subtract both corrections from actual pace
      const weatherCorrection = workout.avgPaceSeconds - weatherAdj;
      const elevCorrection = workout.avgPaceSeconds - elevAdj;
      effectivePace = workout.avgPaceSeconds - weatherCorrection - elevCorrection;
    } else {
      effectivePace = weatherAdj ?? elevAdj ?? null;
    }
    // Sanity check: effective pace should be positive and less than actual
    if (effectivePace && (effectivePace <= 0 || effectivePace >= workout.avgPaceSeconds)) {
      effectivePace = null;
    }
  }

  // Full-workout VDOT adjusted for weather + elevation (most meaningful for races)
  let fullWorkoutVdot: number | null = null;
  if (workout.distanceMiles && workout.durationMinutes && workout.distanceMiles >= 1) {
    const distanceMeters = workout.distanceMiles * 1609.34;
    const timeSeconds = workout.durationMinutes * 60;
    const vdot = calculateAdjustedVDOT(distanceMeters, timeSeconds, {
      weatherTempF: workout.weatherTempF,
      weatherHumidityPct: workout.weatherHumidityPct,
      elevationGainFt: workout.elevationGainFeet || workout.elevationGainFt,
    });
    if (vdot >= 15 && vdot <= 85) {
      fullWorkoutVdot = vdot;
    }
  }

  const assessment = workout.assessment;
  const issues = assessment ? JSON.parse(assessment.issues || '[]') : [];
  const legsTags = assessment ? JSON.parse(assessment.legsTags || '[]') : [];
  const lifeTags = assessment ? JSON.parse(assessment.lifeTags || '[]') : [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hydrationTags = assessment ? JSON.parse(assessment.hydrationTags || '[]') : [];

  // Analyze effort factors (why it felt hard)
  const effortAnalysis = await analyzeWorkoutEffort(
    workout,
    settings,
    assessment ? {
      rpe: assessment.rpe,
      sleepQuality: assessment.sleepQuality,
      sleepHours: assessment.sleepHours,
      stress: assessment.stress,
      soreness: assessment.soreness,
      fueling: assessment.fueling,
      hydration: assessment.hydration,
      verdict: assessment.verdict,
    } : null
  );

  // Get HR data (could be in avgHeartRate or avgHr)
  const avgHr = workout.avgHeartRate || workout.avgHr;
  const maxHr = workout.maxHr;
  const elevation = workout.elevationGainFeet || workout.elevationGainFt;

  // Calculate or use existing training load
  const trainingLoad = workout.trainingLoad || estimateTrainingLoad(workout.durationMinutes, avgHr, workout.workoutType);

  // Estimate HR zone
  const hrZoneInfo = avgHr ? estimateHRZone(avgHr, maxHr ?? undefined, settings?.age ?? undefined) : null;

  const timeOfRunLabels: Record<string, string> = {
    early_morning: 'Early AM (5-7)',
    morning: 'Morning (7-11)',
    lunch: 'Lunch (11-1)',
    afternoon: 'Afternoon (1-5)',
    evening: 'Evening (5-8)',
    night: 'Night (8+)',
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _mentalEnergyLabels: Record<string, string> = {
    fresh: 'Fresh',
    okay: 'Okay',
    drained: 'Drained',
    fried: 'Fried',
  };

  // Calculate zone distributions if we have lap data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hrZoneDistribution: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let paceZoneDistribution: any[] = [];

  if (laps.length > 0 && workout.durationMinutes) {
    // Calculate HR zone distribution from laps
    if (laps.some(l => l.avgHeartRate)) {
      const maxHrForZones = maxHr || (settings?.age ? 220 - settings.age : 185);
      const hrZoneTimes = [0, 0, 0, 0, 0]; // 5 zones

      laps.forEach(lap => {
        if (lap.avgHeartRate) {
          const hrPercent = lap.avgHeartRate / maxHrForZones;
          let zoneIndex = 0;
          if (hrPercent >= 0.9) zoneIndex = 4;
          else if (hrPercent >= 0.8) zoneIndex = 3;
          else if (hrPercent >= 0.7) zoneIndex = 2;
          else if (hrPercent >= 0.6) zoneIndex = 1;
          hrZoneTimes[zoneIndex] += lap.durationSeconds;
        }
      });

      const totalTime = hrZoneTimes.reduce((a, b) => a + b, 0);
      hrZoneDistribution = hrZones.map((zone, i) => ({
        zone: i + 1,
        name: zone.name,
        seconds: Math.round(hrZoneTimes[i]),
        percentage: totalTime > 0 ? Math.round((hrZoneTimes[i] / totalTime) * 100) : 0,
        color: zone.color,
      }));
    }

    // Calculate pace zone distribution
    const avgPaceRef = workout.avgPaceSeconds || 480; // 8:00/mi default
    const paceZoneTimes = [0, 0, 0, 0, 0, 0]; // 6 zones

    laps.forEach(lap => {
      const paceRatio = avgPaceRef / lap.avgPaceSeconds; // < 1 = slower, > 1 = faster
      let zoneIndex = 2; // default to steady

      if (paceRatio < 0.85) zoneIndex = 0;      // Recovery (>15% slower)
      else if (paceRatio < 0.95) zoneIndex = 1; // Easy (5-15% slower)
      else if (paceRatio < 1.05) zoneIndex = 2; // Steady (±5%)
      else if (paceRatio < 1.10) zoneIndex = 3; // Threshold (5-10% faster)
      else if (paceRatio < 1.15) zoneIndex = 4; // VO2max (10-15% faster)
      else zoneIndex = 5;                        // Speed (>15% faster)

      paceZoneTimes[zoneIndex] += lap.durationSeconds;
    });

    const totalPaceTime = paceZoneTimes.reduce((a, b) => a + b, 0);
    const paceZoneConfig = [
      { name: 'Recovery', color: 'bg-slate-400' },
      { name: 'Easy', color: 'bg-sky-400' },
      { name: 'Steady', color: 'bg-blue-500' },
      { name: 'Threshold', color: 'bg-violet-500' },
      { name: 'VO2max', color: 'bg-red-500' },
      { name: 'Speed', color: 'bg-rose-600' },
    ];

    paceZoneDistribution = paceZoneConfig.map((zone, i) => ({
      zone: i + 1,
      name: zone.name,
      seconds: Math.round(paceZoneTimes[i]),
      percentage: totalPaceTime > 0 ? Math.round((paceZoneTimes[i] / totalPaceTime) * 100) : 0,
      color: zone.color,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/history"
            className="text-sm text-textSecondary hover:text-secondary flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to History
          </Link>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">
            {formatDateLong(workout.date)}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2 py-1 rounded text-sm font-medium ${getWorkoutTypeColor(
                workout.workoutType
              )}`}
            >
              {getWorkoutTypeLabel(workout.workoutType)}
            </span>
            {assessment && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getVerdictColor(
                  assessment.verdict
                )}`}
              >
                {assessment.verdict}
              </span>
            )}
            {workout.source && workout.source !== 'manual' && (
              <span className="px-2 py-1 bg-bgTertiary text-textSecondary rounded text-xs capitalize">
                via {workout.source}
              </span>
            )}
          </div>
          {/* Ranking badge for standard distances */}
          <div className="mt-2">
            <WorkoutRankingBadge workoutId={workout.id} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton workoutId={workout.id} />
          <EditWorkoutButton workout={workout} />
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        {/* Primary Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
          <div>
            <p className="text-xs text-textSecondary mb-1">Distance</p>
            <p className="text-2xl font-bold text-textPrimary">
              {formatDistance(workout.distanceMiles)}
              <span className="text-sm font-normal text-textTertiary ml-1">mi</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-textSecondary mb-1">Duration</p>
            <p className="text-2xl font-bold text-textPrimary">
              {formatDurationFull(workout.durationMinutes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-textSecondary mb-1">Pace</p>
            <p className="text-2xl font-bold text-textPrimary">
              {formatPace(workout.avgPaceSeconds)}
              <span className="text-sm font-normal text-textTertiary ml-1">/mi</span>
            </p>
          </div>
          {avgHr && (
            <div>
              <p className="text-xs text-textSecondary mb-1 flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" /> Avg HR
                {hrZoneInfo && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${hrZoneInfo.color} text-white`}>
                    Z{hrZoneInfo.zone}
                  </span>
                )}
              </p>
              <p className="text-2xl font-bold text-textPrimary">
                {avgHr}
                <span className="text-sm font-normal text-textTertiary ml-1">bpm</span>
              </p>
            </div>
          )}
          {elevation && elevation > 0 && (
            <div>
              <p className="text-xs text-textSecondary mb-1 flex items-center gap-1">
                <Mountain className="w-3 h-3 text-emerald-500" /> Elevation
              </p>
              <p className="text-2xl font-bold text-textPrimary">
                {Math.round(elevation)}
                <span className="text-sm font-normal text-textTertiary ml-1">ft</span>
              </p>
            </div>
          )}
          {effectivePace && (
            <div>
              <p className="text-xs text-textSecondary mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3 text-sky-400" /> Eff. Pace
              </p>
              <p className="text-2xl font-bold text-textPrimary">
                {formatPace(effectivePace)}
                <span className="text-sm font-normal text-textTertiary ml-1">/mi</span>
              </p>
            </div>
          )}
          {fullWorkoutVdot && (
            <div>
              <p className="text-xs text-textSecondary mb-1 flex items-center gap-1">
                <Target className="w-3 h-3 text-accentTeal" /> VDOT
              </p>
              <p className="text-2xl font-bold text-textPrimary">{fullWorkoutVdot.toFixed(1)}</p>
            </div>
          )}
          {trainingLoad && (
            <div>
              <p className="text-xs text-textSecondary mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-dream-500" /> Load
              </p>
              <p className="text-2xl font-bold text-textPrimary">{trainingLoad}</p>
            </div>
          )}
        </div>

        {/* Secondary Stats */}
        <div className="mt-6 pt-4 border-t border-borderSecondary grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {maxHr && (
            <div className="flex justify-between">
              <span className="text-textSecondary">Max HR</span>
              <span className="font-medium">{maxHr} bpm</span>
            </div>
          )}
          {workout.routeName && (
            <div className="flex justify-between">
              <span className="text-textSecondary">Route</span>
              <span className="font-medium">{workout.routeName}</span>
            </div>
          )}
          {workout.shoe && (
            <div className="flex justify-between">
              <span className="text-textSecondary">Shoe</span>
              <span className="font-medium">{workout.shoe.name}</span>
            </div>
          )}
          {assessment?.rpe && (
            <div className="flex justify-between">
              <span className="text-textSecondary">RPE</span>
              <span className="font-medium">{assessment.rpe}/10</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {workout.notes && (
          <div className="mt-4 pt-4 border-t border-borderSecondary">
            <p className="text-sm text-textSecondary mb-1">Notes</p>
            <p className="text-secondary">{workout.notes}</p>
          </div>
        )}
      </div>

      {/* Effort Analysis — Why did this feel hard? */}
      <WorkoutEffortAnalysis analysis={effortAnalysis} />

      {/* Workout Exclusion Toggle */}
      <WorkoutExclusionToggle
        workoutId={workout.id}
        excluded={!!workout.excludeFromEstimates}
        autoExcluded={!!workout.autoExcluded}
        reason={workout.excludeReason}
      />

      {/* Route Map (Strava workouts with polyline) */}
      {workout.polyline && (
        <RouteMap polyline={workout.polyline} />
      )}

      {/* Strava-style continuous Pace, HR & Elevation chart */}
      {workout.source === 'strava' && (
        <ActivityStreamChart
          workoutId={workout.id}
          stravaActivityId={workout.stravaActivityId}
          easyPaceSeconds={settings?.easyPaceSeconds ?? undefined}
        />
      )}

      {/* Pace & Elevation Charts (non-Strava fallback) */}
      {laps.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PaceChart
            laps={laps}
            mileSplits={mileSplits}
            mileSplitSource={mileSplitSource}
            avgPaceSeconds={workout.avgPaceSeconds}
            workoutType={workout.workoutType}
          />
          {!workout.stravaActivityId && (
            <ElevationChart
              laps={laps}
              totalElevationGain={elevation}
            />
          )}
        </div>
      )}

      {/* Per-mile HR trend (fallback for non-Strava or as supplement) */}
      {laps.length >= 2 && laps.some(l => l.avgHeartRate) && !workout.stravaActivityId && (
        <HRTrendChart
          laps={laps}
          maxHr={maxHr || (settings?.age ? 220 - settings.age : 185)}
        />
      )}

      {/* Zone Distribution Charts */}
      {laps.length > 0 && (hrZoneDistribution.some(z => z.seconds > 0) || paceZoneDistribution.some(z => z.seconds > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hrZoneDistribution.some(z => z.seconds > 0) && (
            <ZoneDistributionChart
              zones={hrZoneDistribution}
              type="hr"
              totalSeconds={workout.durationMinutes ? workout.durationMinutes * 60 : 0}
            />
          )}
          {paceZoneDistribution.some(z => z.seconds > 0) && (
            <ZoneDistributionChart
              zones={paceZoneDistribution}
              type="pace"
              totalSeconds={workout.durationMinutes ? workout.durationMinutes * 60 : 0}
            />
          )}
        </div>
      )}

      {/* Enhanced Mile Splits with Zone Categorization */}
      {laps.length > 0 ? (
        <EnhancedSplits
          laps={laps}
          mileSplits={mileSplits}
          mileSplitSource={mileSplitSource}
          avgPaceSeconds={workout.avgPaceSeconds}
          workoutType={workout.workoutType}
          easyPace={settings?.easyPaceSeconds}
          tempoPace={settings?.tempoPaceSeconds}
          thresholdPace={settings?.thresholdPaceSeconds}
          intervalPace={settings?.intervalPaceSeconds}
          marathonPace={settings?.marathonPaceSeconds}
          vdot={settings?.vdot}
          conditionAdjustment={conditionAdjustment}
        />
      ) : workout.source === 'strava' && (
        <div className="bg-bgTertiary rounded-xl border border-borderPrimary p-4">
          <div className="flex items-center gap-2 text-sm text-textSecondary">
            <Activity className="w-4 h-4" />
            <span>Lap data not yet synced. Go to Settings → Strava → Sync lap data to fetch splits.</span>
          </div>
        </div>
      )}

      {/* Training Zone Analysis - pace-based zones with condition adjustments */}
      {settings && workout.avgPaceSeconds && (
        <TrainingZoneAnalysis
          avgPaceSeconds={workout.avgPaceSeconds}
          distanceMiles={workout.distanceMiles}
          durationMinutes={workout.durationMinutes}
          elevationGainFeet={elevation}
          avgHeartRate={avgHr}
          workoutType={workout.workoutType}
          weatherTempF={workout.weatherTempF}
          weatherHumidityPct={workout.weatherHumidityPct}
          easyPaceSeconds={settings.easyPaceSeconds}
          tempoPaceSeconds={settings.tempoPaceSeconds}
          thresholdPaceSeconds={settings.thresholdPaceSeconds}
          intervalPaceSeconds={settings.intervalPaceSeconds}
          laps={laps}
        />
      )}

      {bestVdotSegment && (
        <BestVdotSegmentCard result={bestVdotSegment} fullWorkoutVdot={fullWorkoutVdot} workoutType={workout.workoutType} />
      )}

      {/* HR Zones - detailed breakdown for Strava workouts */}
      {workout.source === 'strava' && avgHr && (
        <HRZonesChart
          workoutId={workout.id}
          stravaActivityId={workout.stravaActivityId}
        />
      )}

      {/* Weather Data */}
      {workout.weatherTempF !== null && (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-textPrimary">Weather Conditions</h2>
            {workout.weatherSeverityScore !== null && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(workout.weatherSeverityScore)}`}>
                {getSeverityLabel(workout.weatherSeverityScore)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-rose-400" />
              <span className="font-medium">{workout.weatherTempF}°F</span>
              {workout.weatherFeelsLikeF !== null && workout.weatherFeelsLikeF !== workout.weatherTempF && (
                <span className="text-textTertiary">(feels {workout.weatherFeelsLikeF}°F)</span>
              )}
            </div>
            {workout.weatherHumidityPct !== null && (
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-dream-400" />
                <span className="font-medium">{workout.weatherHumidityPct}%</span>
              </div>
            )}
            {workout.weatherWindMph !== null && (
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-textTertiary" />
                <span className="font-medium">{workout.weatherWindMph} mph</span>
              </div>
            )}
          </div>
          {weatherAdjustmentSec > 0 && workout.avgPaceSeconds && (
            <div className="mt-3 pt-3 border-t border-borderSecondary flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-textTertiary">Weather adjustment: </span>
                <span className="font-medium text-amber-400">+{Math.round(weatherAdjustmentSec)} sec/mi</span>
              </div>
              {fitnessSignals?.weatherAdjustedPace && (
                <div>
                  <span className="text-textTertiary">Ideal-conditions pace: </span>
                  <span className="font-medium text-sky-400">{formatPace(fitnessSignals.weatherAdjustedPace)}/mi</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Assessment */}
      {assessment && (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4">Post-Run Assessment</h2>

          <div className="space-y-6">
            {/* Quick verdict section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-textSecondary">Intended workout?</span>
                <span className="text-sm font-medium capitalize">{assessment.wasIntendedWorkout}</span>
              </div>

              {issues.length > 0 && (
                <div>
                  <span className="text-sm text-textSecondary">Issues:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {issues.map((issue: string) => (
                      <span
                        key={issue}
                        className="px-2 py-0.5 bg-red-100 text-red-300 rounded text-xs capitalize"
                      >
                        {issue.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Effort & Feel */}
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="RPE" value={assessment.rpe} max={10} />
              <StatItem label="Legs Feel" value={assessment.legsFeel} max={10} />
            </div>

            {legsTags.length > 0 && (
              <div>
                <span className="text-sm text-textSecondary">Legs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {legsTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-dream-50 text-dream-700 rounded text-xs capitalize"
                    >
                      {tag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {assessment.breathingFeel && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-textSecondary">Breathing:</span>
                <span className="text-sm font-medium capitalize">{assessment.breathingFeel}</span>
              </div>
            )}

            {/* Schedule Context */}
            {(assessment.timeOfRun || assessment.wasWorkday !== null) && (
              <div className="pt-4 border-t border-borderSecondary">
                <h3 className="text-sm font-medium text-textPrimary mb-3">Schedule Context</h3>
                <div className="space-y-2 text-sm">
                  {assessment.timeOfRun && (
                    <div className="flex items-center gap-3">
                      <span className="text-textSecondary">Time of run:</span>
                      <span className="font-medium">{timeOfRunLabels[assessment.timeOfRun] || assessment.timeOfRun}</span>
                    </div>
                  )}
                  {assessment.wasWorkday !== null && (
                    <div className="flex items-center gap-3">
                      <span className="text-textSecondary">Workday:</span>
                      <span className="font-medium">{assessment.wasWorkday ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recovery & Life */}
            <div className="grid grid-cols-2 gap-4">
              {assessment.sleepQuality !== null && (
                <StatItem label="Sleep Quality" value={assessment.sleepQuality} max={10} />
              )}
              {assessment.stress !== null && (
                <StatItem label="Stress" value={assessment.stress} max={10} />
              )}
              {assessment.soreness !== null && (
                <StatItem label="Soreness" value={assessment.soreness} max={10} />
              )}
              {assessment.mood !== null && (
                <StatItem label="Mood" value={assessment.mood} max={10} />
              )}
            </div>

            {lifeTags.length > 0 && (
              <div>
                <span className="text-sm text-textSecondary">Life context:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lifeTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs capitalize"
                    >
                      {tag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {assessment.note && (
              <div className="pt-4 border-t border-borderSecondary">
                <p className="text-sm text-textSecondary mb-1">Assessment Notes</p>
                <p className="text-secondary">{assessment.note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workout Comparison — compare to last N of same type */}
      <WorkoutComparisonCard workoutId={workout.id} />

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RunningPowerCard workoutId={workout.id} />
        <EfficiencyMetricsCard workoutId={workout.id} />
      </div>

      {/* Similar Workouts */}
      <SimilarWorkoutsList workoutId={workout.id} />
    </div>
  );
}

function StatItem({
  label,
  value,
  max,
}: {
  label: string;
  value: number | null;
  max: number;
}) {
  if (value === null) return null;
  const percentage = (value / max) * 100;

  return (
    <div>
      <p className="text-xs text-textSecondary mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-bgTertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-dream-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium w-6">{value}</span>
      </div>
    </div>
  );
}
