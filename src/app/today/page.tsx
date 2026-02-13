// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getWorkouts } from '@/actions/workouts';
import { getSettings } from '@/actions/settings';
import { getClothingItems } from '@/actions/wardrobe';
import { getTodaysWorkout, getTrainingSummary } from '@/actions/training-plan';
import { getWeeklyStats, getRunningStreak, getCurrentWeekDays } from '@/actions/analytics';
import { getActiveAlerts } from '@/actions/alerts';
import { getTodayReadinessWithFactors } from '@/actions/readiness';
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
import { Plus, ChevronRight, Check, MapPin, Calendar, Target, Flag, Zap, Battery } from 'lucide-react';
import { SeverityBanner } from '@/components/WeatherCard';
import { DailyConditionsCard } from '@/components/DailyConditionsCard';
import { QuickCoachInput } from '@/components/QuickCoachInput';
import { WeeklyStatsCard } from '@/components/WeeklyStatsCard';
import { StreakBadge } from '@/components/StreakBadge';
import { DailyTip } from '@/components/DailyTip';
import { AlertsDisplay } from '@/components/AlertsDisplay';
import { CurrentWeekCircles } from '@/components/CurrentWeekCircles';
import { DemoWrapper } from '@/components/DemoWrapper';
import { DemoToday } from '@/components/DemoToday';
import { DynamicGreeting } from '@/components/DynamicGreeting';
import { QuickLogButton } from '@/components/QuickLogButton';
import { getActiveProfileId } from '@/lib/profile-server';
import { getProfileCompleteness } from '@/lib/profile-completeness';
import { ProfileCompletenessCard } from '@/components/ProfileCompletenessCard';
import { ProfileCompletion } from '@/components/ProfileCompletion';
import { getProactivePrompts } from '@/lib/proactive-coach';
import { ProactiveCoachPrompts } from '@/components/ProactiveCoachPrompts';
import type { TemperaturePreference, WorkoutType, Workout, Assessment, Shoe } from '@/lib/schema';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

async function ServerToday() {
  const profileId = await getActiveProfileId();
  const [recentWorkouts, settings, wardrobeItems, plannedWorkout, trainingSummary, weeklyStats, streak, alerts, weekDays, readinessData, profileCompleteness, proactivePrompts] = await Promise.all([
    getWorkouts(10, profileId),
    getSettings(profileId),
    getClothingItems(false, profileId),
    getTodaysWorkout(),
    getTrainingSummary(),
    getWeeklyStats(),
    getRunningStreak(),
    getActiveAlerts(),
    getCurrentWeekDays(),
    getTodayReadinessWithFactors(),
    profileId ? getProfileCompleteness(profileId) : null,
    getProactivePrompts(),
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

  // Weather/conditions block (reused in both layouts)
  const weatherBlock = weather && severity ? (
    <>
      <SeverityBanner severity={severity} />
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
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-accentTeal/20 rounded-full flex items-center justify-center">
          <MapPin className="w-5 h-5 text-accentTeal" />
        </div>
        <div>
          <h2 className="font-semibold text-textPrimary">Set Your Location</h2>
          <p className="text-sm text-textSecondary">Get weather-based pace adjustments</p>
        </div>
      </div>
      <p className="text-textSecondary text-sm mb-3">
        Add your location in Settings to see current conditions and get intelligent pace
        recommendations based on temperature, humidity, and wind.
      </p>
      <Link
        href="/settings"
        className="link-primary text-sm inline-flex items-center"
      >
        Go to Settings
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  ) : null;

  // Readiness block (reused)
  const readinessBlock = (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            readinessData.result.score >= 70 ? 'bg-teal-500/20 dark:bg-teal-400/20' :
            readinessData.result.score >= 50 ? 'bg-accentTeal/20' :
            readinessData.result.score >= 30 ? 'bg-accentOrange/20' : 'bg-rose-500/20 dark:bg-rose-400/20'
          }`}>
            <Battery className={`w-6 h-6 ${readinessData.result.color}`} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="font-semibold text-textPrimary">Readiness</h3>
              <span className={`text-2xl font-bold ${readinessData.result.color}`}>
                {readinessData.result.score}
              </span>
            </div>
            <p className="text-sm text-textSecondary">{readinessData.result.label}</p>
          </div>
        </div>
        <Link
          href="/readiness"
          className="link-primary text-sm flex items-center gap-1"
        >
          Details
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="text-textSecondary">Sleep</div>
          <div className={`font-medium ${
            readinessData.result.breakdown.sleep >= 70 ? 'text-teal-600 dark:text-teal-300' :
            readinessData.result.breakdown.sleep >= 50 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {readinessData.result.breakdown.sleep}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-textSecondary">Training</div>
          <div className={`font-medium ${
            readinessData.result.breakdown.training >= 70 ? 'text-teal-600 dark:text-teal-300' :
            readinessData.result.breakdown.training >= 50 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {readinessData.result.breakdown.training}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-textSecondary">Physical</div>
          <div className={`font-medium ${
            readinessData.result.breakdown.physical >= 70 ? 'text-teal-600 dark:text-teal-300' :
            readinessData.result.breakdown.physical >= 50 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {readinessData.result.breakdown.physical}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-textSecondary">Life</div>
          <div className={`font-medium ${
            readinessData.result.breakdown.life >= 70 ? 'text-teal-600 dark:text-teal-300' :
            readinessData.result.breakdown.life >= 50 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {readinessData.result.breakdown.life}%
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-bgTertiary rounded-lg">
        <p className="text-sm text-textPrimary">{readinessData.result.recommendation}</p>
      </div>
    </div>
  );

  // Training summary block
  const trainingSummaryBlock = trainingSummary?.nextRace ? (
    <div className="flex items-center gap-3 bg-gradient-to-r from-accent-blue/10 to-accent-teal/10 rounded-xl p-4 border border-accent-blue/20">
      <div className="w-10 h-10 bg-accentBlue/20 rounded-full flex items-center justify-center flex-shrink-0">
        <Flag className="w-5 h-5 text-accentBlue" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-textPrimary truncate">{trainingSummary.nextRace.name}</p>
        <p className="text-xs text-textSecondary truncate">
          {trainingSummary.nextRace.distance} • {trainingSummary.nextRace.daysUntil} days
          {trainingSummary.currentPhase && (
            <span className="ml-2 capitalize">• {trainingSummary.currentPhase} phase</span>
          )}
        </p>
      </div>
    </div>
  ) : (
    <div className="bg-gradient-to-r from-indigo-600 to-teal-600 rounded-xl p-5 text-white shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-white/20 dark:bg-surface-3/30 rounded-full flex items-center justify-center flex-shrink-0">
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
  );

  // Recent workouts block
  const recentWorkoutsBlock = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-textPrimary">Recent Workouts</h2>
        <Link href="/history" className="link-primary text-sm">
          View all
        </Link>
      </div>

      {otherRecentWorkouts.length === 0 && !hasRunToday ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 text-center text-textSecondary shadow-sm">
          <p>No workouts logged yet.</p>
          <p className="text-sm mt-1">Log your first run to get started!</p>
        </div>
      ) : otherRecentWorkouts.length === 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 text-center text-textSecondary shadow-sm">
          <p>Today was your first logged run!</p>
          <p className="text-sm mt-1">Keep it up and build your streak.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {otherRecentWorkouts.map((workout) => (
            <Link
              key={workout.id}
              href={`/workout/${workout.id}`}
              className="block card-interactive p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-textPrimary">
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
                  <div className="flex items-center gap-4 text-sm text-textSecondary">
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
  );

  return (
    <div className="space-y-6">
      {/* Header */}
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
          {!hasRunToday && <QuickLogButton />}
        </div>
      </div>

      {/* Profile Completion */}
      {settings && <ProfileCompletion settings={settings} />}

      {/* Proactive Coach Alerts - Always high priority */}
      {alerts.length > 0 && <AlertsDisplay alerts={alerts} />}

      {hasRunToday ? (
        <>
          {/* === POST-RUN LAYOUT === */}
          {/* 1. Celebration first - you just ran! */}
          <div className="bg-gradient-to-r from-teal-500 to-emerald-500 dark:from-teal-600 dark:to-emerald-600 rounded-xl p-5 text-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 dark:bg-surface-3/30 rounded-full flex items-center justify-center">
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
                className="block bg-white/10 dark:bg-surface-3/20 rounded-lg p-4 hover:bg-white/20 dark:hover:bg-surface-3/30 transition-colors mt-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {getWorkoutTypeLabel(workout.workoutType)}
                      </span>
                      {workout.assessment && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium capitalize bg-white/20 dark:bg-surface-3/30">
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

          {/* 2. Coach messages */}
          {proactivePrompts.length > 0 && (
            <ProactiveCoachPrompts prompts={proactivePrompts} variant="inline" />
          )}

          {/* 3. Ask Coach */}
          <QuickCoachInput suggestions={contextualSuggestions} />

          {/* 4. Week progress + stats */}
          <CurrentWeekCircles days={weekDays} />
          <WeeklyStatsCard
            stats={weeklyStats}
            weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
          />

          {/* 5. Readiness */}
          {readinessBlock}

          {/* 6. Recent workouts */}
          {recentWorkoutsBlock}

          {/* 7. Log another (subtle) */}
          <Link
            href="/log"
            className="block bg-bgSecondary hover:bg-bgInteractive-hover border border-borderPrimary rounded-xl p-4 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accentTeal/20 rounded-full flex items-center justify-center">
                  <Plus className="w-5 h-5 text-accentTeal" />
                </div>
                <div>
                  <p className="font-medium text-textPrimary">Log another run</p>
                  <p className="text-sm text-textSecondary">Double day?</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-textTertiary" />
            </div>
          </Link>

          {/* 8. Training summary */}
          {trainingSummaryBlock}

          {/* 9. Weather lower - already ran, less urgent */}
          {weatherBlock}

          {/* 10. Daily tip */}
          <DailyTip
            phase={trainingSummary?.currentPhase}
            daysUntilRace={trainingSummary?.nextRace?.daysUntil}
            hasRanToday={hasRunToday}
            currentStreak={streak.currentStreak}
          />
        </>
      ) : (
        <>
          {/* === PRE-RUN LAYOUT === */}
          {/* 1. Today's planned workout - what to do */}
          {plannedWorkout && (
            <div className="bg-bgSecondary rounded-xl border-2 border-borderPrimary shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-indigo-500 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="w-5 h-5" />
                    <span className="font-medium">Today&apos;s Workout</span>
                    {plannedWorkout.isKeyWorkout && (
                      <span className="px-2 py-0.5 text-xs bg-white/20 dark:bg-surface-3/30 rounded-full">Key Workout</span>
                    )}
                  </div>
                  {plannedWorkout.phase && (
                    <span className="text-xs text-teal-100 capitalize">{plannedWorkout.phase} phase</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-textPrimary text-lg line-clamp-2">{plannedWorkout.name}</h3>
                <p className="text-textSecondary text-sm mt-1 line-clamp-3">{plannedWorkout.description}</p>

                <div className="flex flex-wrap gap-4 mt-3">
                  {plannedWorkout.targetDistanceMiles && (
                    <div className="flex items-center text-sm text-textSecondary">
                      <Target className="w-4 h-4 mr-1 text-tertiary dark:text-textTertiary" />
                      {plannedWorkout.targetDistanceMiles} miles
                    </div>
                  )}
                  {plannedWorkout.targetPaceSecondsPerMile && (
                    <div className="flex items-center text-sm text-textSecondary">
                      <Zap className="w-4 h-4 mr-1 text-tertiary dark:text-textTertiary" />
                      {formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)}/mi
                    </div>
                  )}
                </div>

                {plannedWorkout.rationale && (
                  <div className="mt-3 pt-3 border-t border-borderSecondary">
                    <p className="text-xs text-textSecondary uppercase tracking-wide mb-1">Purpose</p>
                    <p className="text-sm text-textSecondary line-clamp-3">{plannedWorkout.rationale}</p>
                  </div>
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

          {/* 2. Coach messages */}
          {proactivePrompts.length > 0 && (
            <ProactiveCoachPrompts prompts={proactivePrompts} variant="inline" />
          )}

          {/* 3. Ask Coach */}
          <QuickCoachInput suggestions={contextualSuggestions} />

          {/* 4. Readiness - helps decide if you should run */}
          {readinessBlock}

          {/* 5. Weather/conditions - plan your run */}
          {weatherBlock}

          {/* 6. Log Run CTA */}
          <Link
            href="/log"
            className="block bg-accentTeal hover:bg-accentTeal/90 text-white rounded-xl p-5 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Log a Run</h2>
                <p className="text-teal-100 text-sm mt-0.5">Record your workout and track progress</p>
              </div>
              <Plus className="w-6 h-6" />
            </div>
          </Link>

          {/* 7. Week progress + stats */}
          <CurrentWeekCircles days={weekDays} />
          <WeeklyStatsCard
            stats={weeklyStats}
            weeklyTarget={settings?.weeklyVolumeTargetMiles ?? undefined}
          />

          {/* 8. Training summary */}
          {trainingSummaryBlock}

          {/* 9. Daily tip */}
          <DailyTip
            phase={trainingSummary?.currentPhase}
            daysUntilRace={trainingSummary?.nextRace?.daysUntil}
            hasRanToday={hasRunToday}
            currentStreak={streak.currentStreak}
          />

          {/* 10. Profile completeness */}
          {profileCompleteness && profileCompleteness.percentage < 80 && (
            <ProfileCompletenessCard data={profileCompleteness} variant="compact" />
          )}

          {/* 11. Recent workouts */}
          {recentWorkoutsBlock}
        </>
      )}
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
