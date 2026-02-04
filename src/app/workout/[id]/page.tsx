import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWorkout } from '@/actions/workouts';
import { getWorkoutLaps } from '@/actions/laps';
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
import { ChevronLeft, Thermometer, Droplets, Wind, Heart, TrendingUp, Mountain, Timer, Zap, Activity } from 'lucide-react';
import { HRZonesChart } from '@/components/HRZonesChart';
import { TrainingZoneAnalysis } from '@/components/TrainingZoneAnalysis';
import { WorkoutRankingBadge } from '@/components/BestEfforts';
import { SimilarWorkoutsList, RunningPowerCard, EfficiencyMetricsCard } from '@/components/WorkoutComparison';
import { PaceChart } from '@/components/PaceChart';
import { ElevationChart } from '@/components/ElevationChart';
import { EnhancedSplits } from '@/components/EnhancedSplits';
import { getSettings } from '@/actions/settings';

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

  // Intensity multiplier based on workout type
  const intensityMap: Record<string, number> = {
    easy: 0.6,
    recovery: 0.5,
    long: 0.65,
    steady: 0.7,
    tempo: 0.85,
    interval: 0.95,
    race: 1.0,
  };

  const intensity = intensityMap[workoutType] || 0.65;

  // Simple load calculation: duration * intensity^2 * 100 / 60
  return Math.round(durationMinutes * intensity * intensity * 100 / 60);
}

// HR Zone colors and labels
const hrZones = [
  { name: 'Recovery', color: 'bg-gray-300', textColor: 'text-gray-600', min: 0.5, max: 0.6 },
  { name: 'Aerobic', color: 'bg-teal-400', textColor: 'text-teal-700', min: 0.6, max: 0.7 },
  { name: 'Tempo', color: 'bg-green-500', textColor: 'text-green-700', min: 0.7, max: 0.8 },
  { name: 'Threshold', color: 'bg-slate-400', textColor: 'text-slate-800', min: 0.8, max: 0.9 },
  { name: 'VO2max', color: 'bg-rose-400', textColor: 'text-rose-700', min: 0.9, max: 1.0 },
];

// Estimate HR zone from average HR (assumes max HR of 220-age or 185 if age unknown)
function estimateHRZone(avgHr: number, maxHr?: number): { zone: number; zoneName: string; color: string } {
  const estimatedMax = maxHr || 185; // Default max HR
  const hrPercent = avgHr / estimatedMax;

  for (let i = hrZones.length - 1; i >= 0; i--) {
    if (hrPercent >= hrZones[i].min) {
      return { zone: i + 1, zoneName: hrZones[i].name, color: hrZones[i].color };
    }
  }
  return { zone: 1, zoneName: 'Recovery', color: 'bg-gray-300' };
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

  const assessment = workout.assessment;
  const issues = assessment ? JSON.parse(assessment.issues || '[]') : [];
  const legsTags = assessment ? JSON.parse(assessment.legsTags || '[]') : [];
  const lifeTags = assessment ? JSON.parse(assessment.lifeTags || '[]') : [];
  const hydrationTags = assessment ? JSON.parse(assessment.hydrationTags || '[]') : [];

  // Get HR data (could be in avgHeartRate or avgHr)
  const avgHr = workout.avgHeartRate || workout.avgHr;
  const maxHr = workout.maxHr;
  const elevation = workout.elevationGainFeet || workout.elevationGainFt;

  // Calculate or use existing training load
  const trainingLoad = workout.trainingLoad || estimateTrainingLoad(workout.durationMinutes, avgHr, workout.workoutType);

  // Estimate HR zone
  const hrZoneInfo = avgHr ? estimateHRZone(avgHr, maxHr ?? undefined) : null;

  const timeOfRunLabels: Record<string, string> = {
    early_morning: 'Early AM (5-7)',
    morning: 'Morning (7-11)',
    lunch: 'Lunch (11-1)',
    afternoon: 'Afternoon (1-5)',
    evening: 'Evening (5-8)',
    night: 'Night (8+)',
  };

  const mentalEnergyLabels: Record<string, string> = {
    fresh: 'Fresh',
    okay: 'Okay',
    drained: 'Drained',
    fried: 'Fried',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/history"
            className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to History
          </Link>
          <h1 className="text-2xl font-display font-semibold text-stone-900">
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
              <span className="px-2 py-1 bg-stone-100 text-stone-500 rounded text-xs capitalize">
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
          <EditWorkoutButton workout={workout} />
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        {/* Primary Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
          <div>
            <p className="text-xs text-stone-500 mb-1">Distance</p>
            <p className="text-2xl font-bold text-stone-900">
              {formatDistance(workout.distanceMiles)}
              <span className="text-sm font-normal text-stone-400 ml-1">mi</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Duration</p>
            <p className="text-2xl font-bold text-stone-900">
              {formatDurationFull(workout.durationMinutes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Pace</p>
            <p className="text-2xl font-bold text-stone-900">
              {formatPace(workout.avgPaceSeconds)}
              <span className="text-sm font-normal text-stone-400 ml-1">/mi</span>
            </p>
          </div>
          {avgHr && (
            <div>
              <p className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" /> Avg HR
                {hrZoneInfo && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${hrZoneInfo.color} text-white`}>
                    Z{hrZoneInfo.zone}
                  </span>
                )}
              </p>
              <p className="text-2xl font-bold text-stone-900">
                {avgHr}
                <span className="text-sm font-normal text-stone-400 ml-1">bpm</span>
              </p>
            </div>
          )}
          {elevation && elevation > 0 && (
            <div>
              <p className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                <Mountain className="w-3 h-3 text-emerald-500" /> Elevation
              </p>
              <p className="text-2xl font-bold text-stone-900">
                {elevation}
                <span className="text-sm font-normal text-stone-400 ml-1">ft</span>
              </p>
            </div>
          )}
          {trainingLoad && (
            <div>
              <p className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-teal-500" /> Load
              </p>
              <p className="text-2xl font-bold text-stone-900">{trainingLoad}</p>
            </div>
          )}
        </div>

        {/* Secondary Stats */}
        <div className="mt-6 pt-4 border-t border-stone-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {maxHr && (
            <div className="flex justify-between">
              <span className="text-stone-500">Max HR</span>
              <span className="font-medium">{maxHr} bpm</span>
            </div>
          )}
          {workout.routeName && (
            <div className="flex justify-between">
              <span className="text-stone-500">Route</span>
              <span className="font-medium">{workout.routeName}</span>
            </div>
          )}
          {workout.shoe && (
            <div className="flex justify-between">
              <span className="text-stone-500">Shoe</span>
              <span className="font-medium">{workout.shoe.name}</span>
            </div>
          )}
          {assessment?.rpe && (
            <div className="flex justify-between">
              <span className="text-stone-500">RPE</span>
              <span className="font-medium">{assessment.rpe}/10</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {workout.notes && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-sm text-stone-500 mb-1">Notes</p>
            <p className="text-stone-700">{workout.notes}</p>
          </div>
        )}
      </div>

      {/* Pace & Elevation Charts */}
      {laps.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PaceChart
            laps={laps}
            avgPaceSeconds={workout.avgPaceSeconds}
            workoutType={workout.workoutType}
          />
          <ElevationChart
            laps={laps}
            totalElevationGain={elevation}
          />
        </div>
      )}

      {/* Enhanced Mile Splits with Zone Categorization */}
      {laps.length > 0 ? (
        <EnhancedSplits
          laps={laps}
          avgPaceSeconds={workout.avgPaceSeconds}
          workoutType={workout.workoutType}
          easyPace={settings?.easyPaceSeconds}
          tempoPace={settings?.tempoPaceSeconds}
          thresholdPace={settings?.thresholdPaceSeconds}
          intervalPace={settings?.intervalPaceSeconds}
        />
      ) : workout.source === 'strava' && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-sm text-stone-500">
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

      {/* HR Zones - detailed breakdown for Strava workouts */}
      {workout.source === 'strava' && avgHr && (
        <HRZonesChart
          workoutId={workout.id}
          stravaActivityId={workout.stravaActivityId}
        />
      )}

      {/* Weather Data */}
      {workout.weatherTempF !== null && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-stone-900">Weather Conditions</h2>
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
                <span className="text-stone-400">(feels {workout.weatherFeelsLikeF}°F)</span>
              )}
            </div>
            {workout.weatherHumidityPct !== null && (
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-teal-400" />
                <span className="font-medium">{workout.weatherHumidityPct}%</span>
              </div>
            )}
            {workout.weatherWindMph !== null && (
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-stone-400" />
                <span className="font-medium">{workout.weatherWindMph} mph</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assessment */}
      {assessment && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="font-semibold text-stone-900 mb-4">Post-Run Assessment</h2>

          <div className="space-y-6">
            {/* Quick verdict section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-stone-500">Intended workout?</span>
                <span className="text-sm font-medium capitalize">{assessment.wasIntendedWorkout}</span>
              </div>

              {issues.length > 0 && (
                <div>
                  <span className="text-sm text-stone-500">Issues:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {issues.map((issue: string) => (
                      <span
                        key={issue}
                        className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs capitalize"
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
                <span className="text-sm text-stone-500">Legs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {legsTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs capitalize"
                    >
                      {tag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {assessment.breathingFeel && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-500">Breathing:</span>
                <span className="text-sm font-medium capitalize">{assessment.breathingFeel}</span>
              </div>
            )}

            {/* Schedule Context */}
            {(assessment.timeOfRun || assessment.wasWorkday !== null) && (
              <div className="pt-4 border-t border-stone-100">
                <h3 className="text-sm font-medium text-stone-900 mb-3">Schedule Context</h3>
                <div className="space-y-2 text-sm">
                  {assessment.timeOfRun && (
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500">Time of run:</span>
                      <span className="font-medium">{timeOfRunLabels[assessment.timeOfRun] || assessment.timeOfRun}</span>
                    </div>
                  )}
                  {assessment.wasWorkday !== null && (
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500">Workday:</span>
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
                <span className="text-sm text-stone-500">Life context:</span>
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
              <div className="pt-4 border-t border-stone-100">
                <p className="text-sm text-stone-500 mb-1">Assessment Notes</p>
                <p className="text-stone-700">{assessment.note}</p>
              </div>
            )}
          </div>
        </div>
      )}

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
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium w-6">{value}</span>
      </div>
    </div>
  );
}
