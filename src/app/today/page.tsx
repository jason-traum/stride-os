import Link from 'next/link';
import { getWorkouts } from '@/actions/workouts';
import { getSettings } from '@/actions/settings';
import { getClothingItems } from '@/actions/wardrobe';
import { getTodaysWorkout, getTrainingSummary } from '@/actions/training-plan';
import { getWeeklyStats, getRunningStreak } from '@/actions/analytics';
import { fetchSmartWeather } from '@/lib/weather';
import { calculateConditionsSeverity } from '@/lib/conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems } from '@/lib/outfit';
import { formatPace as formatPaceFromTraining } from '@/lib/training/types';
import { getContextualPrompts, getTimeOfDay, isWeekend, getWeatherCondition, type PromptContext } from '@/lib/chat-prompts';
import {
  formatDate,
  formatDistance,
  formatPace,
  formatDuration,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
  getTodayString,
} from '@/lib/utils';
import { Plus, ChevronRight, Check, MapPin, Calendar, Target, Flag, Zap } from 'lucide-react';
import { SeverityBanner } from '@/components/WeatherCard';
import { DailyConditionsCard } from '@/components/DailyConditionsCard';
import { QuickCoachInput } from '@/components/QuickCoachInput';
import { WeeklyStatsCard } from '@/components/WeeklyStatsCard';
import { StreakBadge } from '@/components/StreakBadge';
import { DailyTip } from '@/components/DailyTip';
import { DemoWrapper } from '@/components/DemoWrapper';
import { DemoToday } from '@/components/DemoToday';
import type { TemperaturePreference, WorkoutType, Workout, Assessment, Shoe } from '@/lib/schema';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

async function ServerToday() {
  const [recentWorkouts, settings, wardrobeItems, plannedWorkout, trainingSummary, weeklyStats, streak] = await Promise.all([
    getWorkouts(10),
    getSettings(),
    getClothingItems(),
    getTodaysWorkout(),
    getTrainingSummary(),
    getWeeklyStats(),
    getRunningStreak(),
  ]);

  // Fetch smart weather if location is set (shows relevant run window)
  const smartWeather = settings?.latitude && settings?.longitude
    ? await fetchSmartWeather(settings.latitude, settings.longitude)
    : null;

  // Use the run window weather for severity and recommendations
  const weather = smartWeather?.runWindow.weather || null;
  const severity = weather ? calculateConditionsSeverity(weather) : null;
  const runWindowLabel = smartWeather?.runWindow.label || null;
  const runWindowTime = smartWeather?.runWindow.time || null;
  const isLiveWeather = smartWeather?.runWindow.isCurrent ?? true;

  // Alternate window (e.g., evening option when showing morning)
  const alternateWindow = smartWeather?.alternateWindow || null;
  const alternateWeather = alternateWindow?.weather || null;
  const alternateSeverity = alternateWeather ? calculateConditionsSeverity(alternateWeather) : null;

  // Calculate outfit recommendation for a default easy 5-mile run
  const defaultDistance = 5;
  const defaultWorkoutType: WorkoutType = 'easy';
  const temperaturePreference = (settings?.temperaturePreference as TemperaturePreference) || 'neutral';

  const outfitRecommendation = weather
    ? (() => {
        const vt = calculateVibesTemp(
          weather.feelsLike,
          defaultWorkoutType,
          defaultDistance,
          temperaturePreference
        );
        const recommendation = getOutfitRecommendation(vt, weather, defaultWorkoutType);
        const matchedItems = matchWardrobeItems(recommendation, wardrobeItems);
        return { recommendation, matchedItems };
      })()
    : null;

  const today = new Date();
  const todayString = getTodayString();
  const greeting = getGreeting();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Find today's workout(s)
  const todaysWorkouts = (recentWorkouts as WorkoutWithRelations[]).filter((w) => w.date === todayString);
  const hasRunToday = todaysWorkouts.length > 0;

  // Recent workouts excluding today
  const otherRecentWorkouts = (recentWorkouts as WorkoutWithRelations[]).filter((w) => w.date !== todayString).slice(0, 5);

  // Generate contextual chat prompts
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900">
            {greeting}{settings?.name ? `, ${settings.name}` : ''}!
          </h1>
          <p className="text-slate-500 mt-1">{dateStr}</p>
        </div>
        {streak.currentStreak > 0 && (
          <StreakBadge
            currentStreak={streak.currentStreak}
            longestStreak={streak.longestStreak}
          />
        )}
      </div>

      {/* Ask Coach - AI-First Interface with Contextual Prompts */}
      <QuickCoachInput suggestions={contextualSuggestions} />

      {/* Training Summary Banner - Show goal race or prompt to set one */}
      {trainingSummary?.nextRace ? (
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Flag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{trainingSummary.nextRace.name}</p>
              <p className="text-xs text-slate-500">
                {trainingSummary.nextRace.distance} • {trainingSummary.nextRace.daysUntil} days
                {trainingSummary.currentPhase && (
                  <span className="ml-2 capitalize">• {trainingSummary.currentPhase} phase</span>
                )}
              </p>
            </div>
          </div>
          <Link href="/plan" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View Plan
          </Link>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Get Your Personalized Training Plan</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Set a goal race and we&apos;ll build an adaptive training plan tailored to your fitness level.
                Every workout calibrated to help you reach your goal.
              </p>
              <Link
                href="/races"
                className="inline-flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium mt-3 hover:bg-indigo-50 transition-colors text-sm"
              >
                <Flag className="w-4 h-4" />
                Set Your Goal Race
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Today's Planned Workout */}
      {plannedWorkout && !hasRunToday && (
        <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Today&apos;s Workout</span>
                {plannedWorkout.isKeyWorkout && (
                  <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">Key Workout</span>
                )}
              </div>
              {plannedWorkout.phase && (
                <span className="text-xs text-blue-100 capitalize">{plannedWorkout.phase} phase</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-slate-900 text-lg">{plannedWorkout.name}</h3>
            <p className="text-slate-600 text-sm mt-1">{plannedWorkout.description}</p>

            {/* Workout stats */}
            <div className="flex flex-wrap gap-4 mt-3">
              {plannedWorkout.targetDistanceMiles && (
                <div className="flex items-center text-sm text-slate-600">
                  <Target className="w-4 h-4 mr-1 text-slate-400" />
                  {plannedWorkout.targetDistanceMiles} miles
                </div>
              )}
              {plannedWorkout.targetPaceSecondsPerMile && (
                <div className="flex items-center text-sm text-slate-600">
                  <Zap className="w-4 h-4 mr-1 text-slate-400" />
                  {formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)}/mi
                </div>
              )}
            </div>

            {/* Rationale */}
            {plannedWorkout.rationale && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Purpose</p>
                <p className="text-sm text-slate-600">{plannedWorkout.rationale}</p>
              </div>
            )}

            {/* Action */}
            <div className="mt-4 flex gap-2">
              <Link
                href="/log"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2.5 rounded-xl font-medium transition-colors"
              >
                Log This Workout
              </Link>
              <Link
                href="/plan"
                className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Daily Conditions - Consolidated Weather, Pace, and Outfit */}
      {weather && severity ? (
        <>
          {/* Severity Warning Banner */}
          <SeverityBanner severity={severity} />

          {/* Daily Conditions Card - All-in-One */}
          <DailyConditionsCard
            weather={weather}
            severity={severity}
            outfitRecommendation={outfitRecommendation}
            acclimatizationScore={settings?.heatAcclimatizationScore ?? 50}
            defaultPaceSeconds={settings?.defaultTargetPaceSeconds ?? undefined}
            runWindowLabel={runWindowLabel}
            runWindowTime={runWindowTime}
            isLiveWeather={isLiveWeather}
            workoutType={defaultWorkoutType}
            alternateWindow={alternateWindow ? {
              label: alternateWindow.label,
              time: alternateWindow.time,
              weather: alternateWeather!,
              severity: alternateSeverity!,
              isCurrent: alternateWindow.isCurrent,
            } : undefined}
          />
        </>
      ) : !settings?.latitude ? (
        /* No Location Set */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Set Your Location</h2>
              <p className="text-sm text-slate-500">Get weather-based pace adjustments</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm mb-3">
            Add your location in Settings to see current conditions and get intelligent pace
            recommendations based on temperature, humidity, and wind.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Settings
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : null}

      {/* Today's Run - Celebration! */}
      {hasRunToday && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Great job today!</h2>
              <p className="text-green-100 text-sm">You got your run in</p>
            </div>
          </div>

          {todaysWorkouts.map((workout) => (
            <Link
              key={workout.id}
              href={`/workout/${workout.id}`}
              className="block bg-white/10 rounded-lg p-4 hover:bg-white/20 transition-colors mt-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {getWorkoutTypeLabel(workout.workoutType)}
                    </span>
                    {workout.assessment && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium capitalize bg-white/20">
                        {workout.assessment.verdict}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-green-100">
                    <span>{formatDistance(workout.distanceMiles)} mi</span>
                    <span>{formatDuration(workout.durationMinutes)}</span>
                    <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-green-100" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Log Run CTA - Different style if already ran today */}
      {!hasRunToday ? (
        <Link
          href="/log"
          className="block bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Log a Run</h2>
              <p className="text-blue-100 text-sm mt-0.5">Record your workout and track progress</p>
            </div>
            <Plus className="w-6 h-6" />
          </div>
        </Link>
      ) : (
        <Link
          href="/log"
          className="block bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Log another run</p>
                <p className="text-sm text-slate-500">Double day?</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </Link>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/pace-calculator"
          className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors shadow-sm"
        >
          <p className="font-medium text-slate-900">Pace Calculator</p>
          <p className="text-sm text-slate-500">Full calculator</p>
        </Link>
        <Link
          href="/history"
          className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors shadow-sm"
        >
          <p className="font-medium text-slate-900">Workout History</p>
          <p className="text-sm text-slate-500">View all runs</p>
        </Link>
      </div>

      {/* Weekly Stats */}
      <WeeklyStatsCard
        stats={weeklyStats}
        weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
      />

      {/* Daily Training Tip */}
      <DailyTip
        phase={trainingSummary?.currentPhase}
        daysUntilRace={trainingSummary?.nextRace?.daysUntil}
        hasRanToday={hasRunToday}
        currentStreak={streak.currentStreak}
      />

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recent Workouts</h2>
          <Link href="/history" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all
          </Link>
        </div>

        {otherRecentWorkouts.length === 0 && !hasRunToday ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 shadow-sm">
            <p>No workouts logged yet.</p>
            <p className="text-sm mt-1">Log your first run to get started!</p>
          </div>
        ) : otherRecentWorkouts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 shadow-sm">
            <p>Today was your first logged run!</p>
            <p className="text-sm mt-1">Keep it up and build your streak.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {otherRecentWorkouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/workout/${workout.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-900">
                        {formatDate(workout.date)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkoutTypeColor(
                          workout.workoutType
                        )}`}
                      >
                        {getWorkoutTypeLabel(workout.workoutType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>{formatDistance(workout.distanceMiles)} mi</span>
                      <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                    </div>
                  </div>

                  {workout.assessment && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getVerdictColor(
                        workout.assessment.verdict
                      )}`}
                    >
                      {workout.assessment.verdict}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoToday />}
      serverComponent={<ServerToday />}
    />
  );
}
