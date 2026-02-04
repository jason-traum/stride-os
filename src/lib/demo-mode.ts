'use client';

/**
 * Demo Mode - Uses localStorage instead of database
 *
 * When ?demo=true is in the URL, the app switches to demo mode where:
 * - All data is stored in localStorage (per-browser isolation)
 * - Onboarding starts fresh
 * - Friends can each have their own experience
 */

import { useEffect } from 'react';

const DEMO_FLAG_KEY = 'dreamy_demo_mode';
const DEMO_SETTINGS_KEY = 'dreamy_demo_settings';
const DEMO_WORKOUTS_KEY = 'dreamy_demo_workouts';
const DEMO_SHOES_KEY = 'dreamy_demo_shoes';

// Check if we're in demo mode
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === 'true';
}

// Initialize demo mode from URL parameter
export function initDemoMode(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const demoParam = params.get('demo');

  if (demoParam === 'true') {
    // Enable demo mode
    localStorage.setItem(DEMO_FLAG_KEY, 'true');

    // Check if we should load pre-seeded demo data
    // ?demo=true&sample=true = pre-loaded sample runner (for quick demos)
    // ?demo=true = fresh start, go through onboarding (for full experience)
    const loadSample = params.get('sample') === 'true';
    if (loadSample) {
      seedDemoData();
    } else if (!getDemoSettings()) {
      // Clear any old demo data for a fresh start
      localStorage.removeItem(DEMO_SETTINGS_KEY);
      localStorage.removeItem(DEMO_WORKOUTS_KEY);
      localStorage.removeItem(DEMO_SHOES_KEY);
      localStorage.removeItem('dreamy_demo_races');
      localStorage.removeItem('dreamy_demo_planned_workouts');
    }

    // Remove the query params from URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    return true;
  }

  return isDemoMode();
}

// Seed demo data with a realistic sample runner - 16 weeks of training history
function seedDemoData(): void {
  // Sample runner: Alex (VDOT ~42), training for a spring marathon
  // This is a realistic mid-pack runner, not an elite
  const today = new Date();
  const raceDate = new Date(today);
  raceDate.setDate(raceDate.getDate() + 70); // ~10 weeks out

  const sampleSettings: DemoSettings = {
    id: 1,
    name: 'Alex',
    onboardingCompleted: true,
    age: 38,
    gender: 'male',
    yearsRunning: 3,
    currentWeeklyMileage: 32,
    currentLongRunMax: 13,
    runsPerWeekCurrent: 5,
    runsPerWeekTarget: 5,
    peakWeeklyMileageTarget: 45,
    weeklyVolumeTargetMiles: 38,
    preferredLongRunDay: 'saturday',
    preferredQualityDays: '["tuesday","thursday"]',
    planAggressiveness: 'moderate',
    qualitySessionsPerWeek: 2,
    vdot: 42, // Realistic mid-pack runner (~3:35 marathon potential)
    easyPaceSeconds: 585, // 9:45/mi
    tempoPaceSeconds: 480, // 8:00/mi
    thresholdPaceSeconds: 450, // 7:30/mi
    intervalPaceSeconds: 405, // 6:45/mi
    marathonPaceSeconds: 510, // 8:30/mi
    halfMarathonPaceSeconds: 485, // 8:05/mi
    temperaturePreference: 'neutral',
    trainBy: 'mixed',
    stressLevel: 'moderate',
    typicalSleepHours: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(sampleSettings));

  // Generate 16 weeks of realistic training data
  const sampleWorkouts: DemoWorkout[] = [];
  let workoutId = 1;

  // Weekly training pattern (realistic for mid-pack marathon training)
  // Week structure: Mon=rest, Tue=quality, Wed=easy, Thu=quality, Fri=easy/rest, Sat=long, Sun=easy
  const weekPatterns = generateWeekPatterns(16);

  for (let week = 0; week < 16; week++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (16 - week) * 7);

    const pattern = weekPatterns[week];

    for (const workout of pattern.workouts) {
      const workoutDate = new Date(weekStart);
      workoutDate.setDate(workoutDate.getDate() + workout.dayOffset);

      // Skip if in the future
      if (workoutDate > today) continue;

      // Add some messy realism - occasionally skip workouts
      if (Math.random() < 0.08) continue; // ~8% miss rate

      // Vary pace based on conditions (weather, fatigue, etc.)
      const paceVariation = (Math.random() - 0.5) * 30; // +/- 15 seconds
      const adjustedPace = workout.basePace + paceVariation;

      // Occasionally have a rough day (slower pace, lower RPE assessment)
      const isRoughDay = Math.random() < 0.12;
      const finalPace = isRoughDay ? adjustedPace + 25 : adjustedPace;

      // Generate assessment for some workouts (about 70%)
      const hasAssessment = Math.random() < 0.7;
      const assessment: DemoAssessment | undefined = hasAssessment ? {
        verdict: isRoughDay
          ? (Math.random() < 0.5 ? 'rough' : 'fine')
          : workout.type === 'interval' || workout.type === 'tempo'
            ? (Math.random() < 0.7 ? 'good' : 'great')
            : (Math.random() < 0.6 ? 'good' : 'great'),
        rpe: isRoughDay
          ? Math.min(10, workout.expectedRpe + 2)
          : workout.expectedRpe + (Math.random() < 0.3 ? 1 : 0),
        legsFeel: Math.floor(Math.random() * 3) + (isRoughDay ? 1 : 3),
        breathingFeel: workout.type === 'easy' || workout.type === 'recovery'
          ? 'easy'
          : workout.type === 'long'
            ? (Math.random() < 0.7 ? 'controlled' : 'hard')
            : (Math.random() < 0.5 ? 'controlled' : 'hard'),
        sleepQuality: Math.floor(Math.random() * 2) + (isRoughDay ? 2 : 3),
        sleepHours: 6 + Math.random() * 2,
        stress: Math.floor(Math.random() * 3) + 2,
        note: generateWorkoutNote(workout.type, isRoughDay),
      } : undefined;

      // Assign shoe (rotate between daily trainers and easy day shoes)
      const shoeId = workout.type === 'interval' || workout.type === 'tempo'
        ? 1 // Daily trainers for quality
        : Math.random() < 0.6 ? 1 : 3; // Mix for easy runs

      sampleWorkouts.push({
        id: workoutId++,
        date: workoutDate.toISOString().split('T')[0],
        distanceMiles: workout.distance,
        durationMinutes: Math.round((workout.distance * finalPace) / 60),
        avgPaceSeconds: Math.round(finalPace),
        workoutType: workout.type,
        shoeId,
        assessment,
        notes: assessment?.note,
      });
    }
  }

  localStorage.setItem(DEMO_WORKOUTS_KEY, JSON.stringify(sampleWorkouts));

  // Sample shoes with realistic mileage
  const sampleShoes: DemoShoe[] = [
    { id: 1, name: 'Daily Trainers', brand: 'Brooks', model: 'Ghost 15', totalMiles: 342, isRetired: false },
    { id: 2, name: 'Race Day', brand: 'Nike', model: 'Vaporfly 3', totalMiles: 28, isRetired: false },
    { id: 3, name: 'Easy Days', brand: 'HOKA', model: 'Clifton 9', totalMiles: 198, isRetired: false },
    { id: 4, name: 'Old Faithfuls', brand: 'Brooks', model: 'Ghost 14', totalMiles: 486, isRetired: true },
  ];
  localStorage.setItem(DEMO_SHOES_KEY, JSON.stringify(sampleShoes));

  // Add a race result from 8 weeks ago (tune-up 10K)
  const raceResults = [
    {
      id: 1,
      date: new Date(today.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      distanceMeters: 10000,
      distanceLabel: '10K',
      finishTimeSeconds: 2820, // 47:00 10K (~7:34/mi)
      raceName: 'Spring Thaw 10K',
      effortLevel: 'all_out' as const,
      conditions: 'Cool, 45°F, light wind',
      vdotAtTime: 42,
    },
  ];
  localStorage.setItem('dreamy_demo_race_results', JSON.stringify(raceResults));

  // Add upcoming goal race
  const races = [
    {
      id: 1,
      name: 'Spring Marathon',
      date: raceDate.toISOString().split('T')[0],
      distanceMeters: 42195,
      distanceLabel: 'marathon',
      priority: 'A' as const,
      targetTimeSeconds: 12900, // 3:35:00 target
      trainingPlanGenerated: true,
    },
  ];
  localStorage.setItem('dreamy_demo_races', JSON.stringify(races));
}

// Generate realistic weekly training patterns
interface WorkoutPattern {
  dayOffset: number;
  type: 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'rest';
  distance: number;
  basePace: number;
  expectedRpe: number;
}

interface WeekPattern {
  weekNumber: number;
  phase: 'base' | 'build' | 'peak' | 'taper';
  workouts: WorkoutPattern[];
}

function generateWeekPatterns(weeks: number): WeekPattern[] {
  const patterns: WeekPattern[] = [];

  // Base paces (VDOT 42)
  const EASY_PACE = 585; // 9:45/mi
  const TEMPO_PACE = 480; // 8:00/mi
  const INTERVAL_PACE = 405; // 6:45/mi
  const LONG_PACE = 600; // 10:00/mi
  const RECOVERY_PACE = 630; // 10:30/mi

  for (let w = 0; w < weeks; w++) {
    // Determine phase and base mileage
    let phase: 'base' | 'build' | 'peak' | 'taper';
    let weeklyMiles: number;
    let longRunMiles: number;

    if (w < 4) {
      phase = 'base';
      weeklyMiles = 25 + w * 2; // 25-31 miles
      longRunMiles = 10 + w * 0.5;
    } else if (w < 10) {
      phase = 'build';
      weeklyMiles = 32 + (w - 4) * 2; // 32-44 miles
      longRunMiles = 12 + (w - 4) * 0.5;
    } else if (w < 14) {
      phase = 'peak';
      weeklyMiles = 40 + (w - 10) * 1.5; // 40-46 miles
      longRunMiles = 14 + (w - 10) * 1;
    } else {
      phase = 'taper';
      weeklyMiles = 35 - (w - 14) * 8; // 35-19 miles
      longRunMiles = 12 - (w - 14) * 4;
    }

    // Add down week every 4th week (except taper)
    if (phase !== 'taper' && w > 0 && w % 4 === 3) {
      weeklyMiles *= 0.75;
      longRunMiles *= 0.8;
    }

    const workouts: WorkoutPattern[] = [];

    // Monday: Rest (no workout)

    // Tuesday: Quality (tempo or intervals)
    const tuesdayType = w % 2 === 0 ? 'tempo' : 'interval';
    workouts.push({
      dayOffset: 1,
      type: tuesdayType,
      distance: tuesdayType === 'tempo' ? 6 : 5,
      basePace: tuesdayType === 'tempo' ? TEMPO_PACE : INTERVAL_PACE,
      expectedRpe: 7,
    });

    // Wednesday: Easy
    workouts.push({
      dayOffset: 2,
      type: 'easy',
      distance: Math.round((weeklyMiles - longRunMiles - 11) * 0.3),
      basePace: EASY_PACE,
      expectedRpe: 4,
    });

    // Thursday: Quality (opposite of Tuesday)
    const thursdayType = w % 2 === 0 ? 'interval' : 'tempo';
    workouts.push({
      dayOffset: 3,
      type: thursdayType,
      distance: thursdayType === 'tempo' ? 5 : 4,
      basePace: thursdayType === 'tempo' ? TEMPO_PACE : INTERVAL_PACE,
      expectedRpe: 7,
    });

    // Friday: Recovery or rest
    if (weeklyMiles > 35) {
      workouts.push({
        dayOffset: 4,
        type: 'recovery',
        distance: 3,
        basePace: RECOVERY_PACE,
        expectedRpe: 3,
      });
    }

    // Saturday: Long run
    workouts.push({
      dayOffset: 5,
      type: 'long',
      distance: Math.round(longRunMiles),
      basePace: LONG_PACE,
      expectedRpe: 5,
    });

    // Sunday: Easy recovery
    workouts.push({
      dayOffset: 6,
      type: 'easy',
      distance: 4,
      basePace: EASY_PACE + 15,
      expectedRpe: 3,
    });

    patterns.push({
      weekNumber: w + 1,
      phase,
      workouts,
    });
  }

  return patterns;
}

// Generate realistic workout notes
function generateWorkoutNote(type: string, isRoughDay: boolean): string | undefined {
  if (Math.random() > 0.4) return undefined; // Only 40% have notes

  const roughNotes = [
    'Legs felt heavy from the start',
    'Didn\'t sleep well last night',
    'Work stress catching up to me',
    'Cut it short, not feeling it today',
    'Pushed through but it was a grind',
  ];

  const tempoNotes = [
    'Hit the paces, felt strong',
    'First mile was rough, settled in after',
    'New route, some good hills',
    'Negative split, finished feeling good',
  ];

  const intervalNotes = [
    '400s felt quick today',
    'Last two reps were tough',
    'Good recovery between intervals',
    'Track was crowded, improvised on the road',
  ];

  const longRunNotes = [
    'Beautiful morning for a long run',
    'Tried new fueling strategy',
    'Last 3 miles were tough',
    'Ran with the group today',
    'Negative split, strong finish',
  ];

  const easyNotes = [
    'Nice and easy',
    'Ran with a friend',
    'Explored a new trail',
    'Good shakeout run',
  ];

  if (isRoughDay) {
    return roughNotes[Math.floor(Math.random() * roughNotes.length)];
  }

  switch (type) {
    case 'tempo':
      return tempoNotes[Math.floor(Math.random() * tempoNotes.length)];
    case 'interval':
      return intervalNotes[Math.floor(Math.random() * intervalNotes.length)];
    case 'long':
      return longRunNotes[Math.floor(Math.random() * longRunNotes.length)];
    default:
      return easyNotes[Math.floor(Math.random() * easyNotes.length)];
  }
}

// Exit demo mode
export function exitDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_SETTINGS_KEY);
  localStorage.removeItem(DEMO_WORKOUTS_KEY);
  localStorage.removeItem(DEMO_SHOES_KEY);
}

// Demo Settings Storage
export interface DemoSettings {
  id?: number;
  name?: string;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  // Basic info
  age?: number;
  gender?: string;
  yearsRunning?: number;
  // Training state
  currentWeeklyMileage?: number;
  currentLongRunMax?: number;
  runsPerWeekCurrent?: number;
  runsPerWeekTarget?: number;
  peakWeeklyMileageTarget?: number;
  weeklyVolumeTargetMiles?: number;
  // Preferences
  preferredLongRunDay?: string;
  preferredQualityDays?: string;
  requiredRestDays?: string;
  planAggressiveness?: string;
  qualitySessionsPerWeek?: number;
  // Pacing
  vdot?: number;
  easyPaceSeconds?: number;
  tempoPaceSeconds?: number;
  thresholdPaceSeconds?: number;
  intervalPaceSeconds?: number;
  marathonPaceSeconds?: number;
  halfMarathonPaceSeconds?: number;
  defaultTargetPaceSeconds?: number;
  // Location
  latitude?: number;
  longitude?: number;
  cityName?: string;
  // Comfort levels
  comfortVO2max?: number;
  comfortTempo?: number;
  comfortHills?: number;
  comfortLongRuns?: number;
  // Other
  temperaturePreference?: string;
  runnerPersona?: string;
  trainBy?: string;
  surfacePreference?: string;
  stressLevel?: string;
  typicalSleepHours?: number;
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export function getDemoSettings(): DemoSettings | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(DEMO_SETTINGS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveDemoSettings(settings: Partial<DemoSettings>): DemoSettings {
  if (typeof window === 'undefined') return settings as DemoSettings;

  const existing = getDemoSettings() || { id: 1, createdAt: new Date().toISOString() };
  const updated = {
    ...existing,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// Demo Workouts Storage
export interface DemoAssessment {
  verdict: 'great' | 'good' | 'fine' | 'rough' | 'awful';
  rpe: number;
  legsFeel?: number;
  breathingFeel?: 'easy' | 'controlled' | 'hard' | 'cooked';
  sleepQuality?: number;
  sleepHours?: number;
  stress?: number;
  soreness?: number;
  hydration?: number;
  note?: string;
}

export interface DemoWorkout {
  id: number;
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
  notes?: string;
  shoeId?: number;
  assessment?: DemoAssessment;
}

export function getDemoWorkouts(): DemoWorkout[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_WORKOUTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addDemoWorkout(workout: Omit<DemoWorkout, 'id'>): DemoWorkout {
  const workouts = getDemoWorkouts();
  const newWorkout = {
    ...workout,
    id: Date.now(),
  };
  workouts.push(newWorkout);
  localStorage.setItem(DEMO_WORKOUTS_KEY, JSON.stringify(workouts));
  return newWorkout;
}

export function updateDemoWorkoutAssessment(workoutId: number, assessment: DemoAssessment): boolean {
  const workouts = getDemoWorkouts();
  const workoutIndex = workouts.findIndex(w => w.id === workoutId);
  if (workoutIndex === -1) return false;

  workouts[workoutIndex] = {
    ...workouts[workoutIndex],
    assessment,
  };
  localStorage.setItem(DEMO_WORKOUTS_KEY, JSON.stringify(workouts));
  return true;
}

export function getDemoWorkoutById(workoutId: number): DemoWorkout | null {
  const workouts = getDemoWorkouts();
  return workouts.find(w => w.id === workoutId) || null;
}

// Demo Shoes Storage
export interface DemoShoe {
  id: number;
  name: string;
  brand: string;
  model: string;
  totalMiles: number;
  isRetired: boolean;
}

export function getDemoShoes(): DemoShoe[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_SHOES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addDemoShoe(shoe: Omit<DemoShoe, 'id'>): DemoShoe {
  const shoes = getDemoShoes();
  const newShoe = {
    ...shoe,
    id: Date.now(),
  };
  shoes.push(newShoe);
  localStorage.setItem(DEMO_SHOES_KEY, JSON.stringify(shoes));
  return newShoe;
}

// Hook for listening to demo data changes
// Use this in pages that need to refresh when the coach makes changes via chat
export function useDemoDataRefresh(callback: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDemoDataChange = () => {
      callback();
    };

    window.addEventListener('demo-data-changed', handleDemoDataChange);
    return () => {
      window.removeEventListener('demo-data-changed', handleDemoDataChange);
    };
  }, [callback]);
}
