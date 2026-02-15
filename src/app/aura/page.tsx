'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/lib/profile-context';
import { getSettings } from '@/actions/settings';
import { getAnalyticsData, getRunningStreak, getVolumeSummaryData } from '@/actions/analytics';
import { getWorkouts } from '@/actions/workouts';
import type { UserSettings, Workout } from '@/lib/schema';
import { User, Share2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// ─── Vibe generators based on REAL data ──────────────────────────────────────

const PERSONA_TITLES: Record<string, string> = {
  newer_runner: 'Fresh Start',
  busy_runner: 'Time Warrior',
  self_coached: 'Lone Wolf',
  coach_guided: 'Student of the Sport',
  type_a_planner: 'The Architect',
  data_optimizer: 'The Analyst',
  other: 'Free Spirit',
};

function getMileageTitle(weeklyMiles: number): string {
  if (weeklyMiles >= 70) return 'Ultra Volume';
  if (weeklyMiles >= 50) return 'High Mileage';
  if (weeklyMiles >= 35) return 'Steady Builder';
  if (weeklyMiles >= 20) return 'Consistent Cruiser';
  if (weeklyMiles >= 10) return 'Building Up';
  return 'Getting Started';
}

function getStreakVibe(streak: number): string | null {
  if (streak >= 14) return `${streak}-day streak. Relentless.`;
  if (streak >= 7) return `${streak} days straight. Locked in.`;
  if (streak >= 3) return `${streak}-day streak. Momentum building.`;
  return null;
}

function getFavoriteWorkoutType(workouts: Workout[]): string | null {
  if (workouts.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    const t = w.workoutType || 'easy';
    counts[t] = (counts[t] || 0) + 1;
  }
  // Exclude 'easy' to find what they gravitate toward beyond easy runs
  const nonEasy = Object.entries(counts).filter(([k]) => k !== 'easy' && k !== 'recovery');
  if (nonEasy.length === 0) return null;
  nonEasy.sort((a, b) => b[1] - a[1]);
  const TYPE_LABELS: Record<string, string> = {
    tempo: 'Tempo Lover', threshold: 'Threshold Chaser', interval: 'Speed Demon',
    long: 'Long Run Loyalist', steady: 'Steady State', marathon: 'Marathon Grinder',
    repetition: 'Rep Specialist', race: 'Race Day Ready', cross_train: 'Cross-Trainer',
  };
  return TYPE_LABELS[nonEasy[0][0]] || null;
}

function getConsistencyGrade(runsPerWeek: number, weeksWithData: number): string {
  if (weeksWithData < 2) return 'Just Getting Started';
  if (runsPerWeek >= 6) return 'Every. Single. Day.';
  if (runsPerWeek >= 5) return 'Incredibly Consistent';
  if (runsPerWeek >= 4) return 'Locked In';
  if (runsPerWeek >= 3) return 'Solid Routine';
  return 'Building the Habit';
}

function getLongestRunVibe(miles: number): string | null {
  if (miles >= 20) return `${Math.round(miles)} mi long run. Marathon-ready legs.`;
  if (miles >= 15) return `${Math.round(miles)} mi long run. Endurance is real.`;
  if (miles >= 10) return `${Math.round(miles)} mi long run. Strong foundation.`;
  return null;
}

function formatPace(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Determine if we need dark text based on background luminance
function needsDarkText(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// ─── Data types ──────────────────────────────────────────────────────────────

interface AuraData {
  settings: UserSettings;
  totalRuns: number;
  totalMiles: number;
  ytdMiles: number;
  avgPaceSeconds: number | null;
  longestRun: number;
  currentStreak: number;
  longestStreak: number;
  thisWeekMiles: number;
  recentWorkouts: Workout[];
  weeksOfData: number;
  avgRunsPerWeek: number;
  fastestPace: number | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuraPage() {
  const { activeProfile } = useProfile();
  const [data, setData] = useState<AuraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProfile?.id) return;
    const profileId = activeProfile.id;

    Promise.all([
      getSettings(profileId),
      getAnalyticsData(profileId),
      getRunningStreak(profileId),
      getVolumeSummaryData(profileId),
      getWorkouts(200, profileId),
    ]).then(([settings, analytics, streak, volume, allWorkouts]) => {
      if (!settings) return;

      const workouts = allWorkouts || [];
      const totalMiles = workouts.reduce((sum: number, w: Workout) => sum + (w.distanceMiles || 0), 0);
      const longestRun = workouts.length > 0 ? Math.max(...workouts.map((w: Workout) => w.distanceMiles || 0)) : 0;
      const paces = workouts.filter((w: Workout) => w.avgPaceSeconds).map((w: Workout) => w.avgPaceSeconds!);
      const fastestPace = paces.length > 0 ? Math.min(...paces) : null;

      // Weeks of data
      const dates = workouts.map((w: Workout) => w.date).sort();
      let weeksOfData = 0;
      if (dates.length >= 2) {
        const first = new Date(dates[0]);
        const last = new Date(dates[dates.length - 1]);
        weeksOfData = Math.max(1, Math.round((last.getTime() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      }

      setData({
        settings,
        totalRuns: workouts.length,
        totalMiles: Math.round(totalMiles),
        ytdMiles: volume.ytdMiles,
        avgPaceSeconds: analytics.avgPaceSeconds,
        longestRun,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        thisWeekMiles: volume.thisWeekMiles,
        recentWorkouts: workouts.slice(0, 90),
        weeksOfData,
        avgRunsPerWeek: weeksOfData > 0 ? workouts.length / weeksOfData : 0,
        fastestPace,
      });
      setLoading(false);
    });
  }, [activeProfile?.id]);

  if (loading || !activeProfile || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-surface-2" />
          <div className="h-4 w-32 bg-surface-2 rounded" />
          <div className="h-3 w-48 bg-surface-2 rounded" />
        </div>
      </div>
    );
  }

  const { settings } = data;
  const startColor = activeProfile.auraColorStart || '#3b82f6';
  const endColor = activeProfile.auraColorEnd || '#8b5cf6';
  const dark = needsDarkText(startColor) || needsDarkText(endColor);
  const textMain = dark ? 'text-gray-900' : 'text-white';
  const textSub = dark ? 'text-gray-700' : 'text-white/70';
  const textMuted = dark ? 'text-gray-500' : 'text-white/50';
  const textFaint = dark ? 'text-gray-400' : 'text-white/40';
  const glassBg = dark ? 'bg-black/8' : 'bg-white/10';
  const glassBorder = dark ? 'border-black/10' : 'border-white/10';
  const divider = dark ? 'border-black/10' : 'border-white/10';

  const persona = PERSONA_TITLES[settings.runnerPersona || ''] || 'Runner';
  const favoriteType = getFavoriteWorkoutType(data.recentWorkouts);
  const streakVibe = getStreakVibe(data.currentStreak);
  const longestRunVibe = getLongestRunVibe(data.longestRun);
  const consistencyGrade = getConsistencyGrade(data.avgRunsPerWeek, data.weeksOfData);

  // Build dynamic tagline from actual data
  const taglineParts: string[] = [];
  if (data.totalMiles > 0) taglineParts.push(`${data.totalMiles.toLocaleString()} lifetime miles`);
  if (data.totalRuns > 0) taglineParts.push(`${data.totalRuns} runs logged`);
  const tagline = taglineParts.join(' / ') || 'Your running journey';

  const handleShare = async () => {
    try {
      await navigator.share?.({
        title: `${settings.name}'s Runner Aura`,
        text: `${persona} / ${tagline}`,
        url: window.location.href,
      });
    } catch { /* cancelled */ }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/profile" className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Profile
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary hover:text-primary rounded-lg hover:bg-surface-2 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Main aura card */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: `linear-gradient(145deg, ${startColor}, ${endColor})` }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: endColor, transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: startColor, transform: 'translate(-20%, 20%)' }} />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: '#fff', transform: 'translate(-50%, -50%)' }} />

        <div className="relative px-7 pt-10 pb-8">
          {/* Avatar */}
          <div className="flex justify-center mb-5">
            <div className={`w-20 h-20 rounded-full ${glassBg} backdrop-blur-sm flex items-center justify-center ring-2 ${glassBorder}`}>
              <User className={`w-10 h-10 ${textMain}`} />
            </div>
          </div>

          {/* Name + persona */}
          <div className="text-center mb-2">
            <h1 className={`text-3xl font-display font-bold ${textMain} tracking-tight`}>{settings.name}</h1>
          </div>
          <div className="text-center mb-6">
            <p className={`text-sm font-medium ${textSub}`}>{persona}</p>
            <p className={`text-xs ${textMuted} mt-0.5`}>{tagline}</p>
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {data.ytdMiles > 0 && (
              <div className={`${glassBg} backdrop-blur-sm rounded-xl px-3 py-3 border ${glassBorder} text-center`}>
                <p className={`text-xl font-bold ${textMain}`}>{Math.round(data.ytdMiles)}</p>
                <p className={`text-[10px] ${textMuted} uppercase tracking-wider`}>YTD miles</p>
              </div>
            )}
            <div className={`${glassBg} backdrop-blur-sm rounded-xl px-3 py-3 border ${glassBorder} text-center`}>
              <p className={`text-xl font-bold ${textMain}`}>{data.totalRuns}</p>
              <p className={`text-[10px] ${textMuted} uppercase tracking-wider`}>Total runs</p>
            </div>
            {settings.vdot && settings.vdot >= 15 && settings.vdot <= 85 && (
              <div className={`${glassBg} backdrop-blur-sm rounded-xl px-3 py-3 border ${glassBorder} text-center`}>
                <p className={`text-xl font-bold ${textMain}`}>{Math.round(settings.vdot * 10) / 10}</p>
                <p className={`text-[10px] ${textMuted} uppercase tracking-wider`}>VDOT</p>
              </div>
            )}
          </div>

          {/* Pace spectrum */}
          {settings.easyPaceSeconds && settings.tempoPaceSeconds && (
            <div className={`${glassBg} backdrop-blur-sm rounded-xl px-4 py-3 border ${glassBorder} mb-5`}>
              <p className={`text-[10px] ${textMuted} uppercase tracking-wider mb-2 text-center`}>Pace Range</p>
              <div className="flex justify-between items-end">
                <div className="text-center">
                  <p className={`text-lg font-bold ${textMain}`}>{formatPace(settings.easyPaceSeconds)}</p>
                  <p className={`text-[9px] ${textFaint}`}>easy</p>
                </div>
                {settings.marathonPaceSeconds && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${textMain}`}>{formatPace(settings.marathonPaceSeconds)}</p>
                    <p className={`text-[9px] ${textFaint}`}>marathon</p>
                  </div>
                )}
                <div className="text-center">
                  <p className={`text-lg font-bold ${textMain}`}>{formatPace(settings.tempoPaceSeconds)}</p>
                  <p className={`text-[9px] ${textFaint}`}>tempo</p>
                </div>
                {data.fastestPace && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${textMain}`}>{formatPace(data.fastestPace)}</p>
                    <p className={`text-[9px] ${textFaint}`}>fastest</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Identity descriptors - the unique part */}
          <div className="space-y-2 mb-5">
            {/* Consistency */}
            <div className={`flex items-center gap-3 ${glassBg} backdrop-blur-sm rounded-lg px-4 py-2.5 border ${glassBorder}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-gray-600' : 'bg-white/60'}`} />
              <p className={`text-sm ${textSub}`}>{consistencyGrade}</p>
            </div>

            {/* Streak */}
            {streakVibe && (
              <div className={`flex items-center gap-3 ${glassBg} backdrop-blur-sm rounded-lg px-4 py-2.5 border ${glassBorder}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-gray-600' : 'bg-white/60'}`} />
                <p className={`text-sm ${textSub}`}>{streakVibe}</p>
              </div>
            )}

            {/* Favorite workout */}
            {favoriteType && (
              <div className={`flex items-center gap-3 ${glassBg} backdrop-blur-sm rounded-lg px-4 py-2.5 border ${glassBorder}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-gray-600' : 'bg-white/60'}`} />
                <p className={`text-sm ${textSub}`}>{favoriteType}</p>
              </div>
            )}

            {/* Longest run */}
            {longestRunVibe && (
              <div className={`flex items-center gap-3 ${glassBg} backdrop-blur-sm rounded-lg px-4 py-2.5 border ${glassBorder}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-gray-600' : 'bg-white/60'}`} />
                <p className={`text-sm ${textSub}`}>{longestRunVibe}</p>
              </div>
            )}

            {/* Weekly mileage tier */}
            {data.thisWeekMiles > 0 && (
              <div className={`flex items-center gap-3 ${glassBg} backdrop-blur-sm rounded-lg px-4 py-2.5 border ${glassBorder}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-gray-600' : 'bg-white/60'}`} />
                <p className={`text-sm ${textSub}`}>{getMileageTitle(data.thisWeekMiles)} - {Math.round(data.thisWeekMiles)} mi this week</p>
              </div>
            )}
          </div>

          {/* Vibe tags */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {settings.surfacePreference && settings.surfacePreference !== 'road' && (
              <span className={`px-2.5 py-1 rounded-full ${glassBg} text-[11px] font-medium ${textSub} border ${glassBorder}`}>
                {settings.surfacePreference === 'trail' ? 'Trail' : settings.surfacePreference === 'track' ? 'Track' : 'Mixed terrain'}
              </span>
            )}
            {settings.preferredRunTime && (
              <span className={`px-2.5 py-1 rounded-full ${glassBg} text-[11px] font-medium ${textSub} border ${glassBorder}`}>
                {settings.preferredRunTime === 'early_morning' ? 'Dawn runs' : settings.preferredRunTime === 'morning' ? 'Morning runs' : settings.preferredRunTime === 'evening' ? 'Evening runs' : settings.preferredRunTime === 'midday' ? 'Midday runs' : 'Flexible schedule'}
              </span>
            )}
            {settings.yearsRunning != null && settings.yearsRunning > 0 && (
              <span className={`px-2.5 py-1 rounded-full ${glassBg} text-[11px] font-medium ${textSub} border ${glassBorder}`}>
                {settings.yearsRunning >= 10 ? 'Veteran' : settings.yearsRunning >= 5 ? 'Seasoned' : settings.yearsRunning >= 2 ? 'Experienced' : 'Rising'}
              </span>
            )}
            {data.longestStreak >= 7 && (
              <span className={`px-2.5 py-1 rounded-full ${glassBg} text-[11px] font-medium ${textSub} border ${glassBorder}`}>
                Best streak: {data.longestStreak}d
              </span>
            )}
            {settings.openToDoubles && (
              <span className={`px-2.5 py-1 rounded-full ${glassBg} text-[11px] font-medium ${textSub} border ${glassBorder}`}>
                Doubles
              </span>
            )}
          </div>

          {/* Footer */}
          <div className={`text-center pt-4 border-t ${divider}`}>
            <p className={`text-[10px] ${textFaint} uppercase tracking-[0.2em]`}>dreamy</p>
          </div>
        </div>
      </div>

      {/* Color swatch */}
      <div className="flex justify-center gap-3 mt-5 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: startColor }} />
          <span className="text-xs text-tertiary font-mono">{startColor}</span>
        </div>
        <span className="text-tertiary text-xs">/</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: endColor }} />
          <span className="text-xs text-tertiary font-mono">{endColor}</span>
        </div>
      </div>
    </div>
  );
}
