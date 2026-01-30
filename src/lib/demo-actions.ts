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
  targetDurationMinutes?: number;
  targetPaceSecondsPerMile?: number;
  description: string;
  rationale?: string;
  isKeyWorkout: boolean;
  status: 'scheduled' | 'completed' | 'skipped';
  phase?: string;
  weekNumber?: number;
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

// Generate a demo training plan with realistic details
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

  // Get paces from settings or use defaults
  const easyPace = settings?.easyPaceSeconds || 540; // 9:00/mi
  const tempoPace = settings?.tempoPaceSeconds || 450; // 7:30/mi
  const intervalPace = settings?.intervalPaceSeconds || 390; // 6:30/mi
  const longPace = easyPace + 15; // Slightly slower than easy

  // Generate plan
  const plannedWorkouts: DemoPlannedWorkout[] = [];
  let workoutId = 1;

  const workoutRationales: Record<string, string> = {
    easy: 'Recovery and aerobic maintenance between harder efforts',
    tempo: 'Build lactate threshold and race-specific fitness',
    interval: 'Develop VO2max and running economy',
    long: 'Build endurance and teach the body to burn fat efficiently',
  };

  for (let week = 0; week < Math.min(weeksUntilRace, 16); week++) {
    const weekStart = new Date(today);
    // Adjust to Monday
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    weekStart.setDate(weekStart.getDate() + daysToMonday + (week * 7));

    // Determine phase
    let phase = 'base';
    const weeksOut = weeksUntilRace - week;
    if (weeksOut <= 2) phase = 'taper';
    else if (weeksOut <= 5) phase = 'peak';
    else if (weeksOut <= 10) phase = 'build';

    // Calculate weekly mileage progression
    const baseMileage = settings?.currentWeeklyMileage || 30;
    const peakMileage = settings?.peakWeeklyMileageTarget || 50;
    let weeklyMileage = baseMileage;

    if (phase === 'base') {
      weeklyMileage = baseMileage + (week * 2);
    } else if (phase === 'build') {
      weeklyMileage = Math.min(peakMileage * 0.9, baseMileage + 15 + (week * 1.5));
    } else if (phase === 'peak') {
      weeklyMileage = peakMileage;
    } else {
      weeklyMileage = peakMileage * (weeksOut === 2 ? 0.7 : 0.5);
    }

    // Long run distance
    const longRunDistance = Math.min(
      phase === 'taper' ? 10 : 12 + Math.min(week, 8),
      race.distanceMeters >= 40000 ? 22 : 16 // Cap based on race distance
    );

    // Add workouts for the week
    const workoutTypes = phase === 'taper'
      ? [
          { day: 1, type: 'easy', name: 'Easy Run', distance: 4, pace: easyPace, key: false },
          { day: 3, type: 'easy', name: 'Easy Run + Strides', distance: 3, pace: easyPace, key: false },
          { day: 5, type: 'easy', name: 'Shakeout Run', distance: 2, pace: easyPace, key: false },
        ]
      : [
          { day: 0, type: 'easy', name: 'Recovery Run', distance: 4, pace: easyPace + 30, key: false },
          { day: 1, type: 'tempo', name: phase === 'peak' ? 'Marathon Pace Run' : 'Steady Tempo', distance: 6, pace: tempoPace, key: true },
          { day: 3, type: 'interval', name: phase === 'build' ? 'Yasso 800s' : 'Fartlek', distance: 5, pace: intervalPace, key: true },
          { day: 4, type: 'easy', name: 'Easy Run', distance: 5, pace: easyPace, key: false },
          { day: 6, type: 'long', name: phase === 'peak' ? 'Progression Long Run' : 'Easy Long Run', distance: longRunDistance, pace: longPace, key: true },
        ];

    for (const wt of workoutTypes) {
      const workoutDate = new Date(weekStart);
      workoutDate.setDate(workoutDate.getDate() + wt.day);

      // Skip if past race date
      if (workoutDate > raceDate) continue;

      plannedWorkouts.push({
        id: workoutId++,
        date: workoutDate.toISOString().split('T')[0],
        name: wt.name,
        workoutType: wt.type,
        targetDistanceMiles: wt.distance,
        targetDurationMinutes: Math.round((wt.distance * wt.pace) / 60),
        targetPaceSecondsPerMile: wt.pace,
        description: getWorkoutDescription(wt.type, wt.name, wt.distance, phase),
        rationale: workoutRationales[wt.type] || 'Training stimulus for race preparation',
        isKeyWorkout: wt.key,
        status: 'scheduled',
        phase,
        weekNumber: week + 1,
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

function getWorkoutDescription(type: string, name: string, distance: number, phase: string): string {
  const descriptions: Record<string, string> = {
    'Recovery Run': 'Very easy effort to promote recovery. Keep it conversational.',
    'Easy Run': 'Comfortable aerobic running. You should be able to hold a conversation.',
    'Easy Run + Strides': 'Easy run followed by 4-6x20 second strides at mile pace with full recovery.',
    'Shakeout Run': 'Short, easy jog to keep legs fresh. Just enough to get blood flowing.',
    'Steady Tempo': '20-30 minutes at comfortably hard effort. Should be able to speak in short phrases.',
    'Marathon Pace Run': `${distance} miles at your goal marathon pace. Practice race-day fueling.`,
    'Yasso 800s': '800m repeats with equal rest. Classic marathon predictor workout.',
    'Fartlek': 'Speed play with varied faster segments. Run by feel.',
    'Easy Long Run': `${distance} miles at easy, conversational pace. Focus on time on feet.`,
    'Progression Long Run': 'Start easy, gradually increase pace. Finish the last 2-3 miles at marathon pace.',
  };
  return descriptions[name] || `${phase} phase ${name.toLowerCase()} - ${distance} miles`;
}

// Update a demo workout status
export function updateDemoWorkoutStatus(workoutId: number, status: 'completed' | 'skipped'): void {
  const workouts = getDemoPlannedWorkouts();
  const updated = workouts.map(w =>
    w.id === workoutId ? { ...w, status } : w
  );
  saveDemoPlannedWorkouts(updated);
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
