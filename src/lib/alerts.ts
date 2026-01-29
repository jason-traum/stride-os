/**
 * Proactive Alerts System
 * Detects patterns that warrant coach attention or user notification
 */

import { db, workouts, plannedWorkouts, races } from './db';
import { gte, desc, and, lte } from 'drizzle-orm';

export type AlertType =
  | 'overtraining_warning'
  | 'recovery_needed'
  | 'high_rpe_streak'
  | 'low_sleep_pattern'
  | 'plan_adherence_issue'
  | 'milestone_achieved'
  | 'race_approaching'
  | 'mileage_spike'
  | 'consistency_decline'
  | 'great_performance';

export type AlertSeverity = 'info' | 'warning' | 'urgent' | 'celebration';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation?: string;
  data?: Record<string, unknown>;
}

/**
 * Detect all active alerts based on recent training data
 */
export async function detectAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Get recent workouts (last 14 days)
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const recentWorkouts = await db.query.workouts.findMany({
    where: gte(workouts.date, twoWeeksAgo.toISOString().split('T')[0]),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  // Get older workouts for comparison (14-28 days ago)
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);

  const olderWorkouts = await db.query.workouts.findMany({
    where: and(
      gte(workouts.date, fourWeeksAgo.toISOString().split('T')[0]),
      lte(workouts.date, twoWeeksAgo.toISOString().split('T')[0])
    ),
    with: {
      assessment: true,
    },
  });

  // Check for high RPE streak (3+ consecutive high RPE workouts)
  const rpeAlert = checkHighRpeStreak(recentWorkouts);
  if (rpeAlert) alerts.push(rpeAlert);

  // Check for low sleep pattern
  const sleepAlert = checkLowSleepPattern(recentWorkouts);
  if (sleepAlert) alerts.push(sleepAlert);

  // Check for mileage spike
  const mileageAlert = checkMileageSpike(recentWorkouts, olderWorkouts);
  if (mileageAlert) alerts.push(mileageAlert);

  // Check for overtraining signals
  const overtrainingAlert = checkOvertrainingSignals(recentWorkouts);
  if (overtrainingAlert) alerts.push(overtrainingAlert);

  // Check for plan adherence issues
  const adherenceAlert = await checkPlanAdherence(today);
  if (adherenceAlert) alerts.push(adherenceAlert);

  // Check for approaching races
  const raceAlerts = await checkApproachingRaces(today);
  alerts.push(...raceAlerts);

  // Check for positive achievements
  const achievementAlerts = checkAchievements(recentWorkouts, olderWorkouts);
  alerts.push(...achievementAlerts);

  return alerts;
}

type WorkoutWithAssessment = Awaited<ReturnType<typeof db.query.workouts.findMany>>[0] & {
  assessment: { rpe: number; sleepQuality?: number | null; sleepHours?: number | null; legsFeel?: number | null; stress?: number | null } | null;
};

function checkHighRpeStreak(workouts: WorkoutWithAssessment[]): Alert | null {
  const recentWithRpe = workouts
    .filter(w => w.assessment?.rpe)
    .slice(0, 5);

  const highRpeCount = recentWithRpe.filter(w => (w.assessment?.rpe ?? 0) >= 8).length;

  if (highRpeCount >= 3) {
    return {
      type: 'high_rpe_streak',
      severity: 'warning',
      title: 'High Effort Streak Detected',
      message: `${highRpeCount} of your last ${recentWithRpe.length} workouts had an RPE of 8+. This could lead to fatigue accumulation.`,
      recommendation: 'Consider adding an extra easy day or reducing intensity on your next workout.',
      data: { highRpeCount, totalWorkouts: recentWithRpe.length },
    };
  }

  return null;
}

function checkLowSleepPattern(workouts: WorkoutWithAssessment[]): Alert | null {
  const withSleep = workouts.filter(w => w.assessment?.sleepQuality !== null && w.assessment?.sleepQuality !== undefined);

  if (withSleep.length < 3) return null;

  const avgSleepQuality = withSleep.reduce((sum, w) => sum + (w.assessment?.sleepQuality ?? 0), 0) / withSleep.length;

  if (avgSleepQuality <= 4) {
    return {
      type: 'low_sleep_pattern',
      severity: 'warning',
      title: 'Poor Sleep Pattern',
      message: `Your average sleep quality over the last ${withSleep.length} workouts is ${avgSleepQuality.toFixed(1)}/10. Sleep is crucial for recovery.`,
      recommendation: 'Focus on sleep hygiene: consistent bedtime, reduced screen time, cool room temperature.',
      data: { avgSleepQuality, workoutsAnalyzed: withSleep.length },
    };
  }

  return null;
}

function checkMileageSpike(recent: WorkoutWithAssessment[], older: WorkoutWithAssessment[]): Alert | null {
  const recentMiles = recent.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const olderMiles = older.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  // Normalize to weekly (recent is 2 weeks, older is 2 weeks)
  const recentWeeklyAvg = recentMiles / 2;
  const olderWeeklyAvg = olderMiles / 2;

  if (olderWeeklyAvg > 0) {
    const increasePercent = ((recentWeeklyAvg - olderWeeklyAvg) / olderWeeklyAvg) * 100;

    if (increasePercent > 20) {
      return {
        type: 'mileage_spike',
        severity: 'warning',
        title: 'Significant Mileage Increase',
        message: `Your weekly mileage increased ${increasePercent.toFixed(0)}% compared to the previous two weeks (${recentWeeklyAvg.toFixed(1)} vs ${olderWeeklyAvg.toFixed(1)} miles/week).`,
        recommendation: 'The 10% rule suggests gradual increases. Consider a down week if you feel fatigued.',
        data: { increasePercent, recentWeeklyAvg, olderWeeklyAvg },
      };
    }
  }

  return null;
}

function checkOvertrainingSignals(workouts: WorkoutWithAssessment[]): Alert | null {
  const recent = workouts.slice(0, 7);

  if (recent.length < 3) return null;

  // Check for multiple overtraining signals
  const signals: string[] = [];

  // Heavy legs trend
  const withLegsFeel = recent.filter(w => w.assessment?.legsFeel !== null && w.assessment?.legsFeel !== undefined);
  if (withLegsFeel.length >= 3) {
    const avgLegsFeel = withLegsFeel.reduce((sum, w) => sum + (w.assessment?.legsFeel ?? 0), 0) / withLegsFeel.length;
    if (avgLegsFeel <= 4) signals.push('persistent leg fatigue');
  }

  // High stress trend
  const withStress = recent.filter(w => w.assessment?.stress !== null && w.assessment?.stress !== undefined);
  if (withStress.length >= 3) {
    const avgStress = withStress.reduce((sum, w) => sum + (w.assessment?.stress ?? 0), 0) / withStress.length;
    if (avgStress >= 7) signals.push('high stress levels');
  }

  // High RPE with declining performance
  const withRpe = recent.filter(w => w.assessment?.rpe);
  if (withRpe.length >= 3) {
    const avgRpe = withRpe.reduce((sum, w) => sum + (w.assessment?.rpe ?? 0), 0) / withRpe.length;
    if (avgRpe >= 7.5) signals.push('consistently high perceived effort');
  }

  if (signals.length >= 2) {
    return {
      type: 'overtraining_warning',
      severity: 'urgent',
      title: 'Overtraining Risk Detected',
      message: `Multiple warning signs detected: ${signals.join(', ')}. Your body may need extra recovery.`,
      recommendation: 'Consider taking 2-3 easy days or a complete rest day. Listen to your body.',
      data: { signals },
    };
  }

  return null;
}

async function checkPlanAdherence(today: string): Promise<Alert | null> {
  // Get planned workouts from the past week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentPlanned = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, oneWeekAgo.toISOString().split('T')[0]),
      lte(plannedWorkouts.date, today)
    ),
  });

  if (recentPlanned.length === 0) return null;

  const skipped = recentPlanned.filter(w => w.status === 'skipped');
  const missed = recentPlanned.filter(w =>
    w.status === 'scheduled' && w.date < today
  );

  const missedOrSkipped = skipped.length + missed.length;
  const adherenceRate = ((recentPlanned.length - missedOrSkipped) / recentPlanned.length) * 100;

  if (adherenceRate < 60) {
    return {
      type: 'plan_adherence_issue',
      severity: 'info',
      title: 'Plan Adherence Check-In',
      message: `You have completed ${adherenceRate.toFixed(0)}% of your planned workouts this week. ${missedOrSkipped} workouts were skipped or missed.`,
      recommendation: 'If the plan feels too aggressive, consider adjusting your weekly targets or talking to your coach about modifications.',
      data: { adherenceRate, missedOrSkipped, totalPlanned: recentPlanned.length },
    };
  }

  return null;
}

async function checkApproachingRaces(today: string): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const upcomingRaces = await db.query.races.findMany({
    where: gte(races.date, today),
    orderBy: [races.date],
  });

  for (const race of upcomingRaces) {
    const raceDate = new Date(race.date);
    const todayDate = new Date(today);
    const daysUntil = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil === 7) {
      alerts.push({
        type: 'race_approaching',
        severity: 'info',
        title: 'Race Week',
        message: `${race.name} is one week away! Time to start your taper.`,
        recommendation: 'Focus on rest, nutrition, and mental preparation. Reduce training volume but maintain some intensity.',
        data: { raceName: race.name, daysUntil, distance: race.distanceLabel },
      });
    } else if (daysUntil === 1) {
      alerts.push({
        type: 'race_approaching',
        severity: 'celebration',
        title: 'Race Tomorrow',
        message: `${race.name} is tomorrow! You are ready for this.`,
        recommendation: 'Trust your training. Get good sleep, hydrate well, and prepare your gear tonight.',
        data: { raceName: race.name, daysUntil, distance: race.distanceLabel },
      });
    }
  }

  return alerts;
}

function checkAchievements(recent: WorkoutWithAssessment[], older: WorkoutWithAssessment[]): Alert[] {
  const alerts: Alert[] = [];

  // Check for longest run PR
  const recentLongest = Math.max(...recent.map(w => w.distanceMiles || 0), 0);
  const olderLongest = Math.max(...older.map(w => w.distanceMiles || 0), 0);

  if (recentLongest > olderLongest && recentLongest >= 10) {
    alerts.push({
      type: 'milestone_achieved',
      severity: 'celebration',
      title: 'New Longest Run',
      message: `Congratulations! Your ${recentLongest.toFixed(1)} mile run is your longest in the past month!`,
      data: { distance: recentLongest },
    });
  }

  // Check for consistency streak
  const recentDays = new Set(recent.map(w => w.date));
  if (recentDays.size >= 10) {
    alerts.push({
      type: 'great_performance',
      severity: 'celebration',
      title: 'Great Consistency',
      message: `You have logged ${recentDays.size} runs in the last two weeks. Keep up the great work!`,
      data: { runCount: recentDays.size },
    });
  }

  return alerts;
}
