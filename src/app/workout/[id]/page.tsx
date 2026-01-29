import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWorkout } from '@/actions/workouts';
import {
  formatDateLong,
  formatDistance,
  formatPace,
  formatDuration,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
} from '@/lib/utils';
import { getSeverityColor, getSeverityLabel } from '@/lib/conditions';
import { DeleteWorkoutButton } from './DeleteButton';
import { EditWorkoutButton } from './EditButton';
import { ChevronLeft, Thermometer, Droplets, Wind } from 'lucide-react';

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workout = await getWorkout(parseInt(id));

  if (!workout) {
    notFound();
  }

  const assessment = workout.assessment;
  const issues = assessment ? JSON.parse(assessment.issues || '[]') : [];
  const legsTags = assessment ? JSON.parse(assessment.legsTags || '[]') : [];
  const lifeTags = assessment ? JSON.parse(assessment.lifeTags || '[]') : [];
  const hydrationTags = assessment ? JSON.parse(assessment.hydrationTags || '[]') : [];

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
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to History
          </Link>
          <h1 className="text-2xl font-display font-semibold text-slate-900">
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
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditWorkoutButton workout={workout} />
          <DeleteWorkoutButton workoutId={workout.id} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Distance</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatDistance(workout.distanceMiles)} <span className="text-sm font-normal text-slate-500">mi</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Duration</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatDuration(workout.durationMinutes)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Pace</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatPace(workout.avgPaceSeconds)} <span className="text-sm font-normal text-slate-500">/mi</span>
            </p>
          </div>
        </div>

        {/* Additional workout info */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
          {workout.routeName && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Route</span>
              <span className="text-slate-900">{workout.routeName}</span>
            </div>
          )}
          {workout.shoe && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Shoe</span>
              <span className="text-slate-900">{workout.shoe.name}</span>
            </div>
          )}
          {workout.avgHr && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Avg HR</span>
              <span className="text-slate-900">{workout.avgHr} bpm</span>
            </div>
          )}
          {workout.maxHr && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Max HR</span>
              <span className="text-slate-900">{workout.maxHr} bpm</span>
            </div>
          )}
          {workout.elevationGainFt && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Elevation</span>
              <span className="text-slate-900">{workout.elevationGainFt} ft</span>
            </div>
          )}
        </div>

        {workout.notes && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Notes</p>
            <p className="text-slate-900">{workout.notes}</p>
          </div>
        )}

        {/* Weather Data */}
        {workout.weatherTempF !== null && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-900">Weather Conditions</p>
              {workout.weatherSeverityScore !== null && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(workout.weatherSeverityScore)}`}>
                  {getSeverityLabel(workout.weatherSeverityScore)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Thermometer className="w-4 h-4 text-slate-400" />
                <span>{workout.weatherTempF}°F</span>
                {workout.weatherFeelsLikeF !== null && workout.weatherFeelsLikeF !== workout.weatherTempF && (
                  <span className="text-slate-400">(feels {workout.weatherFeelsLikeF}°F)</span>
                )}
              </div>
              {workout.weatherHumidityPct !== null && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Droplets className="w-4 h-4 text-slate-400" />
                  <span>{workout.weatherHumidityPct}%</span>
                </div>
              )}
              {workout.weatherWindMph !== null && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Wind className="w-4 h-4 text-slate-400" />
                  <span>{workout.weatherWindMph} mph</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assessment */}
      {assessment && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Post-Run Assessment</h2>

          <div className="space-y-6">
            {/* Quick verdict section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-slate-500">Intended workout?</span>
                <span className="text-sm font-medium capitalize">{assessment.wasIntendedWorkout}</span>
              </div>

              {issues.length > 0 && (
                <div>
                  <span className="text-sm text-slate-500">Issues:</span>
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
                <span className="text-sm text-slate-500">Legs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {legsTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs capitalize"
                    >
                      {tag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {assessment.breathingFeel && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Breathing:</span>
                <span className="text-sm font-medium capitalize">{assessment.breathingFeel}</span>
              </div>
            )}

            {/* Schedule Context */}
            {(assessment.timeOfRun || assessment.wasWorkday !== null) && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-900 mb-3">Schedule Context</h3>
                <div className="space-y-2">
                  {assessment.timeOfRun && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Time of run:</span>
                      <span className="text-sm font-medium">{timeOfRunLabels[assessment.timeOfRun] || assessment.timeOfRun}</span>
                    </div>
                  )}
                  {assessment.wasWorkday !== null && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Workday:</span>
                      <span className="text-sm font-medium">{assessment.wasWorkday ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                  {assessment.wasWorkday && assessment.hoursWorkedBefore !== null && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Hours worked before:</span>
                      <span className="text-sm font-medium">{assessment.hoursWorkedBefore}h</span>
                    </div>
                  )}
                  {assessment.wasWorkday && assessment.workStress !== null && (
                    <StatItem label="Work Stress" value={assessment.workStress} max={10} />
                  )}
                  {assessment.wasWorkday && assessment.mentalEnergyPreRun && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Mental energy:</span>
                      <span className="text-sm font-medium">{mentalEnergyLabels[assessment.mentalEnergyPreRun] || assessment.mentalEnergyPreRun}</span>
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
              {assessment.sleepHours !== null && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Sleep Hours</p>
                  <p className="text-lg font-medium">{assessment.sleepHours?.toFixed(1)}h</p>
                </div>
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
                <span className="text-sm text-slate-500">Life context:</span>
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

            {/* Nutrition & Hydration */}
            <div className="grid grid-cols-2 gap-4">
              {assessment.hydration !== null && (
                <StatItem label="Hydration" value={assessment.hydration} max={10} />
              )}
              {assessment.fueling !== null && (
                <StatItem label="Fueling" value={assessment.fueling} max={10} />
              )}
            </div>

            {hydrationTags.length > 0 && (
              <div>
                <span className="text-sm text-slate-500">Hydration issues:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {hydrationTags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs capitalize"
                    >
                      {tag.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(assessment.underfueled || assessment.forgotElectrolytes) && (
              <div className="flex flex-wrap gap-2">
                {assessment.underfueled && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                    Underfueled
                  </span>
                )}
                {assessment.forgotElectrolytes && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                    Forgot electrolytes
                  </span>
                )}
              </div>
            )}

            {assessment.caffeine && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Caffeine:</span>
                <span className="text-sm font-medium capitalize">{assessment.caffeine}</span>
              </div>
            )}

            {/* Environment */}
            <div className="flex flex-wrap gap-4">
              {assessment.perceivedHeat && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Heat:</span>
                  <span className="text-sm font-medium capitalize">{assessment.perceivedHeat}</span>
                </div>
              )}
              {assessment.feltTemp && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Temp vs expected:</span>
                  <span className="text-sm font-medium capitalize">{assessment.feltTemp}</span>
                </div>
              )}
              {assessment.surface && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Surface:</span>
                  <span className="text-sm font-medium capitalize">{assessment.surface}</span>
                </div>
              )}
            </div>

            {assessment.windHillsDifficulty !== null && assessment.windHillsDifficulty > 0 && (
              <StatItem label="Wind/Hills Difficulty" value={assessment.windHillsDifficulty} max={10} />
            )}

            {/* Notes */}
            {assessment.note && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500 mb-1">Assessment Notes</p>
                <p className="text-slate-900">{assessment.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
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
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium w-6">{value}</span>
      </div>
    </div>
  );
}
