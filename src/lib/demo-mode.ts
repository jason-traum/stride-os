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
    // Enable demo mode and clear any previous demo data for fresh start
    localStorage.setItem(DEMO_FLAG_KEY, 'true');
    localStorage.removeItem(DEMO_SETTINGS_KEY);
    localStorage.removeItem(DEMO_WORKOUTS_KEY);
    localStorage.removeItem(DEMO_SHOES_KEY);

    // Remove the ?demo=true from URL to clean it up (but keep demo mode active)
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    return true;
  }

  return isDemoMode();
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
