// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getWorkouts } from '@/actions/workouts';
import { getSettings } from '@/actions/settings';
import { getTodaysWorkout, getTrainingSummary, getCurrentWeekPlan } from '@/actions/training-plan';
import { getRunningStreak } from '@/actions/analytics';
import { getActiveAlerts } from '@/actions/alerts';
import { getTodayReadinessWithFactors } from '@/actions/readiness';
import { fetchSmartWeather } from '@/lib/weather';
import { formatPace as formatPaceFromTraining } from '@/lib/training/types';
import { getContextualPrompts, getTimeOfDay, isWeekend, getWeatherCondition, type PromptContext } from '@/lib/chat-prompts';
import {
  formatDistance,
  formatPace,
  formatDuration,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
  getTodayString,
} from '@/lib/utils';
import { ChevronRight, Check, Calendar, Target, Zap, Battery, Star, Cloud, Sun, CloudRain, Minus, Flag } from 'lucide-react';
import { QuickCoachInput } from '@/components/QuickCoachInput';
import { StreakBadge } from '@/components/StreakBadge';
import { AlertsDisplay } from '@/components/AlertsDisplay';
import { DemoWrapper } from '@/components/DemoWrapper';
import { DemoToday } from '@/components/DemoToday';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { QuickLogButton } from '@/components/QuickLogButton';
import { getActiveProfileId } from '@/lib/profile-server';
import { getProactivePrompts } from '@/lib/proactive-coach';
import { ProactiveCoachPrompts } from '@/components/ProactiveCoachPrompts';
import type { Workout, Assessment, Shoe } from '@/lib/schema';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

function getRelativeTime(dateStr: string): string {
  const today = getTodayString();
  if (dateStr === today) return 'Today';
  const workoutDate = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffMs = now.getTime() - workoutDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
}

function getWeatherIcon(condition: string) {
  if (condition === 'rain' || condition === 'snow') return CloudRain;
  if (condition === 'cloudy' || condition === 'overcast') return Cloud;
  return Sun;
}

function getTypeDotColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-teal-400',
    long: 'bg-indigo-400',
    tempo: 'bg-rose-400',
    threshold: 'bg-red-500',
    interval: 'bg-fuchsia-500',
    recovery: 'bg-cyan-300',
    race: 'bg-purple-500',
    rest: 'bg-transparent',
    cross_train: 'bg-pink-400',
    steady: 'bg-slate-400',
    marathon: 'bg-amber-500',
  };
  return colors[type] || 'bg-stone-400 dark:bg-stone-500';
}

async function ServerToday() {
  const profileId = await getActiveProfileId();
  const [recentWorkouts, settings, plannedWorkout, trainingSummary, streak, alerts, readinessData, weekPlan, proactivePrompts] = await Promise.all([
    getWorkouts(10, profileId),
    getSettings(profileId),
    getTodaysWorkout(),
    getTrainingSummary(),
    getRunningStreak(),
    getActiveAlerts(),
    getTodayReadinessWithFactors(),
    getCurrentWeekPlan(),
    getProactivePrompts(),
  ]);

  // Fetch smart weather if location is set
  const smartWeather = settings?.latitude && settings?.longitude
    ? await fetchSmartWeather(settings.latitude, settings.longitude)
    : null;
  const weather = smartWeather?.runWindow.weather || null;

  const today = new Date();
  const todayString = getTodayString();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const todaysWorkouts = (recentWorkouts as WorkoutWithRelations[]).filter((w) => w.date === todayString);
  const hasRunToday = todaysWorkouts.length > 0;

  // Last run = most recent workout
  const lastRun = (recentWorkouts as WorkoutWithRelations[])[0] || null;

  // Next workout logic: today's planned if not done, otherwise next scheduled from week plan
  let nextWorkoutData: {
    name: string;
    workoutType: string;
    targetDistanceMiles: number | null;
    targetPaceSecondsPerMile: number | null;
    rationale: string | null;
    isKeyWorkout: boolean | null;
    phase: string | null;
  } | null = null;
  let nextWorkoutLabel = "Today\u2019s Workout";

  if (plannedWorkout && !hasRunToday && plannedWorkout.workoutType !== 'rest') {
    nextWorkoutData = {
      name: plannedWorkout.name,
      workoutType: plannedWorkout.workoutType,
      targetDistanceMiles: plannedWorkout.targetDistanceMiles,
      targetPaceSecondsPerMile: plannedWorkout.targetPaceSecondsPerMile,
      rationale: plannedWorkout.rationale,
      isKeyWorkout: plannedWorkout.isKeyWorkout,
      phase: plannedWorkout.phase ?? trainingSummary?.currentPhase ?? null,
    };
  } else {
    const futureWorkout = weekPlan.workouts.find(
      (w) => w.date > todayString && w.status === 'scheduled' && w.workoutType !== 'rest'
    );
    if (futureWorkout) {
      const nextDate = new Date(futureWorkout.date + 'T12:00:00');
      const dayName = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
      nextWorkoutLabel = `${dayName}\u2019s Workout`;
      nextWorkoutData = {
        name: futureWorkout.name,
        workoutType: futureWorkout.workoutType,
        targetDistanceMiles: futureWorkout.targetDistanceMiles,
        targetPaceSecondsPerMile: futureWorkout.targetPaceSecondsPerMile,
        rationale: futureWorkout.rationale,
        isKeyWorkout: futureWorkout.isKeyWorkout,
        phase: trainingSummary?.currentPhase ?? null,
      };
    }
  }

  // Contextual chat prompts
  const promptContext: PromptContext = {
    hasRunToday,
    timeOfDay: getTimeOfDay(),
    isWeekend: isWeekend(),
    weatherCondition: weather ? getWeatherCondition(weather.temperature, weather.condition === 'rain') : null,
    plannedWorkoutType: plannedWorkout?.workoutType || null,
    isRestDay: !plannedWorkout || plannedWorkout.workoutType === 'rest',
  };
  const contextualSuggestions = getContextualPrompts(promptContext).map(p => ({
    label: p.label,
    prompt: p.prompt,
  }));

  // Week ahead: generate Mon-Sun with workout info
  const weekDays: Array<{
    date: string;
    dayLabel: string;
    workout: (typeof weekPlan.workouts)[0] | null;
    isToday: boolean;
  }> = [];

  const mondayDate = new Date(weekPlan.weekStart + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const workout = weekPlan.workouts.find(w => w.date === dStr) || null;
    weekDays.push({
      date: dStr,
      dayLabel: getDayLabel(dStr),
      workout,
      isToday: dStr === todayString,
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">
            <DynamicGreeting name={settings?.name} />
          </h1>
          <p className="text-textSecondary mt-1">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {streak.currentStreak > 0 && (
            <StreakBadge
              currentStreak={streak.currentStreak}
              longestStreak={streak.longestStreak}
            />
          )}
          <QuickLogButton />
        </div>
      </div>

      {/* 2. Alerts + Proactive Coach Insights */}
      {alerts.length > 0 && <AlertsDisplay alerts={alerts} />}
      {proactivePrompts.length > 0 && (
        <ProactiveCoachPrompts prompts={proactivePrompts} variant="inline" />
      )}

      {/* Unassessed workout prompt */}
      {lastRun && !lastRun.assessment && (
        <div className="bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border border-accentTeal/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-textPrimary">How was your {getWorkoutTypeLabel(lastRun.workoutType).toLowerCase()}?</p>
              <p className="text-sm text-textSecondary mt-0.5">
                {formatDistance(lastRun.distanceMiles)} mi · {getRelativeTime(lastRun.date)}
              </p>
            </div>
            <Link
              href={`/coach?message=${encodeURIComponent(`I just finished a ${formatDistance(lastRun.distanceMiles)} mile ${getWorkoutTypeLabel(lastRun.workoutType).toLowerCase()}. Can you help me assess it?`)}&type=user`}
              className="btn-primary px-4 py-2 rounded-lg text-sm flex-shrink-0"
            >
              Talk to Coach
            </Link>
          </div>
        </div>
      )}

      {/* 3. Last Run Card */}
      {lastRun && (
        <Link
          href={`/workout/${lastRun.id}`}
          className="block bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden hover:border-accentTeal/40 transition-colors"
        >
          <div className="flex">
            <div className="w-1 bg-gradient-to-b from-accentTeal to-accentBlue flex-shrink-0" />
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkoutTypeColor(lastRun.workoutType)}`}>
                    {getWorkoutTypeLabel(lastRun.workoutType)}
                  </span>
                  <span className="text-xs text-textTertiary">{getRelativeTime(lastRun.date)}</span>
                </div>
                {lastRun.assessment && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getVerdictColor(lastRun.assessment.verdict)}`}>
                    {lastRun.assessment.verdict}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatDistance(lastRun.distanceMiles)}</span>
                  <span className="text-textTertiary ml-1">mi</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatPace(lastRun.avgPaceSeconds)}</span>
                  <span className="text-textTertiary ml-1">/mi</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-textPrimary">{formatDuration(lastRun.durationMinutes)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center pr-3">
              <ChevronRight className="w-5 h-5 text-textTertiary" />
            </div>
          </div>
        </Link>
      )}

      {/* 4. Next Workout Card */}
      {nextWorkoutData && (
        <div className="bg-bgSecondary rounded-xl border-2 border-borderPrimary shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-indigo-500 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">{nextWorkoutLabel}</span>
                {nextWorkoutData.isKeyWorkout && (
                  <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Key
                  </span>
                )}
              </div>
              {nextWorkoutData.phase && (
                <span className="text-xs text-teal-100 capitalize">{nextWorkoutData.phase} phase</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-textPrimary text-lg line-clamp-1">{nextWorkoutData.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getWorkoutTypeColor(nextWorkoutData.workoutType)}`}>
                {getWorkoutTypeLabel(nextWorkoutData.workoutType)}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              {nextWorkoutData.targetDistanceMiles && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Target className="w-4 h-4 mr-1 text-textTertiary" />
                  {nextWorkoutData.targetDistanceMiles} miles
                </div>
              )}
              {nextWorkoutData.targetPaceSecondsPerMile && (
                <div className="flex items-center text-sm text-textSecondary">
                  <Zap className="w-4 h-4 mr-1 text-textTertiary" />
                  {formatPaceFromTraining(nextWorkoutData.targetPaceSecondsPerMile)}/mi
                </div>
              )}
            </div>

            {nextWorkoutData.rationale && (
              <p className="text-sm text-textSecondary mt-2 line-clamp-2">{nextWorkoutData.rationale}</p>
            )}

            <div className="mt-4">
              <Link
                href="/log"
                className="btn-primary block text-center py-2.5 rounded-xl"
              >
                Log This Workout
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 5. Week Ahead Strip */}
      {weekPlan.workouts.length > 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-textPrimary">
              Week Ahead
              {trainingSummary?.currentPhase && (
                <span className="text-textTertiary font-normal capitalize"> &middot; {trainingSummary.currentPhase}</span>
              )}
            </h3>
            <span className="text-xs text-textSecondary">
              {weekPlan.completedMiles.toFixed(1)}/{weekPlan.totalMiles.toFixed(1)} mi
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isCompleted = day.workout?.status === 'completed';
              const isRest = !day.workout || day.workout.workoutType === 'rest';
              const isPast = day.date < todayString && !isCompleted;

              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg ${
                    day.isToday ? 'ring-2 ring-accentTeal bg-accentTeal/10' : ''
                  }`}
                >
                  <span className={`text-xs font-medium mb-1.5 ${
                    day.isToday ? 'text-accentTeal' : 'text-textTertiary'
                  }`}>
                    {day.dayLabel}
                  </span>

                  {isRest ? (
                    <Minus className="w-3 h-3 text-textTertiary/40" />
                  ) : (
                    <div className="relative">
                      <div className={`w-3 h-3 rounded-full ${getTypeDotColor(day.workout!.workoutType)}`} />
                      {isCompleted && (
                        <Check className="w-3 h-3 text-green-500 absolute -top-1 -right-1" />
                      )}
                      {day.workout!.isKeyWorkout && !isCompleted && (
                        <Star className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1.5 fill-amber-400" />
                      )}
                    </div>
                  )}

                  {!isRest && day.workout?.targetDistanceMiles && (
                    <span className={`text-[10px] mt-1 ${
                      isCompleted ? 'text-green-600 dark:text-green-400' :
                      isPast ? 'text-textTertiary line-through' : 'text-textSecondary'
                    }`}>
                      {day.workout.targetDistanceMiles}mi
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {trainingSummary?.nextRace && (
            <div className="mt-3 pt-3 border-t border-borderSecondary flex items-center gap-2 text-xs text-textSecondary">
              <Flag className="w-3.5 h-3.5 text-accentBlue" />
              <span className="font-medium text-textPrimary">{trainingSummary.nextRace.name}</span>
              <span>&middot; {trainingSummary.nextRace.distance} &middot; {trainingSummary.nextRace.daysUntil} days</span>
            </div>
          )}
        </div>
      ) : !trainingSummary?.nextRace && (
        <div className="bg-gradient-to-r from-indigo-600 to-teal-600 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Get Your Training Plan</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Set a goal race and we&apos;ll build an adaptive plan tailored to you.
              </p>
              <Link
                href="/races"
                className="inline-flex items-center gap-2 bg-white dark:bg-surface-1 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg font-semibold mt-3 hover:bg-indigo-50 dark:hover:bg-surface-2 transition-colors text-sm shadow-sm"
              >
                <Flag className="w-4 h-4" />
                Set Your Goal Race
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 6. Quick Coach */}
      <QuickCoachInput suggestions={contextualSuggestions} />

      {/* 7. Readiness + Weather Row */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/readiness"
          className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:border-accentTeal/40 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <Battery className={`w-4 h-4 ${readinessData.result.color}`} />
            <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Readiness</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold ${readinessData.result.color}`}>
              {readinessData.result.score}
            </span>
            <span className="text-sm text-textSecondary">{readinessData.result.label}</span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-accentTeal">
            Details <ChevronRight className="w-3 h-3" />
          </div>
        </Link>

        {weather ? (
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const Icon = getWeatherIcon(weather.condition);
                return <Icon className="w-4 h-4 text-accentBlue" />;
              })()}
              <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Weather</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-textPrimary">{Math.round(weather.temperature)}&deg;</span>
              <span className="text-sm text-textSecondary capitalize">{weather.condition}</span>
            </div>
            {weather.feelsLike !== weather.temperature && (
              <p className="text-xs text-textTertiary mt-1">Feels {Math.round(weather.feelsLike)}&deg;</p>
            )}
          </div>
        ) : (
          <Link
            href="/settings"
            className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm hover:border-accentTeal/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-textTertiary" />
              <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Weather</span>
            </div>
            <p className="text-sm text-textSecondary">Set location in settings</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-accentTeal">
              Settings <ChevronRight className="w-3 h-3" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function TodayPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoToday />}
      serverComponent={<ServerToday />}
    />
  );
}
