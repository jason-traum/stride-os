// Coach tools for Claude function calling

import { db, workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts } from '@/lib/db';
import { eq, desc, gte, asc, and, lte } from 'drizzle-orm';
import { fetchCurrentWeather, type WeatherCondition } from './weather';
import { calculateConditionsSeverity, calculatePaceAdjustment, parsePaceToSeconds } from './conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems, getCategoryLabel } from './outfit';
import { calculatePace } from './utils';
import { calculateVDOT, calculatePaceZones } from './training/vdot-calculator';
import { RACE_DISTANCES } from './training/types';
import { formatPace as formatPaceFromTraining } from './training/types';
import { detectAlerts } from './alerts';
import type { WorkoutType, Verdict, NewAssessment, ClothingCategory, TemperaturePreference, OutfitRating, ExtremityRating, RacePriority, Workout, Assessment, Shoe, ClothingItem, PlannedWorkout, Race } from './schema';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

// Tool definitions for Claude
export const coachToolDefinitions = [
  {
    name: 'get_recent_workouts',
    description: 'Get recent workouts with their assessments. Use this to understand recent training patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        count: {
          type: 'number',
          description: 'Number of workouts to retrieve (default 5, max 20)',
        },
        workout_type: {
          type: 'string',
          description: 'Optional filter by workout type (easy, steady, tempo, interval, long, race, recovery)',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'cross_train', 'other'],
        },
      },
    },
  },
  {
    name: 'get_workout_detail',
    description: 'Get full details of a specific workout including assessment data',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'The ID of the workout to retrieve',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'get_shoes',
    description: 'Get list of shoes with current mileage',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_retired: {
          type: 'boolean',
          description: 'Include retired shoes (default false)',
        },
      },
    },
  },
  {
    name: 'get_user_settings',
    description: 'Get user settings including location, preferences, and acclimatization score',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_current_weather',
    description: 'Get current weather conditions and running severity score',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'calculate_adjusted_pace',
    description: 'Calculate pace adjustment based on current weather conditions',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_pace: {
          type: 'string',
          description: 'Target pace per mile in format "7:30" or "8:00"',
        },
        workout_type: {
          type: 'string',
          description: 'Type of workout',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery'],
        },
      },
      required: ['target_pace', 'workout_type'],
    },
  },
  {
    name: 'log_workout',
    description: 'Create a new workout record. You can provide any two of: distance_miles, duration_minutes, pace_per_mile - the third will be calculated. Returns the workout ID for adding an assessment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today)',
        },
        distance_miles: {
          type: 'number',
          description: 'Distance in miles (can be calculated from duration + pace)',
        },
        duration_minutes: {
          type: 'number',
          description: 'Duration in minutes (can be calculated from distance + pace)',
        },
        pace_per_mile: {
          type: 'string',
          description: 'Pace per mile in "mm:ss" format, e.g. "8:30" (can be calculated from distance + duration)',
        },
        workout_type: {
          type: 'string',
          description: 'Type of workout',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'cross_train', 'other'],
        },
        shoe_id: {
          type: 'number',
          description: 'ID of the shoe used (optional)',
        },
        route_name: {
          type: 'string',
          description: 'Name of the route (optional)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the workout (optional)',
        },
      },
      required: ['workout_type'],
    },
  },
  {
    name: 'log_assessment',
    description: 'Create or update an assessment for a workout',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to assess',
        },
        verdict: {
          type: 'string',
          description: 'Overall feeling: great, good, fine, rough, awful',
          enum: ['great', 'good', 'fine', 'rough', 'awful'],
        },
        rpe: {
          type: 'number',
          description: 'Rate of perceived exertion 1-10',
        },
        legs_feel: {
          type: 'number',
          description: 'How legs felt 0-10 (optional)',
        },
        breathing_feel: {
          type: 'string',
          description: 'Breathing difficulty (optional)',
          enum: ['easy', 'controlled', 'hard', 'cooked'],
        },
        sleep_quality: {
          type: 'number',
          description: 'Sleep quality 0-10 (optional)',
        },
        sleep_hours: {
          type: 'number',
          description: 'Hours of sleep (optional)',
        },
        stress: {
          type: 'number',
          description: 'Stress level 0-10 (optional)',
        },
        soreness: {
          type: 'number',
          description: 'Soreness level 0-10 (optional)',
        },
        hydration: {
          type: 'number',
          description: 'Hydration level 0-10 (optional)',
        },
        note: {
          type: 'string',
          description: 'Additional assessment notes (optional)',
        },
      },
      required: ['workout_id', 'verdict', 'rpe'],
    },
  },
  {
    name: 'get_training_summary',
    description: 'Get training summary statistics for a period',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to summarize (default 7)',
        },
      },
    },
  },
  {
    name: 'search_workouts',
    description: 'Search workouts by text in notes/route names or by date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Text to search in notes and route names',
        },
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        date_to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
    },
  },
  {
    name: 'get_outfit_recommendation',
    description: 'Get outfit recommendation based on weather, distance, and workout type. Use this when user asks "what should I wear?"',
    input_schema: {
      type: 'object' as const,
      properties: {
        distance_miles: {
          type: 'number',
          description: 'Distance of the planned run in miles (default 5)',
        },
        workout_type: {
          type: 'string',
          description: 'Type of workout planned',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery'],
        },
        feels_like_temp: {
          type: 'number',
          description: 'Override feels-like temperature (optional, defaults to current weather)',
        },
      },
    },
  },
  {
    name: 'get_wardrobe',
    description: 'Get list of clothing items in the user\'s wardrobe',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_inactive: {
          type: 'boolean',
          description: 'Include inactive/retired items (default false)',
        },
      },
    },
  },
  {
    name: 'add_clothing_item',
    description: 'Add a new clothing item to the wardrobe',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the item (e.g., "Blue quarter zip", "Hestra gloves")',
        },
        category: {
          type: 'string',
          description: 'Category of clothing',
          enum: [
            'top_short_sleeve', 'top_long_sleeve_thin', 'top_long_sleeve_standard', 'top_long_sleeve_warm',
            'outer_quarter_zip', 'outer_shell', 'outer_hoodie',
            'bottom_shorts', 'bottom_half_tights', 'bottom_leggings',
            'gloves_thin', 'gloves_medium', 'gloves_winter',
            'beanie', 'buff', 'socks_thin', 'socks_warm', 'other'
          ],
        },
        warmth_rating: {
          type: 'number',
          description: 'Warmth rating 1-5 (1=lightest, 5=warmest)',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the item',
        },
      },
      required: ['name', 'category', 'warmth_rating'],
    },
  },
  {
    name: 'log_outfit_feedback',
    description: 'Log feedback about how an outfit worked for a run. Use when user says things like "I was too warm" or "my hands were cold"',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout (use most recent if not specified)',
        },
        outfit_rating: {
          type: 'string',
          description: 'Overall outfit rating',
          enum: ['too_cold', 'slightly_cold', 'perfect', 'slightly_warm', 'too_warm'],
        },
        hands_rating: {
          type: 'string',
          description: 'How hands felt',
          enum: ['fine', 'cold', 'painful'],
        },
        face_rating: {
          type: 'string',
          description: 'How face felt',
          enum: ['fine', 'cold', 'painful'],
        },
        removed_layers: {
          type: 'string',
          description: 'Description of what layers were removed mid-run',
        },
      },
      required: ['outfit_rating'],
    },
  },
  // Training Plan Tools
  {
    name: 'get_todays_workout',
    description: 'Get today\'s planned workout from the training plan. Use when user asks "what should I do today?" or "what\'s my workout?"',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_weekly_plan',
    description: 'Get the current week\'s planned workouts from the training plan',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_pace_zones',
    description: 'Get the user\'s current pace zones based on their VDOT. Use when discussing pacing or when they ask about their training paces.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_user_profile',
    description: 'Get detailed user profile including training history and onboarding status. Use this to check what information is missing.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_user_profile',
    description: 'Update user profile fields. Use when user provides information about themselves (training preferences, goals, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'User\'s name',
        },
        current_weekly_mileage: {
          type: 'number',
          description: 'Current weekly running mileage',
        },
        runs_per_week: {
          type: 'number',
          description: 'Current runs per week',
        },
        preferred_long_run_day: {
          type: 'string',
          description: 'Preferred day for long runs',
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        preferred_quality_days: {
          type: 'array',
          description: 'Preferred days for quality/hard workouts',
          items: { type: 'string' },
        },
        plan_aggressiveness: {
          type: 'string',
          description: 'How aggressive the training plan should be',
          enum: ['conservative', 'moderate', 'aggressive'],
        },
        injury_history: {
          type: 'string',
          description: 'Description of past injuries',
        },
        current_injuries: {
          type: 'string',
          description: 'Description of current injuries or niggles',
        },
        coach_context: {
          type: 'string',
          description: 'Additional context for the coach (goals, preferences, constraints)',
        },
      },
    },
  },
  {
    name: 'get_races',
    description: 'Get upcoming and past races',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_past: {
          type: 'boolean',
          description: 'Include past races (default false)',
        },
      },
    },
  },
  {
    name: 'add_race',
    description: 'Add a new goal race. Use when user wants to set a race goal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the race',
        },
        date: {
          type: 'string',
          description: 'Race date in YYYY-MM-DD format',
        },
        distance: {
          type: 'string',
          description: 'Race distance',
          enum: ['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Mile', '100K', '100 Mile'],
        },
        priority: {
          type: 'string',
          description: 'Race priority (A = goal race, B = important, C = tune-up/training)',
          enum: ['A', 'B', 'C'],
        },
        target_time: {
          type: 'string',
          description: 'Target finish time in H:MM:SS or MM:SS format (optional)',
        },
        location: {
          type: 'string',
          description: 'Race location (optional)',
        },
      },
      required: ['name', 'date', 'distance', 'priority'],
    },
  },
  {
    name: 'add_race_result',
    description: 'Log a completed race result. Updates VDOT and pace zones. Use when user tells you about a race they completed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_name: {
          type: 'string',
          description: 'Name of the race (optional)',
        },
        date: {
          type: 'string',
          description: 'Race date in YYYY-MM-DD format',
        },
        distance: {
          type: 'string',
          description: 'Race distance',
          enum: ['5K', '10K', 'Half Marathon', 'Marathon', '50K', '50 Mile', '100K', '100 Mile'],
        },
        finish_time: {
          type: 'string',
          description: 'Finish time in H:MM:SS or MM:SS format',
        },
        effort_level: {
          type: 'string',
          description: 'How hard was the effort?',
          enum: ['all_out', 'hard', 'moderate', 'easy'],
        },
        conditions: {
          type: 'string',
          description: 'Race conditions (weather, course, etc.)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the race',
        },
      },
      required: ['date', 'distance', 'finish_time'],
    },
  },
  {
    name: 'modify_todays_workout',
    description: 'Modify today\'s planned workout. Use when user wants to scale down or swap the workout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'Type of modification',
          enum: ['scale_down', 'skip', 'mark_complete'],
        },
        scale_factor: {
          type: 'number',
          description: 'Scale factor for scale_down (e.g., 0.75 for 75%)',
        },
        reason: {
          type: 'string',
          description: 'Reason for the modification',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_plan_adherence',
    description: 'Get detailed plan adherence analysis with adaptation suggestions. Use when reviewing training consistency or when user mentions struggling to keep up.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks_back: {
          type: 'number',
          description: 'Number of weeks to analyze (default: 4)',
        },
      },
    },
  },
  {
    name: 'get_readiness_score',
    description: 'Calculate a readiness score based on recent training load, sleep, stress, and soreness. Use to advise if user should push hard or take it easy.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'predict_race_time',
    description: 'Predict race time for a given distance based on current fitness (VDOT) and training. Use when user asks about goal times or race predictions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        distance: {
          type: 'string',
          description: 'Race distance to predict',
          enum: ['5K', '10K', '15K', '10_mile', 'half_marathon', 'marathon'],
        },
        conditions: {
          type: 'string',
          description: 'Expected race conditions (optional)',
          enum: ['ideal', 'warm', 'hot', 'cold', 'hilly'],
        },
      },
      required: ['distance'],
    },
  },
  {
    name: 'analyze_workout_patterns',
    description: 'Analyze workout patterns and trends over time. Use to identify what is working and what needs adjustment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks_back: {
          type: 'number',
          description: 'Number of weeks to analyze (default: 8)',
        },
      },
    },
  },
  {
    name: 'get_training_load',
    description: 'Get acute (7-day) and chronic (28-day) training load with fatigue indicators. Use to assess if training is balanced.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_proactive_alerts',
    description: 'Get proactive alerts and notifications about training patterns that need attention. Use this to check for overtraining risks, plan adherence issues, upcoming races, or achievements to celebrate. Call this at the start of conversations to stay informed.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_todays_planned_workout',
    description: 'Get the planned workout for today from the training plan. Use this when user asks about their workout for today.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_planned_workout',
    description: 'Update/edit a planned workout. Use this when user wants to modify a workout in their plan (change distance, type, description, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to update',
        },
        name: {
          type: 'string',
          description: 'New name for the workout (optional)',
        },
        description: {
          type: 'string',
          description: 'New description (optional)',
        },
        target_distance_miles: {
          type: 'number',
          description: 'New target distance in miles (optional)',
        },
        target_pace_per_mile: {
          type: 'string',
          description: 'New target pace in mm:ss format (optional)',
        },
        workout_type: {
          type: 'string',
          description: 'New workout type (optional)',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'threshold', 'fartlek'],
        },
        rationale: {
          type: 'string',
          description: 'New rationale/explanation (optional)',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'suggest_workout_modification',
    description: 'Suggest a modification to a planned workout based on context (weather, fatigue, schedule). Returns the suggestion for user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to suggest changes for',
        },
        reason: {
          type: 'string',
          description: 'Reason for suggesting the modification (weather, fatigue, time constraint, etc.)',
        },
        suggested_change: {
          type: 'string',
          description: 'What change you are suggesting (reduce distance, easier pace, different workout type, etc.)',
        },
      },
      required: ['workout_id', 'reason', 'suggested_change'],
    },
  },
];

// Tool implementations
export async function executeCoachTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'get_recent_workouts':
      return getRecentWorkouts(input);
    case 'get_workout_detail':
      return getWorkoutDetail(input);
    case 'get_shoes':
      return getShoes(input);
    case 'get_user_settings':
      return getUserSettings();
    case 'get_current_weather':
      return getCurrentWeather();
    case 'calculate_adjusted_pace':
      return calculateAdjustedPace(input);
    case 'log_workout':
      return logWorkout(input);
    case 'log_assessment':
      return logAssessment(input);
    case 'get_training_summary':
      return getTrainingSummary(input);
    case 'search_workouts':
      return searchWorkouts(input);
    case 'get_outfit_recommendation':
      return getOutfitRecommendationTool(input);
    case 'get_wardrobe':
      return getWardrobe(input);
    case 'add_clothing_item':
      return addClothingItem(input);
    case 'log_outfit_feedback':
      return logOutfitFeedback(input);
    // Training Plan Tools
    case 'get_todays_workout':
      return getTodaysWorkout();
    case 'get_weekly_plan':
      return getWeeklyPlan();
    case 'get_pace_zones':
      return getPaceZones();
    case 'get_user_profile':
      return getUserProfile();
    case 'update_user_profile':
      return updateUserProfile(input);
    case 'get_races':
      return getRaces(input);
    case 'add_race':
      return addRace(input);
    case 'add_race_result':
      return addRaceResult(input);
    case 'modify_todays_workout':
      return modifyTodaysWorkout(input);
    case 'get_plan_adherence':
      return getPlanAdherence(input);
    case 'get_readiness_score':
      return getReadinessScore();
    case 'predict_race_time':
      return predictRaceTime(input);
    case 'analyze_workout_patterns':
      return analyzeWorkoutPatterns(input);
    case 'get_training_load':
      return getTrainingLoad();
    case 'get_proactive_alerts':
      return getProactiveAlerts();
    case 'get_todays_planned_workout':
      return getTodaysPlannedWorkout();
    case 'update_planned_workout':
      return updatePlannedWorkout(input);
    case 'suggest_workout_modification':
      return suggestWorkoutModification(input);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function getRecentWorkouts(input: Record<string, unknown>) {
  const count = Math.min((input.count as number) || 5, 20);
  const workoutType = input.workout_type as string | undefined;

  const query = db.query.workouts.findMany({
    with: {
      shoe: true,
      assessment: true,
    },
    orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    limit: count,
  });

  let results: WorkoutWithRelations[] = await query;

  if (workoutType) {
    results = results.filter((w: WorkoutWithRelations) => w.workoutType === workoutType);
  }

  return results.map((w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    pace_per_mile: w.avgPaceSeconds ? formatPace(w.avgPaceSeconds) : null,
    workout_type: w.workoutType,
    route_name: w.routeName,
    shoe: w.shoe?.name || null,
    notes: w.notes,
    weather: w.weatherTempF ? {
      temp_f: w.weatherTempF,
      feels_like_f: w.weatherFeelsLikeF,
      humidity: w.weatherHumidityPct,
      conditions: w.weatherConditions,
    } : null,
    assessment: w.assessment ? {
      verdict: w.assessment.verdict,
      rpe: w.assessment.rpe,
      legs_feel: w.assessment.legsFeel,
      sleep_quality: w.assessment.sleepQuality,
      sleep_hours: w.assessment.sleepHours,
      stress: w.assessment.stress,
      note: w.assessment.note,
    } : null,
  }));
}

async function getWorkoutDetail(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: {
      shoe: true,
      assessment: true,
    },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  return {
    id: workout.id,
    date: workout.date,
    distance_miles: workout.distanceMiles,
    duration_minutes: workout.durationMinutes,
    pace_per_mile: workout.avgPaceSeconds ? formatPace(workout.avgPaceSeconds) : null,
    workout_type: workout.workoutType,
    route_name: workout.routeName,
    notes: workout.notes,
    shoe: workout.shoe ? {
      id: workout.shoe.id,
      name: workout.shoe.name,
      total_miles: workout.shoe.totalMiles,
    } : null,
    weather: workout.weatherTempF ? {
      temp_f: workout.weatherTempF,
      feels_like_f: workout.weatherFeelsLikeF,
      humidity: workout.weatherHumidityPct,
      wind_mph: workout.weatherWindMph,
      conditions: workout.weatherConditions,
      severity_score: workout.weatherSeverityScore,
    } : null,
    assessment: workout.assessment ? {
      verdict: workout.assessment.verdict,
      rpe: workout.assessment.rpe,
      was_intended_workout: workout.assessment.wasIntendedWorkout,
      legs_feel: workout.assessment.legsFeel,
      breathing_feel: workout.assessment.breathingFeel,
      sleep_quality: workout.assessment.sleepQuality,
      sleep_hours: workout.assessment.sleepHours,
      stress: workout.assessment.stress,
      soreness: workout.assessment.soreness,
      mood: workout.assessment.mood,
      hydration: workout.assessment.hydration,
      perceived_heat: workout.assessment.perceivedHeat,
      note: workout.assessment.note,
    } : null,
  };
}

async function getShoes(input: Record<string, unknown>) {
  const includeRetired = input.include_retired as boolean || false;

  let results: Shoe[] = await db.select().from(shoes);

  if (!includeRetired) {
    results = results.filter((s: Shoe) => !s.isRetired);
  }

  return results.map((s: Shoe) => ({
    id: s.id,
    name: s.name,
    brand: s.brand,
    model: s.model,
    category: s.category,
    total_miles: s.totalMiles,
    is_retired: s.isRetired,
  }));
}

async function getUserSettings() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { error: 'No settings found' };
  }

  return {
    name: s.name,
    location: s.cityName || null,
    weekly_volume_target_miles: s.weeklyVolumeTargetMiles,
    heat_acclimatization_score: s.heatAcclimatizationScore,
    default_target_pace: s.defaultTargetPaceSeconds ? formatPace(s.defaultTargetPaceSeconds) : null,
    preferred_long_run_day: s.preferredLongRunDay,
    coach_context: s.coachContext,
  };
}

async function getCurrentWeather() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s?.latitude || !s?.longitude) {
    return { error: 'No location configured' };
  }

  const weather = await fetchCurrentWeather(s.latitude, s.longitude);

  if (!weather) {
    return { error: 'Could not fetch weather' };
  }

  const severity = calculateConditionsSeverity(weather);

  return {
    temperature_f: weather.temperature,
    feels_like_f: weather.feelsLike,
    humidity_pct: weather.humidity,
    wind_mph: weather.windSpeed,
    condition: weather.conditionText,
    severity_score: severity.severityScore,
    severity_label: severity.primaryFactor,
    description: severity.description,
  };
}

async function calculateAdjustedPace(input: Record<string, unknown>) {
  const targetPace = input.target_pace as string;
  const workoutType = input.workout_type as WorkoutType;

  const paceSeconds = parsePaceToSeconds(targetPace);
  if (!paceSeconds) {
    return { error: 'Invalid pace format. Use "7:30" format.' };
  }

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s?.latitude || !s?.longitude) {
    return { error: 'No location configured for weather' };
  }

  const weather = await fetchCurrentWeather(s.latitude, s.longitude);
  if (!weather) {
    return { error: 'Could not fetch weather' };
  }

  const severity = calculateConditionsSeverity(weather);
  const adjustment = calculatePaceAdjustment(
    paceSeconds,
    severity,
    workoutType,
    s.heatAcclimatizationScore || 50
  );

  return {
    original_pace: adjustment.originalPace,
    adjusted_pace: adjustment.adjustedPace,
    adjustment_seconds: adjustment.adjustmentSeconds,
    reason: adjustment.reason,
    recommendation: adjustment.recommendation,
    warnings: adjustment.warnings,
  };
}

async function logWorkout(input: Record<string, unknown>) {
  const now = new Date();
  const date = (input.date as string) || now.toISOString().split('T')[0];
  let distanceMiles = input.distance_miles as number | undefined;
  let durationMinutes = input.duration_minutes as number | undefined;
  const pacePerMile = input.pace_per_mile as string | undefined;
  const workoutType = (input.workout_type as WorkoutType) || 'easy';
  const shoeId = input.shoe_id as number | undefined;
  const routeName = input.route_name as string | undefined;
  const notes = input.notes as string | undefined;

  // Parse pace string "mm:ss" to seconds
  let paceSeconds: number | null = null;
  if (pacePerMile) {
    const parts = pacePerMile.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        paceSeconds = mins * 60 + secs;
      }
    }
  }

  // Validate: need at least two of (distance, duration, pace) to calculate the third
  const valuesProvided = [distanceMiles, durationMinutes, paceSeconds].filter(v => v !== undefined && v !== null).length;
  if (valuesProvided < 2 && !distanceMiles) {
    return {
      success: false,
      message: 'Please provide at least two of: distance, duration, or pace. For example: "5 miles in 45 minutes" or "30 minutes at 9:00 pace"',
    };
  }

  // Calculate missing values from the two provided values
  // Priority: calculate from what's given
  if (distanceMiles && durationMinutes) {
    // Both provided: calculate pace
    paceSeconds = calculatePace(distanceMiles, durationMinutes);
  } else if (durationMinutes && paceSeconds) {
    // Duration + pace: calculate distance
    // distance = duration (minutes) / (pace (seconds) / 60)
    distanceMiles = Math.round((durationMinutes / (paceSeconds / 60)) * 100) / 100;
  } else if (distanceMiles && paceSeconds) {
    // Distance + pace: calculate duration
    // duration = distance * pace (seconds) / 60
    durationMinutes = Math.round((distanceMiles * paceSeconds / 60) * 10) / 10;
  }

  // Final pace calculation if we have both distance and duration now
  const avgPaceSeconds = distanceMiles && durationMinutes
    ? calculatePace(distanceMiles, durationMinutes)
    : paceSeconds;

  // Check for duplicate workout (same date with similar distance/duration logged recently)
  // This prevents the AI from accidentally logging the same workout multiple times
  const existingWorkouts = await db.query.workouts.findMany({
    where: eq(workouts.date, date),
    orderBy: [desc(workouts.createdAt)],
    limit: 5,
  });

  for (const existing of existingWorkouts) {
    // Check if created within last 5 minutes (to catch duplicates from same conversation)
    const createdAt = new Date(existing.createdAt);
    const minutesAgo = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (minutesAgo < 5) {
      // Check if distance matches (within 0.1 miles tolerance)
      const distanceMatch = !distanceMiles || !existing.distanceMiles ||
        Math.abs(distanceMiles - existing.distanceMiles) < 0.1;

      // Check if duration matches (within 2 minutes tolerance)
      const durationMatch = !durationMinutes || !existing.durationMinutes ||
        Math.abs(durationMinutes - existing.durationMinutes) < 2;

      // Check if workout type matches
      const typeMatch = existing.workoutType === workoutType;

      if (distanceMatch && durationMatch && typeMatch) {
        // This looks like a duplicate - return the existing workout instead
        const paceStr = existing.avgPaceSeconds ? formatPace(existing.avgPaceSeconds) : '';
        return {
          success: true,
          workout_id: existing.id,
          message: `This workout was already logged (ID: ${existing.id}). No duplicate created.`,
          distance_miles: existing.distanceMiles,
          duration_minutes: existing.durationMinutes,
          pace: paceStr || null,
          already_existed: true,
        };
      }
    }
  }

  const [workout] = await db.insert(workouts).values({
    date,
    distanceMiles,
    durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
    avgPaceSeconds,
    workoutType,
    shoeId: shoeId || null,
    routeName: routeName || null,
    notes: notes || null,
    source: 'manual',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }).returning();

  // Update shoe mileage if provided
  if (shoeId && distanceMiles) {
    const [shoe] = await db.select().from(shoes).where(eq(shoes.id, shoeId));
    if (shoe) {
      await db.update(shoes)
        .set({ totalMiles: shoe.totalMiles + distanceMiles })
        .where(eq(shoes.id, shoeId));
    }
  }

  // Build informative message
  const durationStr = durationMinutes ? `${Math.round(durationMinutes)} min` : '';
  const distanceStr = distanceMiles ? `${distanceMiles} miles` : '';
  const paceStr = avgPaceSeconds ? formatPace(avgPaceSeconds) : '';

  const parts = [distanceStr, durationStr].filter(Boolean).join(', ');
  const message = `Workout logged: ${parts} ${workoutType} run on ${date}${paceStr ? ` @ ${paceStr}/mi pace` : ''}`;

  return {
    success: true,
    workout_id: workout.id,
    message,
    distance_miles: distanceMiles || null,
    duration_minutes: durationMinutes ? Math.round(durationMinutes) : null,
    pace: paceStr || null,
  };
}

async function logAssessment(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const verdict = input.verdict as Verdict;
  const rpe = input.rpe as number;

  const now = new Date().toISOString();

  // Check if assessment already exists
  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.workoutId, workoutId),
  });

  const assessmentData: Partial<NewAssessment> = {
    verdict,
    rpe,
    legsFeel: input.legs_feel as number | undefined ?? null,
    breathingFeel: input.breathing_feel as NewAssessment['breathingFeel'] | undefined ?? null,
    sleepQuality: input.sleep_quality as number | undefined ?? null,
    sleepHours: input.sleep_hours as number | undefined ?? null,
    stress: input.stress as number | undefined ?? null,
    soreness: input.soreness as number | undefined ?? null,
    hydration: input.hydration as number | undefined ?? null,
    note: input.note as string | undefined ?? null,
  };

  if (existing) {
    await db.update(assessments)
      .set(assessmentData)
      .where(eq(assessments.id, existing.id));

    return {
      success: true,
      message: 'Assessment updated',
    };
  }

  await db.insert(assessments).values({
    workoutId,
    ...assessmentData,
    verdict,
    rpe,
    wasIntendedWorkout: 'yes',
    issues: '[]',
    legsTags: '[]',
    lifeTags: '[]',
    hydrationTags: '[]',
    createdAt: now,
  } as NewAssessment);

  return {
    success: true,
    message: 'Assessment saved',
  };
}

async function getTrainingSummary(input: Record<string, unknown>) {
  const days = (input.days as number) || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  const totalMiles = recentWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = recentWorkouts.length;

  const typeDistribution: Record<string, number> = {};
  recentWorkouts.forEach((w: WorkoutWithRelations) => {
    typeDistribution[w.workoutType] = (typeDistribution[w.workoutType] || 0) + 1;
  });

  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment);
  const avgRpe = assessedWorkouts.length > 0
    ? assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length
    : null;

  const verdictCounts: Record<string, number> = {};
  assessedWorkouts.forEach((w: WorkoutWithRelations) => {
    if (w.assessment?.verdict) {
      verdictCounts[w.assessment.verdict] = (verdictCounts[w.assessment.verdict] || 0) + 1;
    }
  });

  const avgSleep = assessedWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepHours).length > 0
    ? assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.sleepHours || 0), 0) /
      assessedWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepHours).length
    : null;

  return {
    period_days: days,
    total_miles: Math.round(totalMiles * 10) / 10,
    total_runs: totalRuns,
    runs_per_week: Math.round((totalRuns / days) * 7 * 10) / 10,
    miles_per_run: totalRuns > 0 ? Math.round((totalMiles / totalRuns) * 10) / 10 : 0,
    workout_type_distribution: typeDistribution,
    average_rpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
    verdict_distribution: verdictCounts,
    average_sleep_hours: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
  };
}

async function searchWorkouts(input: Record<string, unknown>) {
  const query = input.query as string | undefined;
  const dateFrom = input.date_from as string | undefined;
  const dateTo = input.date_to as string | undefined;

  let results: WorkoutWithRelations[] = await db.query.workouts.findMany({
    with: {
      shoe: true,
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
    limit: 20,
  });

  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter((w: WorkoutWithRelations) =>
      (w.notes?.toLowerCase().includes(lowerQuery)) ||
      (w.routeName?.toLowerCase().includes(lowerQuery))
    );
  }

  if (dateFrom) {
    results = results.filter((w: WorkoutWithRelations) => w.date >= dateFrom);
  }

  if (dateTo) {
    results = results.filter((w: WorkoutWithRelations) => w.date <= dateTo);
  }

  return results.map((w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    workout_type: w.workoutType,
    route_name: w.routeName,
    notes: w.notes,
    verdict: w.assessment?.verdict,
  }));
}

function formatPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Outfit-related tool implementations

async function getOutfitRecommendationTool(input: Record<string, unknown>) {
  const distanceMiles = (input.distance_miles as number) || 5;
  const workoutType = (input.workout_type as WorkoutType) || 'easy';
  const overrideTemp = input.feels_like_temp as number | undefined;

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  let feelsLikeTemp: number;
  let weatherData: { temperature: number; feelsLike: number; humidity: number; windSpeed: number; weatherCode: number; condition: WeatherCondition; conditionText: string } | null = null;

  if (overrideTemp !== undefined) {
    feelsLikeTemp = overrideTemp;
    weatherData = {
      temperature: overrideTemp,
      feelsLike: overrideTemp,
      humidity: 50,
      windSpeed: 5,
      weatherCode: 0,
      condition: 'clear',
      conditionText: 'Clear',
    };
  } else {
    if (!s?.latitude || !s?.longitude) {
      return { error: 'No location configured. Please set location in settings or provide feels_like_temp.' };
    }

    const weather = await fetchCurrentWeather(s.latitude, s.longitude);
    if (!weather) {
      return { error: 'Could not fetch weather' };
    }
    feelsLikeTemp = weather.feelsLike;
    weatherData = {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      weatherCode: weather.weatherCode,
      condition: weather.condition,
      conditionText: weather.conditionText,
    };
  }

  const temperaturePreference = (s?.temperaturePreference as TemperaturePreference) || 'neutral';

  const vt = calculateVibesTemp(feelsLikeTemp, workoutType, distanceMiles, temperaturePreference);
  const recommendation = getOutfitRecommendation(vt, weatherData!, workoutType);

  // Get wardrobe items to match
  const wardrobe = await db.select().from(clothingItems).where(eq(clothingItems.isActive, true));
  const matchedItems = matchWardrobeItems(recommendation, wardrobe);

  return {
    vibes_temp: vt.vibesTemp,
    vt_breakdown: vt.breakdown,
    weather: weatherData,
    workout_type: workoutType,
    distance_miles: distanceMiles,
    recommendation: {
      top: {
        suggestion: recommendation.top.recommendation,
        your_items: matchedItems.top.map(i => i.name),
        note: recommendation.top.note,
      },
      bottom: {
        suggestion: recommendation.bottom.recommendation,
        your_items: matchedItems.bottom.map(i => i.name),
        note: recommendation.bottom.note,
      },
      gloves: recommendation.gloves.categories.length > 0 ? {
        suggestion: recommendation.gloves.recommendation,
        your_items: matchedItems.gloves.map(i => i.name),
        note: recommendation.gloves.note,
      } : null,
      headwear: vt.vibesTemp < 30 ? {
        suggestion: recommendation.headwear.recommendation,
        your_items: matchedItems.headwear.map(i => i.name),
        note: recommendation.headwear.note,
      } : null,
      add_ons: recommendation.addOns.shell || recommendation.addOns.buff ? {
        shell: recommendation.addOns.shell,
        buff: recommendation.addOns.buff,
        notes: recommendation.addOns.notes,
      } : null,
    },
    tips: recommendation.warmUpNotes,
    summary: recommendation.summary,
  };
}

async function getWardrobe(input: Record<string, unknown>) {
  const includeInactive = input.include_inactive as boolean || false;

  let items: ClothingItem[] = await db.select().from(clothingItems);

  if (!includeInactive) {
    items = items.filter((i: ClothingItem) => i.isActive);
  }

  // Group by category type
  const grouped: Record<string, Array<{ id: number; name: string; warmth: number; notes: string | null }>> = {};

  for (const item of items) {
    const group = getCategoryLabel(item.category as ClothingCategory);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({
      id: item.id,
      name: item.name,
      warmth: item.warmthRating,
      notes: item.notes,
    });
  }

  return {
    total_items: items.length,
    items_by_category: grouped,
  };
}

async function addClothingItem(input: Record<string, unknown>) {
  const name = input.name as string;
  const category = input.category as ClothingCategory;
  const warmthRating = Math.min(5, Math.max(1, input.warmth_rating as number));
  const notes = input.notes as string | undefined;

  const now = new Date().toISOString();

  const [item] = await db.insert(clothingItems).values({
    name,
    category,
    warmthRating,
    notes: notes || null,
    isActive: true,
    createdAt: now,
  }).returning();

  return {
    success: true,
    message: `Added "${name}" to your wardrobe`,
    item: {
      id: item.id,
      name: item.name,
      category: getCategoryLabel(item.category as ClothingCategory),
      warmth_rating: item.warmthRating,
    },
  };
}

async function logOutfitFeedback(input: Record<string, unknown>) {
  let workoutId = input.workout_id as number | undefined;
  const outfitRating = input.outfit_rating as OutfitRating;
  const handsRating = input.hands_rating as ExtremityRating | undefined;
  const faceRating = input.face_rating as ExtremityRating | undefined;
  const removedLayers = input.removed_layers as string | undefined;

  // If no workout ID, get the most recent workout
  if (!workoutId) {
    const recentWorkout = await db.query.workouts.findFirst({
      orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    });

    if (!recentWorkout) {
      return { error: 'No workouts found to add feedback to' };
    }
    workoutId = recentWorkout.id;
  }

  // Check if assessment exists (workoutId is definitely defined at this point)
  const targetWorkoutId = workoutId as number;
  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.workoutId, targetWorkoutId),
  });

  if (existing) {
    await db.update(assessments)
      .set({
        outfitRating,
        handsRating: handsRating || null,
        faceRating: faceRating || null,
        removedLayers: removedLayers || null,
      })
      .where(eq(assessments.id, existing.id));

    return {
      success: true,
      message: `Outfit feedback saved: ${outfitRating.replace('_', ' ')}`,
      workout_id: workoutId,
    };
  }

  // Create a minimal assessment if none exists
  const now = new Date().toISOString();
  await db.insert(assessments).values({
    workoutId,
    verdict: 'fine',
    rpe: 5,
    wasIntendedWorkout: 'yes',
    issues: '[]',
    legsTags: '[]',
    lifeTags: '[]',
    hydrationTags: '[]',
    outfitRating,
    handsRating: handsRating || null,
    faceRating: faceRating || null,
    removedLayers: removedLayers || null,
    createdAt: now,
  });

  return {
    success: true,
    message: `Outfit feedback saved: ${outfitRating.replace('_', ' ')}`,
    workout_id: workoutId,
    note: 'Created a basic assessment for this workout. You can add more details later.',
  };
}

// Training Plan Tool Implementations

async function getTodaysWorkout() {
  const { plannedWorkouts, trainingBlocks } = await import('@/lib/db');

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return {
      has_workout: false,
      message: 'No planned workout for today. Rest day or no active training plan.',
    };
  }

  // Get the training block for phase info
  let block = null;
  if (workout.trainingBlockId) {
    block = await db.query.trainingBlocks.findFirst({
      where: eq(trainingBlocks.id, workout.trainingBlockId),
    });
  }

  // Get weather for pace adjustment context
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  let weatherContext = null;

  if (s?.latitude && s?.longitude) {
    const weather = await fetchCurrentWeather(s.latitude, s.longitude);
    if (weather) {
      const severity = calculateConditionsSeverity(weather);
      weatherContext = {
        feels_like_f: weather.feelsLike,
        humidity: weather.humidity,
        severity_score: severity.severityScore,
        should_adjust_pace: severity.severityScore > 30,
      };
    }
  }

  return {
    has_workout: true,
    workout: {
      name: workout.name,
      description: workout.description,
      workout_type: workout.workoutType,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace: workout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(workout.targetPaceSecondsPerMile)
        : null,
      is_key_workout: workout.isKeyWorkout,
      rationale: workout.rationale,
      alternatives: workout.alternatives ? JSON.parse(workout.alternatives) : null,
      status: workout.status,
    },
    phase: block?.phase || null,
    phase_focus: block?.focus || null,
    weather_context: weatherContext,
  };
}

async function getWeeklyPlan() {
  const { plannedWorkouts, trainingBlocks } = await import('@/lib/db');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get the Monday of this week
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - daysToMonday);
  const mondayStr = monday.toISOString().split('T')[0];

  // Get the Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sundayStr = sunday.toISOString().split('T')[0];

  // Get workouts for this week
  const weekWorkouts: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, mondayStr),
      lte(plannedWorkouts.date, sundayStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (weekWorkouts.length === 0) {
    return {
      has_plan: false,
      message: 'No training plan for this week.',
    };
  }

  // Get current training block
  const currentBlock = await db.query.trainingBlocks.findFirst({
    where: and(
      lte(trainingBlocks.startDate, todayStr),
      gte(trainingBlocks.endDate, todayStr)
    ),
  });

  const totalMiles = weekWorkouts.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0);
  const completedMiles = weekWorkouts
    .filter((w: PlannedWorkout) => w.status === 'completed')
    .reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0);

  return {
    has_plan: true,
    week_start: mondayStr,
    week_end: sundayStr,
    phase: currentBlock?.phase || null,
    focus: currentBlock?.focus || null,
    target_mileage: totalMiles,
    completed_mileage: completedMiles,
    workouts: weekWorkouts.map(w => ({
      date: w.date,
      day: new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      name: w.name,
      workout_type: w.workoutType,
      target_miles: w.targetDistanceMiles,
      target_pace: w.targetPaceSecondsPerMile
        ? formatPaceFromTraining(w.targetPaceSecondsPerMile)
        : null,
      is_key: w.isKeyWorkout,
      status: w.status,
      is_today: w.date === todayStr,
    })),
  };
}

async function getPaceZones() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s?.vdot) {
    return {
      has_zones: false,
      message: 'No pace zones set. Add a race result to calculate your VDOT and pace zones.',
    };
  }

  const zones = calculatePaceZones(s.vdot);

  return {
    has_zones: true,
    vdot: s.vdot,
    zones: {
      easy: {
        pace: formatPaceFromTraining(zones.easy),
        description: 'Conversational pace. Should feel comfortable and sustainable.',
      },
      marathon: {
        pace: formatPaceFromTraining(zones.marathon),
        description: 'Marathon race pace. Steady, focused effort.',
      },
      half_marathon: {
        pace: formatPaceFromTraining(zones.halfMarathon),
        description: 'Half marathon race pace. Comfortably hard.',
      },
      tempo: {
        pace: formatPaceFromTraining(zones.tempo),
        description: 'Tempo pace. Sustainable for 40-60 minutes. Controlled discomfort.',
      },
      threshold: {
        pace: formatPaceFromTraining(zones.threshold),
        description: 'Lactate threshold. Can speak in short sentences.',
      },
      interval: {
        pace: formatPaceFromTraining(zones.interval),
        description: 'VO2max intervals. Hard but controlled. 3-5 min efforts.',
      },
      repetition: {
        pace: formatPaceFromTraining(zones.repetition),
        description: 'Fast repeats. 200-400m efforts with full recovery.',
      },
    },
  };
}

async function getUserProfile() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return {
      has_profile: false,
      message: 'No user profile found. User needs to complete onboarding.',
      missing_fields: ['all'],
    };
  }

  // Check what's missing
  const missingFields: string[] = [];
  if (!s.name) missingFields.push('name');
  if (!s.currentWeeklyMileage) missingFields.push('current_weekly_mileage');
  if (!s.runsPerWeekCurrent) missingFields.push('runs_per_week');
  if (!s.vdot) missingFields.push('vdot (add a race result)');
  if (!s.preferredLongRunDay) missingFields.push('preferred_long_run_day');
  if (!s.latitude) missingFields.push('location');

  return {
    has_profile: true,
    onboarding_completed: s.onboardingCompleted || false,
    name: s.name,
    // Training background
    current_weekly_mileage: s.currentWeeklyMileage,
    runs_per_week: s.runsPerWeekCurrent,
    current_long_run_max: s.currentLongRunMax,
    years_running: s.yearsRunning,
    // Goals
    peak_weekly_mileage_target: s.peakWeeklyMileageTarget,
    runs_per_week_target: s.runsPerWeekTarget,
    // Preferences
    preferred_long_run_day: s.preferredLongRunDay,
    preferred_quality_days: s.preferredQualityDays ? JSON.parse(s.preferredQualityDays) : null,
    required_rest_days: s.requiredRestDays ? JSON.parse(s.requiredRestDays) : null,
    plan_aggressiveness: s.planAggressiveness,
    quality_sessions_per_week: s.qualitySessionsPerWeek,
    // Fitness
    vdot: s.vdot,
    heat_acclimatization_score: s.heatAcclimatizationScore,
    // Health/context
    injury_history: s.injuryHistory,
    current_injuries: s.currentInjuries,
    coach_context: s.coachContext,
    // Missing
    missing_fields: missingFields.length > 0 ? missingFields : null,
  };
}

async function updateUserProfile(input: Record<string, unknown>) {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { error: 'No user profile found' };
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  // Map input fields to database fields
  if (input.name !== undefined) updates.name = input.name;
  if (input.current_weekly_mileage !== undefined) updates.currentWeeklyMileage = input.current_weekly_mileage;
  if (input.runs_per_week !== undefined) {
    updates.runsPerWeekCurrent = input.runs_per_week;
    updates.runsPerWeekTarget = input.runs_per_week;
  }
  if (input.preferred_long_run_day !== undefined) updates.preferredLongRunDay = input.preferred_long_run_day;
  if (input.preferred_quality_days !== undefined) {
    updates.preferredQualityDays = JSON.stringify(input.preferred_quality_days);
  }
  if (input.plan_aggressiveness !== undefined) updates.planAggressiveness = input.plan_aggressiveness;
  if (input.injury_history !== undefined) updates.injuryHistory = input.injury_history;
  if (input.current_injuries !== undefined) updates.currentInjuries = input.current_injuries;
  if (input.coach_context !== undefined) updates.coachContext = input.coach_context;

  await db.update(userSettings)
    .set(updates)
    .where(eq(userSettings.id, s.id));

  return {
    success: true,
    message: 'Profile updated',
    updated_fields: Object.keys(updates).filter(k => k !== 'updatedAt'),
  };
}

async function getRaces(input: Record<string, unknown>) {
  const includePast = input.include_past as boolean || false;
  const today = new Date().toISOString().split('T')[0];

  const allRaces: Race[] = await db.query.races.findMany({
    orderBy: [asc(races.date)],
  });

  const filteredRaces = includePast
    ? allRaces
    : allRaces.filter((r: Race) => r.date >= today);

  if (filteredRaces.length === 0) {
    return {
      has_races: false,
      message: 'No upcoming races.',
    };
  }

  return {
    has_races: true,
    races: filteredRaces.map(r => {
      const raceDate = new Date(r.date);
      const todayDate = new Date(today);
      const daysUntil = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        name: r.name,
        date: r.date,
        distance: r.distanceLabel,
        priority: r.priority,
        days_until: daysUntil,
        is_past: r.date < today,
        target_time: r.targetTimeSeconds ? formatTimeFromSeconds(r.targetTimeSeconds) : null,
        has_training_plan: r.trainingPlanGenerated,
      };
    }),
  };
}

async function addRace(input: Record<string, unknown>) {
  const name = input.name as string;
  const date = input.date as string;
  const distance = input.distance as string;
  const priority = input.priority as RacePriority;
  const targetTime = input.target_time as string | undefined;
  const location = input.location as string | undefined;

  // Parse target time if provided
  let targetTimeSeconds: number | null = null;
  if (targetTime) {
    targetTimeSeconds = parseTimeToSeconds(targetTime);
  }

  // Get distance in meters
  const distanceInfo = RACE_DISTANCES[distance];
  const distanceMeters = distanceInfo?.meters || 0;

  const now = new Date().toISOString();

  const [race] = await db.insert(races).values({
    name,
    date,
    distanceMeters,
    distanceLabel: distance,
    priority,
    targetTimeSeconds,
    targetPaceSecondsPerMile: targetTimeSeconds && distanceInfo
      ? Math.round(targetTimeSeconds / distanceInfo.miles)
      : null,
    location: location || null,
    notes: null,
    trainingPlanGenerated: false,
    createdAt: now,
    updatedAt: now,
  }).returning();

  const raceDate = new Date(date);
  const today = new Date();
  const daysUntil = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const weeksUntil = Math.ceil(daysUntil / 7);

  return {
    success: true,
    message: `Added ${name} (${distance}) on ${date}`,
    race_id: race.id,
    days_until: daysUntil,
    weeks_until: weeksUntil,
    note: daysUntil > 42
      ? 'Consider generating a training plan for this race.'
      : daysUntil > 14
      ? 'Not enough time for a full training block, but I can help plan your taper.'
      : 'Race is coming up soon! Focus on rest and final preparations.',
  };
}

async function addRaceResult(input: Record<string, unknown>) {
  const raceName = input.race_name as string | undefined;
  const date = input.date as string;
  const distance = input.distance as string;
  const finishTime = input.finish_time as string;
  const effortLevel = (input.effort_level as 'all_out' | 'hard' | 'moderate' | 'easy') || 'all_out';
  const conditions = input.conditions as string | undefined;
  const notes = input.notes as string | undefined;

  // Parse finish time
  const finishTimeSeconds = parseTimeToSeconds(finishTime);
  if (!finishTimeSeconds) {
    return { error: 'Invalid finish time format. Use H:MM:SS or MM:SS.' };
  }

  // Get distance in meters
  const distanceInfo = RACE_DISTANCES[distance];
  const distanceMeters = distanceInfo?.meters || 0;

  // Calculate VDOT
  const calculatedVdot = calculateVDOT(distanceMeters, finishTimeSeconds);

  const now = new Date().toISOString();

  await db.insert(raceResults).values({
    raceName: raceName || null,
    date,
    distanceMeters,
    distanceLabel: distance,
    finishTimeSeconds,
    calculatedVdot,
    effortLevel,
    conditions: conditions || null,
    notes: notes || null,
    createdAt: now,
  });

  // Update user's VDOT and pace zones
  await updateUserVDOTFromResult(calculatedVdot, effortLevel);

  const zones = calculatePaceZones(calculatedVdot);

  return {
    success: true,
    message: `Race result logged: ${distance} in ${finishTime}`,
    calculated_vdot: calculatedVdot,
    new_pace_zones: {
      easy: formatPaceFromTraining(zones.easy),
      tempo: formatPaceFromTraining(zones.tempo),
      interval: formatPaceFromTraining(zones.interval),
    },
    note: effortLevel !== 'all_out'
      ? 'Note: Since this wasn\'t an all-out effort, your true fitness may be higher.'
      : 'VDOT and pace zones have been updated based on this result.',
  };
}

async function modifyTodaysWorkout(input: Record<string, unknown>) {
  const { plannedWorkouts } = await import('@/lib/db');

  const action = input.action as 'scale_down' | 'skip' | 'mark_complete';
  const scaleFactor = (input.scale_factor as number) || 0.75;
  const reason = input.reason as string | undefined;

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return { error: 'No planned workout for today.' };
  }

  const now = new Date().toISOString();

  switch (action) {
    case 'scale_down':
      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: workout.targetDistanceMiles
            ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
            : null,
          targetDurationMinutes: workout.targetDurationMinutes
            ? Math.round(workout.targetDurationMinutes * scaleFactor)
            : null,
          rationale: `${workout.rationale || ''} (Scaled to ${Math.round(scaleFactor * 100)}%${reason ? ': ' + reason : ''})`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      return {
        success: true,
        message: `Workout scaled to ${Math.round(scaleFactor * 100)}%`,
        new_distance: workout.targetDistanceMiles
          ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
          : null,
      };

    case 'skip':
      await db.update(plannedWorkouts)
        .set({
          status: 'skipped',
          rationale: `${workout.rationale || ''} (Skipped${reason ? ': ' + reason : ''})`,
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      return {
        success: true,
        message: 'Workout marked as skipped',
        note: 'Listen to your body. We\'ll adjust the plan as needed.',
      };

    case 'mark_complete':
      await db.update(plannedWorkouts)
        .set({
          status: 'completed',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      return {
        success: true,
        message: 'Workout marked as complete!',
      };

    default:
      return { error: 'Unknown action' };
  }
}

// Helper functions

async function updateUserVDOTFromResult(newVdot: number, effortLevel: string) {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) return;

  // Only update if this is a better VDOT and was an all-out or hard effort
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

function parseTimeToSeconds(time: string): number | null {
  // Handle H:MM:SS or MM:SS format
  const parts = time.split(':').map(p => parseInt(p, 10));

  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    // H:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }

  return null;
}

function formatTimeFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function getPlanAdherence(input: Record<string, unknown>) {
  const { plannedWorkouts } = await import('@/lib/db');
  const weeksBack = (input.weeks_back as number) || 4;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get date range for analysis
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeksBack * 7));
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all workouts in the period (past only)
  const periodWorkouts: PlannedWorkout[] = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startDateStr),
      lte(plannedWorkouts.date, todayStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (periodWorkouts.length === 0) {
    return {
      has_data: false,
      message: 'No planned workouts in this period.',
    };
  }

  // Calculate adherence stats
  const completed = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'completed');
  const skipped = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'skipped');
  const modified = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'modified');
  const pending = periodWorkouts.filter((w: PlannedWorkout) => w.status === 'scheduled' || w.status === null);

  const adherenceRate = Math.round((completed.length / periodWorkouts.length) * 100);

  // Analyze patterns
  const keyWorkouts = periodWorkouts.filter((w: PlannedWorkout) => w.isKeyWorkout);
  const keyCompleted = keyWorkouts.filter((w: PlannedWorkout) => w.status === 'completed');
  const keyAdherence = keyWorkouts.length > 0
    ? Math.round((keyCompleted.length / keyWorkouts.length) * 100)
    : null;

  // Check for concerning patterns
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Multiple skips in a row
  let consecutiveSkips = 0;
  let maxConsecutiveSkips = 0;
  for (const workout of periodWorkouts) {
    if (workout.status === 'skipped') {
      consecutiveSkips++;
      maxConsecutiveSkips = Math.max(maxConsecutiveSkips, consecutiveSkips);
    } else {
      consecutiveSkips = 0;
    }
  }

  if (maxConsecutiveSkips >= 3) {
    concerns.push(`Skipped ${maxConsecutiveSkips} workouts in a row - may indicate burnout or life stress`);
    recommendations.push('Consider reducing weekly volume temporarily');
  }

  // Missing key workouts
  if (keyAdherence !== null && keyAdherence < 70) {
    concerns.push(`Only completed ${keyAdherence}% of key workouts`);
    recommendations.push('Key workouts are most important for fitness gains - prioritize these');
  }

  // Low overall adherence
  if (adherenceRate < 60) {
    concerns.push(`Overall adherence at ${adherenceRate}% is below recommended 80%`);
    recommendations.push('The plan may be too aggressive - consider reducing weekly mileage target');
  }

  // Skipping pattern by day of week
  const skipsByDay: Record<string, number> = {};
  for (const workout of skipped) {
    const dayOfWeek = new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    skipsByDay[dayOfWeek] = (skipsByDay[dayOfWeek] || 0) + 1;
  }

  const mostSkippedDay = Object.entries(skipsByDay).sort((a, b) => b[1] - a[1])[0];
  if (mostSkippedDay && mostSkippedDay[1] >= 2) {
    concerns.push(`${mostSkippedDay[0]} workouts frequently skipped (${mostSkippedDay[1]} times)`);
    recommendations.push(`Consider moving workouts away from ${mostSkippedDay[0]} or making them optional`);
  }

  // Good adherence congratulations
  const positives: string[] = [];
  if (adherenceRate >= 90) {
    positives.push('Excellent adherence! Consistency is paying off.');
  } else if (adherenceRate >= 80) {
    positives.push('Strong adherence rate - keep it up!');
  }

  if (keyAdherence && keyAdherence >= 90) {
    positives.push('Great job prioritizing key workouts.');
  }

  return {
    has_data: true,
    period: {
      start: startDateStr,
      end: todayStr,
      weeks: weeksBack,
    },
    stats: {
      total_workouts: periodWorkouts.length,
      completed: completed.length,
      skipped: skipped.length,
      modified: modified.length,
      pending: pending.length,
      adherence_rate: adherenceRate,
      key_workout_adherence: keyAdherence,
    },
    analysis: {
      concerns: concerns.length > 0 ? concerns : null,
      recommendations: recommendations.length > 0 ? recommendations : null,
      positives: positives.length > 0 ? positives : null,
    },
    by_workout_type: groupByWorkoutType(periodWorkouts),
  };
}

function groupByWorkoutType(workouts: Array<{ workoutType: string; status: string | null }>) {
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

// ==================== Readiness & Performance Tools ====================

async function getReadinessScore() {
  // Get recent workouts with assessments
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  // Calculate components
  let score = 100;
  const factors: Array<{ factor: string; impact: number; note: string }> = [];

  // 1. Training Load (recent mileage compared to typical)
  const last7DaysMiles = recentWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0);
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const weeklyTarget = s?.currentWeeklyMileage || 25;

  if (last7DaysMiles > weeklyTarget * 1.3) {
    const impact = -15;
    score += impact;
    factors.push({ factor: 'High training load', impact, note: `${Math.round(last7DaysMiles)} miles this week (${Math.round((last7DaysMiles / weeklyTarget) * 100)}% of typical)` });
  } else if (last7DaysMiles < weeklyTarget * 0.5) {
    const impact = 10;
    score += impact;
    factors.push({ factor: 'Light training load', impact, note: 'Well rested from reduced volume' });
  }

  // 2. Recent RPE trend
  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.rpe);
  if (assessedWorkouts.length >= 2) {
    const avgRpe = assessedWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length;
    if (avgRpe > 7.5) {
      const impact = -10;
      score += impact;
      factors.push({ factor: 'High perceived effort', impact, note: `Average RPE of ${avgRpe.toFixed(1)} recently` });
    } else if (avgRpe < 5) {
      const impact = 5;
      score += impact;
      factors.push({ factor: 'Low perceived effort', impact, note: 'Workouts feeling manageable' });
    }
  }

  // 3. Sleep quality
  const sleepWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment?.sleepQuality);
  if (sleepWorkouts.length >= 2) {
    const avgSleep = sleepWorkouts.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.assessment?.sleepQuality || 0), 0) / sleepWorkouts.length;
    if (avgSleep < 5) {
      const impact = -15;
      score += impact;
      factors.push({ factor: 'Poor sleep quality', impact, note: `Average sleep quality ${avgSleep.toFixed(1)}/10` });
    } else if (avgSleep >= 8) {
      const impact = 10;
      score += impact;
      factors.push({ factor: 'Good sleep quality', impact, note: 'Well rested' });
    }
  }

  // 4. Soreness
  const sorenessWorkouts = recentWorkouts.filter(w => w.assessment?.soreness);
  if (sorenessWorkouts.length > 0) {
    const latestSoreness = sorenessWorkouts[0].assessment?.soreness || 0;
    if (latestSoreness > 7) {
      const impact = -20;
      score += impact;
      factors.push({ factor: 'High soreness', impact, note: `Soreness level ${latestSoreness}/10` });
    } else if (latestSoreness <= 3) {
      const impact = 5;
      score += impact;
      factors.push({ factor: 'Low soreness', impact, note: 'Muscles feeling fresh' });
    }
  }

  // 5. Stress
  const stressWorkouts = recentWorkouts.filter(w => w.assessment?.stress);
  if (stressWorkouts.length > 0) {
    const latestStress = stressWorkouts[0].assessment?.stress || 0;
    if (latestStress > 7) {
      const impact = -10;
      score += impact;
      factors.push({ factor: 'High stress', impact, note: `Stress level ${latestStress}/10` });
    }
  }

  // 6. Verdict trend (rough/awful workouts)
  const roughWorkouts = recentWorkouts.filter(w =>
    w.assessment?.verdict === 'rough' || w.assessment?.verdict === 'awful'
  );
  if (roughWorkouts.length >= 2) {
    const impact = -15;
    score += impact;
    factors.push({ factor: 'Recent tough workouts', impact, note: `${roughWorkouts.length} rough/awful workouts in the past week` });
  }

  // 7. Days since last rest
  const workoutDates = recentWorkouts.map(w => w.date).sort().reverse();
  if (workoutDates.length >= 7) {
    // Ran every day for a week
    const impact = -10;
    score += impact;
    factors.push({ factor: 'No recent rest days', impact, note: 'Consider a rest day' });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Generate recommendation
  let recommendation: string;
  let suggestedWorkout: string;

  if (score >= 80) {
    recommendation = 'You are well-rested and ready for a hard effort.';
    suggestedWorkout = 'Good day for a key workout or tempo run.';
  } else if (score >= 60) {
    recommendation = 'Moderate readiness. A normal training day should be fine.';
    suggestedWorkout = 'Stick to the plan, but listen to your body.';
  } else if (score >= 40) {
    recommendation = 'Readiness is lower than ideal. Consider scaling back.';
    suggestedWorkout = 'Easy run or consider a rest day.';
  } else {
    recommendation = 'Low readiness. Recovery should be the priority.';
    suggestedWorkout = 'Rest day or very light recovery jog.';
  }

  return {
    score,
    label: score >= 80 ? 'Ready to Go' : score >= 60 ? 'Moderate' : score >= 40 ? 'Caution' : 'Rest Needed',
    factors,
    recommendation,
    suggested_workout: suggestedWorkout,
    recent_stats: {
      workouts_last_7_days: recentWorkouts.length,
      miles_last_7_days: Math.round(last7DaysMiles * 10) / 10,
    },
  };
}

async function predictRaceTime(input: Record<string, unknown>) {
  const distance = input.distance as string;
  const conditions = (input.conditions as string) || 'ideal';

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s?.vdot) {
    return {
      error: 'No VDOT available. Add a race result to get predictions.',
      suggestion: 'Tell me about a recent race so I can calculate your VDOT.',
    };
  }

  const distanceInfo = RACE_DISTANCES[distance];
  if (!distanceInfo) {
    return { error: 'Unknown distance' };
  }

  // Base prediction from VDOT
  // Using Jack Daniels formula approximation
  const vdot = s.vdot;

  // Approximate race pace in seconds per mile based on VDOT and distance
  // This is a simplified version of the Daniels formula
  let predictedPacePerMile: number;

  if (distance === '5K') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 0.95;
  } else if (distance === '10K') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles;
  } else if (distance === 'half_marathon') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.06;
  } else if (distance === 'marathon') {
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.12;
  } else {
    // For other distances, interpolate
    predictedPacePerMile = (29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot) * 60 / distanceInfo.miles * 1.02;
  }

  let predictedTimeSeconds = Math.round(predictedPacePerMile * distanceInfo.miles);

  // Apply conditions adjustments
  let conditionsNote = '';
  if (conditions === 'warm') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.03);
    conditionsNote = 'Added ~3% for warm conditions';
  } else if (conditions === 'hot') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.08);
    conditionsNote = 'Added ~8% for hot conditions';
  } else if (conditions === 'cold') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 0.99);
    conditionsNote = 'Slightly faster in cool conditions';
  } else if (conditions === 'hilly') {
    predictedTimeSeconds = Math.round(predictedTimeSeconds * 1.05);
    conditionsNote = 'Added ~5% for hilly course';
  }

  const predictedPace = Math.round(predictedTimeSeconds / distanceInfo.miles);

  // Calculate range (conservative to aggressive)
  const conservativeTime = Math.round(predictedTimeSeconds * 1.03);
  const aggressiveTime = Math.round(predictedTimeSeconds * 0.98);

  return {
    distance: distanceInfo.label,
    predicted_time: formatTimeFromSeconds(predictedTimeSeconds),
    predicted_pace: formatPaceFromTraining(predictedPace) + '/mi',
    range: {
      conservative: formatTimeFromSeconds(conservativeTime),
      aggressive: formatTimeFromSeconds(aggressiveTime),
    },
    based_on_vdot: vdot,
    conditions_adjustment: conditionsNote || 'None (ideal conditions)',
    confidence_note: 'Predictions are based on current VDOT. Actual performance depends on race-day execution, pacing, and conditions.',
  };
}

async function analyzeWorkoutPatterns(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 8;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const periodWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  if (periodWorkouts.length < 5) {
    return {
      has_data: false,
      message: 'Not enough workout data for analysis. Need at least 5 workouts.',
    };
  }

  // Analyze by workout type
  const byType: Record<string, {
    count: number;
    totalMiles: number;
    avgPace: number;
    avgRpe: number;
    verdicts: Record<string, number>;
  }> = {};

  for (const w of periodWorkouts) {
    if (!byType[w.workoutType]) {
      byType[w.workoutType] = { count: 0, totalMiles: 0, avgPace: 0, avgRpe: 0, verdicts: {} };
    }
    byType[w.workoutType].count++;
    byType[w.workoutType].totalMiles += w.distanceMiles || 0;
    if (w.avgPaceSeconds) byType[w.workoutType].avgPace += w.avgPaceSeconds;
    if (w.assessment?.rpe) byType[w.workoutType].avgRpe += w.assessment.rpe;
    if (w.assessment?.verdict) {
      byType[w.workoutType].verdicts[w.assessment.verdict] =
        (byType[w.workoutType].verdicts[w.assessment.verdict] || 0) + 1;
    }
  }

  // Calculate averages
  const typeAnalysis = Object.entries(byType).map(([type, data]) => {
    const workoutsWithPace = periodWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === type && w.avgPaceSeconds).length;
    const workoutsWithRpe = periodWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === type && w.assessment?.rpe).length;

    return {
      type,
      count: data.count,
      total_miles: Math.round(data.totalMiles * 10) / 10,
      avg_pace: workoutsWithPace > 0 ? formatPaceFromTraining(Math.round(data.avgPace / workoutsWithPace)) : null,
      avg_rpe: workoutsWithRpe > 0 ? Math.round((data.avgRpe / workoutsWithRpe) * 10) / 10 : null,
      most_common_verdict: Object.entries(data.verdicts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
  });

  // Weekly mileage trend
  const weeklyMileage: Array<{ week: string; miles: number }> = [];
  const weekMap = new Map<string, number>();

  for (const w of periodWorkouts) {
    const weekStart = getWeekStart(new Date(w.date + 'T00:00:00'));
    const existing = weekMap.get(weekStart) || 0;
    weekMap.set(weekStart, existing + (w.distanceMiles || 0));
  }

  weekMap.forEach((miles, week) => {
    weeklyMileage.push({ week, miles: Math.round(miles * 10) / 10 });
  });
  weeklyMileage.sort((a, b) => a.week.localeCompare(b.week));

  // Identify trends
  const insights: string[] = [];

  // Check if mileage is increasing
  if (weeklyMileage.length >= 3) {
    const recent3 = weeklyMileage.slice(-3);
    if (recent3[2].miles > recent3[0].miles * 1.15) {
      insights.push('Mileage has been increasing - good progression!');
    } else if (recent3[2].miles < recent3[0].miles * 0.85) {
      insights.push('Mileage has decreased recently - intentional taper or reduction?');
    }
  }

  // Check easy run pacing
  const easyRuns = typeAnalysis.find(t => t.type === 'easy');
  if (easyRuns && easyRuns.avg_rpe && easyRuns.avg_rpe > 5) {
    insights.push('Easy runs may be too hard (avg RPE > 5). Try slowing down.');
  }

  // Check for variety
  const workoutTypes = typeAnalysis.length;
  if (workoutTypes <= 2) {
    insights.push('Consider adding more workout variety (tempo, intervals, hills).');
  }

  // Check long run consistency
  const longRuns = typeAnalysis.find(t => t.type === 'long');
  if (longRuns && longRuns.count < weeksBack * 0.5) {
    insights.push('Long runs are inconsistent. Aim for weekly long runs.');
  }

  return {
    has_data: true,
    period: {
      weeks: weeksBack,
      total_workouts: periodWorkouts.length,
      total_miles: Math.round(periodWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
    },
    by_workout_type: typeAnalysis,
    weekly_mileage: weeklyMileage,
    insights: insights.length > 0 ? insights : ['Training looks balanced. Keep it up!'],
  };
}

async function getTrainingLoad() {
  const today = new Date();

  // Get last 28 days of workouts
  const cutoff28 = new Date(today);
  cutoff28.setDate(cutoff28.getDate() - 28);
  const cutoff7 = new Date(today);
  cutoff7.setDate(cutoff7.getDate() - 7);

  const all28Days: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoff28.toISOString().split('T')[0]),
    with: {
      assessment: true,
    },
    orderBy: [desc(workouts.date)],
  });

  const last7Days = all28Days.filter((w: WorkoutWithRelations) => w.date >= cutoff7.toISOString().split('T')[0]);

  // Calculate acute (7-day) and chronic (28-day) training load
  // Using a simplified TRIMP-like calculation: miles * RPE
  const calculateLoad = (workoutList: WorkoutWithRelations[]) => {
    return workoutList.reduce((sum: number, w: WorkoutWithRelations) => {
      const miles = w.distanceMiles || 0;
      const rpe = w.assessment?.rpe || 5; // Default to 5 if no RPE
      return sum + (miles * rpe);
    }, 0);
  };

  const acuteLoad = calculateLoad(last7Days);
  const chronicLoad = calculateLoad(all28Days) / 4; // Average weekly load over 4 weeks

  // Calculate acute:chronic workload ratio (ACWR)
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

  // Determine status
  let status: string;
  let recommendation: string;

  if (acwr < 0.8) {
    status = 'Undertrained';
    recommendation = 'Training load is lower than usual. Good for recovery, but consider ramping up if feeling fresh.';
  } else if (acwr <= 1.3) {
    status = 'Optimal';
    recommendation = 'Training load is in the sweet spot. Keep it steady.';
  } else if (acwr <= 1.5) {
    status = 'Caution';
    recommendation = 'Training load is elevated. Monitor fatigue and consider extra recovery.';
  } else {
    status = 'High Risk';
    recommendation = 'Training load spike detected. High injury risk. Recommend reducing volume.';
  }

  return {
    acute_load: {
      period: '7 days',
      value: Math.round(acuteLoad),
      miles: Math.round(last7Days.reduce((sum: number, w: WorkoutWithRelations) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
      workouts: last7Days.length,
    },
    chronic_load: {
      period: '28 days (avg/week)',
      value: Math.round(chronicLoad),
      total_miles: Math.round(all28Days.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) * 10) / 10,
      workouts: all28Days.length,
    },
    acwr: Math.round(acwr * 100) / 100,
    status,
    recommendation,
    interpretation: {
      'below_0.8': 'Undertrained - low injury risk but fitness may decline',
      '0.8_to_1.3': 'Optimal - good balance of training stress and recovery',
      '1.3_to_1.5': 'Caution - elevated load, monitor closely',
      'above_1.5': 'High risk - significant injury risk, reduce load',
    },
  };
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Get proactive alerts
async function getProactiveAlerts() {
  const alerts = await detectAlerts();

  if (alerts.length === 0) {
    return {
      alerts: [],
      message: 'No alerts at this time. Training looks good!',
    };
  }

  // Sort by severity (urgent first, then warnings, then info, then celebrations)
  const severityOrder = { urgent: 0, warning: 1, info: 2, celebration: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    alerts: alerts.map(alert => ({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      recommendation: alert.recommendation,
    })),
    summary: {
      urgent: alerts.filter(a => a.severity === 'urgent').length,
      warnings: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      celebrations: alerts.filter(a => a.severity === 'celebration').length,
    },
    coaching_notes: 'Address urgent and warning alerts first. Celebrate achievements to keep motivation high.',
  };
}

// Get today's planned workout
async function getTodaysPlannedWorkout() {
  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return {
      found: false,
      message: 'No planned workout for today.',
    };
  }

  return {
    found: true,
    workout: {
      id: workout.id,
      date: workout.date,
      name: workout.name,
      workout_type: workout.workoutType,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace_seconds_per_mile: workout.targetPaceSecondsPerMile,
      rationale: workout.rationale,
      is_key_workout: workout.isKeyWorkout,
      status: workout.status,
      structure: workout.structure ? JSON.parse(workout.structure) : null,
    },
  };
}

// Update a planned workout
async function updatePlannedWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const existing = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!existing) {
    return { success: false, error: 'Planned workout not found' };
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.name) updates.name = input.name;
  if (input.description) updates.description = input.description;
  if (input.target_distance_miles) updates.targetDistanceMiles = input.target_distance_miles;
  if (input.workout_type) updates.workoutType = input.workout_type;
  if (input.rationale) updates.rationale = input.rationale;

  if (input.target_pace_per_mile) {
    const paceStr = input.target_pace_per_mile as string;
    const [mins, secs] = paceStr.split(':').map(Number);
    updates.targetPaceSecondsPerMile = mins * 60 + (secs || 0);
  }

  await db.update(plannedWorkouts)
    .set(updates)
    .where(eq(plannedWorkouts.id, workoutId));

  return {
    success: true,
    message: `Updated planned workout: ${input.name || existing.name}`,
    updated_fields: Object.keys(updates).filter(k => k !== 'updatedAt'),
  };
}

// Suggest a workout modification (returns suggestion for user approval)
async function suggestWorkoutModification(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const reason = input.reason as string;
  const suggestedChange = input.suggested_change as string;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  return {
    success: true,
    original_workout: {
      id: workout.id,
      name: workout.name,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
    },
    suggestion: {
      reason,
      suggested_change: suggestedChange,
    },
    message: `Suggestion for ${workout.name}: ${suggestedChange} (Reason: ${reason}). Would you like me to make this change?`,
  };
}
