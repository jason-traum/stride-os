/**
 * Demo Mode - Uses localStorage instead of database
 *
 * When ?demo=true is in the URL, the app switches to demo mode where:
 * - All data is stored in localStorage (per-browser isolation)
 * - Onboarding starts fresh
 * - Friends can each have their own experience
 */

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

// Seed demo data with a realistic sample runner
function seedDemoData(): void {
  // Sample runner: Alex, training for a spring marathon
  const today = new Date();
  const raceDate = new Date(today);
  raceDate.setDate(raceDate.getDate() + 70); // ~10 weeks out

  const sampleSettings: DemoSettings = {
    id: 1,
    name: 'Alex',
    onboardingCompleted: true,
    age: 32,
    gender: 'male',
    yearsRunning: 4,
    currentWeeklyMileage: 35,
    currentLongRunMax: 14,
    runsPerWeekCurrent: 5,
    runsPerWeekTarget: 5,
    peakWeeklyMileageTarget: 50,
    weeklyVolumeTargetMiles: 40,
    preferredLongRunDay: 'saturday',
    preferredQualityDays: '["tuesday","thursday"]',
    planAggressiveness: 'moderate',
    qualitySessionsPerWeek: 2,
    vdot: 45,
    easyPaceSeconds: 540, // 9:00/mi
    tempoPaceSeconds: 450, // 7:30/mi
    thresholdPaceSeconds: 420, // 7:00/mi
    intervalPaceSeconds: 375, // 6:15/mi
    marathonPaceSeconds: 480, // 8:00/mi
    halfMarathonPaceSeconds: 450, // 7:30/mi
    temperaturePreference: 'neutral',
    trainBy: 'mixed',
    stressLevel: 'moderate',
    typicalSleepHours: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(sampleSettings));

  // Sample recent workouts (last 2 weeks)
  const sampleWorkouts: DemoWorkout[] = [];
  const workoutPatterns = [
    { daysAgo: 1, type: 'easy', distance: 5, pace: 545 },
    { daysAgo: 2, type: 'tempo', distance: 7, pace: 455 },
    { daysAgo: 4, type: 'easy', distance: 6, pace: 540 },
    { daysAgo: 5, type: 'interval', distance: 6, pace: 480 },
    { daysAgo: 6, type: 'easy', distance: 5, pace: 550 },
    { daysAgo: 8, type: 'long', distance: 14, pace: 555 },
    { daysAgo: 9, type: 'easy', distance: 4, pace: 560 },
    { daysAgo: 11, type: 'tempo', distance: 6, pace: 458 },
    { daysAgo: 12, type: 'easy', distance: 5, pace: 545 },
    { daysAgo: 13, type: 'easy', distance: 6, pace: 538 },
  ];

  workoutPatterns.forEach((w, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - w.daysAgo);
    sampleWorkouts.push({
      id: i + 1,
      date: date.toISOString().split('T')[0],
      distanceMiles: w.distance,
      durationMinutes: Math.round((w.distance * w.pace) / 60),
      avgPaceSeconds: w.pace,
      workoutType: w.type,
    });
  });
  localStorage.setItem(DEMO_WORKOUTS_KEY, JSON.stringify(sampleWorkouts));

  // Sample shoes
  const sampleShoes: DemoShoe[] = [
    { id: 1, name: 'Daily Trainers', brand: 'Nike', model: 'Pegasus 40', totalMiles: 312, isRetired: false },
    { id: 2, name: 'Race Flats', brand: 'Nike', model: 'Vaporfly 3', totalMiles: 48, isRetired: false },
    { id: 3, name: 'Easy Days', brand: 'New Balance', model: 'Fresh Foam 1080', totalMiles: 245, isRetired: false },
  ];
  localStorage.setItem(DEMO_SHOES_KEY, JSON.stringify(sampleShoes));
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
export interface DemoWorkout {
  id: number;
  date: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPaceSeconds: number;
  workoutType: string;
  notes?: string;
  shoeId?: number;
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
