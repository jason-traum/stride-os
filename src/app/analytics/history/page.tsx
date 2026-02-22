import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'History | Analytics | Dreamy',
  description: 'Activity heatmap, calendar view, and weekly/monthly rollups.',
};

import { getAnalyticsData, getDailyActivityData, getCalendarData } from '@/actions/analytics';
import { getSettings } from '@/actions/settings';
import { getActiveProfileId } from '@/lib/profile-server';
import { ActivityHeatmap } from '@/components/charts';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { WeeklyRollupTable, MonthlyRollupCards } from '@/components/TrainingDistribution';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { DreamySheep } from '@/components/DreamySheep';
import { EmptyState } from '@/components/EmptyState';

// Get workout type color
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    recovery: 'bg-slate-500',
    easy: 'bg-sky-500',
    long: 'bg-dream-600',
    steady: 'bg-sky-600',
    marathon: 'bg-blue-600',
    tempo: 'bg-indigo-600',
    threshold: 'bg-violet-600',
    interval: 'bg-red-600',
    repetition: 'bg-rose-700',
    race: 'bg-amber-600',
    cross_train: 'bg-violet-500',
    other: 'bg-stone-500',
  };
  return colors[type] || colors.other;
}

// Get workout type label
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    steady: 'Steady',
    marathon: 'Marathon',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    repetition: 'Repetition',
    long: 'Long',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export default async function HistoryPage() {
  const profileId = await getActiveProfileId();
  const [data, dailyActivity, calendarData, settings] = await Promise.all([
    getAnalyticsData(profileId).catch((e) => {
      console.error('Failed to load analytics data:', e);
      return null;
    }),
    getDailyActivityData(12, profileId).catch((e) => {
      console.error('Failed to load daily activity data:', e);
      return [];
    }),
    getCalendarData(profileId).catch((e) => {
      console.error('Failed to load calendar data:', e);
      return [];
    }),
    getSettings(profileId),
  ]);

  if (!data || data.totalWorkouts === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm">
        <div className="flex flex-col items-center pt-8 pb-2">
          <DreamySheep mood="encouraging" size="lg" withSpeechBubble="Start logging runs to see your activity history!" />
        </div>
        <EmptyState variant="analytics" />
      </div>
    );
  }

  return (
    <AnimatedList className="space-y-6">
      {/* Activity Heatmap - full width */}
      {dailyActivity.length > 0 && (
        <AnimatedListItem>
          <ActivityHeatmap
            data={dailyActivity}
            months={12}
            userThresholdPace={settings?.thresholdPaceSeconds ?? undefined}
            userEasyPace={settings?.easyPaceSeconds ?? undefined}
            userMaxHr={settings?.restingHr ? Math.round(settings.restingHr * 3.2) : undefined}
            userRestingHr={settings?.restingHr ?? undefined}
          />
        </AnimatedListItem>
      )}

      {/* Calendar + Workout Types */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {calendarData.length > 0 && (
            <MonthlyCalendar workouts={calendarData} />
          )}
          {/* Workout Type Distribution */}
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
            <h2 className="font-semibold text-textPrimary mb-3 text-sm">Workout Types</h2>
            {data.workoutTypeDistribution.length > 0 ? (
              <>
                <div className="h-6 rounded-full overflow-hidden flex mb-3">
                  {(() => {
                    const totalCounts = data.workoutTypeDistribution.reduce((sum, t) => sum + t.count, 0);
                    return data.workoutTypeDistribution.map((type) => {
                      const width = (type.count / totalCounts) * 100;
                      return (
                        <div
                          key={type.type}
                          className={`${getTypeColor(type.type)} first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${width}%` }}
                          title={`${getTypeLabel(type.type)}: ${type.count} workouts`}
                        />
                      );
                    });
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {data.workoutTypeDistribution.map((type) => (
                    <div key={type.type} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${getTypeColor(type.type)}`} />
                      <span className="text-xs text-textSecondary">
                        {getTypeLabel(type.type)}: <span className="font-medium">{type.count}</span>
                        <span className="text-textTertiary ml-0.5">({type.miles}mi)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-textTertiary text-center py-6 text-sm">No workout data yet</p>
            )}
          </div>
        </div>
      </AnimatedListItem>

      {/* Rollup Tables */}
      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeeklyRollupTable />
          <MonthlyRollupCards />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}
