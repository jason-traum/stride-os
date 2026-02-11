// Enhanced prescribeWorkout function that uses the workout template library
import { db } from '@/lib/db';
import { workouts, userSettings, plannedWorkouts, races } from '@/lib/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { IntelligentWorkoutSelector } from './workout-templates/intelligent-selector';
import { COMPREHENSIVE_WORKOUT_LIBRARY } from './workout-templates/comprehensive-library';
import { ADVANCED_WORKOUT_VARIATIONS } from './workout-templates/advanced-variations';
import { BEGINNER_FRIENDLY_WORKOUTS } from './workout-templates/beginner-friendly';
import { WorkoutRequestInterpreter } from './workout-request-interpreter';
import { getCoachingKnowledge, findRelevantTopics } from './coach-knowledge';

interface WorkoutPrescription {
  workout_name: string;
  workout_type: string;
  structure: string;
  target_paces: string;
  total_distance: string;
  warmup: string;
  cooldown: string;
  purpose: string[];
  rationale: string;
  difficulty_level: string;
  alternatives?: Array<{
    name: string;
    reason: string;
  }>;
  modifications?: string[];
  coach_notes: string;
  estimated_duration: number;
  template_source?: string;
  confidence_score: number;
}

export async function enhancedPrescribeWorkout(input: Record<string, unknown>): Promise<{
  prescription: WorkoutPrescription;
  context: any;
  coach_notes: string;
}> {
  console.log(`=== [enhancedPrescribeWorkout] START === at ${new Date().toISOString()}`);

  let workoutType = input.workout_type as string;
  const targetDistance = input.target_distance as string;
  const phase = input.phase as string;
  const weeklyMileage = input.weekly_mileage as number;
  let userPreference = input.preference as string; // 'simple', 'detailed', 'advanced', 'auto'
  const rawRequest = input.raw_request as string;

  // If raw request is provided, use the interpreter
  let isEliteVariation = false;
  if (rawRequest) {
    console.log(`[enhancedPrescribeWorkout] Interpreting raw request: "${rawRequest}"`);
    const interpreter = new WorkoutRequestInterpreter();
    const interpretation = interpreter.interpret(rawRequest);

    // Override preference if interpreter detected advanced
    if (interpretation.preference === 'advanced') {
      userPreference = 'advanced';
      console.log(`[enhancedPrescribeWorkout] Detected advanced preference from raw request`);
    }

    // Check for "super advanced" or elite-level requests
    if (rawRequest.toLowerCase().includes('super advanced') ||
        rawRequest.toLowerCase().includes('extremely advanced') ||
        rawRequest.toLowerCase().includes('elite')) {
      isEliteVariation = true;
      console.log(`[enhancedPrescribeWorkout] Detected elite-level workout request`);
    }
  }

  // Get user data
  const profileId = await getActiveProfileId();
  if (!profileId) {
    throw new Error('No active profile');
  }

  // Fetch user settings and recent workouts
  const [settings, recentWorkouts, upcomingRaces] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1),
    db.select().from(workouts)
      .where(eq(workouts.profileId, profileId))
      .orderBy(desc(workouts.date))
      .limit(20),
    db.select().from(races)
      .where(and(
        eq(races.profileId, profileId),
        gte(races.date, new Date().toISOString().split('T')[0])
      ))
      .orderBy(races.date)
      .limit(3)
  ]);

  const userSettingsData = settings[0] || {};

  // Determine user's experience level and preferences
  const fitnessLevel = determineUserFitnessLevel(userSettingsData, recentWorkouts);
  const preferSimpleWorkouts = shouldUseSimpleWorkouts(userPreference, fitnessLevel, userSettingsData);

  // Get relevant coaching knowledge
  const relevantTopics = findRelevantTopics(rawRequest || `${workoutType} workout ${phase} phase`);
  const workoutLibraryKnowledge = getCoachingKnowledge('workout_library');
  const workoutPrescriptionsKnowledge = getCoachingKnowledge('workout_prescriptions');

  // Build athlete context for intelligent selection
  const athleteContext = {
    currentWeek: calculateCurrentWeek(upcomingRaces[0]),
    totalWeeks: calculateTotalWeeks(upcomingRaces[0]),
    phase: (phase || determinePhase(upcomingRaces[0])) as 'recovery' | 'base' | 'build' | 'peak' | 'taper',
    weeklyMileage: weeklyMileage || userSettingsData.currentWeeklyMileage || 25,
    fitnessLevel,
    targetRace: mapTargetRace(targetDistance, upcomingRaces[0]),
    recentWorkouts: mapRecentWorkouts(recentWorkouts),
    injuryRisk: assessInjuryRisk(userSettingsData, recentWorkouts),
    preferredWorkoutTypes: userSettingsData.preferredWorkoutTypes,
    environmentalFactors: {
      temperature: input.temperature as number,
      surface: input.surface as 'track' | 'road' | 'trail'
    },
    upcomingRaces: upcomingRaces.map(r => ({
      daysUntil: calculateDaysUntil(r.date),
      priority: (r.priority || 'B') as 'A' | 'B' | 'C'
    }))
  };

  // Use template library for selection
  const selector = new IntelligentWorkoutSelector();
  let selectedWorkout;

  if (isEliteVariation) {
    // Use elite-level variations for "super advanced" requests
    console.log(`[enhancedPrescribeWorkout] Selecting from ADVANCED_WORKOUT_VARIATIONS`);
    selectedWorkout = selectEliteWorkout(workoutType, athleteContext);
  } else if (preferSimpleWorkouts) {
    // Use beginner-friendly templates
    selectedWorkout = selectSimpleWorkout(workoutType, athleteContext);
  } else {
    // Use full intelligent selection
    selectedWorkout = selector.selectWorkout(athleteContext, mapWorkoutType(workoutType));
  }

  // Build prescription from template
  const prescription = buildPrescription(
    selectedWorkout.primary,
    athleteContext,
    userSettingsData,
    selectedWorkout.alternatives,
    selectedWorkout.modifications
  );

  // Generate context for the response
  const context = generateWorkoutContext(
    athleteContext,
    recentWorkouts,
    userSettingsData,
    selectedWorkout
  );

  // Generate coach notes
  const coachNotes = generateCoachNotes(
    prescription,
    athleteContext,
    userSettingsData,
    preferSimpleWorkouts
  );

  // Enhance with discovered preferences (optional - only if we have profile tracking)
  const enhancedResult = {
    prescription,
    context,
    coach_notes: coachNotes
  };

  // TODO: When profile tracking is fully implemented, uncomment this:
  // try {
  //   const enhanced = await enhanceWorkoutWithPreferences(enhancedResult, profileId);
  //   console.log(`[enhancedPrescribeWorkout] Applied user preference adaptations`);
  //   return enhanced;
  // } catch (error) {
  //   console.warn(`[enhancedPrescribeWorkout] Could not apply preferences:`, error);
  // }

  console.log(`=== [enhancedPrescribeWorkout] END === at ${new Date().toISOString()}`);

  return enhancedResult;
}

// Helper Functions

function determineUserFitnessLevel(settings: any, recentWorkouts: any[]): 'beginner' | 'intermediate' | 'advanced' | 'elite' {
  // Multiple factors to determine fitness level
  const vdot = settings.vdot || 0;
  const yearsRunning = settings.yearsRunning || 0;
  const weeklyMileage = settings.currentWeeklyMileage || 0;
  const recentWorkoutCount = recentWorkouts.length;

  let score = 0;

  // VDOT-based scoring
  if (vdot >= 60) score += 4;
  else if (vdot >= 50) score += 3;
  else if (vdot >= 40) score += 2;
  else if (vdot >= 30) score += 1;

  // Experience scoring
  if (yearsRunning >= 5) score += 3;
  else if (yearsRunning >= 3) score += 2;
  else if (yearsRunning >= 1) score += 1;

  // Mileage scoring
  if (weeklyMileage >= 50) score += 3;
  else if (weeklyMileage >= 35) score += 2;
  else if (weeklyMileage >= 20) score += 1;

  // Consistency scoring
  if (recentWorkoutCount >= 15) score += 2;
  else if (recentWorkoutCount >= 10) score += 1;

  // Convert score to level
  if (score >= 10) return 'elite';
  if (score >= 7) return 'advanced';
  if (score >= 4) return 'intermediate';
  return 'beginner';
}

function shouldUseSimpleWorkouts(preference: string, fitnessLevel: string, settings: any): boolean {
  // Explicit preference
  if (preference === 'simple') return true;
  if (preference === 'advanced') return false;

  // Auto-determine based on user profile
  if (fitnessLevel === 'beginner') return true;
  if (settings.preferSimpleWorkouts === true) return true;
  if (settings.coachingPreference === 'minimal') return true;

  // Check if user typically skips complex workouts
  if (settings.workoutCompletionRate && settings.workoutCompletionRate < 0.7) return true;

  return false;
}

function selectSimpleWorkout(workoutType: string, context: any) {
  // Map workout type to simple templates
  const simpleLibrary = BEGINNER_FRIENDLY_WORKOUTS;
  let candidates = [];

  switch (workoutType) {
    case 'long_run':
      candidates = simpleLibrary.simple_long_runs;
      break;
    case 'tempo':
    case 'threshold':
      candidates = simpleLibrary.simple_tempo;
      break;
    case 'interval':
    case 'vo2max':
    case 'speed':
      candidates = simpleLibrary.simple_speed;
      break;
    case 'easy':
    case 'recovery':
      candidates = simpleLibrary.easy_runs;
      break;
    case 'race_pace':
      candidates = simpleLibrary.race_prep;
      break;
    default:
      // Fun variations for variety
      candidates = simpleLibrary.fun_workouts;
  }

  // Simple selection based on phase
  let selected;
  if (context.phase === 'base' || context.phase === 'recovery') {
    selected = candidates.find(w => w.difficulty === 'beginner') || candidates[0];
  } else {
    selected = candidates[Math.floor(Math.random() * candidates.length)];
  }

  return {
    primary: selected,
    alternatives: candidates.filter(w => w.id !== selected.id).slice(0, 2),
    modifications: [],
    reasoning: ['Selected for simplicity and effectiveness']
  };
}

function selectEliteWorkout(workoutType: string, context: any) {
  // Select from ADVANCED_WORKOUT_VARIATIONS for elite-level workouts
  const advancedLibrary = ADVANCED_WORKOUT_VARIATIONS;
  let candidates = [];

  switch (workoutType) {
    case 'tempo':
    case 'threshold':
      // For tempo, prioritize Norwegian Double Threshold and other advanced variations
      candidates = [
        ...advancedLibrary.norwegian_methods,
        ...advancedLibrary.canova_system,
        ...advancedLibrary.renato_special.filter(w => w.type === 'tempo')
      ];
      break;
    case 'vo2max':
    case 'speed':
    case 'interval':
      candidates = [
        ...advancedLibrary.kenyan_workouts,
        ...advancedLibrary.oregon_project,
        ...advancedLibrary.japanese_ekiden.filter(w => w.type === 'vo2max')
      ];
      break;
    case 'long_run':
      candidates = [
        ...advancedLibrary.canova_system.filter(w => w.type === 'long_run'),
        ...advancedLibrary.marathon_specific
      ];
      break;
    case 'fartlek':
      candidates = advancedLibrary.kenyan_workouts.filter(w => w.name.toLowerCase().includes('fartlek'));
      break;
    default:
      // Fall back to regular selection for other types
      candidates = [];
  }

  // If no advanced variations available for this type, use regular advanced workouts
  if (candidates.length === 0) {
    candidates = COMPREHENSIVE_WORKOUT_LIBRARY[mapWorkoutType(workoutType)] || [];
    // Filter for more advanced ones based on difficulty
    candidates = candidates.filter(w =>
      w.difficulty_score >= 7 ||
      w.name.toLowerCase().includes('advanced') ||
      w.name.toLowerCase().includes('elite')
    );
  }

  // Select based on context
  let selected = candidates[0]; // Default to first

  // Try to match phase
  const phaseMatches = candidates.filter(w =>
    w.best_for?.includes(context.phase) ||
    w.training_phase === context.phase
  );
  if (phaseMatches.length > 0) {
    selected = phaseMatches[0];
  }

  // For tempo specifically, prioritize Norwegian Double Threshold for "super advanced"
  if (workoutType === 'tempo' || workoutType === 'threshold') {
    const norwegianDouble = candidates.find(w =>
      w.name.toLowerCase().includes('norwegian double')
    );
    if (norwegianDouble) {
      selected = norwegianDouble;
    }
  }

  return {
    primary: selected,
    alternatives: candidates.slice(0, 3).filter(c => c !== selected),
    modifications: ['This is an elite-level workout. Adjust paces if needed based on current fitness.'],
    reasoning: ['Selected elite-level workout based on "super advanced" request']
  };
}

function buildPrescription(
  template: any,
  context: any,
  userSettings: any,
  alternatives: any[],
  modifications?: string[]
): WorkoutPrescription {
  // Convert template to prescription format
  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  // Personalize paces based on user's actual data
  let targetPaces = template.targetPace;
  if (userSettings.vdot && targetPaces.includes('5K pace')) {
    const vdotPaces = calculateVDOTPaces(userSettings.vdot);
    targetPaces = targetPaces.replace('5K pace', formatPace(vdotPaces['5K']));
  }
  if (userSettings.tempoPaceSeconds && targetPaces.includes('tempo')) {
    targetPaces = targetPaces.replace('tempo', formatPace(userSettings.tempoPaceSeconds));
  }

  // Scale distances based on weekly mileage
  const mileageMultiplier = Math.min(Math.max(context.weeklyMileage / 40, 0.5), 1.5);
  let totalDistance = template.example || template.structure;
  if (totalDistance.match(/\d+\s*mi/)) {
    const originalMiles = parseInt(totalDistance.match(/(\d+)\s*mi/)[1]);
    const scaledMiles = Math.round(originalMiles * mileageMultiplier);
    totalDistance = totalDistance.replace(/\d+\s*mi/, `${scaledMiles} miles`);
  }

  return {
    workout_name: template.name,
    workout_type: template.category,
    structure: template.structure,
    target_paces: targetPaces,
    total_distance: totalDistance,
    warmup: template.structure.includes('warmup') ? 'Included in structure' : '10-15 min easy jog + dynamic stretches',
    cooldown: template.structure.includes('cooldown') ? 'Included in structure' : '10 min easy jog + stretching',
    purpose: template.purpose,
    rationale: `${template.description}. ${template.physiologicalTarget}.`,
    difficulty_level: template.difficulty,
    alternatives: alternatives?.slice(0, 2).map(alt => ({
      name: alt.name,
      reason: alt.purpose[0] || 'Alternative option'
    })),
    modifications: modifications || generateModifications(template, context),
    coach_notes: template.coachingNote || '',
    estimated_duration: estimateDuration(template, context),
    template_source: template.id,
    confidence_score: 0.95 // High confidence since using proven templates
  };
}

function generateModifications(template: any, context: any): string[] {
  const mods = [];

  // Weather modifications
  if (context.environmentalFactors?.temperature > 75) {
    mods.push('Hot weather: Slow paces by 10-15 sec/mile, bring water');
  } else if (context.environmentalFactors?.temperature < 35) {
    mods.push('Cold weather: Extra warmup time, watch for ice');
  }

  // Fatigue modifications
  if (context.recentWorkouts.filter((w: any) => w.difficulty > 7).length > 2) {
    mods.push('Recent hard training: Consider reducing volume by 20%');
  }

  // Injury risk modifications
  if (context.injuryRisk !== 'low') {
    mods.push('Injury prevention: Add 5min extra warmup/cooldown');
    mods.push('Stop if any pain or unusual discomfort');
  }

  // Phase-specific modifications
  if (context.phase === 'taper') {
    mods.push('Taper phase: Maintain intensity but reduce volume by 30-40%');
  }

  return mods;
}

function generateWorkoutContext(
  athleteContext: any,
  recentWorkouts: any[],
  userSettings: any,
  selection: any
): any {
  // Generate comprehensive context for the AI's response
  const last7DaysWorkouts = recentWorkouts.filter(w => {
    const daysAgo = Math.floor((Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 7;
  });

  const recentMileage = last7DaysWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  return {
    phase: athleteContext.phase,
    target_race: athleteContext.targetRace,
    weeks_until_race: Math.floor(athleteContext.upcomingRaces[0]?.daysUntil / 7) || 'No race scheduled',
    current_fitness: {
      vdot: userSettings.vdot || 'Not assessed',
      weekly_mileage: athleteContext.weeklyMileage,
      recent_7_day_mileage: Math.round(recentMileage),
      fitness_level: athleteContext.fitnessLevel
    },
    recent_training: {
      workouts_last_week: last7DaysWorkouts.length,
      hard_sessions: last7DaysWorkouts.filter(w => ['tempo', 'interval', 'vo2max'].includes(w.workoutType)).length,
      last_long_run: recentWorkouts.find(w => w.workoutType === 'long')?.date || 'Not found',
      selection_reasoning: selection.reasoning
    },
    personalization: {
      preferred_style: userSettings.preferSimpleWorkouts ? 'simple' : 'detailed',
      injury_considerations: athleteContext.injuryRisk !== 'low' ? 'Modified for injury prevention' : 'None',
      environmental_factors: athleteContext.environmentalFactors
    }
  };
}

function generateCoachNotes(
  prescription: WorkoutPrescription,
  context: any,
  userSettings: any,
  isSimpleMode: boolean
): string {
  const notes = [];

  // Opening based on workout selection
  if (isSimpleMode) {
    notes.push(`I've selected a straightforward ${prescription.workout_name} for you. This workout is designed to be effective without being complicated.`);
  } else {
    notes.push(`Based on your ${context.fitnessLevel} fitness level and ${context.phase} training phase, I've prescribed the ${prescription.workout_name}.`);
  }

  // Purpose explanation
  notes.push(`This workout will help you ${prescription.purpose.slice(0, 2).join(' and ')}.`);

  // Pacing guidance
  if (prescription.target_paces.includes('pace')) {
    notes.push(`For pacing, ${prescription.target_paces.includes('easy') ?
      'keep it truly conversational - you should be able to chat comfortably' :
      'aim for a "comfortably hard" effort where you can speak in short sentences'}.`);
  }

  // Motivational note based on recent training
  const recentHardWorkouts = context.recentWorkouts.filter((w: any) => w.difficulty > 7).length;
  if (recentHardWorkouts === 0) {
    notes.push('This is a great opportunity to push yourself a bit after recent easier training.');
  } else if (recentHardWorkouts > 2) {
    notes.push('You\'ve been working hard lately - remember that adaptation happens during recovery too.');
  }

  // Phase-specific encouragement
  if (context.phase === 'peak') {
    notes.push('You\'re in peak phase - trust your fitness and execute with confidence!');
  } else if (context.phase === 'base') {
    notes.push('Base building is all about consistency - every workout is building your foundation.');
  }

  // Close with simple advice
  if (isSimpleMode) {
    notes.push('Remember: the best workout is the one you actually do. Keep it simple and consistent!');
  } else {
    notes.push(`With ${context.upcomingRaces[0]?.daysUntil || 'many'} days until your race, this workout fits perfectly into your progression.`);
  }

  return notes.join(' ');
}

// Utility functions
function calculateCurrentWeek(race: any): number {
  if (!race) return 1;
  const weeksOut = Math.floor((new Date(race.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
  return Math.max(1, 16 - weeksOut); // Assume 16-week plan
}

function calculateTotalWeeks(race: any): number {
  return race ? 16 : 12; // Default training blocks
}

function determinePhase(race: any): 'base' | 'build' | 'peak' | 'taper' | 'recovery' {
  if (!race) return 'base';
  const daysUntil = calculateDaysUntil(race.date);

  if (daysUntil <= 14) return 'taper';
  if (daysUntil <= 28) return 'peak';
  if (daysUntil <= 70) return 'build';
  return 'base';
}

function mapTargetRace(distance: string, race: any): 'marathon' | 'half' | '10k' | '5k' {
  if (race) {
    const meters = race.distanceMeters;
    if (meters >= 42000) return 'marathon';
    if (meters >= 21000) return 'half';
    if (meters >= 10000) return '10k';
    return '5k';
  }

  // Map from input
  if (distance?.toLowerCase().includes('marathon') && !distance.includes('half')) return 'marathon';
  if (distance?.toLowerCase().includes('half')) return 'half';
  if (distance?.includes('10')) return '10k';
  return '5k';
}

function mapRecentWorkouts(workouts: any[]): any[] {
  return workouts.map(w => ({
    type: w.workoutType,
    daysAgo: Math.floor((Date.now() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24)),
    difficulty: estimateWorkoutDifficulty(w),
    recovery: w.workoutType === 'recovery' || w.workoutType === 'easy'
  }));
}

function estimateWorkoutDifficulty(workout: any): number {
  // 1-10 scale based on type and metrics
  if (workout.workoutType === 'recovery') return 2;
  if (workout.workoutType === 'easy') return 3;
  if (workout.workoutType === 'long') return 6;
  if (workout.workoutType === 'tempo') return 7;
  if (workout.workoutType === 'interval' || workout.workoutType === 'vo2max') return 8;
  if (workout.workoutType === 'race') return 10;
  return 5;
}

function assessInjuryRisk(settings: any, recentWorkouts: any[]): 'low' | 'moderate' | 'high' {
  // Check various factors
  if (settings.currentInjuries?.length > 0) return 'high';
  if (settings.injuryHistory?.includes('stress fracture')) return 'moderate';

  // Check recent mileage jump
  const thisWeekMiles = recentWorkouts
    .filter(w => new Date(w.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  const lastWeekMiles = recentWorkouts
    .filter(w => {
      const date = new Date(w.date);
      return date > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
             date <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    })
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  if (thisWeekMiles > lastWeekMiles * 1.5) return 'moderate';

  return 'low';
}

function calculateDaysUntil(dateStr: string): number {
  const raceDate = new Date(dateStr);
  const today = new Date();
  return Math.floor((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapWorkoutType(type: string): 'long' | 'tempo' | 'speed' | 'recovery' | 'any' {
  const mapping: Record<string, any> = {
    'long_run': 'long',
    'tempo': 'tempo',
    'threshold': 'tempo',
    'interval': 'speed',
    'vo2max': 'speed',
    'easy': 'recovery',
    'recovery': 'recovery',
    'fartlek': 'speed',
    'hills': 'speed'
  };

  return mapping[type] || 'any';
}

function estimateDuration(template: any, context: any): number {
  // Rough duration estimates in minutes
  const baseEstimates: Record<string, number> = {
    'long_run': 90,
    'tempo': 60,
    'threshold': 60,
    'vo2max': 75,
    'interval': 75,
    'speed': 60,
    'recovery': 40,
    'easy': 45,
    'fartlek': 50,
    'race_specific': 70
  };

  let duration = baseEstimates[template.category] || 60;

  // Adjust for fitness level
  if (context.fitnessLevel === 'elite') duration *= 1.3;
  else if (context.fitnessLevel === 'advanced') duration *= 1.2;
  else if (context.fitnessLevel === 'beginner') duration *= 0.8;

  return Math.round(duration);
}

function calculateVDOTPaces(vdot: number): Record<string, number> {
  // Simplified VDOT pace calculator (seconds per mile)
  // This would use actual VDOT tables in production
  const adjustmentFactor = (vdot - 45) * 3; // 3 seconds per VDOT point

  return {
    'easy': 540 - adjustmentFactor, // 9:00 base
    'marathon': 480 - adjustmentFactor, // 8:00 base
    'threshold': 440 - adjustmentFactor, // 7:20 base
    'interval': 400 - adjustmentFactor, // 6:40 base
    '10K': 420 - adjustmentFactor, // 7:00 base
    '5K': 390 - adjustmentFactor, // 6:30 base
  };
}