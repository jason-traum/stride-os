'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, Trophy, Calendar, TrendingUp, Thermometer, Loader2, Award, Globe, Clock, Map } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  getRunningStreak,
  getRunningMilestones,
  getWeatherCorrelation,
  getDayOfWeekDistribution,
  getFunFacts,
  type RunningStreak,
  type RunningMilestones,
  type WeatherCorrelation,
} from '@/actions/running-stats';

// Format date nicely
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Running Streak Card
 */
export function RunningStreakCard() {
  const [streak, setStreak] = useState<RunningStreak | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRunningStreak().then(data => {
      setStreak(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-rose-500" />
          Running Streak
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!streak || streak.streakStatus === 'no_data') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-rose-500" />
          Running Streak
        </h2>
        <p className="text-sm text-textTertiary">Start running to build your streak!</p>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-rose-500" />
        Running Streak
      </h2>

      <div className="flex items-center gap-6">
        {/* Current streak */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${streak.streakStatus === 'active' ? 'text-rose-500' : 'text-tertiary'}`}>
            {streak.currentStreak}
          </div>
          <p className="text-xs text-textTertiary mt-1">Current</p>
          {streak.streakStatus === 'active' && streak.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-rose-500 mt-1">
              <Flame className="w-3 h-3" /> Active
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-stone-200" />

        {/* Longest streak */}
        <div className="text-center">
          <div className="text-4xl font-bold text-textSecondary">
            {streak.longestStreak}
          </div>
          <p className="text-xs text-textTertiary mt-1">Longest</p>
          {streak.longestStreakStart && streak.longestStreakEnd && (
            <p className="text-xs text-tertiary mt-1">
              {formatDate(streak.longestStreakStart).split(',')[0]} - {formatDate(streak.longestStreakEnd).split(',')[0]}
            </p>
          )}
        </div>
      </div>

      {streak.streakStatus === 'broken' && streak.lastRunDate && (
        <p className="text-xs text-tertiary mt-4 pt-4 border-t border-borderSecondary">
          Last run: {formatDate(streak.lastRunDate)}
        </p>
      )}
    </div>
  );
}

/**
 * All-Time Milestones Card
 */
export function MilestonesCard() {
  const [milestones, setMilestones] = useState<RunningMilestones | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRunningMilestones().then(data => {
      setMilestones(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" />
          All-Time Stats
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!milestones || milestones.totalRunsAllTime === 0) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-secondary" />
        All-Time Stats
      </h2>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{milestones.totalMilesAllTime}</p>
          <p className="text-xs text-textTertiary">Miles</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{milestones.totalRunsAllTime}</p>
          <p className="text-xs text-textTertiary">Runs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{Math.round(milestones.totalHoursAllTime)}</p>
          <p className="text-xs text-textTertiary">Hours</p>
        </div>
      </div>

      {/* Records */}
      <div className="space-y-2 pt-4 border-t border-borderSecondary">
        {milestones.longestRun && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-textTertiary">Longest Run</span>
            <Link href={`/workout/${milestones.longestRun.id}`} className="link-primary">
              {milestones.longestRun.distance} mi
            </Link>
          </div>
        )}
        {milestones.fastestMile && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-textTertiary">Fastest Pace</span>
            <Link href={`/workout/${milestones.fastestMile.id}`} className="link-primary">
              {formatPace(milestones.fastestMile.pace)}/mi
            </Link>
          </div>
        )}
        {milestones.mostElevation && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-textTertiary">Most Climbing</span>
            <Link href={`/workout/${milestones.mostElevation.id}`} className="link-primary">
              {milestones.mostElevation.elevation} ft
            </Link>
          </div>
        )}
        {milestones.biggestWeek && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-textTertiary">Biggest Week</span>
            <span className="text-textSecondary">{milestones.biggestWeek.miles} mi</span>
          </div>
        )}
        {milestones.biggestMonth && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-textTertiary">Biggest Month</span>
            <span className="text-textSecondary">{milestones.biggestMonth.miles} mi ({milestones.biggestMonth.month})</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Day of Week Distribution
 */
export function DayOfWeekChart() {
  const [data, setData] = useState<{
    days: { day: string; count: number; miles: number; avgPace: number | null }[];
    mostActiveDay: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDayOfWeekDistribution().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading || !data || data.days.every(d => d.count === 0)) {
    return null;
  }

  const maxCount = Math.max(...data.days.map(d => d.count));

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-teal-500" />
        Runs by Day
      </h2>

      {/* h-24 = 96px */}
      <div className="flex items-end justify-between h-24 gap-1">
        {data.days.map((day) => {
          const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
          // Convert percentage to pixels (96px container minus ~36px for labels = ~60px for bar area)
          const heightPx = (Math.max(height, 4) / 100) * 60;
          const isActive = day.day === data.mostActiveDay;

          return (
            <div key={day.day} className="flex-1 flex flex-col items-center justify-end">
              <div
                className={`w-full rounded-t transition-all ${isActive ? 'bg-teal-500' : 'bg-stone-300'}`}
                style={{ height: `${heightPx}px` }}
                title={`${day.day}: ${day.count} runs, ${day.miles} mi`}
              />
              <span className="text-xs text-textTertiary mt-1">{day.day.slice(0, 3)}</span>
              <span className="text-xs text-tertiary">{day.count}</span>
            </div>
          );
        })}
      </div>

      {data.mostActiveDay && (
        <p className="text-xs text-textTertiary mt-4 pt-4 border-t border-borderSecondary">
          You run most often on <span className="font-medium text-teal-600">{data.mostActiveDay}s</span>
        </p>
      )}
    </div>
  );
}

/**
 * Weather Performance Card
 */
export function WeatherPerformanceCard() {
  const [data, setData] = useState<WeatherCorrelation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeatherCorrelation().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return null;
  }

  const hasData = data?.tempRanges.some(r => r.count > 0);
  if (!data || !hasData) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Thermometer className="w-5 h-5 text-red-500" />
        Weather & Performance
      </h2>

      <div className="space-y-2">
        {data.tempRanges.filter(r => r.count > 0).map((range) => (
          <div key={range.range} className="flex items-center gap-2 text-sm">
            <span className="w-28 text-textSecondary truncate">{range.range}</span>
            <div className="flex-1 h-2 bg-stone-100 rounded-full">
              <div
                className={`h-2 rounded-full ${range.range === data.optimalTemp ? 'bg-green-50 dark:bg-green-9500' : 'bg-stone-400'}`}
                style={{ width: `${(range.count / Math.max(...data.tempRanges.map(r => r.count))) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono text-textTertiary">
              {range.avgPace ? formatPace(range.avgPace) : '-'}
            </span>
            <span className="w-8 text-right text-tertiary">{range.count}</span>
          </div>
        ))}
      </div>

      {data.optimalTemp && (
        <p className="text-xs text-textTertiary mt-4 pt-4 border-t border-borderSecondary">
          You run fastest in <span className="font-medium text-green-600">{data.optimalTemp}</span> conditions
        </p>
      )}
    </div>
  );
}

/**
 * Fun Facts Card
 */
export function FunFactsCard() {
  const [facts, setFacts] = useState<{ icon: string; label: string; value: string; detail?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFunFacts().then(result => {
      setFacts(result.facts);
      setLoading(false);
    });
  }, []);

  if (loading || facts.length === 0) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Award className="w-5 h-5 text-purple-500" />
        Running Achievements
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {facts.slice(0, 6).map((fact, i) => (
          <div key={i} className="bg-bgTertiary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{fact.icon}</span>
              <span className="text-xs text-textTertiary">{fact.label}</span>
            </div>
            <p className="text-lg font-bold text-primary">{fact.value}</p>
            {fact.detail && (
              <p className="text-xs text-tertiary mt-1">{fact.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
