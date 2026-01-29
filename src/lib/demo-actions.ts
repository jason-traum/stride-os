/**
 * Demo Mode Actions - Client-side versions that save to localStorage
 * These mirror the server actions but work entirely in the browser
 */

import {
  saveDemoSettings,
  getDemoSettings,
  type DemoSettings,
  addDemoWorkout,
  getDemoWorkouts,
} from './demo-mode';
import { calculateVDOT, calculatePaceZones } from './training/vdot-calculator';
import { RACE_DISTANCES } from './training/types';

const DEMO_RACES_KEY = 'dreamy_demo_races';
const DEMO_PLANNED_WORKOUTS_KEY = 'dreamy_demo_planned_workouts';

export interface DemoRace {
  id: number;
  name: string;
  date: string;
  distanceMeters: number;
  distanceLabel: string;
  priority: 'A' | 'B' | 'C';
  targetTimeSeconds: number | null;
  trainingPlanGenerated: boolean;
}

export interface DemoPlannedWorkout {
  id: number;
  date: string;
  name: string;
  workoutType: string;
  targetDistanceMiles: number;
  description: string;
  isKeyWorkout: boolean;
  status: 'scheduled' | 'completed' | 'skipped';
}

// Get demo races from localStorage
export function getDemoRaces(): DemoRace[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_RACES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save demo race
export function addDemoRace(race: Omit<DemoRace, 'id'>): DemoRace {
  const races = getDemoRaces();
  const newRace = { ...race, id: Date.now() };
  races.push(newRace);
  localStorage.setItem(DEMO_RACES_KEY, JSON.stringify(races));
  return newRace;
}

// Get demo planned workouts
export function getDemoPlannedWorkouts(): DemoPlannedWorkout[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_PLANNED_WORKOUTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save demo planned workouts
export function saveDemoPlannedWorkouts(workouts: DemoPlannedWorkout[]): void {
  localStorage.setItem(DEMO_PLANNED_WORKOUTS_KEY, JSON.stringify(workouts));
}

// Check onboarding status for demo mode
export function checkDemoOnboardingStatus() {
  const settings = getDemoSettings();

  if (!settings) {
    return { needsOnboarding: true, step: 0, onboardingCompleted: false };
  }

  const hasEssentials = settings.name && settings.currentWeeklyMileage;

  return {
    needsOnboarding: !hasEssentials,
    step: settings.onboardingStep ?? 0,
    onboardingCompleted: settings.onboardingCompleted ?? false,
  };
}

// Save onboarding data for demo mode
export interface DemoOnboardingData {
  name: string;
  runnerPersona?: string;
  currentWeeklyMileage: number;
  runsPerWeekCurrent: number;
  currentLongRunMax: number;
  peakWeeklyMileageTarget: number;
  preferredLongRunDay: string;
  requiredRestDays: string[];
  planAggressiveness: 'conservative' | 'moderate' | 'aggressive';
  qualitySessionsPerWeek: number;
  recentRace?: {
    distanceLabel: string;
    finishTimeSeconds: number;
    date: string;
  };
  goalRace: {
    name: string;
    date: string;
    distanceLabel: string;
    priority: 'A' | 'B' | 'C';
    targetTimeSeconds?: number;
  };
  // Extended fields
  yearsRunning?: number;
  comfortVO2max?: number;
  comfortTempo?: number;
  comfortHills?: number;
  comfortLongRuns?: number;
  trainBy?: string;
  typicalSleepHours?: number;
  stressLevel?: string;
}

export function saveDemoOnboardingData(data: DemoOnboardingData): { success: boolean; vdot: number | null } {
  // Calculate VDOT from recent race if provided
  let vdot: number | null = null;
  let paceZones: ReturnType<typeof calculatePaceZones> | null = null;

  if (data.recentRace) {
    const distanceInfo = RACE_DISTANCES[data.recentRace.distanceLabel];
    if (distanceInfo) {
      vdot = calculateVDOT(distanceInfo.meters, data.recentRace.finishTimeSeconds);
      paceZones = calculatePaceZones(vdot);
    }
  }

  // Build settings
  const settings: DemoSettings = {
    id: 1,
    name: data.name,
    runnerPersona: data.runnerPersona,
    onboardingCompleted: true,
    onboardingStep: 10,
    currentWeeklyMileage: data.currentWeeklyMileage,
    runsPerWeekCurrent: data.runsPerWeekCurrent,
    currentLongRunMax: data.currentLongRunMax,
    peakWeeklyMileageTarget: data.peakWeeklyMileageTarget,
    preferredLongRunDay: data.preferredLongRunDay,
    planAggressiveness: data.planAggressiveness,
    qualitySessionsPerWeek: data.qualitySessionsPerWeek,
    // VDOT and paces
    ...(vdot && {
      vdot,
      easyPaceSeconds: paceZones?.easy,
      tempoPaceSeconds: paceZones?.tempo,
      thresholdPaceSeconds: paceZones?.threshold,
      intervalPaceSeconds: paceZones?.interval,
      marathonPaceSeconds: paceZones?.marathon,
      halfMarathonPaceSeconds: paceZones?.halfMarathon,
    }),
    // Extended fields
    yearsRunning: data.yearsRunning,
    comfortVO2max: data.comfortVO2max,
    comfortTempo: data.comfortTempo,
    comfortHills: data.comfortHills,
    comfortLongRuns: data.comfortLongRuns,
    trainBy: data.trainBy,
    typicalSleepHours: data.typicalSleepHours,
    stressLevel: data.stressLevel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDemoSettings(settings);

  // Save goal race
  const goalDistanceInfo = RACE_DISTANCES[data.goalRace.distanceLabel];
  if (goalDistanceInfo) {
    addDemoRace({
      name: data.goalRace.name,
      date: data.goalRace.date,
      distanceMeters: goalDistanceInfo.meters,
      distanceLabel: data.goalRace.distanceLabel,
      priority: data.goalRace.priority,
      targetTimeSeconds: data.goalRace.targetTimeSeconds ?? null,
      trainingPlanGenerated: false,
    });
  }

  return { success: true, vdot };
}

// Generate a simple demo training plan
export function generateDemoTrainingPlan(raceId: number): { success: boolean; weeksGenerated: number } {
  const races = getDemoRaces();
  const race = races.find(r => r.id === raceId);

  if (!race) {
    return { success: false, weeksGenerated: 0 };
  }

  const settings = getDemoSettings();
  const today = new Date();
  const raceDate = new Date(race.date);
  const weeksUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7));

  // Generate simplified plan
  const plannedWorkouts: DemoPlannedWorkout[] = [];
  let workoutId = 1;

  for (let week = 0; week < Math.min(weeksUntilRace, 16); week++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() + (week * 7));

    // Determine phase
    let phase = 'base';
    const weeksOut = weeksUntilRace - week;
    if (weeksOut <= 2) phase = 'taper';
    else if (weeksOut <= 5) phase = 'peak';
    else if (weeksOut <= 10) phase = 'build';

    // Add workouts for the week
    const workoutTypes = phase === 'taper'
      ? [
          { day: 1, type: 'easy', name: 'Easy Run', distance: 4, key: false },
          { day: 3, type: 'easy', name: 'Easy Run + Strides', distance: 3, key: false },
          { day: 5, type: 'easy', name: 'Shakeout Run', distance: 2, key: false },
        ]
      : [
          { day: 0, type: 'easy', name: 'Recovery Run', distance: 4, key: false },
          { day: 1, type: 'tempo', name: 'Tempo Run', distance: 6, key: true },
          { day: 3, type: 'interval', name: 'Interval Session', distance: 5, key: true },
          { day: 4, type: 'easy', name: 'Easy Run', distance: 5, key: false },
          { day: 5, type: 'long', name: 'Long Run', distance: 10 + Math.min(week, 8), key: true },
        ];

    for (const wt of workoutTypes) {
      const workoutDate = new Date(weekStart);
      workoutDate.setDate(workoutDate.getDate() + wt.day);

      plannedWorkouts.push({
        id: workoutId++,
        date: workoutDate.toISOString().split('T')[0],
        name: wt.name,
        workoutType: wt.type,
        targetDistanceMiles: wt.distance,
        description: `${phase.charAt(0).toUpperCase() + phase.slice(1)} phase ${wt.name.toLowerCase()}`,
        isKeyWorkout: wt.key,
        status: 'scheduled',
      });
    }
  }

  saveDemoPlannedWorkouts(plannedWorkouts);

  // Mark race as having a plan
  const updatedRaces = races.map(r =>
    r.id === raceId ? { ...r, trainingPlanGenerated: true } : r
  );
  localStorage.setItem(DEMO_RACES_KEY, JSON.stringify(updatedRaces));

  return { success: true, weeksGenerated: Math.min(weeksUntilRace, 16) };
}

// Get today's planned workout for demo
export function getDemoTodaysWorkout(): DemoPlannedWorkout | null {
  const today = new Date().toISOString().split('T')[0];
  const workouts = getDemoPlannedWorkouts();
  return workouts.find(w => w.date === today) ?? null;
}

// Get demo user profile
export function getDemoUserProfile() {
  const settings = getDemoSettings();
  if (!settings) return null;

  return {
    settings,
    profileCompleteness: {
      completed: settings.onboardingCompleted ? 10 : 0,
      total: 10,
      percentage: settings.onboardingCompleted ? 100 : 0,
    },
  };
}
