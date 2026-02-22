// Shared utility functions used across coach tool modules

import { db, userSettings, coachActions } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { calculatePaceZones } from '../training/vdot-calculator';
import type { UserSettings } from '../schema';

export type { UserSettings };

// Private helper: fetch userSettings filtered by the active profileId.
// Every coach-tool function that reads settings should call this instead of
// the unguarded `db.select().from(userSettings).limit(1)`.
export async function getSettingsForProfile(): Promise<UserSettings | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.profileId, profileId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Record a coach action in the audit log.
 * Called by mutating coach tools after they apply changes.
 */
export async function recordCoachAction(params: {
  actionType: string;
  description: string;
  dataSnapshot?: Record<string, unknown>;
}) {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return;
    const now = new Date().toISOString();
    await db.insert(coachActions).values({
      profileId,
      timestamp: now,
      actionType: params.actionType,
      description: params.description,
      dataSnapshot: params.dataSnapshot ? JSON.stringify(params.dataSnapshot) : null,
      approved: true,
      appliedAt: now,
      notes: null,
      createdAt: now,
    });
  } catch (e) {
    console.error('[recordCoachAction] Failed:', e);
  }
}

/**
 * Create a pending coach action that requires user approval before being applied.
 */
export async function createPendingCoachAction(params: {
  actionType: string;
  description: string;
  dataSnapshot?: Record<string, unknown>;
}): Promise<number | null> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return null;
    const now = new Date().toISOString();
    const [action] = await db.insert(coachActions).values({
      profileId,
      timestamp: now,
      actionType: params.actionType,
      description: params.description,
      dataSnapshot: params.dataSnapshot ? JSON.stringify(params.dataSnapshot) : null,
      approved: null,
      appliedAt: null,
      notes: null,
      createdAt: now,
    }).returning();
    return action?.id ?? null;
  } catch (e) {
    console.error('[createPendingCoachAction] Failed:', e);
    return null;
  }
}

export function formatPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTimeToSeconds(time: string): number | null {
  const parts = time.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function formatTimeFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSecondsToTime(seconds: number): string {
  return formatTimeFromSeconds(seconds);
}

export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function groupByWorkoutType(workouts: Array<{ workoutType: string; status: string | null }>) {
  const byType: Record<string, { total: number; completed: number }> = {};
  for (const w of workouts) {
    if (!byType[w.workoutType]) {
      byType[w.workoutType] = { total: 0, completed: 0 };
    }
    byType[w.workoutType].total++;
    if (w.status === 'completed') {
      byType[w.workoutType].completed++;
    }
  }
  return Object.entries(byType).map(([type, stats]) => ({
    type,
    total: stats.total,
    completed: stats.completed,
    rate: Math.round((stats.completed / stats.total) * 100),
  }));
}

export function buildProfileUpdates(input: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.age !== undefined) updates.age = input.age;
  if (input.years_running !== undefined) updates.yearsRunning = input.years_running;
  if (input.athletic_background !== undefined) updates.athleticBackground = input.athletic_background;
  if (input.resting_hr !== undefined) updates.restingHr = input.resting_hr;
  if (input.current_weekly_mileage !== undefined) updates.currentWeeklyMileage = input.current_weekly_mileage;
  if (input.runs_per_week !== undefined) {
    updates.runsPerWeekCurrent = input.runs_per_week;
    updates.runsPerWeekTarget = input.runs_per_week;
  }
  if (input.current_long_run_max !== undefined) updates.currentLongRunMax = input.current_long_run_max;
  if (input.peak_weekly_mileage_target !== undefined) updates.peakWeeklyMileageTarget = input.peak_weekly_mileage_target;
  if (input.quality_sessions_per_week !== undefined) updates.qualitySessionsPerWeek = input.quality_sessions_per_week;
  if (input.preferred_long_run_day !== undefined) updates.preferredLongRunDay = input.preferred_long_run_day;
  if (input.preferred_quality_days !== undefined) updates.preferredQualityDays = JSON.stringify(input.preferred_quality_days);
  if (input.plan_aggressiveness !== undefined) updates.planAggressiveness = input.plan_aggressiveness;
  if (input.training_philosophy !== undefined) updates.trainingPhilosophy = input.training_philosophy;
  if (input.down_week_frequency !== undefined) updates.downWeekFrequency = input.down_week_frequency;
  if (input.long_run_style !== undefined) updates.longRunMaxStyle = input.long_run_style;
  if (input.fatigue_management_style !== undefined) updates.fatigueManagementStyle = input.fatigue_management_style;
  if (input.workout_variety_pref !== undefined) updates.workoutVarietyPref = input.workout_variety_pref;
  if (input.training_philosophies !== undefined) updates.trainingPhilosophies = JSON.stringify(input.training_philosophies);
  if (input.workout_complexity !== undefined) updates.workoutComplexity = input.workout_complexity;
  if (input.coaching_detail_level !== undefined) updates.coachingDetailLevel = input.coaching_detail_level;
  if (input.speedwork_experience !== undefined) updates.speedworkExperience = input.speedwork_experience;
  if (input.mlr_preference !== undefined) updates.mlrPreference = input.mlr_preference;
  if (input.progressive_long_runs_ok !== undefined) updates.progressiveLongRunsOk = input.progressive_long_runs_ok;
  if (input.comfort_vo2max !== undefined) updates.comfortVO2max = input.comfort_vo2max;
  if (input.comfort_tempo !== undefined) updates.comfortTempo = input.comfort_tempo;
  if (input.comfort_hills !== undefined) updates.comfortHills = input.comfort_hills;
  if (input.comfort_long_runs !== undefined) updates.comfortLongRuns = input.comfort_long_runs;
  if (input.comfort_track_work !== undefined) updates.comfortTrackWork = input.comfort_track_work;
  if (input.open_to_doubles !== undefined) updates.openToDoubles = input.open_to_doubles;
  if (input.train_by !== undefined) updates.trainBy = input.train_by;
  if (input.typical_sleep_hours !== undefined) updates.typicalSleepHours = input.typical_sleep_hours;
  if (input.sleep_quality !== undefined) updates.sleepQuality = input.sleep_quality;
  if (input.stress_level !== undefined) updates.stressLevel = input.stress_level;
  if (input.needs_extra_rest !== undefined) updates.needsExtraRest = input.needs_extra_rest;
  if (input.common_injuries !== undefined) updates.commonInjuries = JSON.stringify(input.common_injuries);
  if (input.current_injuries !== undefined) updates.currentInjuries = input.current_injuries;
  if (input.injury_history !== undefined) updates.injuryHistory = input.injury_history;
  if (input.preferred_run_time !== undefined) updates.preferredRunTime = input.preferred_run_time;
  if (input.surface_preference !== undefined) updates.surfacePreference = input.surface_preference;
  if (input.group_vs_solo !== undefined) updates.groupVsSolo = input.group_vs_solo;
  if (input.heat_sensitivity !== undefined) updates.heatSensitivity = input.heat_sensitivity;
  if (input.cold_sensitivity !== undefined) updates.coldSensitivity = input.cold_sensitivity;
  if (input.marathon_pr !== undefined) updates.marathonPR = input.marathon_pr;
  if (input.half_marathon_pr !== undefined) updates.halfMarathonPR = input.half_marathon_pr;
  if (input.ten_k_pr !== undefined) updates.tenKPR = input.ten_k_pr;
  if (input.five_k_pr !== undefined) updates.fiveKPR = input.five_k_pr;
  if (input.coach_context !== undefined) updates.coachContext = input.coach_context;
  return updates;
}

export async function updateUserVDOTFromResult(newVdot: number, effortLevel: string) {
  const s = await getSettingsForProfile();
  if (!s) return;
  const shouldUpdate =
    (effortLevel === 'all_out' || effortLevel === 'hard') &&
    (!s.vdot || newVdot > s.vdot);
  if (!shouldUpdate) return;
  const zones = calculatePaceZones(newVdot);
  await db.update(userSettings)
    .set({
      vdot: newVdot,
      easyPaceSeconds: zones.easy,
      tempoPaceSeconds: zones.tempo,
      thresholdPaceSeconds: zones.threshold,
      intervalPaceSeconds: zones.interval,
      marathonPaceSeconds: zones.marathon,
      halfMarathonPaceSeconds: zones.halfMarathon,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));
}
