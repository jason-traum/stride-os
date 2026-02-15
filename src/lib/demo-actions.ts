/**
 * Demo Mode Actions - Client-side versions that save to localStorage
 * These mirror the server actions but work entirely in the browser
 */

import {
  saveDemoSettings,
  getDemoSettings,
  type DemoSettings,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addDemoWorkout,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDemoWorkouts,
} from './demo-mode';
import { calculateVDOT, calculatePaceZones } from './training/vdot-calculator';
import { RACE_DISTANCES } from './training/types';

const DEMO_RACES_KEY = 'dreamy_demo_races';
const DEMO_PLANNED_WORKOUTS_KEY = 'dreamy_demo_planned_workouts';
const DEMO_RACE_RESULTS_KEY = 'dreamy_demo_race_results';
const DEMO_INJURIES_KEY = 'dreamy_demo_injuries';
const DEMO_WARDROBE_KEY = 'dreamy_demo_wardrobe';
const DEMO_OUTFIT_FEEDBACK_KEY = 'dreamy_demo_outfit_feedback';

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

export interface DemoRaceResult {
  id: number;
  date: string;
  distanceLabel: string;
  distanceMeters: number;
  finishTimeSeconds: number;
  raceName?: string;
  effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
  conditions?: string;
  notes?: string;
  vdotAtTime?: number;
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

// Get demo race results from localStorage
export function getDemoRaceResults(): DemoRaceResult[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_RACE_RESULTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save demo race result
export function addDemoRaceResult(result: Omit<DemoRaceResult, 'id'>): DemoRaceResult {
  const results = getDemoRaceResults();
  const newResult = { ...result, id: Date.now() };
  results.push(newResult);
  localStorage.setItem(DEMO_RACE_RESULTS_KEY, JSON.stringify(results));
  return newResult;
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

  // Get preferred long run day (default to saturday)
  const preferredLongRunDay = settings?.preferredLongRunDay || 'saturday';
  const dayIndexMap: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
    friday: 4, saturday: 5, sunday: 6
  };
  const longRunDayIndex = dayIndexMap[preferredLongRunDay.toLowerCase()] ?? 5; // Default to Saturday (5)

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _weeklyMileage = baseMileage;

    if (phase === 'base') {
      weeklyMileage = baseMileage + (week * 2);
    } else if (phase === 'build') {
      weeklyMileage = Math.min(peakMileage * 0.9, baseMileage + 15 + (week * 1.5));
    } else if (phase === 'peak') {
      weeklyMileage = peakMileage;
    } else {
      weeklyMileage = peakMileage * (weeksOut === 2 ? 0.7 : 0.5);
    }

    // Long run distance - progressive build, cap based on week in plan and race distance
    const maxLongRun = race.distanceMeters >= 40000 ? 22 : 16; // Marathon: 22mi max, Half: 16mi max
    const longRunDistance = Math.min(
      phase === 'taper' ? 10 : 10 + Math.min(week, 10), // Start at 10mi, add 1mi/week up to 10 weeks
      maxLongRun
    );

    // Calculate quality day indices, avoiding long run day and placing appropriately
    // Typical: quality on Tue (1) and Thu (3), but adjust if long run is on a weekday
    let qualityDay1 = 1; // Tuesday
    let qualityDay2 = 3; // Thursday

    // If long run is on a weekday, adjust quality days
    if (longRunDayIndex < 5) {
      // Long run on weekday, avoid it
      if (longRunDayIndex === 1) qualityDay1 = 2; // Move to Wednesday
      if (longRunDayIndex === 3) qualityDay2 = 2; // Move to Wednesday
    }

    // Add workouts for the week
    const workoutTypes = phase === 'taper'
      ? [
          { day: qualityDay1, type: 'easy', name: 'Easy Run', distance: 4, pace: easyPace, key: false },
          { day: qualityDay2, type: 'easy', name: 'Easy Run + Strides', distance: 3, pace: easyPace, key: false },
          { day: longRunDayIndex - 1 >= 0 ? longRunDayIndex - 1 : 4, type: 'easy', name: 'Shakeout Run', distance: 2, pace: easyPace, key: false },
        ]
      : [
          { day: 0, type: 'easy', name: 'Recovery Run', distance: 4, pace: easyPace + 30, key: false },
          { day: qualityDay1, type: 'tempo', name: phase === 'peak' ? 'Marathon Pace Run' : 'Steady Tempo', distance: 6, pace: tempoPace, key: true },
          { day: qualityDay2, type: 'interval', name: phase === 'build' ? 'Yasso 800s' : 'Fartlek', distance: 5, pace: intervalPace, key: true },
          { day: longRunDayIndex - 1 >= 0 ? longRunDayIndex - 1 : 4, type: 'easy', name: 'Easy Run', distance: 5, pace: easyPace, key: false },
          { day: longRunDayIndex, type: 'long', name: phase === 'peak' ? 'Progression Long Run' : 'Easy Long Run', distance: longRunDistance, pace: longPace, key: true },
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

// ============== Injury Tracking ==============

export interface DemoInjury {
  id: number;
  bodyPart: string;
  side?: 'left' | 'right' | 'both';
  severity: 'minor' | 'moderate' | 'severe';
  description?: string;
  restrictions: string[];
  loggedDate: string;
  clearedDate?: string;
  isActive: boolean;
}

export function getDemoInjuries(): DemoInjury[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_INJURIES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getActiveDemoInjuries(): DemoInjury[] {
  return getDemoInjuries().filter(i => i.isActive);
}

export function addDemoInjury(injury: Omit<DemoInjury, 'id' | 'loggedDate' | 'isActive'>): DemoInjury {
  const injuries = getDemoInjuries();
  const newInjury: DemoInjury = {
    ...injury,
    id: Date.now(),
    loggedDate: new Date().toISOString().split('T')[0],
    isActive: true,
  };
  injuries.push(newInjury);
  localStorage.setItem(DEMO_INJURIES_KEY, JSON.stringify(injuries));
  return newInjury;
}

export function clearDemoInjury(injuryId: number): boolean {
  const injuries = getDemoInjuries();
  const index = injuries.findIndex(i => i.id === injuryId);
  if (index === -1) return false;

  injuries[index] = {
    ...injuries[index],
    isActive: false,
    clearedDate: new Date().toISOString().split('T')[0],
  };
  localStorage.setItem(DEMO_INJURIES_KEY, JSON.stringify(injuries));
  return true;
}

export function getDemoInjuryRestrictions(): string[] {
  const activeInjuries = getActiveDemoInjuries();
  const restrictions = new Set<string>();
  activeInjuries.forEach(i => i.restrictions.forEach(r => restrictions.add(r)));
  return Array.from(restrictions);
}

// ============== Wardrobe / Clothing ==============

export interface DemoClothingItem {
  id: number;
  category: 'base_layer' | 'mid_layer' | 'outer_layer' | 'shorts' | 'tights' | 'socks' | 'hat' | 'gloves' | 'accessories';
  name: string;
  brand?: string;
  tempRangeMin: number; // Fahrenheit
  tempRangeMax: number;
  weatherSuitability: ('rain' | 'wind' | 'sun' | 'snow')[];
  owned: boolean;
  createdAt: string;
}

export function getDemoWardrobe(): DemoClothingItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_WARDROBE_KEY);
  if (!stored) {
    // Seed with default wardrobe items
    const defaultItems = getDefaultDemoWardrobe();
    localStorage.setItem(DEMO_WARDROBE_KEY, JSON.stringify(defaultItems));
    return defaultItems;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addDemoClothingItem(item: Omit<DemoClothingItem, 'id' | 'createdAt'>): DemoClothingItem {
  const wardrobe = getDemoWardrobe();
  const newItem: DemoClothingItem = {
    ...item,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  };
  wardrobe.push(newItem);
  localStorage.setItem(DEMO_WARDROBE_KEY, JSON.stringify(wardrobe));
  return newItem;
}

function getDefaultDemoWardrobe(): DemoClothingItem[] {
  const now = new Date().toISOString();
  return [
    { id: 1, category: 'shorts', name: 'Running Shorts', tempRangeMin: 55, tempRangeMax: 95, weatherSuitability: ['sun'], owned: true, createdAt: now },
    { id: 2, category: 'tights', name: 'Running Tights', tempRangeMin: 20, tempRangeMax: 50, weatherSuitability: ['wind'], owned: true, createdAt: now },
    { id: 3, category: 'base_layer', name: 'Tech T-Shirt', tempRangeMin: 50, tempRangeMax: 95, weatherSuitability: ['sun'], owned: true, createdAt: now },
    { id: 4, category: 'base_layer', name: 'Long Sleeve Base', tempRangeMin: 30, tempRangeMax: 55, weatherSuitability: [], owned: true, createdAt: now },
    { id: 5, category: 'mid_layer', name: 'Running Vest', tempRangeMin: 35, tempRangeMax: 50, weatherSuitability: ['wind'], owned: true, createdAt: now },
    { id: 6, category: 'outer_layer', name: 'Rain Jacket', tempRangeMin: 40, tempRangeMax: 65, weatherSuitability: ['rain', 'wind'], owned: true, createdAt: now },
    { id: 7, category: 'hat', name: 'Running Cap', tempRangeMin: 55, tempRangeMax: 100, weatherSuitability: ['sun'], owned: true, createdAt: now },
    { id: 8, category: 'hat', name: 'Beanie', tempRangeMin: 10, tempRangeMax: 40, weatherSuitability: ['wind', 'snow'], owned: true, createdAt: now },
    { id: 9, category: 'gloves', name: 'Running Gloves', tempRangeMin: 20, tempRangeMax: 45, weatherSuitability: ['wind'], owned: true, createdAt: now },
    { id: 10, category: 'socks', name: 'Moisture-Wicking Socks', tempRangeMin: 50, tempRangeMax: 95, weatherSuitability: [], owned: true, createdAt: now },
  ];
}

// ============== Outfit Feedback ==============

export interface DemoOutfitFeedback {
  id: number;
  date: string;
  temperature: number;
  conditions: string;
  items: number[]; // clothing item IDs
  rating: 'too_cold' | 'slightly_cold' | 'perfect' | 'slightly_warm' | 'too_warm';
  notes?: string;
}

export function getDemoOutfitFeedback(): DemoOutfitFeedback[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_OUTFIT_FEEDBACK_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addDemoOutfitFeedback(feedback: Omit<DemoOutfitFeedback, 'id'>): DemoOutfitFeedback {
  const allFeedback = getDemoOutfitFeedback();
  const newFeedback: DemoOutfitFeedback = {
    ...feedback,
    id: Date.now(),
  };
  allFeedback.push(newFeedback);
  localStorage.setItem(DEMO_OUTFIT_FEEDBACK_KEY, JSON.stringify(allFeedback));
  return newFeedback;
}
