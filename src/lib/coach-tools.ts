// Coach tools for Claude function calling

import { db, workouts, assessments, shoes, userSettings, clothingItems, races, raceResults, plannedWorkouts, trainingBlocks, sorenessEntries, canonicalRoutes, coachSettings } from '@/lib/db';
import { eq, desc, gte, asc, and, lte, lt } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { fetchCurrentWeather, type WeatherCondition } from './weather';
import { calculateConditionsSeverity, calculatePaceAdjustment, parsePaceToSeconds } from './conditions';
import { calculateVibesTemp, getOutfitRecommendation, matchWardrobeItems, getCategoryLabel } from './outfit';
import { calculatePace } from './utils';
import { calculateVDOT, calculatePaceZones } from './training/vdot-calculator';
import { RACE_DISTANCES } from './training/types';
import { formatPace as formatPaceFromTraining } from './training/types';
import { detectAlerts } from './alerts';
import { enhancedPrescribeWorkout } from './enhanced-prescribe-workout';
import type { WorkoutType, Verdict, NewAssessment, ClothingCategory, TemperaturePreference, OutfitRating, ExtremityRating, RacePriority, Workout, Assessment, Shoe, ClothingItem, PlannedWorkout, Race, CanonicalRoute, WorkoutSegment, UserSettings } from './schema';

// New feature imports
import {
  classifyRun,
  computeQualityRatio,
  computeTRIMP,
} from './training/run-classifier';
import {
  computeExecutionScore,
  parseExecutionDetails,
} from './training/execution-scorer';
import {
  checkDataQuality,
  parseDataQualityFlags,
  getDataQualitySummary,
  type DataQualityFlags,
} from './training/data-quality';
import {
  getRouteProgressSummary,
} from './training/route-matcher';
import { generateExplanationContext } from './training/workout-processor';
import {
  standardPlans,
  getStandardPlan,
  getPlansByAuthor,
  getSuitablePlans,
  type StandardPlanTemplate,
} from './training/standard-plans';
import { buildPerformanceModel } from './training/performance-model';
import { getCoachingKnowledge, findRelevantTopics, getRelatedTopics, getTopicWithRelated, type KnowledgeTopic } from './coach-knowledge';

type WorkoutWithRelations = Workout & {
  assessment?: Assessment | null;
  shoe?: Shoe | null;
};

// Demo mode types
export interface DemoContext {
  isDemo: true;
  settings: {
    name?: string;
    age?: number;
    yearsRunning?: number;
    currentWeeklyMileage?: number;
    vdot?: number;
    easyPaceSeconds?: number;
    tempoPaceSeconds?: number;
    thresholdPaceSeconds?: number;
    intervalPaceSeconds?: number;
    marathonPaceSeconds?: number;
    halfMarathonPaceSeconds?: number;
    planAggressiveness?: string;
    preferredLongRunDay?: string;
    qualitySessionsPerWeek?: number;
    peakWeeklyMileageTarget?: number;
    [key: string]: unknown;
  } | null;
  workouts: Array<{
    id: number;
    date: string;
    distanceMiles: number;
    durationMinutes: number;
    avgPaceSeconds: number;
    workoutType: string;
    notes?: string;
    assessment?: {
      verdict: 'great' | 'good' | 'fine' | 'rough' | 'awful';
      rpe: number;
      legsFeel?: number;
      sleepQuality?: number;
      stress?: number;
      soreness?: number;
      note?: string;
    };
  }>;
  shoes: Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
    totalMiles: number;
  }>;
  races: Array<{
    id: number;
    name: string;
    date: string;
    distanceMeters: number;
    distanceLabel: string;
    priority: 'A' | 'B' | 'C';
    targetTimeSeconds: number | null;
    trainingPlanGenerated: boolean;
  }>;
  plannedWorkouts: Array<{
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
  }>;
}

// Demo action types for client-side application
export interface DemoAction {
  demoAction: string;
  data: unknown;
  message?: string;
}

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
    name: 'update_workout',
    description: 'Update an existing workout record. Use this when the user wants to change workout details like type, notes, distance, or duration. The user might say things like "change that to a tempo run" or "mark my last run as a steady run" or "update the workout from yesterday".',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to update',
        },
        workout_type: {
          type: 'string',
          description: 'New workout type',
          enum: ['easy', 'steady', 'tempo', 'threshold', 'interval', 'long', 'race', 'recovery', 'cross_train', 'other'],
        },
        distance_miles: {
          type: 'number',
          description: 'New distance in miles (optional)',
        },
        duration_minutes: {
          type: 'number',
          description: 'New duration in minutes (optional)',
        },
        notes: {
          type: 'string',
          description: 'New notes for the workout (optional)',
        },
        route_name: {
          type: 'string',
          description: 'Route name (optional)',
        },
        shoe_id: {
          type: 'number',
          description: 'Shoe ID to assign (optional)',
        },
      },
      required: ['workout_id'],
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
    description: 'Modify today\'s planned workout. Use when user wants to scale down or swap the workout. Set preview=true to show what would change without applying.',
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
        preview: {
          type: 'boolean',
          description: 'If true, returns what would change without applying. Use for confirmation before making changes.',
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
    name: 'get_fitness_trend',
    description: 'Analyze fitness trend using pace-to-RPE efficiency. Are they getting faster at the same effort level? Works without heart rate data by using RPE and pace from easy runs and workouts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks_back: {
          type: 'number',
          description: 'Number of weeks to analyze (default: 8)',
        },
        workout_type: {
          type: 'string',
          description: 'Filter by workout type (optional). Best for "easy" runs as they should be most consistent effort.',
          enum: ['easy', 'tempo', 'long', 'interval'],
        },
      },
    },
  },
  {
    name: 'analyze_recovery_pattern',
    description: 'Analyze how the user recovers after hard efforts. Looks at RPE, legs feel, and verdicts in days following quality sessions or long runs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks_back: {
          type: 'number',
          description: 'Number of weeks to analyze (default: 6)',
        },
      },
    },
  },
  {
    name: 'compare_workouts',
    description: 'Compare two workouts side-by-side. Use when user asks "how did this compare to last week?" or wants to see progress.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id_1: {
          type: 'number',
          description: 'ID of first workout (earlier one)',
        },
        workout_id_2: {
          type: 'number',
          description: 'ID of second workout (later/recent one)',
        },
      },
      required: ['workout_id_1', 'workout_id_2'],
    },
  },
  {
    name: 'get_fatigue_indicators',
    description: 'Deep analysis of fatigue signals from recent assessments. Looks at legs feel, sleep, stress, soreness, verdict patterns, and RPE trends to identify accumulating fatigue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_back: {
          type: 'number',
          description: 'Number of days to analyze (default: 14)',
        },
      },
    },
  },
  {
    name: 'estimate_workout_quality',
    description: 'Estimate how well a workout went based on RPE and pace relative to targets and typical performance. Use when analyzing if a workout was successful.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to analyze',
        },
      },
      required: ['workout_id'],
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
    name: 'get_planned_workout_by_date',
    description: 'Get the planned workout for a specific date. Use when user asks about workouts for tomorrow, specific days, or future dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date to get workout for (ISO format YYYY-MM-DD). Can be "tomorrow" and it will be converted.',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'update_planned_workout',
    description: 'Update/edit a planned workout. Use this when user wants to modify a workout in their plan (change distance, type, description, etc.). Set preview=true to show what would change without applying.',
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
        preview: {
          type: 'boolean',
          description: 'If true, returns what would change without applying. Use for confirmation before making changes.',
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
  {
    name: 'swap_workouts',
    description: 'Swap the dates of two planned workouts. Use when user wants to switch days (e.g., "swap Saturday and Sunday" or "switch my tempo and long run this week"). Set preview=true to show what would change without applying.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id_1: {
          type: 'number',
          description: 'ID of the first planned workout',
        },
        workout_id_2: {
          type: 'number',
          description: 'ID of the second planned workout',
        },
        reason: {
          type: 'string',
          description: 'Reason for the swap (optional)',
        },
        preview: {
          type: 'boolean',
          description: 'If true, returns what would change without applying. Use for confirmation before making changes.',
        },
      },
      required: ['workout_id_1', 'workout_id_2'],
    },
  },
  {
    name: 'reschedule_workout',
    description: 'Move a planned workout to a different date. Use when user wants to move a workout (e.g., "move tomorrow\'s tempo to Thursday" or "push my long run to next weekend").',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to move',
        },
        new_date: {
          type: 'string',
          description: 'New date in YYYY-MM-DD format',
        },
        reason: {
          type: 'string',
          description: 'Reason for rescheduling (optional)',
        },
      },
      required: ['workout_id', 'new_date'],
    },
  },
  {
    name: 'skip_workout',
    description: 'Skip a planned workout. Use when user can\'t do a workout and wants to remove it from the plan (e.g., "skip tomorrow\'s run" or "cancel Thursday\'s intervals").',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to skip',
        },
        reason: {
          type: 'string',
          description: 'Reason for skipping (optional but helpful for context)',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'get_week_workouts',
    description: 'Get all planned workouts for a specific week. Useful for understanding the full week context when making modifications.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_offset: {
          type: 'number',
          description: 'Week offset from current week (0 = this week, 1 = next week, -1 = last week)',
        },
      },
    },
  },
  {
    name: 'make_down_week',
    description: 'Convert a week into a recovery/down week by reducing volume and intensity. Use when user is exhausted, stressed, needs recovery, or requests an easier week. Reduces distances by the specified percentage and converts quality sessions to easy runs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_offset: {
          type: 'number',
          description: 'Week offset (0 = this week, 1 = next week). Defaults to 0.',
        },
        reduction_percent: {
          type: 'number',
          description: 'Percentage to reduce volume by (e.g., 30 means reduce to 70% of planned). Typically 20-40%. Defaults to 30.',
        },
        keep_long_run: {
          type: 'boolean',
          description: 'Whether to keep the long run (at reduced distance) or convert to easy. Defaults to true.',
        },
        reason: {
          type: 'string',
          description: 'Reason for the down week (fatigue, stress, illness, etc.)',
        },
      },
    },
  },
  {
    name: 'insert_rest_day',
    description: 'Insert a rest day on a specific date. Can optionally push subsequent workouts forward by one day or just skip the workout on that day.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date to make a rest day in YYYY-MM-DD format',
        },
        push_workouts: {
          type: 'boolean',
          description: 'If true, push this day\'s workout and all subsequent workouts in the week forward by one day. If false, just skip/remove the workout on this day. Defaults to false.',
        },
        reason: {
          type: 'string',
          description: 'Reason for the rest day (optional)',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'adjust_workout_distance',
    description: 'Quickly adjust the distance of a planned workout. Use for making a workout shorter or longer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to adjust',
        },
        new_distance_miles: {
          type: 'number',
          description: 'New target distance in miles',
        },
        reason: {
          type: 'string',
          description: 'Reason for the adjustment (optional)',
        },
      },
      required: ['workout_id', 'new_distance_miles'],
    },
  },
  {
    name: 'convert_to_easy',
    description: 'Convert a quality/hard workout to an easy run. Use when user needs to dial back intensity but still wants to run.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the planned workout to convert',
        },
        keep_distance: {
          type: 'boolean',
          description: 'Whether to keep the same distance (true) or reduce it (false). Defaults to true.',
        },
        reason: {
          type: 'string',
          description: 'Reason for converting to easy (optional)',
        },
      },
      required: ['workout_id'],
    },
  },
  // ============================================================
  // INJURY TRACKING TOOLS
  // ============================================================
  {
    name: 'log_injury',
    description: 'Log a current injury or pain. Use when user mentions any pain, niggle, or injury. This helps track issues and automatically applies training restrictions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        body_part: {
          type: 'string',
          description: 'Body part affected',
          enum: ['knee', 'shin', 'calf', 'achilles', 'ankle', 'foot', 'plantar_fascia', 'hamstring', 'quad', 'hip', 'it_band', 'glute', 'back', 'other'],
        },
        side: {
          type: 'string',
          description: 'Left, right, or both',
          enum: ['left', 'right', 'both'],
        },
        severity: {
          type: 'string',
          description: 'Severity level',
          enum: ['mild', 'moderate', 'severe'],
        },
        description: {
          type: 'string',
          description: 'Description of the pain/injury (when it started, what makes it worse, etc.)',
        },
        restrictions: {
          type: 'array',
          description: 'Training restrictions to apply',
          items: {
            type: 'string',
            enum: ['no_speed_work', 'no_hills', 'no_long_runs', 'easy_only', 'reduced_mileage', 'no_running'],
          },
        },
      },
      required: ['body_part', 'severity'],
    },
  },
  {
    name: 'clear_injury',
    description: 'Mark an injury as resolved. Use when user says pain is gone or they\'re cleared to run normally.',
    input_schema: {
      type: 'object' as const,
      properties: {
        body_part: {
          type: 'string',
          description: 'Body part that has healed',
        },
        notes: {
          type: 'string',
          description: 'Any notes about the recovery',
        },
      },
      required: ['body_part'],
    },
  },
  {
    name: 'get_injury_status',
    description: 'Get current injury status and any active training restrictions. Use before suggesting workouts to ensure they respect injury limitations.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  // ============================================================
  // TRAVEL & ALTITUDE TOOLS
  // ============================================================
  {
    name: 'set_travel_status',
    description: 'Set travel status when user is traveling. Tracks altitude for pace adjustments and notes about available facilities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        is_traveling: {
          type: 'boolean',
          description: 'Whether user is currently traveling',
        },
        location: {
          type: 'string',
          description: 'Where they are traveling to',
        },
        altitude_feet: {
          type: 'number',
          description: 'Altitude in feet (for pace adjustments). Common: Denver 5280, Mexico City 7350, Boulder 5430, Flagstaff 7000',
        },
        start_date: {
          type: 'string',
          description: 'Travel start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Travel end date (YYYY-MM-DD)',
        },
        facilities: {
          type: 'string',
          description: 'Available facilities (treadmill, gym, trails, etc.)',
        },
      },
      required: ['is_traveling'],
    },
  },
  {
    name: 'get_altitude_pace_adjustment',
    description: 'Calculate pace adjustment for altitude. Higher altitude = slower paces due to reduced oxygen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        altitude_feet: {
          type: 'number',
          description: 'Altitude in feet',
        },
        days_at_altitude: {
          type: 'number',
          description: 'Days spent at altitude (acclimatization reduces the impact over ~2 weeks)',
        },
      },
      required: ['altitude_feet'],
    },
  },
  {
    name: 'get_context_summary',
    description: 'IMPORTANT: Call this at the start of most conversations. Returns the athlete\'s training journey (goal race, weeks until race, current phase, week number, week focus) plus alerts (injuries, fatigue, travel). This context should inform every response - frame advice in terms of where they are in their training cycle.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  // ============================================================
  // BRIEFINGS & REVIEWS
  // ============================================================
  {
    name: 'get_pre_run_briefing',
    description: 'Get everything needed before a run: today\'s planned workout, current weather, outfit recommendation, any alerts (injuries, fatigue), and pace adjustments. Use when user says "ready to run", "heading out", or asks what they should do today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_outfit: {
          type: 'boolean',
          description: 'Include outfit recommendation (default true)',
        },
      },
    },
  },
  {
    name: 'get_weekly_review',
    description: 'Get a comprehensive review of the past week: miles run, workouts completed, plan adherence, key metrics, what went well, what to improve. Use when user asks "how did my week go?" or for weekly check-ins.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_offset: {
          type: 'number',
          description: 'Week to review (0 = current week, -1 = last week). Defaults to -1 for last completed week.',
        },
      },
    },
  },
  {
    name: 'suggest_next_workout',
    description: 'Suggest what workout to do based on recent training, fatigue, and goals. Use when there\'s no training plan or user asks "what should I do today?" without a planned workout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        available_time_minutes: {
          type: 'number',
          description: 'How much time they have (optional)',
        },
        preference: {
          type: 'string',
          description: 'Any preference (easy, hard, long, short)',
          enum: ['easy', 'moderate', 'hard', 'long', 'short', 'no_preference'],
        },
      },
    },
  },
  {
    name: 'analyze_completed_workout',
    description: 'Analyze a just-completed workout vs. what was planned. Use after user logs a run to provide feedback on how it went relative to the plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the completed workout to analyze',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'explain_workout_difficulty',
    description: 'Explain why a specific workout felt hard or easy. Analyzes factors like sleep, fatigue, weather, weekly volume, and recovery. Use when user asks "why did that feel hard/easy?" or wants to understand their perceived effort.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to analyze',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'get_upcoming_week_preview',
    description: 'Preview the upcoming week\'s training with context. Shows what\'s planned, highlights key workouts, notes any concerns based on current fatigue/injuries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_race',
    description: 'Update an existing race. Can change target time, date, priority, or other details. Use when athlete wants to adjust their race goal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the race to update',
        },
        target_time: {
          type: 'string',
          description: 'New target finish time in H:MM:SS or MM:SS format',
        },
        date: {
          type: 'string',
          description: 'New race date in YYYY-MM-DD format',
        },
        priority: {
          type: 'string',
          description: 'New race priority (A = goal race, B = important, C = tune-up)',
          enum: ['A', 'B', 'C'],
        },
        name: {
          type: 'string',
          description: 'New race name',
        },
        notes: {
          type: 'string',
          description: 'Notes about the race',
        },
      },
      required: ['race_id'],
    },
  },
  {
    name: 'delete_race',
    description: 'Remove a race from the calendar. Use when athlete decides not to do a race or wants to clear old races.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the race to delete',
        },
      },
      required: ['race_id'],
    },
  },
  {
    name: 'get_training_philosophy',
    description: 'Get information about training philosophy, periodization, and general coaching principles. Use to explain training decisions or answer questions about methodology.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Specific topic to explain',
          enum: ['periodization', 'polarized_training', 'workout_types', 'recovery', 'tapering', 'base_building', 'speed_development', 'long_runs', 'race_pacing'],
        },
      },
    },
  },
  {
    name: 'suggest_plan_adjustment',
    description: 'Analyze current situation and suggest adjustments to the training plan. Considers recent training load, fatigue, injuries, and goals to provide recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for needing adjustment (e.g., "missed 2 weeks due to illness", "feeling overtrained", "race date changed")',
        },
        weeks_affected: {
          type: 'number',
          description: 'Number of weeks affected by the situation',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'generate_training_plan',
    description: 'Generate a training plan for an upcoming race. Use when user asks to create a plan for their race or wants to start training for a goal race. Creates a periodized plan with base, build, peak, and taper phases.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the race to generate a plan for',
        },
      },
      required: ['race_id'],
    },
  },
  {
    name: 'get_standard_plans',
    description: 'Get pre-built training plan templates from popular programs (Pfitzinger, Hansons, Hal Higdon, Jack Daniels). Use when user asks about specific programs like "Pfitz 18/55" or "what plan should I follow?" or wants to use a proven template.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_distance: {
          type: 'string',
          description: 'Target race distance',
          enum: ['marathon', 'half_marathon', '10K', '5K'],
        },
        author: {
          type: 'string',
          description: 'Filter by plan author (Pfitzinger, Hansons, Higdon, Daniels)',
        },
        plan_id: {
          type: 'string',
          description: 'Get a specific plan by ID (pfitz-18-55, hansons-beginner, etc.)',
        },
      },
    },
  },
  // ============================================================
  // NEW DREAMY FEATURES - Time Rewrite, Explanations, Modes, etc.
  // ============================================================
  {
    name: 'rewrite_workout_for_time',
    description: 'Rewrite today\'s planned workout to fit within a time constraint. Preserves the training intent (tempo stays tempo) while adjusting volume. Use when user says "I only have X minutes" or "short on time today".',
    input_schema: {
      type: 'object' as const,
      properties: {
        minutes: {
          type: 'number',
          description: 'Available time in minutes',
        },
        preserve_warmup: {
          type: 'boolean',
          description: 'Keep at least a 10-min warmup (default true)',
        },
      },
      required: ['minutes'],
    },
  },
  {
    name: 'explain_workout',
    description: 'Explain why a workout felt hard or easy. Analyzes conditions, sleep, stress, training load, fueling, pace vs typical, and time of day. Use when user asks "why did that feel so hard?" or "why was today tough?"',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to explain (defaults to most recent)',
        },
      },
    },
  },
  {
    name: 'explain_recommendation',
    description: 'Explain the reasoning behind any AI recommendation. Use when user asks "why did you suggest that?" or wants to understand coach logic.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recommendation_type: {
          type: 'string',
          description: 'Type of recommendation to explain',
          enum: ['pace_adjustment', 'workout_modification', 'rest_day', 'intensity_change', 'plan_adjustment'],
        },
        context: {
          type: 'string',
          description: 'Additional context about the recommendation',
        },
      },
      required: ['recommendation_type'],
    },
  },
  {
    name: 'convert_to_treadmill',
    description: 'Convert an outdoor workout to a treadmill equivalent. Adjusts pace (+15-20s/mi or sets 1% incline) and modifies hill workouts to incline intervals. Use when user says "doing this on the treadmill" or weather forces indoor running.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to convert (defaults to today\'s planned workout)',
        },
        incline_percent: {
          type: 'number',
          description: 'Base incline to simulate outdoor effort (default 1%)',
        },
      },
    },
  },
  {
    name: 'generate_race_checklist',
    description: 'Generate a comprehensive race week checklist including gear prep, nutrition, logistics, and mental prep. Auto-triggered when race is <7 days away.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the upcoming race',
        },
      },
      required: ['race_id'],
    },
  },
  {
    name: 'activate_busy_week',
    description: 'Activate "busy week" mode which reduces training load while maintaining key sessions. Use when user mentions being overwhelmed with work, travel, or life stress.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description: 'Why this week is busy (work, travel, family, etc.)',
        },
        reduction_percent: {
          type: 'number',
          description: 'How much to reduce volume (default 40%)',
        },
        preserve_key_workout: {
          type: 'boolean',
          description: 'Keep the most important workout of the week (default true)',
        },
      },
    },
  },
  {
    name: 'set_travel_mode',
    description: 'Activate travel mode with specific accommodations. Adjusts workouts based on available facilities and time zone changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Travel start date (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'Travel end date (YYYY-MM-DD)',
        },
        destination: {
          type: 'string',
          description: 'Where traveling to (for altitude/timezone)',
        },
        has_treadmill: {
          type: 'boolean',
          description: 'Hotel/location has treadmill access',
        },
        has_gym: {
          type: 'boolean',
          description: 'Hotel/location has gym for cross-training',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'generate_return_plan',
    description: 'Generate a plan to safely return to training after time off. Use when user has been away from running for several days or longer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_away: {
          type: 'number',
          description: 'Number of days without running',
        },
        reason: {
          type: 'string',
          description: 'Reason for time off (illness, injury, travel, life)',
          enum: ['illness', 'injury', 'travel', 'busy', 'mental_break', 'other'],
        },
      },
      required: ['days_away'],
    },
  },
  {
    name: 'set_coach_mode',
    description: 'Set the coach autonomy level. "advisor" mode suggests changes for approval, "autopilot" mode auto-applies minor changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          description: 'Coach autonomy mode',
          enum: ['advisor', 'autopilot'],
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'get_route_progress',
    description: 'Get progress tracking for a specific route. Shows personal bests, average times, and improvement trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        route_id: {
          type: 'number',
          description: 'ID of the canonical route (optional - lists all routes if not provided)',
        },
      },
    },
  },
  {
    name: 'get_workout_classification',
    description: 'Get the auto-classification details for a workout. Shows detected category, confidence, and signals used.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to classify',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'get_execution_score',
    description: 'Get the execution score breakdown for a completed workout vs its planned version.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the completed workout',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'get_data_quality_report',
    description: 'Get a data quality report for a workout. Shows GPS, HR, and pace reliability flags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to analyze',
        },
      },
      required: ['workout_id'],
    },
  },
  {
    name: 'log_soreness',
    description: 'Log body region soreness. Use when user mentions specific muscle/joint soreness.',
    input_schema: {
      type: 'object' as const,
      properties: {
        body_region: {
          type: 'string',
          description: 'Body region that is sore',
          enum: ['left_calf', 'right_calf', 'left_shin', 'right_shin', 'left_quad', 'right_quad', 'left_hamstring', 'right_hamstring', 'left_knee', 'right_knee', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle', 'left_foot', 'right_foot', 'lower_back', 'upper_back', 'left_glute', 'right_glute', 'left_it_band', 'right_it_band'],
        },
        severity: {
          type: 'number',
          description: 'Severity level 0-3 (0=none, 1=mild, 2=moderate, 3=severe)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the soreness',
        },
      },
      required: ['body_region', 'severity'],
    },
  },
  {
    name: 'get_weekly_recap',
    description: 'Get a weekly recap summary suitable for sharing. Shows miles, hours, adherence %, highlights, and fitness trend.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_offset: {
          type: 'number',
          description: 'Week offset (0 = this week, -1 = last week). Defaults to -1.',
        },
      },
    },
  },
  {
    name: 'get_prep_for_tomorrow',
    description: 'Get preparation recommendations for tomorrow\'s run. Includes outfit suggestion, gear checklist, and any considerations.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'override_workout_structure',
    description: 'Override the auto-detected workout structure with the user\'s description. Use when a user says something like "that 10 miler was really 1 mile warmup, 3x3 miles at tempo, 1 mile cooldown" or corrects how a run should be categorized.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'number',
          description: 'ID of the workout to update. If not provided, uses the most recent workout.',
        },
        workout_type: {
          type: 'string',
          description: 'The corrected workout type',
          enum: ['easy', 'steady', 'tempo', 'interval', 'long', 'race', 'recovery', 'fartlek', 'progression'],
        },
        structure: {
          type: 'string',
          description: 'Human-readable structure description like "1mi WU, 3x3mi @ tempo, 1mi CD" or "easy with 4x100m strides"',
        },
      },
      required: ['structure'],
    },
  },
  {
    name: 'get_performance_model',
    description: 'Get the user\'s performance-based pace model. This analyzes their actual race results and best efforts to derive accurate training paces, rather than relying solely on static VDOT. Returns estimated fitness level, pace zones, trend (improving/declining), and confidence based on data quality.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_coaching_knowledge',
    description: `Retrieve deep coaching knowledge. Set include_related=true to also fetch related topics for comprehensive answers.

CRITICAL TOPICS:
- race_prediction_reasoning: Multi-factor prediction framework
- advanced_pattern_analysis: Reading patterns in training data

RACE DAY:
- race_day_timeline: Complete checklists from week before through post-race
- race_execution: Pacing, fueling, managing the race

PRESCRIPTIONS:
- workout_prescriptions: Phase-specific workout recommendations
- workout_library: Specific workout examples

All topics: training_philosophies, periodization, workout_types, workout_library, pacing_zones, race_specific, race_execution, tapering, goal_setting, recovery_adaptation, injury_management, sleep_optimization, nutrition_fueling, strength_training, cross_training, heart_rate_training, running_form, shoe_guidance, women_running, special_populations, ultra_trail, doubles_training, weather_conditions, plan_adjustment, mental_performance, race_prediction_reasoning, advanced_pattern_analysis, race_day_timeline, workout_prescriptions.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'The topic to retrieve knowledge about',
          enum: [
            'training_philosophies', 'periodization', 'workout_types', 'pacing_zones', 'race_specific',
            'nutrition_fueling', 'recovery_adaptation', 'injury_management', 'mental_performance',
            'special_populations', 'weather_conditions', 'tapering', 'plan_adjustment',
            'race_prediction_reasoning', 'advanced_pattern_analysis', 'strength_training',
            'cross_training', 'sleep_optimization', 'race_execution', 'running_form',
            'shoe_guidance', 'heart_rate_training', 'women_running', 'ultra_trail',
            'doubles_training', 'goal_setting', 'workout_library', 'race_day_timeline', 'workout_prescriptions'
          ],
        },
        include_related: {
          type: 'boolean',
          description: 'Also fetch related topics for comprehensive answers (e.g., tapering also fetches race_execution, race_day_timeline)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'prescribe_workout',
    description: 'Generate a specific workout prescription based on the athlete\'s current phase, goal race, fitness level, and recent training. Returns a detailed workout with paces, structure, and rationale.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_type: {
          type: 'string',
          description: 'Type of workout to prescribe',
          enum: ['easy', 'long_run', 'tempo', 'threshold', 'vo2max', 'speed', 'fartlek', 'progression', 'race_simulation'],
        },
        target_distance: {
          type: 'string',
          description: 'Target race distance (5K, 10K, half_marathon, marathon)',
        },
        phase: {
          type: 'string',
          description: 'Current training phase',
          enum: ['base', 'build', 'peak', 'taper', 'recovery'],
        },
        weekly_mileage: {
          type: 'number',
          description: 'Current weekly mileage to calibrate workout volume',
        },
      },
      required: ['workout_type'],
    },
  },
  {
    name: 'get_race_day_plan',
    description: 'Generate a complete race day plan including timeline, checklists, pacing strategy, and nutrition plan based on the upcoming race.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the race to generate plan for (optional, will use next upcoming if not specified)',
        },
      },
    },
  },
  {
    name: 'remember_context',
    description: 'Store important context from the conversation for future reference. Use this to remember key information like recent decisions, preferences expressed, or important facts mentioned.',
    input_schema: {
      type: 'object' as const,
      properties: {
        context_type: {
          type: 'string',
          description: 'Type of context being stored',
          enum: ['preference', 'decision', 'concern', 'goal', 'constraint', 'insight'],
        },
        content: {
          type: 'string',
          description: 'The context to remember',
        },
        importance: {
          type: 'string',
          description: 'How important is this context',
          enum: ['low', 'medium', 'high'],
        },
      },
      required: ['context_type', 'content'],
    },
  },
  {
    name: 'recall_context',
    description: 'Recall previously stored context from the conversation. Use at the start of conversations or when you need to reference earlier decisions/preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        context_type: {
          type: 'string',
          description: 'Type of context to recall (optional, returns all if not specified)',
          enum: ['preference', 'decision', 'concern', 'goal', 'constraint', 'insight', 'all'],
        },
      },
    },
  },
];

// Tool implementations
export async function executeCoachTool(
  toolName: string,
  input: Record<string, unknown>,
  demoContext?: DemoContext
): Promise<unknown> {
  console.log(`=== [executeCoachTool] START === Tool: ${toolName} at ${new Date().toISOString()}`);
  console.log(`[executeCoachTool] Input:`, JSON.stringify(input));

  try {
    // In demo mode, route to demo-specific implementations for certain tools
    if (demoContext?.isDemo) {
      console.log(`[executeCoachTool] Demo mode detected`);
      const demoResult = executeDemoTool(toolName, input, demoContext);
      if (demoResult !== null) {
        console.log(`=== [executeCoachTool] END (demo) === Tool: ${toolName} at ${new Date().toISOString()}`);
        return demoResult;
      }
      // Fall through to regular implementation if demo handler returns null
    }

    let result: unknown;
    switch (toolName) {
    case 'get_recent_workouts':
      result = await getRecentWorkouts(input);
      break;
    case 'get_workout_detail':
      result = await getWorkoutDetail(input);
      break;
    case 'get_shoes':
      result = await getShoes(input);
      break;
    case 'get_user_settings':
      result = await getUserSettings();
      break;
    case 'get_current_weather':
      result = await getCurrentWeather();
      break;
    case 'calculate_adjusted_pace':
      result = calculateAdjustedPace(input);
      break;
    case 'log_workout':
      result = await logWorkout(input);
      break;
    case 'update_workout':
      result = await updateWorkoutTool(input);
      break;
    case 'log_assessment':
      result = await logAssessment(input);
      break;
    case 'get_training_summary':
      result = await getTrainingSummary(input);
      break;
    case 'search_workouts':
      result = await searchWorkouts(input);
      break;
    case 'get_outfit_recommendation':
      result = await getOutfitRecommendationTool(input);
      break;
    case 'get_wardrobe':
      result = await getWardrobe(input);
      break;
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
    case 'get_fitness_trend':
      return getFitnessTrend(input);
    case 'analyze_recovery_pattern':
      return analyzeRecoveryPattern(input);
    case 'compare_workouts':
      return compareWorkouts(input);
    case 'get_fatigue_indicators':
      return getFatigueIndicators(input);
    case 'estimate_workout_quality':
      return estimateWorkoutQuality(input);
    case 'get_proactive_alerts':
      return getProactiveAlerts();
    case 'get_todays_planned_workout':
      return getTodaysPlannedWorkout();
    case 'get_planned_workout_by_date':
      result = await getPlannedWorkoutByDate(input);
      break;
    case 'update_planned_workout':
      result = await updatePlannedWorkout(input);
      break;
    case 'suggest_workout_modification':
      result = await suggestWorkoutModification(input);
      break;
    case 'swap_workouts':
      return swapWorkouts(input);
    case 'reschedule_workout':
      return rescheduleWorkout(input);
    case 'skip_workout':
      return skipWorkout(input);
    case 'get_week_workouts':
      return getWeekWorkouts(input);
    case 'make_down_week':
      return makeDownWeek(input);
    case 'insert_rest_day':
      return insertRestDay(input);
    case 'adjust_workout_distance':
      return adjustWorkoutDistance(input);
    case 'convert_to_easy':
      return convertToEasy(input);
    case 'log_injury':
      return logInjury(input);
    case 'clear_injury':
      return clearInjury(input);
    case 'get_injury_status':
      return getInjuryStatus();
    case 'set_travel_status':
      return setTravelStatus(input);
    case 'get_altitude_pace_adjustment':
      return getAltitudePaceAdjustment(input);
    case 'get_context_summary':
      return getContextSummary();
    case 'get_pre_run_briefing':
      return getPreRunBriefing(input);
    case 'get_weekly_review':
      return getWeeklyReview(input);
    case 'suggest_next_workout':
      result = await suggestNextWorkout(input);
      break;
    case 'analyze_completed_workout':
      result = await analyzeCompletedWorkout(input);
      break;
    case 'explain_workout_difficulty':
      result = explainWorkoutDifficulty(input);
      break;
    case 'get_upcoming_week_preview':
      result = await getUpcomingWeekPreview();
      break;
    case 'update_race':
      result = await updateRace(input);
      break;
    case 'delete_race':
      result = await deleteRace(input);
      break;
    case 'get_training_philosophy':
      result = getTrainingPhilosophy(input);
      break;
    case 'suggest_plan_adjustment':
      result = await suggestPlanAdjustment(input);
      break;
    case 'generate_training_plan':
      return generateTrainingPlan(input);
    case 'get_standard_plans':
      return getStandardPlansHandler(input);
    // New dreamy features
    case 'rewrite_workout_for_time':
      return rewriteWorkoutForTime(input);
    case 'explain_workout':
      return explainWorkout(input);
    case 'explain_recommendation':
      return explainRecommendation(input);
    case 'convert_to_treadmill':
      return convertToTreadmill(input);
    case 'generate_race_checklist':
      return generateRaceChecklist(input);
    case 'activate_busy_week':
      return activateBusyWeek(input);
    case 'set_travel_mode':
      return setTravelMode(input);
    case 'generate_return_plan':
      return generateReturnPlan(input);
    case 'set_coach_mode':
      return setCoachMode(input);
    case 'get_route_progress':
      return getRouteProgress(input);
    case 'get_workout_classification':
      return getWorkoutClassification(input);
    case 'get_execution_score':
      return getExecutionScoreTool(input);
    case 'get_data_quality_report':
      return getDataQualityReport(input);
    case 'log_soreness':
      return logSoreness(input);
    case 'get_weekly_recap':
      return getWeeklyRecap(input);
    case 'get_prep_for_tomorrow':
      return getPrepForTomorrow();
    case 'override_workout_structure':
      return overrideWorkoutStructure(input);
    case 'get_performance_model':
      return getPerformanceModel();
    case 'get_coaching_knowledge':
      return handleGetCoachingKnowledge(input);
    case 'prescribe_workout':
      result = await prescribeWorkout(input);
      break;
    case 'get_race_day_plan':
      result = await getRaceDayPlan(input);
      break;
    case 'remember_context':
      result = await rememberContext(input);
      break;
    case 'recall_context':
      result = await recallContext(input);
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`=== [executeCoachTool] END === Tool: ${toolName} at ${new Date().toISOString()}`);
    console.log(`[executeCoachTool] Result:`, JSON.stringify(result).slice(0, 200));
    return result;
  } catch (error) {
    console.error(`=== [executeCoachTool] ERROR === Tool: ${toolName} at ${new Date().toISOString()}`);
    console.error(`[executeCoachTool] Error:`, error);
    console.error(`[executeCoachTool] Stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// Demo mode tool implementations
function executeDemoTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: DemoContext
): unknown | null {
  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  switch (toolName) {
    // ========== READ TOOLS ==========
    case 'get_recent_workouts': {
      const count = Math.min((input.count as number) || 5, 20);
      const workoutType = input.workout_type as string | undefined;

      let results = [...ctx.workouts].sort((a, b) => b.date.localeCompare(a.date));

      if (workoutType) {
        results = results.filter(w => w.workoutType === workoutType);
      }

      return results.slice(0, count).map(w => ({
        id: w.id,
        date: w.date,
        distance_miles: w.distanceMiles,
        duration_minutes: w.durationMinutes,
        pace_per_mile: formatPace(w.avgPaceSeconds),
        workout_type: w.workoutType,
        notes: w.notes || null,
        assessment: w.assessment ? {
          verdict: w.assessment.verdict,
          rpe: w.assessment.rpe,
          legs_feel: w.assessment.legsFeel,
          sleep_quality: w.assessment.sleepQuality,
          stress: w.assessment.stress,
          note: w.assessment.note,
        } : null,
      }));
    }

    case 'get_user_settings':
      return {
        name: ctx.settings?.name || 'Demo Runner',
        vdot: ctx.settings?.vdot || 45,
        easy_pace: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
        tempo_pace: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
        threshold_pace: ctx.settings?.thresholdPaceSeconds ? formatPace(ctx.settings.thresholdPaceSeconds) : '7:00/mi',
        interval_pace: ctx.settings?.intervalPaceSeconds ? formatPace(ctx.settings.intervalPaceSeconds) : '6:15/mi',
        weekly_mileage: ctx.settings?.currentWeeklyMileage || 35,
        plan_aggressiveness: ctx.settings?.planAggressiveness || 'moderate',
      };

    case 'get_shoes': {
      const includeRetired = input.include_retired as boolean || false;
      return ctx.shoes.filter(s => includeRetired || s.totalMiles < 500).map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        model: s.model,
        total_miles: s.totalMiles,
      }));
    }

    case 'get_races': {
      const includeCompleted = input.include_completed as boolean || false;
      const today = new Date().toISOString().split('T')[0];
      return ctx.races
        .filter(r => includeCompleted || r.date >= today)
        .map(r => ({
          id: r.id,
          name: r.name,
          date: r.date,
          distance: r.distanceLabel,
          priority: r.priority,
          target_time_seconds: r.targetTimeSeconds,
          has_training_plan: r.trainingPlanGenerated,
        }));
    }

    case 'get_pace_zones':
      return {
        vdot: ctx.settings?.vdot || 45,
        easy: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
        marathon: ctx.settings?.marathonPaceSeconds ? formatPace(ctx.settings.marathonPaceSeconds) : '8:00/mi',
        half_marathon: ctx.settings?.halfMarathonPaceSeconds ? formatPace(ctx.settings.halfMarathonPaceSeconds) : '7:30/mi',
        threshold: ctx.settings?.thresholdPaceSeconds ? formatPace(ctx.settings.thresholdPaceSeconds) : '7:00/mi',
        interval: ctx.settings?.intervalPaceSeconds ? formatPace(ctx.settings.intervalPaceSeconds) : '6:15/mi',
        tempo: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
      };

    case 'get_todays_planned_workout':
    case 'get_todays_workout': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (!todaysWorkout) {
        return { message: 'No workout planned for today (rest day)' };
      }
      return {
        id: todaysWorkout.id,
        name: todaysWorkout.name,
        type: todaysWorkout.workoutType,
        distance_miles: todaysWorkout.targetDistanceMiles,
        target_pace: todaysWorkout.targetPaceSecondsPerMile ? formatPace(todaysWorkout.targetPaceSecondsPerMile) : null,
        description: todaysWorkout.description,
        rationale: todaysWorkout.rationale,
        is_key_workout: todaysWorkout.isKeyWorkout,
        phase: todaysWorkout.phase,
        status: todaysWorkout.status,
      };
    }

    case 'get_planned_workout_by_date': {
      let dateStr = input.date as string;

      // Handle "tomorrow" conversion
      if (dateStr === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      }

      const workout = ctx.plannedWorkouts.find(w => w.date === dateStr);
      if (!workout) {
        return {
          found: false,
          date: dateStr,
          message: `No workout planned for ${dateStr} (rest day or no plan)`,
          suggestion: 'Use suggest_next_workout or prescribe_workout to get a workout recommendation.'
        };
      }
      return {
        found: true,
        date: dateStr,
        workout: {
          id: workout.id,
          name: workout.name,
          type: workout.workoutType,
          distance_miles: workout.targetDistanceMiles,
          target_pace: workout.targetPaceSecondsPerMile ? formatPace(workout.targetPaceSecondsPerMile) : null,
          description: workout.description,
          rationale: workout.rationale,
          is_key_workout: workout.isKeyWorkout,
          phase: workout.phase,
          status: workout.status,
        },
        message: `${workout.name} planned for ${dateStr}`,
      };
    }

    case 'get_week_workouts':
    case 'get_weekly_plan': {
      const weekOffset = (input.week_offset as number) || 0;
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      const weekWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= startStr && w.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        week_start: startStr,
        week_end: endStr,
        workouts: weekWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
          name: w.name,
          type: w.workoutType,
          distance_miles: w.targetDistanceMiles,
          target_pace: w.targetPaceSecondsPerMile ? formatPace(w.targetPaceSecondsPerMile) : null,
          is_key_workout: w.isKeyWorkout,
          status: w.status,
          phase: w.phase,
        })),
        total_miles: weekWorkouts.reduce((sum, w) => sum + w.targetDistanceMiles, 0),
      };
    }

    case 'get_context_summary': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      const upcomingRaces = ctx.races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      const nextRace = upcomingRaces[0];

      // Calculate this week's mileage
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startStr = startOfWeek.toISOString().split('T')[0];
      const weekWorkouts = ctx.workouts.filter(w => w.date >= startStr);
      const weekMileage = weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);

      return {
        athlete_name: ctx.settings?.name || 'Runner',
        vdot: ctx.settings?.vdot || 45,
        current_weekly_mileage: ctx.settings?.currentWeeklyMileage || 35,
        this_week_actual_miles: weekMileage.toFixed(1),
        todays_workout: todaysWorkout ? todaysWorkout.name : 'Rest day',
        next_race: nextRace ? {
          name: nextRace.name,
          date: nextRace.date,
          distance: nextRace.distanceLabel,
          days_until: Math.ceil((new Date(nextRace.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        recent_workouts_count: ctx.workouts.length,
        phase: todaysWorkout?.phase || 'base',
      };
    }

    // ========== WRITE TOOLS - Return demo actions ==========
    case 'add_race': {
      const name = input.name as string;
      const date = input.date as string;
      const distanceLabel = input.distance as string || 'half_marathon';
      const priority = (input.priority as 'A' | 'B' | 'C') || 'A';
      const targetTimeSeconds = input.target_time_seconds as number | undefined;

      const distanceInfo = RACE_DISTANCES[distanceLabel];
      const newRace = {
        id: Date.now(),
        name,
        date,
        distanceMeters: distanceInfo?.meters || 21097,
        distanceLabel,
        priority,
        targetTimeSeconds: targetTimeSeconds || null,
        trainingPlanGenerated: false,
      };

      return {
        demoAction: 'add_race',
        data: newRace,
        message: `Added ${name} (${distanceLabel}) on ${date} as ${priority}-priority race. The race has been added to your calendar. Would you like me to generate a training plan for this race?`,
      } as DemoAction;
    }

    case 'log_workout': {
      const date = (input.date as string) || new Date().toISOString().split('T')[0];
      const distanceMiles = input.distance_miles as number;
      const durationMinutes = input.duration_minutes as number;
      const paceStr = input.pace_per_mile as string;
      const workoutType = (input.workout_type as string) || 'easy';

      // Calculate missing values
      let finalDistance = distanceMiles;
      let finalDuration = durationMinutes;
      let finalPaceSeconds = paceStr ? parsePaceToSeconds(paceStr) : 0;

      if (finalDistance && finalDuration && !finalPaceSeconds) {
        finalPaceSeconds = Math.round((finalDuration * 60) / finalDistance);
      } else if (finalDistance && finalPaceSeconds && !finalDuration) {
        finalDuration = Math.round((finalDistance * finalPaceSeconds) / 60);
      } else if (finalDuration && finalPaceSeconds && !finalDistance) {
        finalDistance = (finalDuration * 60) / finalPaceSeconds;
      }

      const newWorkout = {
        id: Date.now(),
        date,
        distanceMiles: finalDistance || 0,
        durationMinutes: finalDuration || 0,
        avgPaceSeconds: finalPaceSeconds || 0,
        workoutType,
        notes: input.notes as string | undefined,
      };

      return {
        demoAction: 'add_workout',
        data: newWorkout,
        message: `Logged ${finalDistance?.toFixed(1) || 0} mile ${workoutType} run on ${date}${finalPaceSeconds ? ` at ${formatPace(finalPaceSeconds)}` : ''}. Great work!`,
      } as DemoAction;
    }

    case 'update_workout': {
      const workoutId = input.workout_id as number;
      const workout = ctx.workouts.find(w => w.id === workoutId);

      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const changes: string[] = [];
      const updateData: Partial<typeof workout> = {};

      if (input.workout_type !== undefined) {
        updateData.workoutType = input.workout_type as string;
        changes.push(`type → ${input.workout_type}`);
      }
      if (input.distance_miles !== undefined) {
        updateData.distanceMiles = input.distance_miles as number;
        changes.push(`distance → ${input.distance_miles} mi`);
      }
      if (input.duration_minutes !== undefined) {
        updateData.durationMinutes = input.duration_minutes as number;
        changes.push(`duration → ${input.duration_minutes} min`);
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes as string;
        changes.push(`notes updated`);
      }

      return {
        demoAction: 'update_workout',
        data: { workoutId, ...updateData },
        message: `Updated workout from ${workout.date}: ${changes.join(', ') || 'no changes'}`,
      } as DemoAction;
    }

    case 'reschedule_workout': {
      const workoutId = input.workout_id as number;
      const newDate = input.new_date as string;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'reschedule_workout',
        data: { workoutId, newDate, reason },
        message: `Rescheduled "${workout.name}" from ${workout.date} to ${newDate}. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'skip_workout': {
      const workoutId = input.workout_id as number;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'skip_workout',
        data: { workoutId, reason },
        message: `Marked "${workout.name}" as skipped. ${workout.isKeyWorkout ? 'Note: This was a key workout - we may want to reschedule or substitute.' : ''} Reason: ${reason}`,
      } as DemoAction;
    }

    case 'convert_to_easy': {
      const workoutId = input.workout_id as number;
      const reason = input.reason as string;
      const keepDistance = (input.keep_distance as boolean) ?? false;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const newDistance = keepDistance ? workout.targetDistanceMiles : Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10;

      return {
        demoAction: 'convert_to_easy',
        data: {
          workoutId,
          newDistance,
          newPace: ctx.settings?.easyPaceSeconds || 540,
          reason,
        },
        message: `Converted "${workout.name}" to an easy ${newDistance} mile run${keepDistance ? '' : ' (reduced from ' + workout.targetDistanceMiles + ' mi)'}. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'adjust_workout_distance': {
      const workoutId = input.workout_id as number;
      const newDistance = input.new_distance_miles as number;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'adjust_distance',
        data: { workoutId, newDistance, reason },
        message: `Adjusted "${workout.name}" distance from ${workout.targetDistanceMiles} to ${newDistance} miles. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'swap_workouts': {
      const workout1Id = input.workout_id_1 as number;
      const workout2Id = input.workout_id_2 as number;
      const reason = input.reason as string;

      const workout1 = ctx.plannedWorkouts.find(w => w.id === workout1Id);
      const workout2 = ctx.plannedWorkouts.find(w => w.id === workout2Id);

      if (!workout1 || !workout2) {
        return { error: 'One or both workouts not found', demoAction: 'none' };
      }

      return {
        demoAction: 'swap_workouts',
        data: { workout1Id, workout2Id, reason },
        message: `Swapped "${workout1.name}" (${workout1.date}) with "${workout2.name}" (${workout2.date}). Reason: ${reason}`,
      } as DemoAction;
    }

    case 'make_down_week': {
      const weekStartDate = input.week_start_date as string;
      const reductionPercent = (input.reduction_percent as number) || 30;
      const reason = input.reason as string;

      // Find workouts in that week
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const weekWorkouts = ctx.plannedWorkouts.filter(
        w => w.date >= weekStartDate && w.date <= weekEndStr
      );

      return {
        demoAction: 'make_down_week',
        data: {
          weekStartDate,
          reductionPercent,
          reason,
          affectedWorkoutIds: weekWorkouts.map(w => w.id),
        },
        message: `Made week of ${weekStartDate} a down week with ${reductionPercent}% volume reduction. ${weekWorkouts.length} workouts will be modified. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'insert_rest_day': {
      const date = input.date as string;
      const pushSubsequent = (input.push_subsequent as boolean) || false;
      const reason = input.reason as string;

      const existingWorkout = ctx.plannedWorkouts.find(w => w.date === date);

      return {
        demoAction: 'insert_rest_day',
        data: {
          date,
          pushSubsequent,
          reason,
          removedWorkoutId: existingWorkout?.id,
        },
        message: `Inserted rest day on ${date}.${existingWorkout ? ` "${existingWorkout.name}" will be ${pushSubsequent ? 'pushed to the next day' : 'skipped'}.` : ''} Reason: ${reason}`,
      } as DemoAction;
    }

    case 'update_race': {
      const raceId = input.race_id as number;
      const updates: Record<string, unknown> = {};

      if (input.name) updates.name = input.name;
      if (input.date) updates.date = input.date;
      if (input.target_time_seconds) updates.targetTimeSeconds = input.target_time_seconds;
      if (input.priority) updates.priority = input.priority;

      const race = ctx.races.find(r => r.id === raceId);
      if (!race) {
        return { error: 'Race not found', demoAction: 'none' };
      }

      return {
        demoAction: 'update_race',
        data: { raceId, updates },
        message: `Updated ${race.name}: ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    case 'delete_race': {
      const raceId = input.race_id as number;
      const race = ctx.races.find(r => r.id === raceId);

      if (!race) {
        return { error: 'Race not found', demoAction: 'none' };
      }

      return {
        demoAction: 'delete_race',
        data: { raceId },
        message: `Deleted race "${race.name}" from your calendar.`,
      } as DemoAction;
    }

    case 'update_planned_workout': {
      const workoutId = input.workout_id as number;
      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.workout_type) updates.workoutType = input.workout_type;
      if (input.target_distance_miles) updates.targetDistanceMiles = input.target_distance_miles;
      if (input.target_pace) updates.targetPaceSecondsPerMile = parsePaceToSeconds(input.target_pace as string);
      if (input.description) updates.description = input.description;
      if (input.status) updates.status = input.status;

      return {
        demoAction: 'update_planned_workout',
        data: { workoutId, updates },
        message: `Updated "${workout.name}": ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    case 'modify_todays_workout': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (!todaysWorkout) {
        return { error: 'No workout planned for today', demoAction: 'none' };
      }

      const updates: Record<string, unknown> = {};
      if (input.new_distance_miles) updates.targetDistanceMiles = input.new_distance_miles;
      if (input.new_workout_type) updates.workoutType = input.new_workout_type;
      if (input.add_strides) updates.name = `${todaysWorkout.name} + Strides`;
      if (input.reduce_intensity) {
        updates.workoutType = 'easy';
        updates.name = 'Easy Run';
      }

      return {
        demoAction: 'update_planned_workout',
        data: { workoutId: todaysWorkout.id, updates },
        message: `Modified today's workout: ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    // For other tools, return helpful information without requiring database
    case 'get_current_weather':
      return {
        message: 'Weather data not available in demo mode. Check your local weather app for current conditions.',
        temperature: 55,
        feels_like: 55,
        humidity: 50,
        wind_speed: 5,
        conditions: 'partly cloudy',
      };

    case 'get_workout_detail': {
      const workoutId = input.workout_id as number;
      const workout = ctx.workouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found' };
      }
      return {
        id: workout.id,
        date: workout.date,
        distance_miles: workout.distanceMiles,
        duration_minutes: workout.durationMinutes,
        pace_per_mile: formatPace(workout.avgPaceSeconds),
        workout_type: workout.workoutType,
        notes: workout.notes || null,
        shoe: null,
        assessment: workout.assessment ? {
          verdict: workout.assessment.verdict,
          rpe: workout.assessment.rpe,
          legs_feel: workout.assessment.legsFeel,
          sleep_quality: workout.assessment.sleepQuality,
          stress: workout.assessment.stress,
          soreness: workout.assessment.soreness,
          note: workout.assessment.note,
        } : null,
      };
    }

    case 'get_user_profile': {
      return {
        name: ctx.settings?.name || 'Demo Runner',
        age: ctx.settings?.age || null,
        years_running: ctx.settings?.yearsRunning || null,
        current_weekly_mileage: ctx.settings?.currentWeeklyMileage || 35,
        peak_mileage_target: ctx.settings?.peakWeeklyMileageTarget || 50,
        vdot: ctx.settings?.vdot || 45,
        plan_aggressiveness: ctx.settings?.planAggressiveness || 'moderate',
        preferred_long_run_day: ctx.settings?.preferredLongRunDay || 'saturday',
        quality_sessions_per_week: ctx.settings?.qualitySessionsPerWeek || 2,
        onboarding_completed: true,
      };
    }

    case 'update_user_profile': {
      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.current_weekly_mileage) updates.currentWeeklyMileage = input.current_weekly_mileage;
      if (input.plan_aggressiveness) updates.planAggressiveness = input.plan_aggressiveness;
      if (input.preferred_long_run_day) updates.preferredLongRunDay = input.preferred_long_run_day;
      if (input.coach_context) updates.coachContext = input.coach_context;
      if (input.injury_history) updates.injuryHistory = input.injury_history;
      if (input.current_injuries) updates.currentInjuries = input.current_injuries;

      return {
        demoAction: 'update_user_profile',
        data: { updates },
        message: `Updated profile: ${Object.keys(updates).join(', ')}`,
      } as DemoAction;
    }

    case 'get_training_summary': {
      const days = (input.days as number) || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const recentWorkouts = ctx.workouts.filter(w => w.date >= cutoffStr);
      const totalMiles = recentWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const totalMinutes = recentWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);

      const workoutsByType: Record<string, number> = {};
      recentWorkouts.forEach(w => {
        workoutsByType[w.workoutType] = (workoutsByType[w.workoutType] || 0) + 1;
      });

      return {
        period_days: days,
        total_workouts: recentWorkouts.length,
        total_miles: Math.round(totalMiles * 10) / 10,
        total_time_minutes: totalMinutes,
        avg_miles_per_run: recentWorkouts.length > 0 ? Math.round((totalMiles / recentWorkouts.length) * 10) / 10 : 0,
        workouts_by_type: workoutsByType,
        avg_pace: recentWorkouts.length > 0
          ? formatPace(Math.round(recentWorkouts.reduce((sum, w) => sum + w.avgPaceSeconds, 0) / recentWorkouts.length))
          : null,
      };
    }

    case 'search_workouts': {
      const query = (input.query as string)?.toLowerCase();
      const dateFrom = input.date_from as string;
      const dateTo = input.date_to as string;

      let results = [...ctx.workouts];

      if (query) {
        results = results.filter(w =>
          w.notes?.toLowerCase().includes(query) ||
          w.workoutType.toLowerCase().includes(query)
        );
      }
      if (dateFrom) {
        results = results.filter(w => w.date >= dateFrom);
      }
      if (dateTo) {
        results = results.filter(w => w.date <= dateTo);
      }

      return results.slice(0, 10).map(w => ({
        id: w.id,
        date: w.date,
        distance_miles: w.distanceMiles,
        workout_type: w.workoutType,
        pace_per_mile: formatPace(w.avgPaceSeconds),
        notes: w.notes || null,
      }));
    }

    case 'get_training_load': {
      // Calculate actual training load from demo workouts
      const today = new Date();
      const acute7 = new Date(today);
      acute7.setDate(acute7.getDate() - 7);
      const chronic28 = new Date(today);
      chronic28.setDate(chronic28.getDate() - 28);

      const acuteStr = acute7.toISOString().split('T')[0];
      const chronicStr = chronic28.toISOString().split('T')[0];

      const acuteWorkouts = ctx.workouts.filter(w => w.date >= acuteStr);
      const chronicWorkouts = ctx.workouts.filter(w => w.date >= chronicStr);

      const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const chronicLoad = chronicWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0) / 4; // Weekly average

      const acuteChronicRatio = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 1;

      return {
        acute_load_miles: Math.round(acuteLoad * 10) / 10,
        chronic_load_miles_per_week: Math.round(chronicLoad * 10) / 10,
        acute_chronic_ratio: acuteChronicRatio,
        interpretation: acuteChronicRatio > 1.5 ? 'High risk - significantly increased load' :
                        acuteChronicRatio > 1.3 ? 'Moderate risk - building load' :
                        acuteChronicRatio < 0.8 ? 'Under-training - consider increasing' :
                        'Optimal training zone',
        recommendation: acuteChronicRatio > 1.5 ? 'Consider a recovery day or reduced volume' :
                        acuteChronicRatio < 0.8 ? 'Good time to add a bit more training stimulus' :
                        'Continue with your current plan',
      };
    }

    case 'get_fitness_trend': {
      const weeksBack = (input.weeks_back as number) || 8;
      const workoutType = input.workout_type as string;

      // Group workouts by week and calculate trends
      const weeks: Array<{ weekStart: string; avgPace: number; totalMiles: number; count: number }> = [];

      for (let i = 0; i < weeksBack; i++) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        let weekWorkouts = ctx.workouts.filter(w => w.date >= weekStartStr && w.date <= weekEndStr);
        if (workoutType) {
          weekWorkouts = weekWorkouts.filter(w => w.workoutType === workoutType);
        }

        if (weekWorkouts.length > 0) {
          weeks.push({
            weekStart: weekStartStr,
            avgPace: Math.round(weekWorkouts.reduce((sum, w) => sum + w.avgPaceSeconds, 0) / weekWorkouts.length),
            totalMiles: Math.round(weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0) * 10) / 10,
            count: weekWorkouts.length,
          });
        }
      }

      const trend = weeks.length >= 2
        ? weeks[0].avgPace < weeks[weeks.length - 1].avgPace ? 'improving' : 'stable'
        : 'insufficient_data';

      return {
        weeks_analyzed: weeksBack,
        workout_type_filter: workoutType || 'all',
        weekly_data: weeks.reverse(),
        trend,
        interpretation: trend === 'improving' ? 'Your pace is getting faster at similar efforts - great progress!' :
                        trend === 'stable' ? 'Pace is consistent - solid base building' :
                        'Need more data to determine trend',
      };
    }

    case 'get_fatigue_indicators':
    case 'analyze_recovery_pattern': {
      // Analyze recent workout patterns for fatigue signals
      const recent7 = ctx.workouts.slice(0, 7);
      const hardWorkouts = recent7.filter(w => ['tempo', 'interval', 'long'].includes(w.workoutType));
      const easyWorkouts = recent7.filter(w => w.workoutType === 'easy' || w.workoutType === 'recovery');

      const hardToEasyRatio = easyWorkouts.length > 0 ? hardWorkouts.length / easyWorkouts.length : hardWorkouts.length;

      return {
        recent_workout_count: recent7.length,
        hard_workout_count: hardWorkouts.length,
        easy_workout_count: easyWorkouts.length,
        hard_to_easy_ratio: Math.round(hardToEasyRatio * 100) / 100,
        fatigue_risk: hardToEasyRatio > 0.6 ? 'elevated' : hardToEasyRatio > 0.4 ? 'moderate' : 'low',
        recommendation: hardToEasyRatio > 0.6
          ? 'Consider adding more easy days between hard efforts'
          : 'Good balance of hard and easy training',
      };
    }

    case 'get_plan_adherence': {
      const weeksBack = (input.weeks_back as number) || 4;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (weeksBack * 7));
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const plannedInPeriod = ctx.plannedWorkouts.filter(w => w.date >= cutoffStr && w.date < today);
      const completed = plannedInPeriod.filter(w => w.status === 'completed');
      const skipped = plannedInPeriod.filter(w => w.status === 'skipped');

      const adherenceRate = plannedInPeriod.length > 0
        ? Math.round((completed.length / plannedInPeriod.length) * 100)
        : 100;

      return {
        weeks_analyzed: weeksBack,
        planned_workouts: plannedInPeriod.length,
        completed: completed.length,
        skipped: skipped.length,
        adherence_rate: adherenceRate,
        interpretation: adherenceRate >= 85 ? 'Excellent adherence!' :
                        adherenceRate >= 70 ? 'Good adherence - minor adjustments may help' :
                        'Adherence could improve - consider adjusting plan difficulty',
      };
    }

    case 'get_readiness_score': {
      // Calculate readiness based on recent training patterns
      const recent3 = ctx.workouts.slice(0, 3);
      const avgRecentMiles = recent3.length > 0
        ? recent3.reduce((sum, w) => sum + w.distanceMiles, 0) / recent3.length
        : 0;

      const hadHardWorkoutYesterday = recent3.length > 0 &&
        ['tempo', 'interval', 'long'].includes(recent3[0].workoutType);

      let readinessScore = 75; // Base score
      if (hadHardWorkoutYesterday) readinessScore -= 15;
      if (avgRecentMiles > 8) readinessScore -= 5;

      return {
        readiness_score: readinessScore,
        factors: {
          recent_training_load: avgRecentMiles > 6 ? 'moderate_to_high' : 'manageable',
          recent_hard_effort: hadHardWorkoutYesterday,
        },
        recommendation: readinessScore >= 70
          ? 'Good to go for any workout'
          : readinessScore >= 50
          ? 'Consider an easier effort today'
          : 'Rest day recommended',
      };
    }

    case 'get_proactive_alerts': {
      const alerts: Array<{ type: string; severity: string; message: string }> = [];
      const today = new Date().toISOString().split('T')[0];

      // Check for upcoming race
      const upcomingRace = ctx.races.find(r => r.date >= today);
      if (upcomingRace) {
        const daysUntil = Math.ceil((new Date(upcomingRace.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7) {
          alerts.push({
            type: 'race_week',
            severity: 'info',
            message: `${upcomingRace.name} is in ${daysUntil} days! Time to taper and stay fresh.`,
          });
        } else if (daysUntil <= 14) {
          alerts.push({
            type: 'race_approaching',
            severity: 'info',
            message: `${upcomingRace.name} is in ${daysUntil} days. Peak training then taper.`,
          });
        }
      }

      // Check training load
      const recent7Miles = ctx.workouts
        .filter(w => {
          const wDate = new Date(w.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return wDate >= weekAgo;
        })
        .reduce((sum, w) => sum + w.distanceMiles, 0);

      const targetWeekly = ctx.settings?.currentWeeklyMileage || 35;
      if (recent7Miles > targetWeekly * 1.2) {
        alerts.push({
          type: 'high_volume',
          severity: 'warning',
          message: `This week's mileage (${Math.round(recent7Miles)}mi) is above your typical ${targetWeekly}mi. Consider recovery.`,
        });
      }

      // Check for today's workout
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (todaysWorkout) {
        alerts.push({
          type: 'todays_workout',
          severity: 'info',
          message: `Today's workout: ${todaysWorkout.name} (${todaysWorkout.targetDistanceMiles}mi)`,
        });
      }

      return {
        alert_count: alerts.length,
        alerts,
        checked_at: new Date().toISOString(),
      };
    }

    case 'get_pre_run_briefing': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);

      return {
        date: today,
        planned_workout: todaysWorkout ? {
          name: todaysWorkout.name,
          type: todaysWorkout.workoutType,
          distance_miles: todaysWorkout.targetDistanceMiles,
          target_pace: todaysWorkout.targetPaceSecondsPerMile ? formatPace(todaysWorkout.targetPaceSecondsPerMile) : null,
          description: todaysWorkout.description,
          is_key_workout: todaysWorkout.isKeyWorkout,
        } : null,
        weather: {
          temperature: 55,
          feels_like: 55,
          conditions: 'partly cloudy',
          note: 'Check your local weather for accurate conditions',
        },
        pace_zones: {
          easy: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
          tempo: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
        },
        ready_to_run: true,
      };
    }

    case 'get_weekly_review': {
      const weekOffset = (input.week_offset as number) ?? -1;
      const today = new Date();
      const reviewWeekEnd = new Date(today);
      reviewWeekEnd.setDate(reviewWeekEnd.getDate() + (weekOffset * 7));
      const reviewWeekStart = new Date(reviewWeekEnd);
      reviewWeekStart.setDate(reviewWeekStart.getDate() - 6);

      const startStr = reviewWeekStart.toISOString().split('T')[0];
      const endStr = reviewWeekEnd.toISOString().split('T')[0];

      const weekWorkouts = ctx.workouts.filter(w => w.date >= startStr && w.date <= endStr);
      const plannedWorkouts = ctx.plannedWorkouts.filter(w => w.date >= startStr && w.date <= endStr);

      const totalMiles = weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const totalTime = weekWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);

      return {
        week_start: startStr,
        week_end: endStr,
        workouts_completed: weekWorkouts.length,
        workouts_planned: plannedWorkouts.length,
        total_miles: Math.round(totalMiles * 10) / 10,
        total_time_minutes: totalTime,
        workout_types: weekWorkouts.reduce((acc, w) => {
          acc[w.workoutType] = (acc[w.workoutType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        highlights: weekWorkouts.length > 0
          ? `Completed ${weekWorkouts.length} runs for ${Math.round(totalMiles)} miles`
          : 'No workouts logged this week',
      };
    }

    case 'get_upcoming_week_preview': {
      const today = new Date();
      const weekStart = new Date(today);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const upcomingWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= startStr && w.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      const keyWorkouts = upcomingWorkouts.filter(w => w.isKeyWorkout);
      const totalPlannedMiles = upcomingWorkouts.reduce((sum, w) => sum + w.targetDistanceMiles, 0);

      return {
        week_start: startStr,
        week_end: endStr,
        planned_workouts: upcomingWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
          name: w.name,
          type: w.workoutType,
          distance_miles: w.targetDistanceMiles,
          is_key: w.isKeyWorkout,
        })),
        total_miles: Math.round(totalPlannedMiles * 10) / 10,
        key_workout_count: keyWorkouts.length,
        phase: upcomingWorkouts[0]?.phase || 'training',
      };
    }

    case 'predict_race_time': {
      const distance = input.distance as string;
      const conditions = input.conditions as string || 'ideal';
      const vdot = ctx.settings?.vdot || 45;

      // VDOT-based predictions
      const predictions: Record<string, number> = {
        '5K': Math.round((12.5 + (60 - vdot) * 0.5) * 60),
        '10K': Math.round((26 + (60 - vdot) * 1.1) * 60),
        '15K': Math.round((40 + (60 - vdot) * 1.7) * 60),
        '10_mile': Math.round((44 + (60 - vdot) * 1.85) * 60),
        'half_marathon': Math.round((58 + (60 - vdot) * 2.4) * 60),
        'marathon': Math.round((125 + (60 - vdot) * 5.2) * 60),
      };

      let predictedSeconds = predictions[distance] || predictions['half_marathon'];

      // Adjust for conditions
      const conditionAdjustments: Record<string, number> = {
        ideal: 1.0,
        warm: 1.03,
        hot: 1.08,
        cold: 1.01,
        hilly: 1.05,
      };
      predictedSeconds = Math.round(predictedSeconds * (conditionAdjustments[conditions] || 1.0));

      const hours = Math.floor(predictedSeconds / 3600);
      const mins = Math.floor((predictedSeconds % 3600) / 60);
      const secs = predictedSeconds % 60;
      const timeStr = hours > 0
        ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

      return {
        distance,
        conditions,
        predicted_time: timeStr,
        predicted_seconds: predictedSeconds,
        vdot_used: vdot,
        note: 'Prediction based on current VDOT. Actual performance depends on training, pacing, and race-day factors.',
      };
    }

    case 'get_training_philosophy': {
      const topic = input.topic as string;

      const philosophies: Record<string, { title: string; explanation: string; application: string }> = {
        periodization: {
          title: 'Periodization',
          explanation: 'Training is divided into phases (base, build, peak, taper) each with specific goals. Base builds aerobic capacity, build adds race-specific work, peak is highest intensity/volume, taper reduces load before race.',
          application: 'Your current phase determines workout focus. In base phase, most runs are easy. In build/peak, quality sessions become more important.',
        },
        polarized_training: {
          title: 'Polarized Training (80/20 Rule)',
          explanation: 'About 80% of training should be easy (conversational pace), and 20% hard (tempo, intervals). The easy days truly easy allows you to go hard on hard days.',
          application: 'If you feel tired on easy days, slow down. Save your energy for quality sessions.',
        },
        workout_types: {
          title: 'Workout Types',
          explanation: 'Easy runs build aerobic base. Tempo runs improve lactate threshold. Intervals develop VO2max. Long runs build endurance and mental toughness.',
          application: 'Each workout type serves a purpose. Trust the process even when easy runs feel too slow.',
        },
        recovery: {
          title: 'Recovery',
          explanation: 'Adaptation happens during rest, not during training. Sleep, nutrition, and easy days are when your body gets stronger.',
          application: 'Never skip recovery days or turn them into hard efforts. Quality sleep is as important as quality workouts.',
        },
        tapering: {
          title: 'Tapering',
          explanation: 'Reducing training load 2-3 weeks before a goal race allows your body to fully recover while maintaining fitness. You may feel sluggish - this is normal.',
          application: 'Trust the taper. Resist the urge to do more. You cannot gain fitness in the final weeks, but you can lose freshness.',
        },
        base_building: {
          title: 'Base Building',
          explanation: 'Establishing aerobic fitness through consistent easy running before adding intensity. A strong base supports all other training.',
          application: 'Be patient with base building. The aerobic gains compound over time and make harder training more effective.',
        },
        speed_development: {
          title: 'Speed Development',
          explanation: 'Faster running develops neuromuscular coordination, running economy, and VO2max. Introduced gradually after establishing base.',
          application: 'Speed work is the spice, not the main course. A little goes a long way when built on solid aerobic base.',
        },
        long_runs: {
          title: 'Long Runs',
          explanation: 'The cornerstone of distance training. Builds endurance, teaches body to burn fat, and develops mental resilience. Should be done at easy, conversational pace.',
          application: 'Long runs should leave you tired but not destroyed. If you need days to recover, you went too hard.',
        },
        race_pacing: {
          title: 'Race Pacing',
          explanation: 'Starting conservatively and running even or negative splits typically produces best results. Going out too fast leads to painful fade.',
          application: 'First miles should feel easy, almost too slow. Save your energy for when it counts in the second half.',
        },
      };

      const topicInfo = philosophies[topic] || philosophies['polarized_training'];

      return {
        topic: topic || 'polarized_training',
        title: topicInfo.title,
        explanation: topicInfo.explanation,
        application: topicInfo.application,
      };
    }

    case 'log_assessment': {
      const workoutId = input.workout_id as number;
      const verdict = input.verdict as string;
      const rpe = input.rpe as number;

      return {
        demoAction: 'log_assessment',
        data: {
          workoutId,
          verdict,
          rpe,
          legsFeel: input.legs_feel,
          sleepQuality: input.sleep_quality,
          sleepHours: input.sleep_hours,
          stress: input.stress,
          soreness: input.soreness,
          note: input.note,
        },
        message: `Logged assessment for workout: ${verdict} (RPE ${rpe})`,
      } as DemoAction;
    }

    case 'add_race_result': {
      const distance = input.distance as string;
      const finishTime = input.finish_time as string;
      const date = input.date as string;

      // Parse finish time to seconds
      const timeParts = finishTime.split(':').map(Number);
      let finishTimeSeconds = 0;
      if (timeParts.length === 3) {
        finishTimeSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      } else if (timeParts.length === 2) {
        finishTimeSeconds = timeParts[0] * 60 + timeParts[1];
      }

      return {
        demoAction: 'add_race_result',
        data: {
          date,
          distance,
          finishTimeSeconds,
          raceName: input.race_name,
          effortLevel: input.effort_level,
          conditions: input.conditions,
          notes: input.notes,
        },
        message: `Logged race result: ${distance} in ${finishTime}. This will update your pace zones!`,
      } as DemoAction;
    }

    case 'generate_training_plan': {
      const raceId = input.race_id as number;
      const race = ctx.races.find(r => r.id === raceId);

      if (!race) {
        return { error: 'Race not found. Please add a race first.' };
      }

      if (race.trainingPlanGenerated) {
        return { message: 'A training plan already exists for this race. Would you like me to regenerate it?' };
      }

      return {
        demoAction: 'generate_training_plan',
        data: { raceId },
        message: `I'll generate a training plan for ${race.name} (${race.distanceLabel}) on ${race.date}. This will create a periodized plan with appropriate phases leading up to your race.`,
      } as DemoAction;
    }

    case 'suggest_workout_modification':
    case 'suggest_next_workout':
    case 'suggest_plan_adjustment': {
      // Return the context so the AI can make suggestions based on the plan data
      const todayStr = new Date().toISOString().split('T')[0];
      const upcomingWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 7);
      return {
        suggestion_context: {
          upcoming_workouts: upcomingWorkouts.map(w => ({
            id: w.id,
            date: w.date,
            name: w.name,
            type: w.workoutType,
            distance: w.targetDistanceMiles,
          })),
          current_phase: upcomingWorkouts[0]?.phase || 'base',
          athlete_vdot: ctx.settings?.vdot || 45,
        },
        message: 'Based on your upcoming schedule, I can help you make adjustments. What would you like to modify?',
      };
    }

    // Injury tracking demo handlers
    case 'log_injury': {
      const bodyPart = input.body_part as string;
      const severity = (input.severity as string) || 'minor';
      const side = input.side as string | undefined;
      const restrictions = (input.restrictions as string[]) || [];

      return {
        demoAction: 'log_injury',
        data: {
          bodyPart,
          severity,
          side,
          restrictions,
          description: input.description,
        },
        message: `Logged ${severity} ${bodyPart}${side ? ` (${side})` : ''} injury. I'll adjust your training recommendations accordingly.`,
        success: true,
        recommendations: [
          severity === 'severe' ? 'Consider seeing a medical professional before running again.' : null,
          'Take extra rest days as needed.',
          severity !== 'severe' ? 'Easy runs only until this heals.' : 'No running until cleared.',
        ].filter(Boolean),
      };
    }

    case 'clear_injury': {
      const bodyPart = input.body_part as string;
      return {
        demoAction: 'clear_injury',
        data: { bodyPart },
        message: `Great that your ${bodyPart} is feeling better! Returning to normal training gradually.`,
        success: true,
        recommendations: [
          'Ease back into intensity over 1-2 weeks.',
          'Listen to your body if any discomfort returns.',
        ],
      };
    }

    case 'get_injury_status': {
      return {
        has_injuries: false,
        active_injuries: [],
        has_restrictions: false,
        restrictions: [],
        message: 'No active injuries on record. Stay healthy!',
      };
    }

    // Wardrobe demo handlers
    case 'get_wardrobe': {
      return {
        items: [
          { id: 1, category: 'shorts', name: 'Running Shorts', tempRange: '55-95°F' },
          { id: 2, category: 'tights', name: 'Running Tights', tempRange: '20-50°F' },
          { id: 3, category: 'base_layer', name: 'Tech T-Shirt', tempRange: '50-95°F' },
          { id: 4, category: 'base_layer', name: 'Long Sleeve Base', tempRange: '30-55°F' },
          { id: 5, category: 'outer_layer', name: 'Rain Jacket', tempRange: '40-65°F' },
          { id: 6, category: 'hat', name: 'Running Cap', tempRange: '55-100°F' },
          { id: 7, category: 'hat', name: 'Beanie', tempRange: '10-40°F' },
          { id: 8, category: 'gloves', name: 'Running Gloves', tempRange: '20-45°F' },
        ],
        categories: ['base_layer', 'mid_layer', 'outer_layer', 'shorts', 'tights', 'socks', 'hat', 'gloves'],
        total_items: 8,
      };
    }

    case 'add_clothing_item': {
      return {
        demoAction: 'add_clothing_item',
        data: {
          category: input.category,
          name: input.name,
          brand: input.brand,
          tempRangeMin: input.temp_range_min,
          tempRangeMax: input.temp_range_max,
          weatherSuitability: input.weather_suitability,
        },
        message: `Added ${input.name} to your wardrobe!`,
        success: true,
      };
    }

    case 'log_outfit_feedback': {
      const rating = input.rating as string;
      return {
        demoAction: 'log_outfit_feedback',
        data: {
          rating,
          temperature: input.temperature,
          items: input.items,
          notes: input.notes,
        },
        message: `Logged outfit feedback: ${rating}. I'll use this to improve future recommendations.`,
        success: true,
      };
    }

    case 'get_outfit_recommendation': {
      // Provide a generic outfit recommendation for demo
      const temp = (input.temperature as number) || 55;
      let recommendation;
      if (temp > 70) {
        recommendation = {
          layers: ['Running shorts', 'Tech T-Shirt'],
          accessories: ['Running Cap (sun protection)'],
          note: 'Light and breathable for warm conditions.',
        };
      } else if (temp > 50) {
        recommendation = {
          layers: ['Running shorts', 'Long Sleeve Base'],
          accessories: [],
          note: 'Perfect running weather. Light layers.',
        };
      } else if (temp > 35) {
        recommendation = {
          layers: ['Running Tights', 'Long Sleeve Base', 'Running Vest'],
          accessories: ['Gloves'],
          note: 'Layer up for cool conditions.',
        };
      } else {
        recommendation = {
          layers: ['Running Tights', 'Long Sleeve Base', 'Mid Layer', 'Outer Layer'],
          accessories: ['Beanie', 'Gloves'],
          note: 'Full winter gear. Stay warm!',
        };
      }
      return {
        temperature: temp,
        recommendation,
        vibes_temp: temp - 10, // Running makes it feel warmer
      };
    }

    case 'set_travel_status': {
      return {
        demoAction: 'set_travel_status',
        data: {
          traveling: input.traveling,
          altitude: input.altitude,
          tempDelta: input.temp_delta,
          returnDate: input.return_date,
        },
        message: input.traveling
          ? `Travel mode activated. I'll adjust recommendations for your trip.`
          : `Welcome back! Adjusting back to normal training.`,
        success: true,
      };
    }

    // For tools that don't need special demo handling, return null to fall through
    default:
      return null;
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
  let workoutType = input.workout_type as WorkoutType | undefined;
  const shoeId = input.shoe_id as number | undefined;
  const routeName = input.route_name as string | undefined;
  const notes = input.notes as string | undefined;

  // Get active profile
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Find planned workout for this date to auto-link and auto-categorize
  const plannedWorkoutForDate = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, date),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    with: {
      template: true,
    },
    orderBy: [desc(plannedWorkouts.isKeyWorkout)], // Prioritize key workouts
  });

  // Auto-detect workout type from planned workout if not explicitly provided
  if (!workoutType && plannedWorkoutForDate) {
    // Map template category or workout type to our WorkoutType
    const templateType = plannedWorkoutForDate.workoutType;
    if (templateType) {
      workoutType = templateType as WorkoutType;
    }
  }

  // Track if we should auto-detect from pace later (no planned workout and no explicit type)
  const shouldAutoDetectFromPace = !workoutType && !plannedWorkoutForDate;

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

  // Auto-detect workout type from pace if no planned workout and no explicit type
  if (shouldAutoDetectFromPace && avgPaceSeconds) {
    // Get user's pace zones to classify the workout
    const settings = await db.query.userSettings.findFirst();
    if (settings?.vdot) {
      const paceZones = calculatePaceZones(settings.vdot);
      // Compare avg pace to zones (lower pace seconds = faster)
      // Threshold: tempo - marathon pace range
      // Tempo: around threshold pace
      // Interval: faster than threshold
      // Easy: slower than marathon pace
      // Long: based on distance (10+ miles at easy pace)

      const easyPaceSeconds = paceZones.easy || 600;
      const tempoPaceSeconds = paceZones.tempo || 480;
      const thresholdPaceSeconds = paceZones.threshold || 420;
      const intervalPaceSeconds = paceZones.interval || 360;

      // Determine workout type based on pace
      if (distanceMiles && distanceMiles >= 10 && avgPaceSeconds >= easyPaceSeconds - 30) {
        workoutType = 'long';
      } else if (avgPaceSeconds <= intervalPaceSeconds + 15) {
        workoutType = 'interval';
      } else if (avgPaceSeconds <= thresholdPaceSeconds + 15) {
        workoutType = 'tempo';
      } else if (avgPaceSeconds <= tempoPaceSeconds + 20) {
        workoutType = 'steady';
      } else if (avgPaceSeconds >= easyPaceSeconds + 30) {
        workoutType = 'recovery';
      } else {
        workoutType = 'easy';
      }
    }
  }

  // Default to 'easy' if still no type
  if (!workoutType) {
    workoutType = 'easy';
  }

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
    profileId: profileId || null,
    date,
    distanceMiles,
    durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
    avgPaceSeconds,
    workoutType,
    shoeId: shoeId || null,
    routeName: routeName || null,
    notes: notes || null,
    source: 'manual',
    plannedWorkoutId: plannedWorkoutForDate?.id || null,
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

  // Link to planned workout if found - update planned workout to mark as completed
  let linkedPlannedWorkout: PlannedWorkout | null = null;
  if (plannedWorkoutForDate) {
    // Update the planned workout to mark as completed and link to logged workout
    await db.update(plannedWorkouts)
      .set({
        status: 'completed',
        completedWorkoutId: workout.id,
        updatedAt: now.toISOString(),
      })
      .where(eq(plannedWorkouts.id, plannedWorkoutForDate.id));

    linkedPlannedWorkout = plannedWorkoutForDate;
  }

  // Build informative message
  const durationStr = durationMinutes ? `${Math.round(durationMinutes)} min` : '';
  const distanceStr = distanceMiles ? `${distanceMiles} miles` : '';
  const paceStr = avgPaceSeconds ? formatPace(avgPaceSeconds) : '';

  const parts = [distanceStr, durationStr].filter(Boolean).join(', ');
  let message = `Workout logged: ${parts} ${workoutType} run on ${date}${paceStr ? ` @ ${paceStr}/mi pace` : ''}`;

  // Add note about linking to planned workout
  if (linkedPlannedWorkout) {
    const plannedName = linkedPlannedWorkout.name || 'scheduled workout';
    message += `. Linked to planned "${plannedName}" and marked as completed.`;
  }

  return {
    success: true,
    workout_id: workout.id,
    message,
    distance_miles: distanceMiles || null,
    duration_minutes: durationMinutes ? Math.round(durationMinutes) : null,
    pace: paceStr || null,
    linked_planned_workout_id: linkedPlannedWorkout?.id || null,
    linked_planned_workout_name: linkedPlannedWorkout?.name || null,
  };
}

async function updateWorkoutTool(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  if (!workoutId) {
    return {
      success: false,
      message: 'Workout ID is required. Please specify which workout to update.',
    };
  }

  // Find the existing workout
  const existingWorkout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!existingWorkout) {
    return {
      success: false,
      message: `Workout with ID ${workoutId} not found.`,
    };
  }

  // Build update object with only provided fields
  const updateData: Partial<Workout> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.workout_type !== undefined) {
    updateData.workoutType = input.workout_type as WorkoutType;
  }
  if (input.distance_miles !== undefined) {
    updateData.distanceMiles = input.distance_miles as number;
  }
  if (input.duration_minutes !== undefined) {
    updateData.durationMinutes = input.duration_minutes as number;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes as string;
  }
  if (input.route_name !== undefined) {
    updateData.routeName = input.route_name as string;
  }
  if (input.shoe_id !== undefined) {
    updateData.shoeId = input.shoe_id as number;
  }

  // Recalculate pace if distance or duration changed
  const newDistance = updateData.distanceMiles ?? existingWorkout.distanceMiles;
  const newDuration = updateData.durationMinutes ?? existingWorkout.durationMinutes;
  if (newDistance && newDuration && (updateData.distanceMiles !== undefined || updateData.durationMinutes !== undefined)) {
    updateData.avgPaceSeconds = calculatePace(newDistance, newDuration);
  }

  // Perform update
  await db.update(workouts)
    .set(updateData)
    .where(eq(workouts.id, workoutId));

  // Format response
  const changes: string[] = [];
  if (input.workout_type !== undefined) {
    changes.push(`type → ${input.workout_type}`);
  }
  if (input.distance_miles !== undefined) {
    changes.push(`distance → ${input.distance_miles} mi`);
  }
  if (input.duration_minutes !== undefined) {
    changes.push(`duration → ${input.duration_minutes} min`);
  }
  if (input.notes !== undefined) {
    changes.push(`notes updated`);
  }
  if (input.route_name !== undefined) {
    changes.push(`route → ${input.route_name}`);
  }

  const changeStr = changes.length > 0 ? changes.join(', ') : 'no changes';

  return {
    success: true,
    workout_id: workoutId,
    message: `Updated workout from ${existingWorkout.date}: ${changeStr}`,
    previous_type: existingWorkout.workoutType,
    new_type: updateData.workoutType ?? existingWorkout.workoutType,
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
  console.log('[addRace] Starting with input:', JSON.stringify(input));

  const name = input.name as string;
  const date = input.date as string;
  const distance = input.distance as string;
  const priority = input.priority as RacePriority;
  const targetTime = input.target_time as string | undefined;
  const location = input.location as string | undefined;

  // Validate required fields
  if (!name || !date || !distance) {
    console.error('[addRace] Missing required fields:', { name, date, distance });
    return { error: 'Missing required fields: name, date, and distance are required' };
  }

  // Get active profile
  const profileId = await getActiveProfileId();
  console.log('[addRace] Profile ID:', profileId);

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Parse target time if provided
  let targetTimeSeconds: number | null = null;
  if (targetTime) {
    targetTimeSeconds = parseTimeToSeconds(targetTime);
    console.log('[addRace] Parsed target time:', targetTime, '->', targetTimeSeconds);
  }

  // Get distance in meters
  const distanceInfo = RACE_DISTANCES[distance];
  const distanceMeters = distanceInfo?.meters || 0;
  console.log('[addRace] Distance:', distance, '->', distanceMeters, 'meters');

  if (!distanceMeters) {
    console.warn('[addRace] Unknown distance label:', distance, '- Available:', Object.keys(RACE_DISTANCES).join(', '));
    return { error: `Unknown distance: ${distance}. Use one of: ${Object.keys(RACE_DISTANCES).join(', ')}` };
  }

  const now = new Date().toISOString();

  try {
    console.log('[addRace] Inserting race into database...');
    const [race] = await db.insert(races).values({
      profileId: profileId || null,
      name,
      date,
      distanceMeters,
      distanceLabel: distance,
      priority: priority || 'B',
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
    console.log('[addRace] Race inserted successfully, ID:', race.id);

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
  } catch (dbError) {
    console.error('[addRace] Database error:', dbError);
    return { error: `Failed to add race: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}` };
  }
}

async function addRaceResult(input: Record<string, unknown>) {
  const raceName = input.race_name as string | undefined;
  const date = input.date as string;
  const distance = input.distance as string;
  const finishTime = input.finish_time as string;
  const effortLevel = (input.effort_level as 'all_out' | 'hard' | 'moderate' | 'easy') || 'all_out';
  const conditions = input.conditions as string | undefined;
  const notes = input.notes as string | undefined;

  // Get active profile
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

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
    profileId: profileId || null,
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

async function updateRace(input: Record<string, unknown>) {
  const raceId = input.race_id as number;
  const targetTime = input.target_time as string | undefined;
  const date = input.date as string | undefined;
  const priority = input.priority as RacePriority | undefined;
  const name = input.name as string | undefined;
  const notes = input.notes as string | undefined;

  // Fetch existing race
  const existingRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!existingRace) {
    return { error: `Race with ID ${raceId} not found.` };
  }

  const updates: Partial<Race> = {
    updatedAt: new Date().toISOString(),
  };

  // Process target time change
  if (targetTime) {
    const targetTimeSeconds = parseTimeToSeconds(targetTime);
    if (!targetTimeSeconds) {
      return { error: 'Invalid target time format. Use H:MM:SS or MM:SS.' };
    }
    updates.targetTimeSeconds = targetTimeSeconds;

    // Update target pace if we have distance info
    if (existingRace.distanceMeters) {
      const miles = existingRace.distanceMeters / 1609.344;
      updates.targetPaceSecondsPerMile = Math.round(targetTimeSeconds / miles);
    }
  }

  if (date) {
    updates.date = date;
  }

  if (priority) {
    updates.priority = priority;
  }

  if (name) {
    updates.name = name;
  }

  if (notes !== undefined) {
    updates.notes = notes || null;
  }

  await db.update(races)
    .set(updates)
    .where(eq(races.id, raceId));

  // Fetch updated race
  const updatedRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  const changes: string[] = [];
  if (targetTime) changes.push(`target time to ${targetTime}`);
  if (date) changes.push(`date to ${date}`);
  if (priority) changes.push(`priority to ${priority}`);
  if (name) changes.push(`name to "${name}"`);
  if (notes !== undefined) changes.push('notes');

  return {
    success: true,
    message: `Updated ${existingRace.name}: ${changes.join(', ')}`,
    race: {
      id: updatedRace?.id,
      name: updatedRace?.name,
      date: updatedRace?.date,
      distance: updatedRace?.distanceLabel,
      priority: updatedRace?.priority,
      target_time: updatedRace?.targetTimeSeconds
        ? formatSecondsToTime(updatedRace.targetTimeSeconds)
        : null,
    },
    note: targetTime
      ? 'Consider if the training plan pace zones should be updated to reflect this new goal.'
      : undefined,
  };
}

async function deleteRace(input: Record<string, unknown>) {
  const raceId = input.race_id as number;

  // Fetch existing race
  const existingRace = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!existingRace) {
    return { error: `Race with ID ${raceId} not found.` };
  }

  await db.delete(races).where(eq(races.id, raceId));

  return {
    success: true,
    message: `Deleted race: ${existingRace.name} (${existingRace.date})`,
    deleted_race: {
      id: existingRace.id,
      name: existingRace.name,
      date: existingRace.date,
      distance: existingRace.distanceLabel,
    },
  };
}

function getTrainingPhilosophy(input: Record<string, unknown>) {
  const topic = input.topic as string | undefined;

  const philosophies: Record<string, { title: string; explanation: string; keyPoints: string[] }> = {
    periodization: {
      title: 'Training Periodization',
      explanation: 'Periodization divides training into phases with specific goals. Each phase builds on the previous one, progressing from general aerobic fitness to race-specific sharpness.',
      keyPoints: [
        'Base Phase: Build aerobic capacity with easy running, gradually increasing volume',
        'Build Phase: Introduce quality workouts (tempo, threshold) while maintaining volume',
        'Peak/Specific Phase: Race-specific workouts, VO2max, goal-pace training',
        'Taper Phase: Reduce volume while maintaining intensity to arrive fresh at race',
        'Recovery Phase: Easy running and rest after goal races',
      ],
    },
    polarized_training: {
      title: '80/20 Polarized Training',
      explanation: 'Research by Stephen Seiler shows elite endurance athletes spend ~80% of training at low intensity and ~20% at high intensity, with minimal time in the "moderate" zone. This approach maximizes aerobic development while allowing recovery.',
      keyPoints: [
        '80% easy: Zone 1-2, conversational pace, builds aerobic base without excessive stress',
        '20% hard: Zone 4-5, tempo/threshold/intervals, provides stimulus for adaptation',
        'Avoid the "gray zone": Moderate effort feels productive but compromises both recovery and stimulus',
        'Easy days truly easy, hard days truly hard',
        'Supported by Norwegian Method (even more polarized) and extensive research',
      ],
    },
    workout_types: {
      title: 'Understanding Workout Types',
      explanation: 'Different workouts target different physiological systems. A well-designed plan includes variety to develop all aspects of fitness.',
      keyPoints: [
        'Easy Runs: Aerobic development, recovery, fat oxidation (60-70% of training)',
        'Long Runs: Endurance, mental toughness, glycogen management',
        'Tempo: Lactate threshold improvement, sustained effort practice',
        'Intervals: VO2max development, running economy, speed',
        'Strides/Hills: Neuromuscular activation, form, strength',
        'Recovery: Active recovery, maintains fitness without stress',
      ],
    },
    recovery: {
      title: 'Recovery and Adaptation',
      explanation: 'Training stress + recovery = adaptation. Without adequate recovery, fitness doesn\'t improve and injury risk increases. Recovery is where gains are actually made.',
      keyPoints: [
        'Sleep: 7-9 hours; most crucial recovery factor',
        '48-hour rule: Allow 48 hours between hard efforts',
        'Down weeks: Reduce volume 20-30% every 3-4 weeks',
        'Active recovery: Easy movement beats complete rest',
        'Listen to your body: Persistent fatigue, elevated HR, poor sleep are warning signs',
        'Nutrition timing: Carbs and protein within 30 min post-workout aids recovery',
      ],
    },
    tapering: {
      title: 'Race Tapering',
      explanation: 'Tapering reduces training volume while maintaining intensity to allow the body to fully recover and peak on race day. Done correctly, it can improve performance 2-3%.',
      keyPoints: [
        'Duration: 2-3 weeks for marathon, 1-2 weeks for shorter races',
        'Volume reduction: Cut volume 40-60%, not intensity',
        'Maintain sharpness: Keep some race-pace work, shorter duration',
        'Trust the process: Feeling antsy and restless is normal',
        'Sleep more: Bank rest in final week',
        'Don\'t try anything new: Race week is not for experiments',
      ],
    },
    base_building: {
      title: 'Aerobic Base Building',
      explanation: 'The aerobic base is the foundation of all endurance performance. Building it requires patience—mostly easy running with gradual volume increases.',
      keyPoints: [
        '10% rule: Increase weekly volume no more than 10% per week',
        'Consistency > intensity: Regular easy running beats sporadic hard efforts',
        'Time on feet: Duration matters as much as pace',
        'Patience: Aerobic adaptations take 6-12 weeks to manifest',
        'Heart rate training: Keep easy runs truly easy (Zone 2)',
        'Maffetone method: 180 minus age as HR ceiling for base building',
      ],
    },
    speed_development: {
      title: 'Speed Development',
      explanation: 'Speed work improves VO2max, running economy, and neuromuscular coordination. It should be added after establishing an aerobic base.',
      keyPoints: [
        'Prerequisites: 4-6 weeks of consistent base running first',
        'Start conservative: Shorter intervals, fewer reps, longer recovery',
        'Progressive overload: Gradually increase volume or decrease rest',
        'Track work: Provides precise distance and surface',
        'Fartlek: Unstructured speed play, good introduction to faster running',
        'Recovery: Quality over quantity; skip if overly fatigued',
      ],
    },
    long_runs: {
      title: 'Long Run Philosophy',
      explanation: 'The long run is the cornerstone of distance training. It builds endurance, mental toughness, and teaches the body to use fat for fuel.',
      keyPoints: [
        'Easy pace: Most long runs should be conversational, 1-2 min slower than race pace',
        'Progressive: Finish faster than you start, negative splits',
        'Race-pace segments: Include goal-pace miles in later phases',
        'Fueling practice: Long runs are the time to test race nutrition',
        'Peak distance: 20-22 miles for marathon, 12-15 for half marathon',
        'Recovery: May need 2-3 days of easy running after longest runs',
      ],
    },
    race_pacing: {
      title: 'Race Pacing Strategy',
      explanation: 'Even pacing (or slight negative splits) is the most efficient way to race. Starting too fast leads to disproportionate energy expenditure and late-race struggles.',
      keyPoints: [
        'Even splits: Aim for consistent mile times throughout',
        'Bank time myth: Going out fast doesn\'t "bank" time, it costs it',
        'First mile: Should feel easy, almost too slow',
        'Negative split: Slightly faster second half is ideal',
        'Know your limits: Pace should feel sustainable at halfway',
        'Weather adjustment: Slow pace 1-2%+ for heat, humidity, wind',
      ],
    },
  };

  if (topic && philosophies[topic]) {
    return philosophies[topic];
  }

  // Return overview of all topics
  return {
    available_topics: Object.entries(philosophies).map(([key, value]) => ({
      topic: key,
      title: value.title,
    })),
    note: 'Call again with a specific topic for detailed information.',
  };
}

async function suggestPlanAdjustment(input: Record<string, unknown>) {
  const reason = input.reason as string;
  const weeksAffected = (input.weeks_affected as number) || 1;

  // Gather context
  const [settings, recentWorkouts, injuries, fatigueData] = await Promise.all([
    db.query.userSettings.findFirst(),
    db.query.workouts.findMany({
      orderBy: [desc(workouts.date)],
      limit: 14,
      with: { assessment: true },
    }),
    getInjuryStatus(),
    getFatigueIndicators({}),
  ]);

  // Get upcoming planned workouts
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 14);
  const upcomingPlanned = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, today),
      lte(plannedWorkouts.date, nextWeek.toISOString().split('T')[0])
    ),
    orderBy: [asc(plannedWorkouts.date)],
    limit: 14,
  });

  // Analyze the situation
  const completedWorkouts = recentWorkouts.filter((w: Workout) => w.date >= getDateDaysAgo(14));
  const recentRPEs = completedWorkouts
    .map((w: Workout & { assessment?: Assessment | null }) => w.assessment?.rpe)
    .filter((rpe: number | undefined | null): rpe is number => rpe !== undefined && rpe !== null);
  const avgRPE = recentRPEs.length > 0
    ? recentRPEs.reduce((a: number, b: number) => a + b, 0) / recentRPEs.length
    : null;

  const suggestions: string[] = [];
  const actions: string[] = [];

  // Analyze reason
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('illness') || reasonLower.includes('sick') || reasonLower.includes('flu') || reasonLower.includes('cold')) {
    suggestions.push('After illness, return gradually. Start with easy running at reduced volume.');
    suggestions.push('Listen to your body - if you feel worse during a run, stop.');
    if (weeksAffected >= 2) {
      actions.push('Use convert_to_easy to make the first 3-4 days back all easy runs');
      actions.push('Use adjust_workout_distance to reduce distances by 30-40% in week 1 back');
      suggestions.push('Consider skipping quality workouts for the first week back.');
    } else {
      actions.push('Use convert_to_easy for the first 2-3 days back');
      suggestions.push('Resume quality work cautiously in the second week back.');
    }
  }

  if (reasonLower.includes('missed') || reasonLower.includes('break') || reasonLower.includes('vacation')) {
    suggestions.push(`After ${weeksAffected} week(s) off, rebuild gradually.`);
    if (weeksAffected >= 3) {
      suggestions.push('Significant time off requires 2-3 weeks of base rebuilding before quality work.');
      actions.push('Use make_down_week for the first week back');
      actions.push('Use skip_workout to skip the most intense quality sessions for 2 weeks');
    } else if (weeksAffected >= 1) {
      suggestions.push('A week or two off is okay - ease back but you\'ll regain fitness quickly.');
      actions.push('Use adjust_workout_distance to reduce distances by 20-30% in week 1');
    }
  }

  if (reasonLower.includes('overtrain') || reasonLower.includes('tired') || reasonLower.includes('fatigue') || reasonLower.includes('exhausted')) {
    suggestions.push('Signs of overtraining require immediate recovery focus.');
    suggestions.push('Cut volume and intensity significantly until you feel fresh again.');
    actions.push('Use make_down_week to reduce this week\'s load');
    actions.push('Use convert_to_easy to remove intensity from upcoming quality days');
    if (avgRPE && avgRPE > 7) {
      suggestions.push(`Your recent average RPE (${avgRPE.toFixed(1)}) is high - confirming need for recovery.`);
    }
  }

  if (reasonLower.includes('injury') || reasonLower.includes('pain') || reasonLower.includes('hurt')) {
    suggestions.push('Injury requires careful management. When in doubt, rest.');
    suggestions.push('See a medical professional if pain persists.');
    actions.push('Use log_injury to track the injury and get restricted workout guidance');
    actions.push('Use skip_workout or convert_to_easy for any workouts that aggravate it');
  }

  if (reasonLower.includes('race') && (reasonLower.includes('change') || reasonLower.includes('moved') || reasonLower.includes('different'))) {
    suggestions.push('Race date changes may require plan restructuring.');
    actions.push('Use update_race to update the race date');
    suggestions.push('If the race moved earlier, consider condensing the build phase.');
    suggestions.push('If the race moved later, you can extend base or add a mini-taper cycle.');
  }

  if (reasonLower.includes('busy') || reasonLower.includes('travel') || reasonLower.includes('work') || reasonLower.includes('stress')) {
    suggestions.push('High life stress impacts recovery - training should be adjusted.');
    suggestions.push('Prioritize sleep over training volume during busy periods.');
    actions.push('Use adjust_workout_distance to shorten workouts if time-crunched');
    actions.push('Use set_travel_status if traveling to track context');
    suggestions.push('Keep some running to maintain fitness but reduce expectations.');
  }

  // Add general guidance if no specific pattern matched
  if (suggestions.length === 0) {
    suggestions.push('When adjusting the plan, preserve key workouts if possible.');
    suggestions.push('Long runs and one quality session per week maintain fitness.');
    actions.push('Use get_week_workouts to see current week and identify what can flex');
    actions.push('Use swap_workouts if days need to be rearranged');
  }

  // Add injury context if relevant
  const injuryStatus = injuries as { has_active_injury?: boolean; active_injuries?: unknown[] };
  if (injuryStatus.has_active_injury) {
    suggestions.push('Note: You have active injuries logged - factor these into any plan changes.');
  }

  // Add fatigue context
  const fatigue = fatigueData as { fatigue_score?: number; recommendation?: string };
  if (fatigue.fatigue_score && fatigue.fatigue_score > 6) {
    suggestions.push(`Current fatigue level is elevated (${fatigue.fatigue_score}/10) - err on the side of more rest.`);
  }

  return {
    situation: reason,
    weeks_affected: weeksAffected,
    suggestions,
    recommended_tools: actions,
    context: {
      recent_avg_rpe: avgRPE?.toFixed(1) || 'unknown',
      upcoming_workouts_count: upcomingPlanned.length,
      active_injuries: injuryStatus.has_active_injury || false,
      fatigue_level: fatigue.fatigue_score || 'unknown',
    },
    general_principle: 'Consistency over time matters more than any single week. It\'s better to do less and stay healthy than push through and get injured.',
  };
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function modifyTodaysWorkout(input: Record<string, unknown>) {
  const { plannedWorkouts } = await import('@/lib/db');

  const action = input.action as 'scale_down' | 'skip' | 'mark_complete';
  const scaleFactor = (input.scale_factor as number) || 0.75;
  const reason = input.reason as string | undefined;
  const isPreview = input.preview === true;

  const today = new Date().toISOString().split('T')[0];

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!workout) {
    return { error: 'No planned workout for today.' };
  }

  // Calculate what would change for preview
  const newDistance = workout.targetDistanceMiles
    ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
    : null;
  const newDuration = workout.targetDurationMinutes
    ? Math.round(workout.targetDurationMinutes * scaleFactor)
    : null;

  // If preview mode, return what would change without applying
  if (isPreview) {
    switch (action) {
      case 'scale_down':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be scaled:`,
          changes: [
            workout.targetDistanceMiles
              ? `• Distance: ${workout.targetDistanceMiles} mi → ${newDistance} mi (${Math.round(scaleFactor * 100)}%)`
              : null,
            workout.targetDurationMinutes
              ? `• Duration: ${workout.targetDurationMinutes} min → ${newDuration} min`
              : null,
          ].filter(Boolean),
          workout: {
            id: workout.id,
            name: workout.name,
            current: {
              distance: workout.targetDistanceMiles,
              duration: workout.targetDurationMinutes,
            },
            proposed: {
              distance: newDistance,
              duration: newDuration,
            },
          },
          confirm_prompt: 'Would you like me to apply this modification?',
        };

      case 'skip':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be marked as skipped.`,
          changes: [
            `• Status: scheduled → skipped`,
            reason ? `• Reason: ${reason}` : null,
          ].filter(Boolean),
          workout: {
            id: workout.id,
            name: workout.name,
            type: workout.workoutType,
            distance: workout.targetDistanceMiles,
          },
          confirm_prompt: 'Would you like me to skip this workout?',
        };

      case 'mark_complete':
        return {
          success: true,
          preview: true,
          message: `Preview: Today's workout "${workout.name}" would be marked as complete.`,
          changes: [`• Status: scheduled → completed`],
          workout: {
            id: workout.id,
            name: workout.name,
          },
          confirm_prompt: 'Would you like me to mark this workout as complete?',
        };

      default:
        return { error: 'Unknown action' };
    }
  }

  // Apply the changes
  const now = new Date().toISOString();

  switch (action) {
    case 'scale_down':
      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          targetDurationMinutes: newDuration,
          rationale: `${workout.rationale || ''} (Scaled to ${Math.round(scaleFactor * 100)}%${reason ? ': ' + reason : ''})`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      return {
        success: true,
        message: `Workout scaled to ${Math.round(scaleFactor * 100)}%`,
        new_distance: newDistance,
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

// Get planned workout for a specific date
async function getPlannedWorkoutByDate(input: Record<string, unknown>) {
  console.log(`=== [getPlannedWorkoutByDate] START === at ${new Date().toISOString()}`);
  console.log(`[getPlannedWorkoutByDate] Input:`, JSON.stringify(input));

  let dateStr = input.date as string;

  // Handle "tomorrow" conversion
  if (dateStr === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateStr = tomorrow.toISOString().split('T')[0];
    console.log(`[getPlannedWorkoutByDate] Converted 'tomorrow' to:`, dateStr);
  }

  console.log(`[getPlannedWorkoutByDate] Querying DB for date:`, dateStr);
  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, dateStr),
  });
  console.log(`[getPlannedWorkoutByDate] DB query result:`, workout ? 'Found workout' : 'No workout found');

  if (!workout) {
    const notFoundResult = {
      found: false,
      date: dateStr,
      message: `No planned workout for ${dateStr}.`,
      suggestion: 'Use suggest_next_workout or prescribe_workout to get a workout recommendation.',
    };
    console.log(`=== [getPlannedWorkoutByDate] END (not found) === at ${new Date().toISOString()}`);
    return notFoundResult;
  }

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const result = {
    found: true,
    date: dateStr,
    workout: {
      id: workout.id,
      date: workout.date,
      name: workout.name,
      workout_type: workout.workoutType,
      description: workout.description,
      target_distance_miles: workout.targetDistanceMiles,
      target_duration_minutes: workout.targetDurationMinutes,
      target_pace: workout.targetPaceSecondsPerMile ? formatPace(workout.targetPaceSecondsPerMile) : null,
      rationale: workout.rationale,
      is_key_workout: workout.isKeyWorkout,
      status: workout.status,
      structure: workout.structure ? JSON.parse(workout.structure) : null,
    },
    message: `${workout.name} planned for ${dateStr}`,
  };

  console.log(`=== [getPlannedWorkoutByDate] END (found) === at ${new Date().toISOString()}`);
  console.log(`[getPlannedWorkoutByDate] Result:`, JSON.stringify(result).slice(0, 200));
  return result;
}

// Update a planned workout (with optional preview mode)
async function updatePlannedWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const isPreview = input.preview === true;

  const existing = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!existing) {
    return { success: false, error: 'Planned workout not found' };
  }

  // Build the updates
  const updates: Record<string, unknown> = {};
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  if (input.name && input.name !== existing.name) {
    updates.name = input.name;
    changes.push({ field: 'name', from: existing.name, to: input.name });
  }
  if (input.description && input.description !== existing.description) {
    updates.description = input.description;
    changes.push({ field: 'description', from: existing.description?.substring(0, 50) + '...', to: (input.description as string).substring(0, 50) + '...' });
  }
  if (input.target_distance_miles && input.target_distance_miles !== existing.targetDistanceMiles) {
    updates.targetDistanceMiles = input.target_distance_miles;
    changes.push({ field: 'distance', from: `${existing.targetDistanceMiles} mi`, to: `${input.target_distance_miles} mi` });
  }
  if (input.workout_type && input.workout_type !== existing.workoutType) {
    updates.workoutType = input.workout_type;
    changes.push({ field: 'type', from: existing.workoutType, to: input.workout_type });
  }
  if (input.rationale) {
    updates.rationale = input.rationale;
  }

  if (input.target_pace_per_mile) {
    const paceStr = input.target_pace_per_mile as string;
    const [mins, secs] = paceStr.split(':').map(Number);
    const newPace = mins * 60 + (secs || 0);
    if (newPace !== existing.targetPaceSecondsPerMile) {
      updates.targetPaceSecondsPerMile = newPace;
      const oldPace = existing.targetPaceSecondsPerMile
        ? `${Math.floor(existing.targetPaceSecondsPerMile / 60)}:${String(existing.targetPaceSecondsPerMile % 60).padStart(2, '0')}`
        : 'none';
      changes.push({ field: 'pace', from: oldPace, to: paceStr });
    }
  }

  // If preview mode, return what would change without applying
  if (isPreview) {
    if (changes.length === 0) {
      return {
        success: true,
        preview: true,
        message: 'No changes detected - workout already matches the requested values.',
        workout: {
          id: existing.id,
          name: existing.name,
          date: existing.date,
        },
      };
    }

    return {
      success: true,
      preview: true,
      message: `Preview: The following changes would be applied to "${existing.name}" on ${existing.date}:`,
      changes: changes.map(c => `• ${c.field}: ${c.from} → ${c.to}`),
      workout: {
        id: existing.id,
        name: existing.name,
        date: existing.date,
        current: {
          name: existing.name,
          type: existing.workoutType,
          distance: existing.targetDistanceMiles,
          pace: existing.targetPaceSecondsPerMile,
        },
        proposed: {
          name: updates.name || existing.name,
          type: updates.workoutType || existing.workoutType,
          distance: updates.targetDistanceMiles || existing.targetDistanceMiles,
          pace: updates.targetPaceSecondsPerMile || existing.targetPaceSecondsPerMile,
        },
      },
      confirm_prompt: 'Would you like me to apply these changes?',
    };
  }

  // Apply the changes
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    await db.update(plannedWorkouts)
      .set(updates)
      .where(eq(plannedWorkouts.id, workoutId));
  }

  return {
    success: true,
    message: `Updated planned workout: ${updates.name || existing.name}`,
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

// Swap two planned workouts by exchanging their dates (with optional preview mode)
async function swapWorkouts(input: Record<string, unknown>) {
  const workoutId1 = input.workout_id_1 as number;
  const workoutId2 = input.workout_id_2 as number;
  const reason = input.reason as string | undefined;
  const isPreview = input.preview === true;

  const workout1 = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId1),
  });

  const workout2 = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId2),
  });

  if (!workout1 || !workout2) {
    return {
      success: false,
      error: `Workout not found: ${!workout1 ? workoutId1 : workoutId2}`
    };
  }

  const date1 = workout1.date;
  const date2 = workout2.date;

  // Format dates for display
  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // If preview mode, return what would change without applying
  if (isPreview) {
    return {
      success: true,
      preview: true,
      message: `Preview: The following swap would be applied:`,
      changes: [
        `• ${workout1.name}: ${formatDate(date1)} → ${formatDate(date2)}`,
        `• ${workout2.name}: ${formatDate(date2)} → ${formatDate(date1)}`,
      ],
      workout_1: {
        id: workout1.id,
        name: workout1.name,
        type: workout1.workoutType,
        current_date: date1,
        proposed_date: date2,
      },
      workout_2: {
        id: workout2.id,
        name: workout2.name,
        type: workout2.workoutType,
        current_date: date2,
        proposed_date: date1,
      },
      confirm_prompt: 'Would you like me to swap these workouts?',
    };
  }

  // Apply the swap
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      date: date2,
      rationale: `${workout1.rationale || ''} (Swapped with ${workout2.name}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId1));

  await db.update(plannedWorkouts)
    .set({
      date: date1,
      rationale: `${workout2.rationale || ''} (Swapped with ${workout1.name}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId2));

  return {
    success: true,
    message: `Swapped workouts: ${workout1.name} (now ${formatDate(date2)}) ↔ ${workout2.name} (now ${formatDate(date1)})`,
    workout_1: {
      id: workout1.id,
      name: workout1.name,
      original_date: date1,
      new_date: date2,
    },
    workout_2: {
      id: workout2.id,
      name: workout2.name,
      original_date: date2,
      new_date: date1,
    },
  };
}

// Reschedule a workout to a different date
async function rescheduleWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const newDate = input.new_date as string;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const originalDate = workout.date;
  const now = new Date().toISOString();

  // Check if there's already a workout on the target date
  const existingOnNewDate = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, newDate),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  await db.update(plannedWorkouts)
    .set({
      date: newDate,
      rationale: `${workout.rationale || ''} (Moved from ${originalDate}${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  return {
    success: true,
    message: `Moved ${workout.name} from ${originalDate} to ${newDate}`,
    workout: {
      id: workout.id,
      name: workout.name,
      original_date: originalDate,
      new_date: newDate,
    },
    warning: existingOnNewDate
      ? `Note: There's already a ${existingOnNewDate.name} scheduled for ${newDate}. You may want to swap or reschedule that one too.`
      : undefined,
  };
}

// Skip a planned workout
async function skipWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      status: 'skipped',
      rationale: `${workout.rationale || ''} (Skipped${reason ? ': ' + reason : ''})`,
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  return {
    success: true,
    message: `Skipped ${workout.name} on ${workout.date}`,
    workout: {
      id: workout.id,
      name: workout.name,
      date: workout.date,
      was_key_workout: workout.isKeyWorkout,
    },
    note: workout.isKeyWorkout
      ? "This was a key workout. If possible, consider rescheduling rather than skipping entirely."
      : "One day won't break your training. Listen to your body.",
  };
}

// Get all workouts for a specific week
async function getWeekWorkouts(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) || 0;

  // Calculate the start and end of the target week
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get to Monday

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const workoutsForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  const formatPace = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    week_start: startStr,
    week_end: endStr,
    week_offset: weekOffset,
    workouts: workoutsForWeek.map((w: PlannedWorkout) => ({
      id: w.id,
      date: w.date,
      day_of_week: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      name: w.name,
      workout_type: w.workoutType,
      target_distance_miles: w.targetDistanceMiles,
      target_pace: formatPace(w.targetPaceSecondsPerMile),
      description: w.description,
      is_key_workout: w.isKeyWorkout,
      status: w.status,
    })),
    total_planned_miles: workoutsForWeek.reduce((sum: number, w: PlannedWorkout) => sum + (w.targetDistanceMiles || 0), 0),
  };
}

// Make a week into a down/recovery week
async function makeDownWeek(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) || 0;
  const reductionPercent = (input.reduction_percent as number) || 30;
  const keepLongRun = input.keep_long_run !== false; // default true
  const reason = input.reason as string | undefined;

  // Calculate the start and end of the target week
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const workoutsForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  if (workoutsForWeek.length === 0) {
    return { success: false, error: 'No scheduled workouts found for this week.' };
  }

  const now = new Date().toISOString();
  const scaleFactor = (100 - reductionPercent) / 100;
  const modifications: Array<{ name: string; change: string }> = [];

  for (const workout of workoutsForWeek) {
    const isLongRun = workout.workoutType === 'long';
    const isQuality = ['tempo', 'interval', 'threshold', 'fartlek'].includes(workout.workoutType);

    if (isLongRun && keepLongRun) {
      // Reduce long run distance but keep it
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          rationale: `${workout.rationale || ''} (Recovery week: reduced to ${Math.round(scaleFactor * 100)}%)`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Reduced from ${workout.targetDistanceMiles}mi to ${newDistance}mi`,
      });
    } else if (isQuality) {
      // Convert quality sessions to easy runs
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10 // 80% of original distance as easy
        : null;

      await db.update(plannedWorkouts)
        .set({
          name: 'Easy Run',
          workoutType: 'easy',
          targetDistanceMiles: newDistance,
          description: `Easy recovery run (originally: ${workout.name})`,
          rationale: `${workout.rationale || ''} (Recovery week: converted to easy)`,
          isKeyWorkout: false,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Converted to easy ${newDistance}mi`,
      });
    } else {
      // Easy runs - just reduce distance
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          rationale: `${workout.rationale || ''} (Recovery week)`,
          status: 'modified',
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, workout.id));

      modifications.push({
        name: workout.name,
        change: `Reduced to ${newDistance}mi`,
      });
    }
  }

  const originalMiles = workoutsForWeek.reduce((sum: number, w: { targetDistanceMiles: number | null }) => sum + (w.targetDistanceMiles || 0), 0);

  // Recalculate after modifications
  const updatedWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
  });
  const newMiles = updatedWorkouts.reduce((sum: number, w: { targetDistanceMiles: number | null }) => sum + (w.targetDistanceMiles || 0), 0);

  return {
    success: true,
    message: `Made week of ${startStr} a recovery week`,
    reason: reason || 'Recovery/down week',
    original_miles: Math.round(originalMiles * 10) / 10,
    new_miles: Math.round(newMiles * 10) / 10,
    reduction: `${reductionPercent}%`,
    modifications,
    note: 'Quality sessions converted to easy runs. This week is about recovery—listen to your body.',
  };
}

// Insert a rest day
async function insertRestDay(input: Record<string, unknown>) {
  const date = input.date as string;
  const pushWorkouts = (input.push_workouts as boolean) || false;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: and(
      eq(plannedWorkouts.date, date),
      eq(plannedWorkouts.status, 'scheduled')
    ),
  });

  if (!workout) {
    return {
      success: true,
      message: `${date} is already a rest day (no workout scheduled).`,
    };
  }

  const now = new Date().toISOString();

  if (pushWorkouts) {
    // Get all workouts from this date to end of week and push them forward
    const workoutDate = new Date(date + 'T12:00:00');
    const dayOfWeek = workoutDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    const weekEnd = new Date(workoutDate);
    weekEnd.setDate(workoutDate.getDate() + daysUntilSunday);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const workoutsToShift = await db.query.plannedWorkouts.findMany({
      where: and(
        gte(plannedWorkouts.date, date),
        lte(plannedWorkouts.date, weekEndStr),
        eq(plannedWorkouts.status, 'scheduled')
      ),
      orderBy: [desc(plannedWorkouts.date)], // Process from end to avoid collisions
    });

    const shifted: string[] = [];
    for (const w of workoutsToShift) {
      const oldDate = new Date(w.date + 'T12:00:00');
      oldDate.setDate(oldDate.getDate() + 1);
      const newDate = oldDate.toISOString().split('T')[0];

      await db.update(plannedWorkouts)
        .set({
          date: newDate,
          rationale: `${w.rationale || ''} (Shifted +1 day${reason ? ': ' + reason : ''})`,
          updatedAt: now,
        })
        .where(eq(plannedWorkouts.id, w.id));

      shifted.push(`${w.name}: ${w.date} → ${newDate}`);
    }

    return {
      success: true,
      message: `Inserted rest day on ${date}. Pushed ${workoutsToShift.length} workouts forward.`,
      reason,
      shifted_workouts: shifted,
      warning: 'Note: Workouts may now extend into next week. Review your schedule.',
    };
  } else {
    // Just skip the workout on this day
    await db.update(plannedWorkouts)
      .set({
        status: 'skipped',
        rationale: `${workout.rationale || ''} (Rest day inserted${reason ? ': ' + reason : ''})`,
        updatedAt: now,
      })
      .where(eq(plannedWorkouts.id, workout.id));

    return {
      success: true,
      message: `Made ${date} a rest day. Skipped: ${workout.name}`,
      skipped_workout: {
        name: workout.name,
        type: workout.workoutType,
        was_key_workout: workout.isKeyWorkout,
      },
      reason,
      note: workout.isKeyWorkout
        ? 'This was a key workout. Consider rescheduling it to another day if possible.'
        : 'Rest is part of training. You\'ll come back stronger.',
    };
  }
}

// Adjust workout distance
async function adjustWorkoutDistance(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const newDistance = input.new_distance_miles as number;
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  const oldDistance = workout.targetDistanceMiles;
  const now = new Date().toISOString();

  await db.update(plannedWorkouts)
    .set({
      targetDistanceMiles: newDistance,
      rationale: `${workout.rationale || ''} (Distance adjusted from ${oldDistance}mi to ${newDistance}mi${reason ? ': ' + reason : ''})`,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  const changeDirection = newDistance > (oldDistance || 0) ? 'increased' : 'reduced';

  return {
    success: true,
    message: `${workout.name} on ${workout.date}: ${changeDirection} from ${oldDistance}mi to ${newDistance}mi`,
    workout: {
      id: workout.id,
      name: workout.name,
      date: workout.date,
      old_distance: oldDistance,
      new_distance: newDistance,
    },
  };
}

// Convert a quality workout to an easy run
async function convertToEasy(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const keepDistance = input.keep_distance !== false; // default true
  const reason = input.reason as string | undefined;

  const workout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.id, workoutId),
  });

  if (!workout) {
    return { success: false, error: 'Planned workout not found' };
  }

  if (workout.workoutType === 'easy' || workout.workoutType === 'recovery') {
    return {
      success: true,
      message: `${workout.name} is already an easy/recovery run.`,
      no_change: true,
    };
  }

  const now = new Date().toISOString();
  const originalName = workout.name;
  const originalType = workout.workoutType;
  const newDistance = keepDistance
    ? workout.targetDistanceMiles
    : workout.targetDistanceMiles
      ? Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10
      : null;

  await db.update(plannedWorkouts)
    .set({
      name: 'Easy Run',
      workoutType: 'easy',
      targetDistanceMiles: newDistance,
      targetPaceSecondsPerMile: null, // Remove pace target for easy
      description: `Easy run (originally: ${originalName})`,
      rationale: `${workout.rationale || ''} (Converted to easy${reason ? ': ' + reason : ''})`,
      isKeyWorkout: false,
      status: 'modified',
      updatedAt: now,
    })
    .where(eq(plannedWorkouts.id, workoutId));

  return {
    success: true,
    message: `Converted ${originalName} to easy ${newDistance}mi run`,
    original: {
      name: originalName,
      type: originalType,
      distance: workout.targetDistanceMiles,
    },
    new: {
      name: 'Easy Run',
      type: 'easy',
      distance: newDistance,
    },
    date: workout.date,
    note: 'Sometimes an easy day is the smartest workout. You\'ll absorb previous training better.',
  };
}

// ============================================================
// RPE-BASED FITNESS ANALYSIS TOOLS
// ============================================================

/**
 * Analyze fitness trend using pace-to-RPE efficiency.
 * The idea: if you're getting faster at the same RPE, you're getting fitter.
 * Works best with easy runs since they should be at consistent effort.
 */
async function getFitnessTrend(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 8;
  const workoutType = input.workout_type as string | undefined;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Get workouts with both pace and RPE data
  const allWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  // Filter to workouts with pace and RPE
  let relevantWorkouts = allWorkouts.filter((w: WorkoutWithRelations) =>
    w.avgPaceSeconds &&
    w.assessment?.rpe &&
    w.distanceMiles && w.distanceMiles >= 2 // At least 2 miles for meaningful data
  );

  if (workoutType) {
    relevantWorkouts = relevantWorkouts.filter((w: WorkoutWithRelations) => w.workoutType === workoutType);
  } else {
    // Default to easy runs for most consistent comparison
    relevantWorkouts = relevantWorkouts.filter((w: WorkoutWithRelations) =>
      w.workoutType === 'easy' || w.workoutType === 'recovery' || w.workoutType === 'long'
    );
  }

  if (relevantWorkouts.length < 4) {
    return {
      has_sufficient_data: false,
      message: `Not enough workouts with pace and RPE data (found ${relevantWorkouts.length}, need at least 4).`,
      tip: 'Log RPE with your runs to enable fitness trend analysis.',
    };
  }

  // Calculate efficiency score for each workout: seconds/mile per RPE point
  // Lower is better (faster pace at same effort)
  const dataPoints = relevantWorkouts.map((w: WorkoutWithRelations) => ({
    date: w.date,
    pace_seconds: w.avgPaceSeconds!,
    rpe: w.assessment!.rpe,
    efficiency: w.avgPaceSeconds! / w.assessment!.rpe, // seconds per RPE point
    type: w.workoutType,
  }));

  // Split into early period and recent period
  const midpoint = Math.floor(dataPoints.length / 2);
  const earlyPeriod = dataPoints.slice(0, midpoint);
  const recentPeriod = dataPoints.slice(midpoint);

  const avgEarlyEfficiency = earlyPeriod.reduce((sum, d) => sum + d.efficiency, 0) / earlyPeriod.length;
  const avgRecentEfficiency = recentPeriod.reduce((sum, d) => sum + d.efficiency, 0) / recentPeriod.length;

  // Calculate percentage change (negative is improvement)
  const efficiencyChange = ((avgRecentEfficiency - avgEarlyEfficiency) / avgEarlyEfficiency) * 100;

  // Also look at pace at similar RPE
  const targetRpe = 5; // Use RPE 5 as baseline for easy running
  const earlyAtTargetRpe = earlyPeriod.filter(d => d.rpe >= targetRpe - 1 && d.rpe <= targetRpe + 1);
  const recentAtTargetRpe = recentPeriod.filter(d => d.rpe >= targetRpe - 1 && d.rpe <= targetRpe + 1);

  let paceComparison = null;
  if (earlyAtTargetRpe.length >= 2 && recentAtTargetRpe.length >= 2) {
    const avgEarlyPace = earlyAtTargetRpe.reduce((sum, d) => sum + d.pace_seconds, 0) / earlyAtTargetRpe.length;
    const avgRecentPace = recentAtTargetRpe.reduce((sum, d) => sum + d.pace_seconds, 0) / recentAtTargetRpe.length;
    paceComparison = {
      early_avg_pace: formatPaceFromTraining(Math.round(avgEarlyPace)),
      recent_avg_pace: formatPaceFromTraining(Math.round(avgRecentPace)),
      change_seconds: Math.round(avgRecentPace - avgEarlyPace),
      at_rpe: `${targetRpe - 1}-${targetRpe + 1}`,
    };
  }

  // Determine trend
  let trend: string;
  let interpretation: string;

  if (efficiencyChange < -5) {
    trend = 'Improving';
    interpretation = 'You\'re getting faster at the same effort level—fitness is building.';
  } else if (efficiencyChange > 5) {
    trend = 'Declining';
    interpretation = 'Running feels harder for the same pace. Could be fatigue accumulation, or external factors (heat, stress, sleep).';
  } else {
    trend = 'Stable';
    interpretation = 'Fitness is holding steady. Consistent training is working.';
  }

  return {
    has_sufficient_data: true,
    workouts_analyzed: relevantWorkouts.length,
    period: `${weeksBack} weeks`,
    workout_type_filter: workoutType || 'easy/recovery/long runs',

    efficiency_trend: {
      early_period_efficiency: Math.round(avgEarlyEfficiency * 10) / 10,
      recent_period_efficiency: Math.round(avgRecentEfficiency * 10) / 10,
      change_percent: Math.round(efficiencyChange * 10) / 10,
      note: 'Efficiency = pace (sec/mi) per RPE point. Lower is better.',
    },

    pace_at_similar_effort: paceComparison,

    trend,
    interpretation,

    recent_data_points: dataPoints.slice(-5).map(d => ({
      date: d.date,
      pace: formatPaceFromTraining(d.pace_seconds),
      rpe: d.rpe,
    })),
  };
}

/**
 * Analyze recovery patterns after hard efforts.
 * How do they bounce back? Are easy days truly easy?
 */
async function analyzeRecoveryPattern(input: Record<string, unknown>) {
  const weeksBack = (input.weeks_back as number) || 6;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const allWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  if (allWorkouts.length < 6) {
    return {
      has_sufficient_data: false,
      message: 'Need more workout data to analyze recovery patterns.',
    };
  }

  // Identify hard efforts (tempo, interval, long, or high RPE)
  const hardEfforts = allWorkouts.filter((w: WorkoutWithRelations) =>
    w.workoutType === 'tempo' ||
    w.workoutType === 'interval' ||
    w.workoutType === 'steady' ||
    w.workoutType === 'long' ||
    (w.assessment?.rpe && w.assessment.rpe >= 7)
  );

  // Look at the workout AFTER each hard effort
  const recoveryAnalysis: Array<{
    hard_workout: string;
    hard_date: string;
    next_workout: string;
    next_date: string;
    days_between: number;
    next_rpe: number | null;
    next_legs_feel: number | null;
    next_verdict: string | null;
    recovery_quality: string;
  }> = [];

  for (const hardWorkout of hardEfforts) {
    const hardDate = new Date(hardWorkout.date + 'T12:00:00');

    // Find the next workout
    const nextWorkout = allWorkouts.find((w: WorkoutWithRelations) => {
      const wDate = new Date(w.date + 'T12:00:00');
      return wDate > hardDate;
    });

    if (nextWorkout && nextWorkout.assessment) {
      const nextDate = new Date(nextWorkout.date + 'T12:00:00');
      const daysBetween = Math.round((nextDate.getTime() - hardDate.getTime()) / (1000 * 60 * 60 * 24));

      // Assess recovery quality
      let recoveryQuality = 'Unknown';
      const nextRpe = nextWorkout.assessment.rpe;
      const nextLegsFeel = nextWorkout.assessment.legsFeel;
      const nextVerdict = nextWorkout.assessment.verdict;

      if (nextWorkout.workoutType === 'easy' || nextWorkout.workoutType === 'recovery') {
        // For easy runs, high RPE or bad legs = poor recovery
        if (nextRpe && nextRpe >= 6) {
          recoveryQuality = 'Sluggish';
        } else if (nextLegsFeel !== null && nextLegsFeel >= 7) {
          recoveryQuality = 'Heavy legs';
        } else if (nextVerdict === 'rough' || nextVerdict === 'awful') {
          recoveryQuality = 'Struggled';
        } else if (nextVerdict === 'great' || nextVerdict === 'good') {
          recoveryQuality = 'Good';
        } else {
          recoveryQuality = 'Adequate';
        }
      } else {
        // For quality sessions, check if they could perform
        if (nextVerdict === 'great' || nextVerdict === 'good') {
          recoveryQuality = 'Performed well';
        } else if (nextVerdict === 'rough' || nextVerdict === 'awful') {
          recoveryQuality = 'Underperformed';
        } else {
          recoveryQuality = 'Adequate';
        }
      }

      recoveryAnalysis.push({
        hard_workout: `${hardWorkout.workoutType} (${hardWorkout.distanceMiles}mi)`,
        hard_date: hardWorkout.date,
        next_workout: `${nextWorkout.workoutType} (${nextWorkout.distanceMiles}mi)`,
        next_date: nextWorkout.date,
        days_between: daysBetween,
        next_rpe: nextRpe || null,
        next_legs_feel: nextLegsFeel || null,
        next_verdict: nextVerdict || null,
        recovery_quality: recoveryQuality,
      });
    }
  }

  // Summarize patterns
  const goodRecoveries = recoveryAnalysis.filter(r =>
    r.recovery_quality === 'Good' || r.recovery_quality === 'Adequate' || r.recovery_quality === 'Performed well'
  ).length;
  const poorRecoveries = recoveryAnalysis.filter(r =>
    r.recovery_quality === 'Sluggish' || r.recovery_quality === 'Heavy legs' ||
    r.recovery_quality === 'Struggled' || r.recovery_quality === 'Underperformed'
  ).length;

  const avgDaysBetween = recoveryAnalysis.length > 0
    ? Math.round(recoveryAnalysis.reduce((sum, r) => sum + r.days_between, 0) / recoveryAnalysis.length * 10) / 10
    : 0;

  // Insights
  const insights: string[] = [];

  if (poorRecoveries > goodRecoveries) {
    insights.push('Recovery is a pattern issue. Consider more rest between hard efforts or easier easy days.');
  }

  if (avgDaysBetween < 1.5 && poorRecoveries > 2) {
    insights.push('Hard efforts are close together. May need more recovery time between quality sessions.');
  }

  const backToBackHard = recoveryAnalysis.filter(r =>
    r.days_between <= 1 &&
    (r.next_workout.includes('tempo') || r.next_workout.includes('interval') || r.next_workout.includes('long'))
  );
  if (backToBackHard.length > 0) {
    insights.push(`${backToBackHard.length} instances of back-to-back hard efforts. This can work (Hansons style) but requires good overall recovery.`);
  }

  return {
    has_sufficient_data: true,
    hard_efforts_analyzed: hardEfforts.length,
    recovery_instances: recoveryAnalysis.length,

    summary: {
      good_recoveries: goodRecoveries,
      poor_recoveries: poorRecoveries,
      avg_days_between_hard_efforts: avgDaysBetween,
    },

    insights,

    recent_recovery_data: recoveryAnalysis.slice(-5),
  };
}

/**
 * Compare two workouts side-by-side
 */
async function compareWorkouts(input: Record<string, unknown>) {
  const workoutId1 = input.workout_id_1 as number;
  const workoutId2 = input.workout_id_2 as number;

  const workout1 = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId1),
    with: { assessment: true, shoe: true },
  });

  const workout2 = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId2),
    with: { assessment: true, shoe: true },
  });

  if (!workout1 || !workout2) {
    return { success: false, error: `Workout not found: ${!workout1 ? workoutId1 : workoutId2}` };
  }

  const formatWorkout = (w: WorkoutWithRelations) => ({
    id: w.id,
    date: w.date,
    type: w.workoutType,
    distance_miles: w.distanceMiles,
    duration_minutes: w.durationMinutes,
    pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
    rpe: w.assessment?.rpe || null,
    verdict: w.assessment?.verdict || null,
    legs_feel: w.assessment?.legsFeel || null,
    notes: w.notes || null,
  });

  const w1 = formatWorkout(workout1);
  const w2 = formatWorkout(workout2);

  // Calculate differences
  const comparison: Record<string, string> = {};

  if (w1.distance_miles && w2.distance_miles) {
    const diff = w2.distance_miles - w1.distance_miles;
    comparison.distance = diff > 0 ? `+${diff.toFixed(1)} mi` : `${diff.toFixed(1)} mi`;
  }

  if (workout1.avgPaceSeconds && workout2.avgPaceSeconds) {
    const diff = workout2.avgPaceSeconds - workout1.avgPaceSeconds;
    const sign = diff > 0 ? '+' : '';
    comparison.pace = `${sign}${Math.round(diff)} sec/mi (${diff < 0 ? 'faster' : 'slower'})`;
  }

  if (w1.rpe && w2.rpe) {
    const diff = w2.rpe - w1.rpe;
    comparison.rpe = diff === 0 ? 'Same' : (diff > 0 ? `+${diff} (harder)` : `${diff} (easier)`);
  }

  // Efficiency comparison (if we have pace and RPE for both)
  let efficiencyNote = null;
  if (workout1.avgPaceSeconds && workout2.avgPaceSeconds && w1.rpe && w2.rpe) {
    const eff1 = workout1.avgPaceSeconds / w1.rpe;
    const eff2 = workout2.avgPaceSeconds / w2.rpe;
    const effDiff = ((eff2 - eff1) / eff1) * 100;

    if (Math.abs(effDiff) > 3) {
      efficiencyNote = effDiff < 0
        ? `Workout 2 was more efficient (${Math.abs(Math.round(effDiff))}% better pace per RPE point)`
        : `Workout 1 was more efficient (workout 2 was ${Math.round(effDiff)}% less efficient)`;
    } else {
      efficiencyNote = 'Similar efficiency (pace relative to effort)';
    }
  }

  return {
    workout_1: w1,
    workout_2: w2,
    comparison,
    efficiency_note: efficiencyNote,
    days_apart: Math.round(
      (new Date(w2.date + 'T12:00:00').getTime() - new Date(w1.date + 'T12:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    ),
  };
}

/**
 * Deep dive into fatigue indicators from recent assessments
 */
async function getFatigueIndicators(input: Record<string, unknown>) {
  const daysBack = (input.days_back as number) || 14;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoffStr),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  const assessedWorkouts = recentWorkouts.filter((w: WorkoutWithRelations) => w.assessment);

  if (assessedWorkouts.length < 3) {
    return {
      has_sufficient_data: false,
      message: 'Need at least 3 assessed workouts for fatigue analysis.',
    };
  }

  // Collect metrics
  const rpeValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.rpe).filter(Boolean) as number[];
  const legsFeelValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.legsFeel).filter((v): v is number => v !== null && v !== undefined);
  const sleepValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.sleepQuality).filter((v): v is number => v !== null && v !== undefined);
  const stressValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.stress).filter((v): v is number => v !== null && v !== undefined);
  const sorenessValues = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.soreness).filter((v): v is number => v !== null && v !== undefined);
  const verdicts = assessedWorkouts.map((w: WorkoutWithRelations) => w.assessment!.verdict).filter(Boolean) as string[];

  // Calculate averages and trends
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Look at trend (first half vs second half)
  const trend = (arr: number[]) => {
    if (arr.length < 4) return 'insufficient data';
    const mid = Math.floor(arr.length / 2);
    const first = avg(arr.slice(0, mid));
    const second = avg(arr.slice(mid));
    if (first === null || second === null) return 'insufficient data';
    const diff = second - first;
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  };

  // Fatigue signals
  const signals: Array<{ indicator: string; status: string; details: string }> = [];

  // RPE trend
  if (rpeValues.length >= 3) {
    const avgRpe = avg(rpeValues)!;
    const rpeTrend = trend(rpeValues);
    if (avgRpe > 7) {
      signals.push({ indicator: 'RPE', status: 'Warning', details: `High average RPE (${avgRpe.toFixed(1)}). Workouts feeling hard.` });
    } else if (rpeTrend === 'increasing') {
      signals.push({ indicator: 'RPE', status: 'Watch', details: 'RPE trending upward. Same effort feeling harder.' });
    } else {
      signals.push({ indicator: 'RPE', status: 'OK', details: `Average RPE: ${avgRpe.toFixed(1)}` });
    }
  }

  // Legs feel trend
  if (legsFeelValues.length >= 3) {
    const avgLegs = avg(legsFeelValues)!;
    const legsTrend = trend(legsFeelValues);
    if (avgLegs > 6) {
      signals.push({ indicator: 'Legs', status: 'Warning', details: `Heavy legs pattern (avg ${avgLegs.toFixed(1)}/10). May need extra recovery.` });
    } else if (legsTrend === 'increasing') {
      signals.push({ indicator: 'Legs', status: 'Watch', details: 'Legs feeling progressively heavier.' });
    } else {
      signals.push({ indicator: 'Legs', status: 'OK', details: `Average legs feel: ${avgLegs.toFixed(1)}/10` });
    }
  }

  // Sleep
  if (sleepValues.length >= 3) {
    const avgSleep = avg(sleepValues)!;
    if (avgSleep < 5) {
      signals.push({ indicator: 'Sleep', status: 'Warning', details: `Poor sleep quality (avg ${avgSleep.toFixed(1)}/10). Recovery compromised.` });
    } else if (avgSleep >= 7) {
      signals.push({ indicator: 'Sleep', status: 'Good', details: `Good sleep quality (avg ${avgSleep.toFixed(1)}/10)` });
    } else {
      signals.push({ indicator: 'Sleep', status: 'OK', details: `Average sleep quality: ${avgSleep.toFixed(1)}/10` });
    }
  }

  // Stress
  if (stressValues.length >= 3) {
    const avgStress = avg(stressValues)!;
    if (avgStress > 7) {
      signals.push({ indicator: 'Stress', status: 'Warning', details: `High stress (avg ${avgStress.toFixed(1)}/10). Consider easier training.` });
    }
  }

  // Soreness
  if (sorenessValues.length >= 3) {
    const avgSoreness = avg(sorenessValues)!;
    if (avgSoreness > 6) {
      signals.push({ indicator: 'Soreness', status: 'Warning', details: `High soreness (avg ${avgSoreness.toFixed(1)}/10). Muscles need recovery.` });
    }
  }

  // Verdict pattern
  if (verdicts.length >= 3) {
    const roughCount = verdicts.filter(v => v === 'rough' || v === 'awful').length;
    const greatCount = verdicts.filter(v => v === 'great' || v === 'good').length;

    if (roughCount >= verdicts.length / 2) {
      signals.push({ indicator: 'Verdicts', status: 'Warning', details: `${roughCount}/${verdicts.length} workouts rated rough/awful. Training not going well.` });
    } else if (greatCount >= verdicts.length * 0.6) {
      signals.push({ indicator: 'Verdicts', status: 'Good', details: `${greatCount}/${verdicts.length} workouts rated good/great.` });
    }
  }

  // Overall assessment
  const warningCount = signals.filter(s => s.status === 'Warning').length;
  const watchCount = signals.filter(s => s.status === 'Watch').length;

  let overallStatus: string;
  let recommendation: string;

  if (warningCount >= 3) {
    overallStatus = 'Fatigue Accumulation';
    recommendation = 'Multiple warning signs. Strongly recommend a down week or extra rest days.';
  } else if (warningCount >= 2 || (warningCount >= 1 && watchCount >= 2)) {
    overallStatus = 'Elevated Fatigue';
    recommendation = 'Signs of fatigue building. Consider reducing intensity or adding recovery.';
  } else if (watchCount >= 2) {
    overallStatus = 'Monitor';
    recommendation = 'Some early warning signs. Keep tracking and be ready to back off.';
  } else {
    overallStatus = 'Well Recovered';
    recommendation = 'Fatigue indicators look good. Continue as planned.';
  }

  return {
    period: `Last ${daysBack} days`,
    workouts_assessed: assessedWorkouts.length,

    signals,

    overall_status: overallStatus,
    recommendation,

    raw_averages: {
      rpe: avg(rpeValues)?.toFixed(1) || null,
      legs_feel: avg(legsFeelValues)?.toFixed(1) || null,
      sleep_quality: avg(sleepValues)?.toFixed(1) || null,
      stress: avg(stressValues)?.toFixed(1) || null,
      soreness: avg(sorenessValues)?.toFixed(1) || null,
    },
  };
}

/**
 * Estimate how well a workout went based on RPE and pace relative to expectations
 */
async function estimateWorkoutQuality(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  // Get user's pace zones for context
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const vdot = s?.vdot || 40;
  const paceZones = calculatePaceZones(vdot);

  const result: {
    workout_id: number;
    date: string;
    type: string;
    distance: number | null;
    pace: string | null;
    rpe: number | null;
    verdict: string | null;
    quality_assessment: string;
    details: string[];
    suggestions: string[];
  } = {
    workout_id: workout.id,
    date: workout.date,
    type: workout.workoutType,
    distance: workout.distanceMiles,
    pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
    rpe: workout.assessment?.rpe || null,
    verdict: workout.assessment?.verdict || null,
    quality_assessment: 'Unknown',
    details: [],
    suggestions: [],
  };

  if (!workout.assessment) {
    result.quality_assessment = 'No Assessment';
    result.suggestions.push('Add an assessment to get workout quality analysis.');
    return result;
  }

  const rpe = workout.assessment.rpe;
  const verdict = workout.assessment.verdict;
  const pace = workout.avgPaceSeconds;

  // Analyze based on workout type
  if (workout.workoutType === 'easy' || workout.workoutType === 'recovery') {
    // Easy runs should feel easy (RPE 3-5)
    if (rpe && rpe <= 5) {
      result.details.push('Effort level appropriate for easy run.');
      result.quality_assessment = 'Good';
    } else if (rpe && rpe <= 6) {
      result.details.push('Slightly harder than ideal for easy run.');
      result.quality_assessment = 'Acceptable';
      result.suggestions.push('Easy runs should feel conversational (RPE 3-5). Slow down if needed.');
    } else if (rpe && rpe > 6) {
      result.details.push('Too hard for an easy day.');
      result.quality_assessment = 'Too Intense';
      result.suggestions.push('This wasn\'t really easy. Easy days should be RPE 3-5. Going too hard prevents recovery.');
    }

    // Check pace vs easy pace zone (easy pace +/- 30 seconds per mile is typical range)
    if (pace && paceZones.easy) {
      const easyPace = paceZones.easy;
      const easyMin = easyPace - 30; // Faster end of easy range
      const easyMax = easyPace + 30; // Slower end of easy range
      if (pace < easyMin - 15) {
        result.details.push(`Pace was faster than easy zone (ran ${formatPaceFromTraining(pace)}, easy zone is ${formatPaceFromTraining(easyMin)}-${formatPaceFromTraining(easyMax)}).`);
        result.suggestions.push('Easy runs don\'t need to be fast. Slow down to build aerobic base efficiently.');
      }
    }
  } else if (workout.workoutType === 'tempo' || workout.workoutType === 'threshold') {
    // Tempo should be comfortably hard (RPE 6-8)
    if (rpe && rpe >= 6 && rpe <= 8) {
      result.details.push('Effort level appropriate for tempo work.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe < 6) {
      result.details.push('Effort was lower than typical tempo (RPE 6-8).');
      result.quality_assessment = 'Undertrained';
      result.suggestions.push('Tempo should feel "comfortably hard." If it felt easy, the pace may have been too slow or you\'re getting fitter.');
    } else if (rpe && rpe > 8) {
      result.details.push('Effort was higher than ideal tempo (RPE 6-8).');
      result.quality_assessment = 'Overreached';
      result.suggestions.push('Tempo shouldn\'t feel maximal. If it was RPE 9+, the pace was too aggressive or you were fatigued.');
    }
  } else if (workout.workoutType === 'interval') {
    // Intervals should be hard (RPE 7-9)
    if (rpe && rpe >= 7 && rpe <= 9) {
      result.details.push('Effort level appropriate for intervals.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe < 7) {
      result.details.push('Effort was lower than typical interval work (RPE 7-9).');
      result.quality_assessment = 'Could Push Harder';
      result.suggestions.push('Intervals should be hard but controlled. If it felt moderate, consider increasing pace or reducing rest.');
    } else if (rpe && rpe >= 10) {
      result.details.push('All-out effort. Intervals should be hard but not maximal.');
      result.quality_assessment = 'Overreached';
      result.suggestions.push('RPE 10 suggests the pace was too aggressive. Intervals should leave something in the tank.');
    }
  } else if (workout.workoutType === 'long') {
    // Long runs should be moderate (RPE 4-6, maybe 7 at the end)
    if (rpe && rpe <= 6) {
      result.details.push('Effort level appropriate for long run.');
      result.quality_assessment = verdict === 'great' || verdict === 'good' ? 'Excellent' : 'Good';
    } else if (rpe && rpe === 7) {
      result.details.push('Effort was moderate-hard for long run.');
      result.quality_assessment = 'Acceptable';
      result.suggestions.push('Long runs should mostly feel conversational. RPE 7 is OK for the last few miles but not the whole run.');
    } else if (rpe && rpe > 7) {
      result.details.push('Long run was too hard.');
      result.quality_assessment = 'Too Intense';
      result.suggestions.push('Long runs build endurance through time on feet, not intensity. Slow down to preserve the aerobic benefit.');
    }
  }

  // Add verdict context
  if (verdict) {
    if (verdict === 'great') {
      result.details.push('You rated this workout "great" - everything clicked.');
    } else if (verdict === 'rough' || verdict === 'awful') {
      result.details.push(`You rated this "${verdict}" - worth investigating why.`);
      if (!result.suggestions.some(s => s.includes('Check'))) {
        result.suggestions.push('Check recent sleep, stress, and recovery. Bad workouts often have external causes.');
      }
    }
  }

  return result;
}

// ============================================================
// INJURY TRACKING
// ============================================================

interface Injury {
  body_part: string;
  side?: string;
  severity: string;
  description?: string;
  restrictions: string[];
  logged_date: string;
}

/**
 * Log a current injury or pain
 */
async function logInjury(input: Record<string, unknown>) {
  const bodyPart = input.body_part as string;
  const side = input.side as string | undefined;
  const severity = input.severity as string;
  const description = input.description as string | undefined;
  const restrictions = (input.restrictions as string[]) || [];

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  // Parse existing injuries or start fresh
  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  // Add or update injury
  const existingIndex = currentInjuries.findIndex(
    (i: Injury) => i.body_part === bodyPart && (!side || i.side === side)
  );

  const newInjury: Injury = {
    body_part: bodyPart,
    side,
    severity,
    description,
    restrictions,
    logged_date: new Date().toISOString().split('T')[0],
  };

  if (existingIndex >= 0) {
    currentInjuries[existingIndex] = newInjury;
  } else {
    currentInjuries.push(newInjury);
  }

  await db.update(userSettings)
    .set({
      currentInjuries: JSON.stringify(currentInjuries),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  // Build restriction summary
  const allRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    success: true,
    message: `Logged ${severity} ${bodyPart}${side ? ` (${side})` : ''} injury`,
    injury: newInjury,
    total_active_injuries: currentInjuries.length,
    active_restrictions: allRestrictions,
    recommendations: getInjuryRecommendations(severity, bodyPart, restrictions),
  };
}

function getInjuryRecommendations(severity: string, bodyPart: string, restrictions: string[]): string[] {
  const recs: string[] = [];

  if (severity === 'severe') {
    recs.push('Consider seeing a sports medicine doctor or physical therapist.');
    recs.push('Rest is priority. Running through severe pain often extends recovery time significantly.');
  } else if (severity === 'moderate') {
    recs.push('Monitor closely. If it gets worse or doesn\'t improve in a week, see a professional.');
    recs.push('Cross-training (pool running, cycling) can maintain fitness while reducing impact.');
  } else {
    recs.push('Keep an eye on it. Many niggles resolve with a few easy days.');
  }

  if (bodyPart === 'achilles' || bodyPart === 'plantar_fascia') {
    recs.push('Avoid hills and speed work until resolved. Both put extra stress on these areas.');
  }

  if (bodyPart === 'shin') {
    recs.push('Shin pain can progress to stress fractures. If pain persists or worsens, get imaging.');
  }

  if (bodyPart === 'it_band' || bodyPart === 'knee') {
    recs.push('Foam rolling and hip strengthening exercises often help these issues.');
  }

  return recs;
}

/**
 * Clear/resolve an injury
 */
async function clearInjury(input: Record<string, unknown>) {
  const bodyPart = input.body_part as string;
  const notes = input.notes as string | undefined;

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  const clearedInjury = currentInjuries.find(
    (i: Injury) => i.body_part.toLowerCase().includes(bodyPart.toLowerCase())
  );

  if (!clearedInjury) {
    return {
      success: true,
      message: `No active injury found for "${bodyPart}". Current injuries: ${currentInjuries.map((i: Injury) => i.body_part).join(', ') || 'none'}`,
    };
  }

  // Remove from active injuries
  currentInjuries = currentInjuries.filter(
    (i: Injury) => !i.body_part.toLowerCase().includes(bodyPart.toLowerCase())
  );

  // Add to history
  let injuryHistory = s.injuryHistory || '';
  const historyEntry = `${clearedInjury.body_part} (${clearedInjury.logged_date} - ${new Date().toISOString().split('T')[0]})${notes ? ': ' + notes : ''}`;
  injuryHistory = injuryHistory ? `${injuryHistory}\n${historyEntry}` : historyEntry;

  await db.update(userSettings)
    .set({
      currentInjuries: JSON.stringify(currentInjuries),
      injuryHistory,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  const remainingRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    success: true,
    message: `Cleared ${clearedInjury.body_part} injury. Great that you're feeling better!`,
    cleared_injury: clearedInjury,
    remaining_injuries: currentInjuries.length,
    remaining_restrictions: remainingRestrictions,
    note: currentInjuries.length === 0
      ? 'No active injuries. Return to normal training, but ease back in.'
      : `Still tracking: ${currentInjuries.map((i: Injury) => i.body_part).join(', ')}`,
  };
}

/**
 * Get current injury status and restrictions
 */
async function getInjuryStatus() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { active_injuries: [], restrictions: [], injury_history: null };
  }

  let currentInjuries: Injury[] = [];
  try {
    if (s.currentInjuries) {
      currentInjuries = JSON.parse(s.currentInjuries);
    }
  } catch {
    currentInjuries = [];
  }

  const allRestrictions = Array.from(new Set(currentInjuries.flatMap((i: Injury) => i.restrictions)));

  return {
    active_injuries: currentInjuries.map((i: Injury) => ({
      body_part: i.body_part,
      side: i.side,
      severity: i.severity,
      logged_date: i.logged_date,
      restrictions: i.restrictions,
    })),
    restrictions: allRestrictions,
    has_restrictions: allRestrictions.length > 0,
    injury_history: s.injuryHistory || null,
    recommendations: allRestrictions.length > 0
      ? getRestrictionGuidance(allRestrictions)
      : ['No active restrictions. Train as planned.'],
  };
}

function getRestrictionGuidance(restrictions: string[]): string[] {
  const guidance: string[] = [];

  if (restrictions.includes('no_running')) {
    guidance.push('No running currently. Cross-train only (pool, bike, elliptical).');
  }
  if (restrictions.includes('easy_only')) {
    guidance.push('Easy runs only. No quality sessions until cleared.');
  }
  if (restrictions.includes('no_speed_work')) {
    guidance.push('No speed work or intervals. Tempo runs may be okay if they don\'t aggravate.');
  }
  if (restrictions.includes('no_hills')) {
    guidance.push('Avoid hills. Extra stress on lower legs and Achilles.');
  }
  if (restrictions.includes('no_long_runs')) {
    guidance.push('Cap runs at 8-10 miles. Long runs can aggravate some injuries.');
  }
  if (restrictions.includes('reduced_mileage')) {
    guidance.push('Reduce weekly volume by 30-50% until symptoms improve.');
  }

  return guidance;
}

// ============================================================
// TRAVEL & ALTITUDE (simplified - like heat adjustment)
// ============================================================

/**
 * Set travel status
 */
async function setTravelStatus(input: Record<string, unknown>) {
  const isTraveling = input.is_traveling as boolean;
  const location = input.location as string | undefined;
  const altitudeFeet = input.altitude_feet as number | undefined;
  const startDate = input.start_date as string | undefined;
  const endDate = input.end_date as string | undefined;
  const facilities = input.facilities as string | undefined;

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  if (!s) {
    return { success: false, error: 'User settings not found' };
  }

  // Store travel info in coach_context or a travel-specific field
  let coachContext = s.coachContext || '';

  // Remove old travel notes
  coachContext = coachContext.replace(/\[TRAVEL:.*?\]/g, '').trim();

  if (isTraveling && location) {
    const travelNote = `[TRAVEL: ${location}${altitudeFeet ? ` at ${altitudeFeet}ft` : ''}${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}${facilities ? ` - ${facilities}` : ''}]`;
    coachContext = `${travelNote} ${coachContext}`.trim();
  }

  await db.update(userSettings)
    .set({
      coachContext,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userSettings.id, s.id));

  if (!isTraveling) {
    return {
      success: true,
      message: 'Travel status cleared. Back to normal training.',
    };
  }

  // Calculate altitude impact if provided
  let altitudeNote = null;
  if (altitudeFeet && altitudeFeet > 3000) {
    const paceAdjustment = getAltitudeAdjustment(altitudeFeet);
    altitudeNote = {
      altitude_feet: altitudeFeet,
      pace_adjustment_percent: paceAdjustment.percent,
      guidance: paceAdjustment.guidance,
    };
  }

  return {
    success: true,
    message: `Travel status set: ${location}`,
    location,
    altitude: altitudeNote,
    dates: startDate && endDate ? `${startDate} to ${endDate}` : null,
    facilities,
    training_notes: [
      altitudeFeet && altitudeFeet > 4000
        ? `At ${altitudeFeet}ft, expect runs to feel harder. Adjust pace by ~${getAltitudeAdjustment(altitudeFeet).percent}% and focus on effort, not pace.`
        : null,
      facilities?.includes('treadmill')
        ? 'Treadmill available - good for maintaining workouts. Set 1% incline to simulate outdoor running.'
        : null,
      'Travel fatigue is real. First run or two may feel off. That\'s normal.',
    ].filter(Boolean),
  };
}

function getAltitudeAdjustment(altitudeFeet: number): { percent: number; guidance: string } {
  // Rough rule: ~3% slower per 1000ft above 4000ft for unacclimatized runners
  // Similar to heat adjustment philosophy - focus on effort, not pace
  if (altitudeFeet < 3000) {
    return { percent: 0, guidance: 'Minimal altitude impact.' };
  } else if (altitudeFeet < 5000) {
    return { percent: 3, guidance: 'Slight altitude effect. Run by feel.' };
  } else if (altitudeFeet < 7000) {
    return { percent: 6, guidance: 'Noticeable altitude. Easy runs should feel easy regardless of pace.' };
  } else if (altitudeFeet < 9000) {
    return { percent: 10, guidance: 'Significant altitude. All runs will feel harder. RPE is your guide.' };
  } else {
    return { percent: 15, guidance: 'High altitude. Take it very easy. Consider shorter runs.' };
  }
}

/**
 * Get altitude pace adjustment (simplified - like heat)
 */
async function getAltitudePaceAdjustment(input: Record<string, unknown>) {
  const altitudeFeet = input.altitude_feet as number;
  const daysAtAltitude = (input.days_at_altitude as number) || 0;

  const baseAdjustment = getAltitudeAdjustment(altitudeFeet);

  // Acclimatization reduces impact over ~2 weeks
  let acclimatizationFactor = 1.0;
  if (daysAtAltitude > 0) {
    acclimatizationFactor = Math.max(0.5, 1 - (daysAtAltitude * 0.04)); // ~4% reduction per day, max 50% reduction
  }

  const adjustedPercent = Math.round(baseAdjustment.percent * acclimatizationFactor);

  return {
    altitude_feet: altitudeFeet,
    days_at_altitude: daysAtAltitude,
    pace_adjustment_percent: adjustedPercent,
    guidance: baseAdjustment.guidance,
    acclimatization_note: daysAtAltitude > 0
      ? `After ${daysAtAltitude} days, your body has partially adapted.`
      : 'No acclimatization yet. First few days will feel hardest.',
    key_principle: 'Like heat, altitude means slower paces at the same effort. This is still good training. Focus on RPE, not the watch.',
  };
}

/**
 * Get comprehensive context summary for the coach
 */
async function getContextSummary() {
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  // Get goal race (A priority race that's upcoming)
  const today = new Date().toISOString().split('T')[0];
  const goalRace = await db.query.races.findFirst({
    where: and(
      eq(races.priority, 'A'),
      gte(races.date, today)
    ),
    orderBy: [asc(races.date)],
  });

  // Get current training week
  let currentWeek = null;
  let totalWeeks = 0;
  if (goalRace) {
    currentWeek = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, today),
        gte(trainingBlocks.endDate, today)
      ),
    });

    // Get total weeks in plan
    const allWeeks = await db.query.trainingBlocks.findMany({
      where: eq(trainingBlocks.raceId, goalRace.id),
    });
    totalWeeks = allWeeks.length;
  }

  // Calculate weeks until race
  let weeksUntilRace = null;
  let daysUntilRace = null;
  if (goalRace) {
    const raceDate = new Date(goalRace.date);
    const todayDate = new Date(today);
    daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    weeksUntilRace = Math.ceil(daysUntilRace / 7);
  }

  // Get injury status
  const injuryStatus = await getInjuryStatus();

  // Get fatigue indicators
  const fatigueData = await getFatigueIndicators({ days_back: 7 });

  // Get training load
  const loadData = await getTrainingLoad();

  // Check for travel notes in coach context
  let travelStatus = null;
  if (s?.coachContext) {
    const travelMatch = s.coachContext.match(/\[TRAVEL: ([^\]]+)\]/);
    if (travelMatch) {
      travelStatus = travelMatch[1];
    }
  }

  // Build summary
  const alerts: string[] = [];

  // Injury alerts
  if (injuryStatus.active_injuries && injuryStatus.active_injuries.length > 0) {
    alerts.push(`Active injury: ${injuryStatus.active_injuries.map((i: Injury) => i.body_part).join(', ')}`);
  }

  // Fatigue alerts
  if (fatigueData.overall_status === 'Fatigue Accumulation' || fatigueData.overall_status === 'Elevated Fatigue') {
    alerts.push(`Fatigue status: ${fatigueData.overall_status}`);
  }

  // Training load alerts
  if (loadData.status === 'High Risk' || loadData.status === 'Caution') {
    alerts.push(`Training load: ${loadData.status}`);
  }

  // Travel alerts
  if (travelStatus) {
    alerts.push(`Currently traveling: ${travelStatus}`);
  }

  // Build training journey context
  const trainingJourney = goalRace ? {
    goal_race: {
      name: goalRace.name,
      date: goalRace.date,
      distance: goalRace.distanceLabel,
      target_time: goalRace.targetTimeSeconds
        ? formatSecondsToTime(goalRace.targetTimeSeconds)
        : null,
    },
    countdown: {
      days_until_race: daysUntilRace,
      weeks_until_race: weeksUntilRace,
    },
    current_phase: currentWeek ? {
      phase: currentWeek.phase,
      week_number: currentWeek.weekNumber,
      total_weeks: totalWeeks,
      week_focus: currentWeek.focus,
      target_mileage: currentWeek.targetMileage,
    } : null,
    phase_description: currentWeek ? getPhaseDescription(currentWeek.phase, weeksUntilRace || 0) : null,
  } : null;

  return {
    // THE MOST IMPORTANT THING: Where are they in their training journey?
    training_journey: trainingJourney,

    has_alerts: alerts.length > 0,
    alerts,

    injuries: {
      active: injuryStatus.active_injuries?.length || 0,
      restrictions: injuryStatus.restrictions || [],
    },

    fatigue: {
      status: fatigueData.overall_status || 'Unknown',
      key_indicators: fatigueData.signals?.slice(0, 3) || [],
    },

    training_load: {
      status: loadData.status,
      acwr: loadData.acwr,
    },

    travel: travelStatus,

    coach_context: s?.coachContext?.replace(/\[TRAVEL:.*?\]/g, '').trim() || null,

    summary: trainingJourney
      ? `${weeksUntilRace} weeks until ${goalRace?.name}. Currently in ${currentWeek?.phase || 'training'} phase (week ${currentWeek?.weekNumber || '?'} of ${totalWeeks}).${alerts.length > 0 ? ' Heads up: ' + alerts.join('. ') : ''}`
      : alerts.length > 0
        ? `Heads up: ${alerts.join('. ')}`
        : 'No goal race set. Training in maintenance mode.',
  };
}

function getPhaseDescription(phase: string, weeksOut: number): string {
  switch (phase) {
    case 'base':
      return 'Building aerobic foundation. Focus on easy miles, consistency, and gradually increasing volume. Quality work is light - mostly strides and easy fartlek.';
    case 'build':
      return 'Adding intensity while maintaining volume. Two quality sessions per week - tempo/threshold work and some faster intervals. This is where fitness really develops.';
    case 'peak':
      return 'Race-specific preparation. Highest intensity, volume starts to level off. Key workouts matter most now. Sharpening for race day.';
    case 'taper':
      return 'Reducing volume while maintaining intensity. Trust your fitness - the hay is in the barn. Focus on rest, nutrition, and arriving fresh.';
    case 'recovery':
      return 'Post-race or recovery period. Easy running only, rebuilding before next training block.';
    default:
      return 'General training period.';
  }
}

// ============================================================
// BRIEFINGS & REVIEWS
// ============================================================

/**
 * Pre-run briefing: everything needed before heading out
 */
async function getPreRunBriefing(input: Record<string, unknown>) {
  const includeOutfit = input.include_outfit !== false;

  // Get today's planned workout
  const today = new Date().toISOString().split('T')[0];
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  // Get training journey context (goal race, phase, weeks out)
  const goalRace = await db.query.races.findFirst({
    where: and(
      eq(races.priority, 'A'),
      gte(races.date, today)
    ),
    orderBy: [asc(races.date)],
  });

  let trainingContext = null;
  if (goalRace) {
    const currentWeek = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, today),
        gte(trainingBlocks.endDate, today)
      ),
    });

    const raceDate = new Date(goalRace.date);
    const todayDate = new Date(today);
    const daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksUntilRace = Math.ceil(daysUntilRace / 7);

    trainingContext = {
      goal_race: goalRace.name,
      race_date: goalRace.date,
      race_distance: goalRace.distanceLabel,
      target_time: goalRace.targetTimeSeconds ? formatSecondsToTime(goalRace.targetTimeSeconds) : null,
      weeks_until_race: weeksUntilRace,
      days_until_race: daysUntilRace,
      current_phase: currentWeek?.phase || null,
      week_number: currentWeek?.weekNumber || null,
      week_focus: currentWeek?.focus || null,
    };
  }

  // Get weather
  let weather = null;
  try {
    weather = await getCurrentWeather();
  } catch {
    // Weather fetch failed, continue without it
  }

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue indicators (quick check)
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Get pace zones
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const vdot = s?.vdot || 40;
  const paceZones = calculatePaceZones(vdot);

  // Build alerts
  const alerts: string[] = [];

  if (injuries.has_restrictions) {
    alerts.push(`Injury restrictions active: ${injuries.restrictions.join(', ')}`);
  }

  if (fatigue.overall_status === 'Fatigue Accumulation' || fatigue.overall_status === 'Elevated Fatigue') {
    alerts.push(`Fatigue level: ${fatigue.overall_status}. Consider taking it easy.`);
  }

  // Weather alerts - check for challenging conditions based on severity score
  if (weather && 'severity_score' in weather && weather.severity_score && weather.severity_score >= 60) {
    const label = weather.severity_label || 'challenging';
    alerts.push(`Weather: ${label} conditions (severity ${weather.severity_score}/100). Consider adjusting your run.`);
  }

  // Build workout info
  let workoutInfo = null;
  if (plannedWorkout) {
    const formatPace = (seconds: number | null) => {
      if (!seconds) return null;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
    };

    workoutInfo = {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      target_pace: formatPace(plannedWorkout.targetPaceSecondsPerMile),
      description: plannedWorkout.description,
      is_key_workout: plannedWorkout.isKeyWorkout,
    };

    // Check if workout conflicts with restrictions
    if (injuries.has_restrictions) {
      const conflicts: string[] = [];
      if (injuries.restrictions.includes('no_running')) {
        conflicts.push('No running restriction active - consider cross-training instead');
      }
      if (injuries.restrictions.includes('easy_only') &&
          ['tempo', 'interval', 'threshold'].includes(plannedWorkout.workoutType)) {
        conflicts.push('Quality workout planned but easy-only restriction active');
      }
      if (injuries.restrictions.includes('no_speed_work') &&
          ['interval', 'tempo'].includes(plannedWorkout.workoutType)) {
        conflicts.push('Speed work planned but no-speed-work restriction active');
      }
      if (conflicts.length > 0) {
        alerts.push(...conflicts);
      }
    }
  }

  // Get outfit recommendation if requested
  let outfit = null;
  if (includeOutfit && weather) {
    try {
      outfit = await executeCoachTool('get_outfit_recommendation', {
        workout_type: plannedWorkout?.workoutType || 'easy',
        distance_miles: plannedWorkout?.targetDistanceMiles || 5,
      });
    } catch {
      // Outfit fetch failed
    }
  }

  // Pace guidance based on workout type
  let paceGuidance = null;
  if (plannedWorkout && paceZones) {
    const type = plannedWorkout.workoutType;
    if (type === 'easy' || type === 'recovery') {
      paceGuidance = {
        zone: 'Easy',
        range: paceZones.easy ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}` : null,
        feel: 'Conversational. Should be able to chat easily.',
      };
    } else if (type === 'tempo' || type === 'threshold') {
      paceGuidance = {
        zone: 'Tempo/Threshold',
        range: paceZones.tempo ? formatPaceFromTraining(paceZones.tempo) : null,
        feel: 'Comfortably hard. Can speak in short sentences.',
      };
    } else if (type === 'interval') {
      paceGuidance = {
        zone: 'Interval',
        range: paceZones.interval ? formatPaceFromTraining(paceZones.interval) : null,
        feel: 'Hard but controlled. Focus on recovery between reps.',
      };
    } else if (type === 'long') {
      paceGuidance = {
        zone: 'Long Run',
        range: paceZones.easy ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}` : null,
        feel: 'Easy to moderate. Time on feet matters more than pace.',
      };
    }
  }

  // Build workout purpose based on training context
  let workoutPurpose = null;
  if (plannedWorkout && trainingContext) {
    const type = plannedWorkout.workoutType;
    const phase = trainingContext.current_phase;
    const weeksOut = trainingContext.weeks_until_race;

    if (type === 'easy' || type === 'recovery') {
      workoutPurpose = 'Recovery and aerobic maintenance. Keep it truly easy—this run supports the hard work.';
    } else if (type === 'long') {
      if (phase === 'base') {
        workoutPurpose = 'Building endurance foundation. Time on feet is the goal, not pace.';
      } else if (phase === 'build') {
        workoutPurpose = 'Extending your endurance while volume is high. Stay controlled.';
      } else if (phase === 'peak' && weeksOut && weeksOut <= 4) {
        workoutPurpose = 'Final long run. Confidence builder. Don\'t overdo it—fitness is already there.';
      }
    } else if (type === 'tempo' || type === 'threshold') {
      workoutPurpose = 'Lactate threshold development. This pace teaches your body to clear lactate at race effort.';
    } else if (type === 'interval') {
      workoutPurpose = 'VO2max development. Hard but controlled—focus on hitting paces and full recovery between reps.';
    }
  }

  return {
    date: today,

    // Training journey context - the most important framing
    training_context: trainingContext,

    has_alerts: alerts.length > 0,
    alerts,

    workout: workoutInfo || { message: 'No workout planned for today. Easy run or rest day.' },
    workout_purpose: workoutPurpose,
    pace_guidance: paceGuidance,

    weather: weather && 'temperature_f' in weather ? {
      temp_f: weather.temperature_f,
      feels_like_f: weather.feels_like_f,
      conditions: weather.condition,
      severity: weather.severity_label,
    } : null,

    outfit: outfit || null,

    ready_to_run: alerts.length === 0,
    pre_run_checklist: [
      plannedWorkout?.isKeyWorkout ? '⚡ Key workout - make sure you\'re fresh and fueled' : null,
      weather?.temperature_f && weather.temperature_f > 70 ? '💧 Warm out - hydrate before and consider carrying water' : null,
      weather?.temperature_f && weather.temperature_f < 40 ? '🧤 Cold out - longer warmup recommended' : null,
      plannedWorkout?.workoutType === 'interval' ? '🏃 Dynamic warmup before intervals (leg swings, high knees)' : null,
    ].filter(Boolean),
  };
}

/**
 * Weekly review: comprehensive look at the past week
 */
async function getWeeklyReview(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) ?? -1; // Default to last week

  // Calculate week dates
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  // Get training journey context
  const todayStr = today.toISOString().split('T')[0];
  const goalRace = await db.query.races.findFirst({
    where: and(
      eq(races.priority, 'A'),
      gte(races.date, todayStr)
    ),
    orderBy: [asc(races.date)],
  });

  let trainingContext = null;
  let reviewedWeekContext = null;
  if (goalRace) {
    // Get the training week being reviewed
    reviewedWeekContext = await db.query.trainingBlocks.findFirst({
      where: and(
        eq(trainingBlocks.raceId, goalRace.id),
        lte(trainingBlocks.startDate, startStr),
        gte(trainingBlocks.endDate, startStr)
      ),
    });

    // Get current week for countdown
    const raceDate = new Date(goalRace.date);
    const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weeksUntilRace = Math.ceil(daysUntilRace / 7);

    trainingContext = {
      goal_race: goalRace.name,
      race_date: goalRace.date,
      weeks_until_race: weeksUntilRace,
      reviewed_week: reviewedWeekContext ? {
        phase: reviewedWeekContext.phase,
        week_number: reviewedWeekContext.weekNumber,
        focus: reviewedWeekContext.focus,
        target_mileage: reviewedWeekContext.targetMileage,
      } : null,
    };
  }

  // Get completed workouts
  const completedWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: and(
      gte(workouts.date, startStr),
      lte(workouts.date, endStr)
    ),
    with: { assessment: true },
    orderBy: [asc(workouts.date)],
  });

  // Get planned workouts
  const plannedForWeek = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startStr),
      lte(plannedWorkouts.date, endStr)
    ),
  });

  // Calculate metrics
  const totalMiles = completedWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = completedWorkouts.length;
  const avgPace = completedWorkouts.filter(w => w.avgPaceSeconds).length > 0
    ? completedWorkouts.reduce((sum, w) => sum + (w.avgPaceSeconds || 0), 0) /
      completedWorkouts.filter(w => w.avgPaceSeconds).length
    : null;

  // Assessment metrics
  const assessedWorkouts = completedWorkouts.filter(w => w.assessment);
  const avgRpe = assessedWorkouts.length > 0
    ? assessedWorkouts.reduce((sum, w) => sum + (w.assessment?.rpe || 0), 0) / assessedWorkouts.length
    : null;

  const verdictCounts: Record<string, number> = {};
  assessedWorkouts.forEach(w => {
    const v = w.assessment?.verdict;
    if (v) verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  });

  // Plan adherence
  const plannedMiles = plannedForWeek.reduce((sum: number, p: { targetDistanceMiles: number | null }) => sum + (p.targetDistanceMiles || 0), 0);
  const plannedWorkoutCount = plannedForWeek.filter((p: { status: string }) => p.status === 'scheduled' || p.status === 'completed').length;
  const completedPlanned = plannedForWeek.filter((p: { status: string }) => p.status === 'completed').length;
  const skippedWorkouts = plannedForWeek.filter((p: { status: string }) => p.status === 'skipped').length;

  // Identify highlights and concerns
  const highlights: string[] = [];
  const concerns: string[] = [];

  // Good week indicators
  if (verdictCounts['great'] && verdictCounts['great'] >= 2) {
    highlights.push(`${verdictCounts['great']} workouts rated "great"`);
  }
  if (totalMiles >= plannedMiles * 0.9 && plannedMiles > 0) {
    highlights.push(`Hit ${Math.round((totalMiles / plannedMiles) * 100)}% of planned mileage`);
  }
  if (avgRpe && avgRpe <= 5.5 && totalMiles > 20) {
    highlights.push('Good volume at manageable effort');
  }

  // Key workouts
  const keyWorkouts = completedWorkouts.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'long'
  );
  if (keyWorkouts.length >= 2) {
    highlights.push(`Completed ${keyWorkouts.length} key workouts`);
  }

  // Concerns
  if (verdictCounts['rough'] && verdictCounts['rough'] >= 2) {
    concerns.push(`${verdictCounts['rough']} workouts felt rough`);
  }
  if (verdictCounts['awful']) {
    concerns.push(`${verdictCounts['awful']} workout(s) felt awful - worth investigating`);
  }
  if (skippedWorkouts >= 2) {
    concerns.push(`${skippedWorkouts} workouts skipped`);
  }
  if (avgRpe && avgRpe > 7) {
    concerns.push(`High average RPE (${avgRpe.toFixed(1)}) - training felt hard`);
  }

  // Workout breakdown by type
  const byType: Record<string, { count: number; miles: number }> = {};
  completedWorkouts.forEach(w => {
    if (!byType[w.workoutType]) byType[w.workoutType] = { count: 0, miles: 0 };
    byType[w.workoutType].count++;
    byType[w.workoutType].miles += w.distanceMiles || 0;
  });

  return {
    week: `${startStr} to ${endStr}`,
    week_offset: weekOffset,

    // Training journey context
    training_context: trainingContext,

    summary: {
      total_miles: Math.round(totalMiles * 10) / 10,
      total_runs: totalRuns,
      avg_pace: avgPace ? formatPaceFromTraining(Math.round(avgPace)) : null,
      avg_rpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
    },

    plan_adherence: plannedMiles > 0 ? {
      planned_miles: Math.round(plannedMiles * 10) / 10,
      actual_miles: Math.round(totalMiles * 10) / 10,
      percent_completed: Math.round((totalMiles / plannedMiles) * 100),
      workouts_completed: completedPlanned,
      workouts_skipped: skippedWorkouts,
    } : null,

    workout_breakdown: Object.entries(byType).map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
    })),

    verdicts: verdictCounts,

    highlights,
    concerns,

    daily_log: completedWorkouts.map(w => ({
      date: w.date,
      type: w.workoutType,
      miles: w.distanceMiles,
      pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
      verdict: w.assessment?.verdict || null,
      rpe: w.assessment?.rpe || null,
    })),

    coaching_note: generateWeeklyCoachingNote(highlights, concerns, totalMiles, avgRpe),
  };
}

function generateWeeklyCoachingNote(
  highlights: string[],
  concerns: string[],
  totalMiles: number,
  avgRpe: number | null
): string {
  if (concerns.length > highlights.length) {
    return 'Tough week. Focus on recovery before pushing hard again. One rough week doesn\'t define your training.';
  }
  if (highlights.length >= 2 && concerns.length === 0) {
    return 'Strong week! You\'re building fitness. Keep the consistency going.';
  }
  if (totalMiles > 0 && (!avgRpe || avgRpe <= 6)) {
    return 'Solid training week. You\'re putting in the work without overdoing it.';
  }
  return 'Another week in the books. Consistency over time is what builds fitness.';
}

/**
 * Suggest what workout to do when there's no plan
 */
async function suggestNextWorkout(input: Record<string, unknown>) {
  console.log(`=== [suggestNextWorkout] START === at ${new Date().toISOString()}`);
  console.log(`[suggestNextWorkout] Input:`, JSON.stringify(input));

  const availableTime = input.available_time_minutes as number | undefined;
  const preference = input.preference as string | undefined;

  // Get recent workouts
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const recentWorkouts: WorkoutWithRelations[] = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoff.toISOString().split('T')[0]),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue indicators
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Get user settings for pace zones
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const paceZones = s?.vdot ? calculatePaceZones(s.vdot) : null;

  // Analyze recent training
  const recentMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const lastWorkout = recentWorkouts[0];
  const lastWorkoutDate = lastWorkout ? new Date(lastWorkout.date) : null;
  const daysSinceLastRun = lastWorkoutDate
    ? Math.floor((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const recentHardWorkouts = recentWorkouts.filter(w =>
    w.workoutType === 'tempo' || w.workoutType === 'interval' || w.workoutType === 'steady'
  );
  const recentLongRuns = recentWorkouts.filter(w => w.workoutType === 'long');

  // Determine what makes sense
  let suggestedType = 'easy';
  let suggestedDistance = 5;
  const reasoning: string[] = [];

  // Check restrictions first
  const restrictionsList = injuries.restrictions as string[];
  if (restrictionsList.includes('no_running')) {
    return {
      suggestion: 'Cross-train',
      type: 'cross_train',
      reasoning: ['Active injury restriction - no running currently'],
      alternatives: ['Pool running', 'Cycling', 'Elliptical'],
    };
  }

  if (restrictionsList.includes('easy_only')) {
    suggestedType = 'easy';
    reasoning.push('Easy only due to injury restriction');
  } else if (fatigue.overall_status === 'Fatigue Accumulation') {
    suggestedType = 'easy';
    reasoning.push('Fatigue indicators suggest recovery needed');
  } else if (preference === 'easy' || preference === 'short') {
    suggestedType = 'easy';
    reasoning.push('Based on your preference');
  } else if (daysSinceLastRun >= 3) {
    suggestedType = 'easy';
    reasoning.push('Been a few days - ease back in');
  } else if (preference === 'hard' && recentHardWorkouts.length < 2) {
    suggestedType = 'tempo';
    reasoning.push('Ready for quality work');
  } else if (preference === 'long' && recentLongRuns.length === 0) {
    suggestedType = 'long';
    reasoning.push('No long run this week yet');
  } else {
    // Default logic
    if (lastWorkout?.workoutType === 'tempo' || lastWorkout?.workoutType === 'interval') {
      suggestedType = 'easy';
      reasoning.push('Recovery after yesterday\'s quality session');
    } else if (recentHardWorkouts.length === 0 && recentMiles > 15) {
      suggestedType = 'tempo';
      reasoning.push('Good base this week, ready for quality');
    } else if (recentLongRuns.length === 0 && recentMiles > 20) {
      suggestedType = 'long';
      reasoning.push('Week needs a long run');
    } else {
      suggestedType = 'easy';
      reasoning.push('Easy running builds aerobic base');
    }
  }

  // Determine distance
  if (availableTime) {
    // Estimate pace based on type
    const easyPace = paceZones?.easy || 540; // 9:00 default
    const tempoTargetPace = paceZones?.tempo || 420; // 7:00 default

    const paceToUse = suggestedType === 'easy' ? easyPace : tempoTargetPace;
    suggestedDistance = Math.round((availableTime / (paceToUse / 60)) * 10) / 10;
    reasoning.push(`Based on ${availableTime} minutes available`);
  } else {
    if (suggestedType === 'easy') suggestedDistance = 5;
    else if (suggestedType === 'tempo') suggestedDistance = 6;
    else if (suggestedType === 'long') suggestedDistance = Math.max(10, recentMiles * 0.3);
  }

  // Cap based on restrictions
  if (restrictionsList.includes('reduced_mileage')) {
    suggestedDistance = Math.min(suggestedDistance, 6);
    reasoning.push('Distance capped due to mileage restriction');
  }

  // Build the suggestion
  const paceGuidance = suggestedType === 'easy'
    ? paceZones?.easy
      ? `${formatPaceFromTraining(paceZones.easy - 30)}-${formatPaceFromTraining(paceZones.easy + 30)}/mi`
      : 'Conversational pace'
    : suggestedType === 'tempo'
      ? paceZones?.tempo
        ? `${formatPaceFromTraining(paceZones.tempo)}/mi`
        : 'Comfortably hard'
      : 'Easy pace, focus on time on feet';

  const result = {
    suggestion: `${suggestedType.charAt(0).toUpperCase() + suggestedType.slice(1)} ${suggestedDistance} miles`,
    type: suggestedType,
    distance_miles: suggestedDistance,
    pace_guidance: paceGuidance,
    reasoning,
    context: {
      days_since_last_run: daysSinceLastRun,
      recent_miles_7_days: Math.round(recentMiles * 10) / 10,
      recent_hard_workouts: recentHardWorkouts.length,
      fatigue_status: fatigue.overall_status,
    },
    alternatives: suggestedType === 'easy'
      ? ['Rest day if feeling tired', 'Strides at the end if feeling good']
      : suggestedType === 'tempo'
        ? ['Fartlek for variety', 'Easy run if not feeling it']
        : ['Shorter run if time-crunched', 'Add strides in the middle'],
  };

  console.log(`=== [suggestNextWorkout] END === at ${new Date().toISOString()}`);
  console.log(`[suggestNextWorkout] Result:`, JSON.stringify(result).slice(0, 200));
  return result;
}

/**
 * Analyze a completed workout vs. what was planned
 */
async function analyzeCompletedWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  // Find the planned workout for this date
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, workout.date),
  });

  const analysis: {
    workout_date: string;
    actual: Record<string, unknown>;
    planned: Record<string, unknown> | null;
    comparison: string[];
    verdict_analysis: string | null;
    coaching_feedback: string[];
  } = {
    workout_date: workout.date,
    actual: {
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
      duration: workout.durationMinutes,
      rpe: workout.assessment?.rpe,
      verdict: workout.assessment?.verdict,
    },
    planned: null,
    comparison: [],
    verdict_analysis: null,
    coaching_feedback: [],
  };

  if (plannedWorkout) {
    analysis.planned = {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      pace: plannedWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)
        : null,
    };

    // Compare distance
    if (workout.distanceMiles && plannedWorkout.targetDistanceMiles) {
      const distDiff = workout.distanceMiles - plannedWorkout.targetDistanceMiles;
      if (Math.abs(distDiff) < 0.5) {
        analysis.comparison.push('Distance: Hit the target ✓');
      } else if (distDiff > 0) {
        analysis.comparison.push(`Distance: Ran ${distDiff.toFixed(1)} more than planned`);
      } else {
        analysis.comparison.push(`Distance: Ran ${Math.abs(distDiff).toFixed(1)} less than planned`);
      }
    }

    // Compare pace
    if (workout.avgPaceSeconds && plannedWorkout.targetPaceSecondsPerMile) {
      const paceDiff = workout.avgPaceSeconds - plannedWorkout.targetPaceSecondsPerMile;
      if (Math.abs(paceDiff) <= 10) {
        analysis.comparison.push('Pace: Right on target ✓');
      } else if (paceDiff < 0) {
        analysis.comparison.push(`Pace: ${Math.abs(Math.round(paceDiff))} sec/mi faster than target`);
      } else {
        analysis.comparison.push(`Pace: ${Math.round(paceDiff)} sec/mi slower than target`);
      }
    }

    // Compare type
    if (workout.workoutType !== plannedWorkout.workoutType) {
      analysis.comparison.push(`Type: Did ${workout.workoutType} instead of ${plannedWorkout.workoutType}`);
    }
  }

  // Analyze verdict and RPE
  if (workout.assessment?.verdict) {
    const v = workout.assessment.verdict;
    const rpe = workout.assessment.rpe;

    if (v === 'great') {
      analysis.verdict_analysis = 'You rated this great - everything clicked today.';
      analysis.coaching_feedback.push('Nice work! These are the runs that build confidence.');
    } else if (v === 'good') {
      analysis.verdict_analysis = 'Solid effort. This is what consistent training looks like.';
    } else if (v === 'fine') {
      analysis.verdict_analysis = 'Got it done. Not every run needs to feel amazing.';
    } else if (v === 'rough') {
      analysis.verdict_analysis = 'Tough one. Worth checking sleep, stress, or fueling.';
      analysis.coaching_feedback.push('Rough runs happen. What matters is you showed up.');
      if (rpe && rpe >= 7) {
        analysis.coaching_feedback.push('High effort on a rough day - take it easier tomorrow.');
      }
    } else if (v === 'awful') {
      analysis.verdict_analysis = 'Really struggled. That\'s valuable data.';
      analysis.coaching_feedback.push('Awful runs are signals, not failures. Consider extra recovery.');
    }

    // RPE vs workout type analysis
    if (rpe && plannedWorkout) {
      if (plannedWorkout.workoutType === 'easy' && rpe > 5) {
        analysis.coaching_feedback.push(`RPE ${rpe} is high for an easy run. Slow down to make easy truly easy.`);
      }
      if (plannedWorkout.workoutType === 'tempo' && rpe < 6) {
        analysis.coaching_feedback.push('Tempo felt easier than expected. Fitness is building!');
      }
      if (plannedWorkout.workoutType === 'tempo' && rpe >= 9) {
        analysis.coaching_feedback.push('Tempo felt very hard. Might need to adjust target pace or prioritize recovery.');
      }
    }
  }

  if (analysis.coaching_feedback.length === 0) {
    analysis.coaching_feedback.push('Run logged. Keep building that consistency.');
  }

  return analysis;
}

/**
 * Explain why a workout felt hard or easy
 */
async function explainWorkoutDifficulty(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Get the workout with assessment
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { assessment: true },
  });

  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  if (!workout.assessment) {
    return {
      success: false,
      error: 'No assessment found for this workout. Need RPE and verdict data to analyze difficulty.'
    };
  }

  // Gather data for analysis
  const workoutDate = new Date(workout.date);
  const factors: Array<{ factor: string; impact: 'harder' | 'easier' | 'neutral'; explanation: string }> = [];

  // 1. Sleep quality from assessment
  if (workout.assessment.sleepQuality !== null) {
    const sleepHours = workout.assessment.sleepQuality;
    if (sleepHours < 6) {
      factors.push({
        factor: 'Poor sleep',
        impact: 'harder',
        explanation: `${sleepHours} hours vs your usual 7-8 hours`,
      });
    } else if (sleepHours >= 8) {
      factors.push({
        factor: 'Good sleep',
        impact: 'easier',
        explanation: `${sleepHours} hours of quality rest`,
      });
    }
  }

  // 2. Training load / TSB
  const cutoffDate = new Date(workoutDate);
  cutoffDate.setDate(cutoffDate.getDate() - 28);
  const recentWorkouts = await db.query.workouts.findMany({
    where: and(
      eq(workouts.profileId, profileId),
      gte(workouts.date, cutoffDate.toISOString().split('T')[0]),
      lt(workouts.date, workout.date)
    ),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Calculate acute (7-day) and chronic (28-day) load
  const sevenDaysAgo = new Date(workoutDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const last7DaysWorkouts = recentWorkouts.filter(w =>
    new Date(w.date) >= sevenDaysAgo
  );
  const acuteMiles = last7DaysWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const chronicMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) / 4;

  // Training Stress Balance (simplified)
  const tsb = chronicMiles - acuteMiles;
  if (tsb < -10) {
    factors.push({
      factor: 'High fatigue',
      impact: 'harder',
      explanation: `TSB: ${tsb.toFixed(0)} (accumulated fatigue from ${acuteMiles.toFixed(0)}mi this week)`,
    });
  } else if (tsb > 5) {
    factors.push({
      factor: 'Well rested',
      impact: 'easier',
      explanation: `TSB: ${tsb.toFixed(0)} (fresh legs from lighter recent volume)`,
    });
  }

  // 3. Weather conditions
  if (workout.temperature !== null && workout.humidity !== null) {
    const heatIndex = workout.temperature + (workout.humidity > 60 ? 10 : 0);
    if (heatIndex > 75) {
      factors.push({
        factor: 'Hot conditions',
        impact: 'harder',
        explanation: `${workout.temperature}°F with ${workout.humidity}% humidity adds ~${Math.round(heatIndex - 70) * 3} sec/mi effort`,
      });
    } else if (workout.temperature < 35) {
      factors.push({
        factor: 'Cold conditions',
        impact: 'harder',
        explanation: `${workout.temperature}°F requires extra warmup and impacts efficiency`,
      });
    } else if (workout.temperature >= 45 && workout.temperature <= 65 && workout.humidity < 60) {
      factors.push({
        factor: 'Ideal conditions',
        impact: 'easier',
        explanation: `${workout.temperature}°F with low humidity`,
      });
    }
  }

  // 4. Days since last hard effort
  const hardWorkouts = recentWorkouts.filter(w =>
    w.workoutType && ['tempo', 'threshold', 'interval', 'race'].includes(w.workoutType)
  );

  if (hardWorkouts.length > 0) {
    const lastHard = hardWorkouts[0];
    const daysSinceHard = Math.floor(
      (workoutDate.getTime() - new Date(lastHard.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceHard < 2) {
      factors.push({
        factor: 'Insufficient recovery',
        impact: 'harder',
        explanation: `Only ${daysSinceHard} days since last ${lastHard.workoutType} workout`,
      });
    } else if (daysSinceHard > 7) {
      factors.push({
        factor: 'Fresh for quality',
        impact: 'easier',
        explanation: `${daysSinceHard} days since last hard effort`,
      });
    }
  }

  // 5. Weekly mileage vs typical
  const userSettingsData = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const typicalWeekly = userSettingsData[0]?.currentWeeklyMileage || 30;

  if (acuteMiles > typicalWeekly * 1.2) {
    factors.push({
      factor: 'High weekly volume',
      impact: 'harder',
      explanation: `${acuteMiles.toFixed(0)}mi this week vs ${typicalWeekly}mi typical`,
    });
  }

  // 6. Specific workout factors
  if (workout.assessment.stress && workout.assessment.stress >= 8) {
    factors.push({
      factor: 'High life stress',
      impact: 'harder',
      explanation: 'Stress level 8+ impacts recovery and performance',
    });
  }

  if (workout.assessment.soreness && workout.assessment.soreness >= 7) {
    factors.push({
      factor: 'Muscle soreness',
      impact: 'harder',
      explanation: `Soreness level ${workout.assessment.soreness}/10 affects efficiency`,
    });
  }

  // 7. Time of day
  if (workout.timeOfRun) {
    if (workout.timeOfRun === 'early_morning' && workout.assessment.sleepQuality && workout.assessment.sleepQuality < 7) {
      factors.push({
        factor: 'Early morning + poor sleep',
        impact: 'harder',
        explanation: 'Body not fully awake, glycogen stores lower',
      });
    }
  }

  // Calculate predominant impact
  const harderCount = factors.filter(f => f.impact === 'harder').length;
  const easierCount = factors.filter(f => f.impact === 'easier').length;

  // Build explanation
  const rpe = workout.assessment.rpe;
  const verdict = workout.assessment.verdict;
  const pace = workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null;

  let summary: string;
  if (verdict === 'awful' || verdict === 'rough' || (rpe && rpe >= 8)) {
    const topHardFactors = factors
      .filter(f => f.impact === 'harder')
      .slice(0, 3)
      .map(f => f.explanation)
      .join(', ');

    summary = topHardFactors
      ? `This run felt hard because: ${topHardFactors}.`
      : 'This run felt hard, likely due to accumulated fatigue or external factors.';
  } else if (verdict === 'great' || (rpe && rpe <= 5)) {
    const topEasyFactors = factors
      .filter(f => f.impact === 'easier')
      .slice(0, 2)
      .map(f => f.explanation)
      .join(' and ');

    summary = topEasyFactors
      ? `This run felt good because of ${topEasyFactors}.`
      : 'This run felt good - your body was ready for the effort.';
  } else {
    summary = `This run felt typical with ${harderCount} factors making it harder and ${easierCount} making it easier.`;
  }

  // Add pace vs effort insight
  if (pace && rpe) {
    const settings = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
    const easyPace = settings[0]?.easyPaceSeconds || 540;

    if (workout.workoutType === 'easy' && workout.avgPaceSeconds) {
      const paceVsTypical = workout.avgPaceSeconds - easyPace;
      if (paceVsTypical > 30 && rpe > 6) {
        summary += ` Your ${pace}/mi pace was ${Math.round(paceVsTypical)} seconds slower than usual, confirming the higher perceived effort.`;
      } else if (paceVsTypical < -20 && rpe <= 5) {
        summary += ` You ran ${Math.abs(Math.round(paceVsTypical))} seconds faster than usual at ${pace}/mi while it still felt easy - fitness improving!`;
      }
    }
  }

  return {
    success: true,
    workout_summary: {
      date: workout.date,
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: pace,
      rpe: rpe,
      verdict: verdict,
    },
    explanation: summary,
    contributing_factors: factors,
    training_context: {
      acute_load: `${acuteMiles.toFixed(1)}mi last 7 days`,
      chronic_load: `${chronicMiles.toFixed(1)}mi/week average`,
      tsb: tsb.toFixed(0),
      days_since_hard_effort: hardWorkouts.length > 0
        ? Math.floor((workoutDate.getTime() - new Date(hardWorkouts[0].date).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A',
    },
    recommendation: tsb < -10
      ? 'Consider an easy day or rest tomorrow to allow adaptation.'
      : harderCount > easierCount
      ? 'Normal to feel this way given the circumstances. Stay consistent.'
      : 'Good conditions for quality work if feeling recovered.',
  };
}

/**
 * Preview the upcoming week
 */
async function getUpcomingWeekPreview() {
  // Get this week and next week's workouts
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + mondayOffset);

  const nextSunday = new Date(thisMonday);
  nextSunday.setDate(thisMonday.getDate() + 13); // This week + next week

  const startStr = thisMonday.toISOString().split('T')[0];
  const endStr = nextSunday.toISOString().split('T')[0];

  const upcomingWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, today.toISOString().split('T')[0]),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  // Get injury status
  const injuries = await getInjuryStatus();

  // Get fatigue status
  const fatigue = await getFatigueIndicators({ days_back: 7 });

  // Identify key workouts
  type PlannedWorkoutType = { date: string; name: string; workoutType: string; targetDistanceMiles: number | null; targetPaceSecondsPerMile: number | null; isKeyWorkout: boolean };
  const keyWorkouts = upcomingWorkouts.filter((w: PlannedWorkoutType) => w.isKeyWorkout);

  // Calculate planned miles
  const plannedMiles = upcomingWorkouts.reduce((sum: number, w: PlannedWorkoutType) => sum + (w.targetDistanceMiles || 0), 0);

  // Check for concerns
  const concerns: string[] = [];

  if (injuries.has_restrictions) {
    const injuryRestrictions = injuries.restrictions as string[];
    const conflictingWorkouts = upcomingWorkouts.filter((w: PlannedWorkoutType) => {
      if (injuryRestrictions.includes('no_speed_work') &&
          ['tempo', 'interval'].includes(w.workoutType)) return true;
      if (injuryRestrictions.includes('no_hills') &&
          w.name.toLowerCase().includes('hill')) return true;
      if (injuryRestrictions.includes('no_long_runs') &&
          w.workoutType === 'long' && (w.targetDistanceMiles || 0) > 10) return true;
      return false;
    });
    if (conflictingWorkouts.length > 0) {
      concerns.push(`${conflictingWorkouts.length} workout(s) may conflict with injury restrictions`);
    }
  }

  if (fatigue.overall_status === 'Fatigue Accumulation') {
    concerns.push('Fatigue is high - consider modifying the week');
  }

  // Back-to-back quality check
  for (let i = 0; i < upcomingWorkouts.length - 1; i++) {
    const w1 = upcomingWorkouts[i];
    const w2 = upcomingWorkouts[i + 1];
    const d1 = new Date(w1.date);
    const d2 = new Date(w2.date);
    const daysBetween = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);

    if (daysBetween === 1 &&
        ['tempo', 'interval', 'long'].includes(w1.workoutType) &&
        ['tempo', 'interval', 'long'].includes(w2.workoutType)) {
      concerns.push(`Back-to-back hard efforts: ${w1.name} (${w1.date}) and ${w2.name} (${w2.date})`);
    }
  }

  const formatPace = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  return {
    period: `${today.toISOString().split('T')[0]} through ${endStr}`,
    total_workouts: upcomingWorkouts.length,
    total_planned_miles: Math.round(plannedMiles * 10) / 10,
    key_workouts: keyWorkouts.length,

    concerns,
    has_concerns: concerns.length > 0,

    workouts: upcomingWorkouts.map((w: PlannedWorkoutType) => ({
      date: w.date,
      day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      name: w.name,
      type: w.workoutType,
      distance: w.targetDistanceMiles,
      pace: formatPace(w.targetPaceSecondsPerMile),
      is_key: w.isKeyWorkout,
    })),

    focus_areas: keyWorkouts.length > 0
      ? keyWorkouts.map((w: PlannedWorkoutType) => `${w.name} on ${new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}`)
      : ['Consistent easy running this week'],

    coaching_preview: generateWeekPreviewNote(keyWorkouts.length, plannedMiles, concerns.length),
  };
}

function generateWeekPreviewNote(keyWorkouts: number, plannedMiles: number, concernCount: number): string {
  if (concernCount > 0) {
    return 'Some things to watch this week. Address the concerns above before pushing hard.';
  }
  if (keyWorkouts >= 3) {
    return 'Big week ahead with multiple key sessions. Prioritize recovery between hard efforts.';
  }
  if (keyWorkouts === 0) {
    return 'Recovery-focused week. Use this time to absorb recent training.';
  }
  return `${keyWorkouts} key workout(s) and ${Math.round(plannedMiles)} miles planned. Solid week ahead.`;
}

async function generateTrainingPlan(input: Record<string, unknown>) {
  const raceId = input.race_id as number;

  // Get race details
  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return { error: 'Race not found. Please add a race first using add_race.' };
  }

  // Get user settings
  const settings = await db.query.userSettings.findFirst();
  if (!settings) {
    return { error: 'User settings not found. Please complete onboarding first.' };
  }

  // Validate minimum required data
  if (!settings.currentWeeklyMileage) {
    return { error: 'Please set your current weekly mileage first.' };
  }

  // Import plan generator dynamically to avoid circular dependencies
  const { generateTrainingPlan: generatePlan } = await import('@/lib/training/plan-generator');
  const { calculatePaceZones } = await import('@/lib/training/vdot-calculator');

  const today = new Date();
  const raceDate = new Date(race.date);
  const totalWeeks = Math.floor((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (totalWeeks < 4) {
    return { error: 'Not enough time for a proper training plan. Need at least 4 weeks before the race.' };
  }

  const paceZones = settings.vdot ? calculatePaceZones(settings.vdot) : undefined;

  // Parse preferred quality days from settings (stored as JSON string)
  let preferredQualityDays: string[] = ['tuesday', 'thursday'];
  try {
    if (settings.preferredQualityDays) {
      preferredQualityDays = JSON.parse(settings.preferredQualityDays as string);
    }
  } catch {
    // Use defaults
  }

  // Parse required rest days from settings
  let requiredRestDays: string[] = [];
  try {
    if (settings.requiredRestDays) {
      requiredRestDays = JSON.parse(settings.requiredRestDays as string);
    }
  } catch {
    // Use defaults
  }

  try {
    const generatedPlan = generatePlan({
      raceId: race.id,
      raceDate: race.date,
      raceDistanceMeters: race.distanceMeters,
      raceDistanceLabel: race.distanceLabel,
      startDate: today.toISOString().split('T')[0],
      currentWeeklyMileage: settings.currentWeeklyMileage || 25,
      peakWeeklyMileageTarget: settings.peakWeeklyMileageTarget || (settings.currentWeeklyMileage || 25) * 1.3,
      runsPerWeek: settings.runsPerWeekTarget || settings.runsPerWeekCurrent || 5,
      preferredLongRunDay: (settings.preferredLongRunDay as string) || 'saturday',
      preferredQualityDays,
      requiredRestDays,
      planAggressiveness: (settings.planAggressiveness as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
      qualitySessionsPerWeek: settings.qualitySessionsPerWeek || 2,
      paceZones,
    });

    // Save training blocks to database (one per week)
    const now = new Date().toISOString();
    const blockInserts = generatedPlan.weeks.map(week => ({
      raceId: race.id,
      name: `Week ${week.weekNumber} - ${week.phase.charAt(0).toUpperCase() + week.phase.slice(1)}`,
      phase: week.phase as 'base' | 'build' | 'peak' | 'taper' | 'recovery',
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      targetMileage: Math.round(week.targetMileage),
      focus: week.focus,
      createdAt: now,
    }));

    await db.insert(trainingBlocks).values(blockInserts);

    // Save planned workouts to database
    const workoutInserts = generatedPlan.weeks.flatMap(week =>
      week.workouts.map(workout => ({
        raceId: race.id,
        date: workout.date,
        name: workout.name,
        workoutType: workout.workoutType as 'easy' | 'steady' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | 'cross_train' | 'other',
        targetDistanceMiles: workout.targetDistanceMiles || null,
        targetDurationMinutes: workout.targetDurationMinutes || null,
        targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile || null,
        description: workout.description,
        rationale: workout.rationale || null,
        isKeyWorkout: workout.isKeyWorkout,
        status: 'scheduled' as const,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await db.insert(plannedWorkouts).values(workoutInserts);

    // Update race to mark plan as generated
    await db.update(races)
      .set({ trainingPlanGenerated: true })
      .where(eq(races.id, race.id));

    return {
      success: true,
      message: `Training plan generated for ${race.name}!`,
      summary: {
        total_weeks: generatedPlan.totalWeeks,
        phases: generatedPlan.phases.map(p => ({
          phase: p.phase,
          weeks: p.weeks,
          focus: p.focus,
        })),
        total_workouts: workoutInserts.length,
        peak_mileage: generatedPlan.summary.peakMileage,
      },
    };
  } catch (error) {
    return {
      error: `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get standard training plan templates from popular programs
 */
async function getStandardPlansHandler(input: Record<string, unknown>) {
  const raceDistance = input.race_distance as 'marathon' | 'half_marathon' | '10K' | '5K' | undefined;
  const author = input.author as string | undefined;
  const planId = input.plan_id as string | undefined;

  // If specific plan ID requested
  if (planId) {
    const plan = getStandardPlan(planId);
    if (!plan) {
      return {
        error: `Plan not found: ${planId}`,
        available_plans: standardPlans.map(p => ({ id: p.id, name: p.name, author: p.author })),
      };
    }

    return {
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        author: plan.author,
        description: plan.description,
        philosophy: plan.philosophy,
        race_distance: plan.raceDistance,
        weeks: plan.weeks,
        peak_week_miles: plan.peakWeekMiles,
        runs_per_week: plan.runsPerWeek,
        quality_sessions_per_week: plan.qualitySessionsPerWeek,
        max_long_run_miles: plan.maxLongRunMiles,
        key_workouts: plan.keyWorkouts,
        suitable_for: plan.suitableFor,
        required_weekly_mileage: plan.requiredWeeklyMileage,
        taper_weeks: plan.taperWeeks,
      },
    };
  }

  // Filter by author
  if (author) {
    const authorPlans = getPlansByAuthor(author);
    return {
      success: true,
      author: author,
      plans: authorPlans.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        race_distance: p.raceDistance,
        weeks: p.weeks,
        peak_week_miles: p.peakWeekMiles,
        suitable_for: p.suitableFor,
        required_weekly_mileage: p.requiredWeeklyMileage,
      })),
    };
  }

  // Get user settings to find suitable plans
  const settings = await db.query.userSettings.findFirst();
  const currentMileage = settings?.currentWeeklyMileage || 25;

  // Filter by race distance if provided
  let plans = standardPlans;
  if (raceDistance) {
    plans = plans.filter(p => p.raceDistance === raceDistance);
  }

  // Sort by suitability (closest match to current mileage)
  const sortedPlans = plans.sort((a, b) => {
    const diffA = Math.abs(a.requiredWeeklyMileage - currentMileage);
    const diffB = Math.abs(b.requiredWeeklyMileage - currentMileage);
    return diffA - diffB;
  });

  return {
    success: true,
    current_weekly_mileage: currentMileage,
    race_distance_filter: raceDistance || 'all',
    plans: sortedPlans.map(p => ({
      id: p.id,
      name: p.name,
      author: p.author,
      description: p.description,
      race_distance: p.raceDistance,
      weeks: p.weeks,
      peak_week_miles: p.peakWeekMiles,
      runs_per_week: p.runsPerWeek,
      suitable_for: p.suitableFor,
      required_weekly_mileage: p.requiredWeeklyMileage,
      fits_current_fitness: p.requiredWeeklyMileage <= currentMileage,
    })),
    recommendation: sortedPlans.length > 0 && sortedPlans[0].requiredWeeklyMileage <= currentMileage
      ? `Based on your current ${currentMileage} miles/week, ${sortedPlans[0].name} would be a good fit.`
      : `You may need to build your base before starting these plans. Current: ${currentMileage} mi/week.`,
  };
}

// ============================================================
// NEW DREAMY FEATURES IMPLEMENTATIONS
// ============================================================

/**
 * Rewrite today's workout to fit a time constraint
 */
async function rewriteWorkoutForTime(input: Record<string, unknown>) {
  const minutes = input.minutes as number;
  const preserveWarmup = input.preserve_warmup !== false;

  // Get today's planned workout
  const today = new Date().toISOString().split('T')[0];
  const plannedWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, today),
  });

  if (!plannedWorkout) {
    return {
      error: 'No planned workout found for today',
      suggestion: `With ${minutes} minutes, consider an easy ${Math.round(minutes / 10)} mile run.`,
    };
  }

  // Get user settings for pacing
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const easyPace = s?.easyPaceSeconds || 540;

  // Calculate what's achievable in the time
  const minWarmup = preserveWarmup ? 10 : 5;
  const minCooldown = 5;
  const availableMainTime = minutes - minWarmup - minCooldown;

  if (minutes < 25) {
    // Under 25 minutes - just do easy effort
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    return {
      original: {
        name: plannedWorkout.name,
        type: plannedWorkout.workoutType,
        distance: plannedWorkout.targetDistanceMiles,
        duration: plannedWorkout.targetDurationMinutes,
      },
      rewritten: {
        name: 'Quick Easy Run',
        type: 'easy',
        distance: estimatedMiles,
        duration: minutes,
        description: `Easy-paced run for ${minutes} minutes. Focus on moving well rather than hitting targets.`,
      },
      reasoning: 'Under 25 minutes is best spent on easy effort to maintain fitness without fatigue.',
      original_intent_preserved: false,
      note: plannedWorkout.workoutType !== 'easy'
        ? `Consider rescheduling your ${plannedWorkout.workoutType} to a day with more time.`
        : 'Original intent maintained.',
    };
  }

  // Determine how to preserve training intent
  const workoutType = plannedWorkout.workoutType;
  let rewritten;

  if (workoutType === 'easy' || workoutType === 'recovery') {
    // Easy runs - just shorten
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: `Shortened ${plannedWorkout.name}`,
      type: workoutType,
      distance: estimatedMiles,
      duration: minutes,
      description: `Easy run for ${minutes} minutes.`,
    };
  } else if (workoutType === 'long') {
    // Long runs - if less than 60% of planned, suggest postpone
    const originalDuration = plannedWorkout.targetDurationMinutes || 90;
    if (minutes < originalDuration * 0.6) {
      return {
        original: {
          name: plannedWorkout.name,
          type: workoutType,
          distance: plannedWorkout.targetDistanceMiles,
          duration: originalDuration,
        },
        recommendation: 'postpone',
        reasoning: `${minutes} minutes is less than 60% of your planned long run. Suggest postponing to tomorrow or the weekend.`,
        alternative: {
          name: 'Easy Run',
          type: 'easy',
          distance: Math.round((minutes * 60 / easyPace) * 10) / 10,
          duration: minutes,
          description: `Easy run to keep the streak going. Reschedule long run when you have more time.`,
        },
      };
    }
    // Reduce long run but keep it meaningful
    const reducedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: 'Medium-Long Run',
      type: 'long',
      distance: reducedMiles,
      duration: minutes,
      description: `Shortened long run. Maintain easy pace throughout.`,
    };
  } else if (workoutType === 'tempo' || workoutType === 'threshold') {
    // Quality workouts - preserve intensity, reduce volume
    const tempoPace = s?.tempoPaceSeconds || 420;
    const tempoTime = Math.max(10, availableMainTime - 5); // At least 10 min of tempo
    const tempoMiles = Math.round((tempoTime * 60 / tempoPace) * 10) / 10;

    rewritten = {
      name: `Shortened ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
      type: workoutType,
      distance: null,
      duration: minutes,
      structure: {
        warmup: `${minWarmup} min easy`,
        main: `${tempoTime} min at ${workoutType} effort`,
        cooldown: `${minCooldown} min easy`,
      },
      description: `Warmup ${minWarmup} min, then ${tempoTime} min at ${workoutType} pace, cool down ${minCooldown} min.`,
    };
  } else if (workoutType === 'interval') {
    // Intervals - reduce reps but keep intensity
    const intervalPace = s?.intervalPaceSeconds || 360;
    const reps = Math.max(3, Math.floor(availableMainTime / 4)); // ~4 min per rep with recovery

    rewritten = {
      name: 'Shortened Intervals',
      type: 'interval',
      duration: minutes,
      structure: {
        warmup: `${minWarmup} min easy`,
        main: `${reps} x 400m with 90s jog recovery`,
        cooldown: `${minCooldown} min easy`,
      },
      description: `Warmup, then ${reps} x 400m at interval effort, cool down. Quality over quantity.`,
    };
  } else {
    // Default fallback
    const estimatedMiles = Math.round((minutes * 60 / easyPace) * 10) / 10;
    rewritten = {
      name: 'Adapted Workout',
      type: 'easy',
      distance: estimatedMiles,
      duration: minutes,
      description: `${minutes} minute easy run. Original workout adapted for time.`,
    };
  }

  return {
    original: {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      duration: plannedWorkout.targetDurationMinutes,
      description: plannedWorkout.description,
    },
    rewritten,
    reasoning: `Adapted ${plannedWorkout.workoutType} workout to fit ${minutes} minute window while preserving training intent.`,
    original_intent_preserved: workoutType === 'easy' || workoutType === 'recovery' || minutes >= 40,
  };
}

/**
 * Explain why a workout felt hard
 */
async function explainWorkout(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number | undefined;

  // Get the workout (most recent if no ID provided)
  let workout;
  if (workoutId) {
    workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, workoutId),
      with: { assessment: true, segments: true },
    });
  } else {
    workout = await db.query.workouts.findFirst({
      with: { assessment: true, segments: true },
      orderBy: [desc(workouts.date), desc(workouts.createdAt)],
    });
  }

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Get user settings
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  // Get recent workouts for context
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const recentWorkouts = await db.query.workouts.findMany({
    where: gte(workouts.date, cutoff.toISOString().split('T')[0]),
    with: { assessment: true },
    orderBy: [desc(workouts.date)],
  });

  // Run classification
  const classification = classifyRun(workout as Workout, s as UserSettings, workout.segments as WorkoutSegment[]);

  // Check data quality
  const dataQuality = checkDataQuality(workout as Workout, workout.segments as WorkoutSegment[]);

  // Generate explanation context
  const context = generateExplanationContext(
    workout as Workout,
    classification,
    dataQuality,
    s as UserSettings,
    recentWorkouts.filter(w => w.id !== workout.id) as Workout[],
    workout.assessment as {
      sleepQuality?: number;
      sleepHours?: number;
      stress?: number;
      soreness?: number;
      fueling?: number;
      hydration?: number;
      rpe?: number;
    } | undefined
  );

  // Build the explanation
  const factors = context.factors;
  const reasons = context.likelyReasons;
  const suggestions = context.suggestions;

  let mainExplanation = '';
  if (factors.length === 0) {
    mainExplanation = 'No obvious factors detected. Sometimes runs just feel harder than expected - that\'s normal.';
  } else if (factors.length === 1) {
    mainExplanation = `This workout was likely affected by ${factors[0]}.`;
  } else {
    mainExplanation = `Multiple factors may have contributed: ${factors.slice(0, 3).join(', ')}.`;
  }

  // Tomorrow suggestion
  let tomorrowSuggestion = 'Listen to your body tomorrow and adjust accordingly.';
  if (context.suggestions.includes('Consider a lighter day tomorrow')) {
    tomorrowSuggestion = 'Take it easier tomorrow - your body may need recovery.';
  } else if (factors.includes('poor sleep') || factors.includes('sleep deficit')) {
    tomorrowSuggestion = 'Prioritize sleep tonight. Tomorrow will feel better with rest.';
  } else if (factors.includes('challenging weather')) {
    tomorrowSuggestion = 'The weather was tough. Tomorrow might feel much better.';
  }

  return {
    workout: {
      date: workout.date,
      type: workout.workoutType,
      distance: workout.distanceMiles,
      pace: workout.avgPaceSeconds ? formatPaceFromTraining(workout.avgPaceSeconds) : null,
      verdict: workout.assessment?.verdict,
      rpe: workout.assessment?.rpe,
    },
    classification: {
      category: classification.category,
      confidence: Math.round(classification.confidence * 100),
      summary: classification.summary,
    },
    explanation: mainExplanation,
    contributing_factors: factors,
    likely_reasons: reasons,
    suggestions,
    tomorrow_suggestion: tomorrowSuggestion,
    data_quality: {
      score: dataQuality.overallScore,
      summary: getDataQualitySummary(dataQuality),
    },
  };
}

/**
 * Explain the reasoning behind a recommendation
 */
async function explainRecommendation(input: Record<string, unknown>) {
  const recommendationType = input.recommendation_type as string;
  const context = input.context as string | undefined;

  const explanations: Record<string, { principle: string; factors: string[]; evidence: string }> = {
    pace_adjustment: {
      principle: 'Pace adjustments account for conditions that affect running economy.',
      factors: ['Temperature', 'Humidity', 'Wind', 'Altitude', 'Terrain'],
      evidence: 'Research shows heat adds ~2% per 10°F above 55°F; altitude reduces performance ~3% per 3,000ft.',
    },
    workout_modification: {
      principle: 'Modifications preserve training intent while adapting to circumstances.',
      factors: ['Time constraints', 'Fatigue level', 'Weather', 'Schedule conflicts'],
      evidence: 'Maintaining workout frequency with adjusted volume is better than skipping entirely.',
    },
    rest_day: {
      principle: 'Rest is when adaptation happens. Strategic rest prevents overtraining.',
      factors: ['Accumulated fatigue', 'High stress', 'Poor sleep streak', 'Elevated RPE trend'],
      evidence: 'Studies show performance gains come during recovery, not during hard efforts.',
    },
    intensity_change: {
      principle: 'Training zones should match your current fitness and recovery state.',
      factors: ['Current VDOT', 'Recent performance', 'Fatigue indicators', 'Training phase'],
      evidence: 'Running easy runs too fast is the most common training mistake - it compromises recovery.',
    },
    plan_adjustment: {
      principle: 'Plans should adapt to life. Rigid adherence can lead to burnout or injury.',
      factors: ['Life stress', 'Illness', 'Work demands', 'Plan adherence rate'],
      evidence: 'Successful training comes from consistent, sustainable effort over months.',
    },
  };

  const explanation = explanations[recommendationType] || {
    principle: 'Recommendations are based on your training history and current state.',
    factors: ['Recent training load', 'Recovery indicators', 'Goals'],
    evidence: 'Personalized coaching adapts to your unique situation.',
  };

  return {
    recommendation_type: recommendationType,
    context: context || 'General guidance',
    underlying_principle: explanation.principle,
    factors_considered: explanation.factors,
    supporting_evidence: explanation.evidence,
    additional_context: 'Every recommendation aims to help you train consistently while avoiding injury.',
  };
}

/**
 * Convert outdoor workout to treadmill
 */
async function convertToTreadmill(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number | undefined;
  const inclinePercent = (input.incline_percent as number) || 1;

  // Get the workout (today's planned if no ID)
  let plannedWorkout;
  if (workoutId) {
    plannedWorkout = await db.query.plannedWorkouts.findFirst({
      where: eq(plannedWorkouts.id, workoutId),
    });
  } else {
    const today = new Date().toISOString().split('T')[0];
    plannedWorkout = await db.query.plannedWorkouts.findFirst({
      where: eq(plannedWorkouts.date, today),
    });
  }

  if (!plannedWorkout) {
    return { error: 'No planned workout found' };
  }

  // Base conversion: add incline OR slow pace
  const targetPace = plannedWorkout.targetPaceSecondsPerMile;
  const adjustedPace = targetPace ? targetPace + 15 : null; // Add 15 sec/mi

  let treadmillVersion;

  if (plannedWorkout.workoutType === 'easy' || plannedWorkout.workoutType === 'recovery') {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      pace_adjustment: '+15 sec/mi OR use 1% incline at original pace',
      description: `Set incline to ${inclinePercent}% to simulate outdoor resistance. Keep effort easy.`,
      tips: [
        'Use a fan to simulate airflow',
        'Vary pace/incline slightly to reduce monotony',
        'Consider a show or music to pass time',
      ],
    };
  } else if (plannedWorkout.workoutType === 'tempo' || plannedWorkout.workoutType === 'threshold') {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      pace_adjustment: adjustedPace ? `Target ${formatPaceFromTraining(adjustedPace)}/mi at ${inclinePercent}% incline` : 'Maintain effort level',
      description: `Tempo effort on treadmill at ${inclinePercent}% incline. Use effort/HR more than pace.`,
      tips: [
        'Treadmill tempo often feels harder mentally',
        'Break it into segments if needed',
        'Focus on effort, not exact pace',
      ],
    };
  } else if (plannedWorkout.workoutType === 'interval') {
    treadmillVersion = {
      name: `Treadmill Intervals`,
      type: 'interval',
      description: 'Adapted interval workout for treadmill',
      structure: {
        warmup: '10 min easy at 1% incline',
        main: 'Intervals: Increase speed for work, decrease for recovery',
        cooldown: '5-10 min easy',
      },
      tips: [
        'Use speed changes rather than stopping',
        'Know your interval speeds before starting',
        'Recovery can be slow jog (4-5 mph) rather than standing',
      ],
    };
  } else if (plannedWorkout.workoutType === 'long') {
    // Hill workouts become incline intervals
    treadmillVersion = {
      name: `Treadmill Long Run`,
      type: 'long',
      distance: plannedWorkout.targetDistanceMiles,
      incline: inclinePercent,
      description: `Long run on treadmill. Use ${inclinePercent}% incline and vary between 0-2% to simulate rolling terrain.`,
      tips: [
        'Entertainment is essential for long treadmill runs',
        'Break into 20-30 min mental segments',
        'Take a bathroom/water break halfway if needed',
        'Slight incline variations help prevent repetitive strain',
      ],
    };
  } else {
    treadmillVersion = {
      name: `Treadmill ${plannedWorkout.name}`,
      type: plannedWorkout.workoutType,
      incline: inclinePercent,
      pace_adjustment: '+15-20 sec/mi or 1% incline',
      description: `Adapted for treadmill with ${inclinePercent}% base incline.`,
    };
  }

  return {
    original: {
      name: plannedWorkout.name,
      type: plannedWorkout.workoutType,
      distance: plannedWorkout.targetDistanceMiles,
      pace: plannedWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(plannedWorkout.targetPaceSecondsPerMile)
        : null,
    },
    treadmill_version: treadmillVersion,
    general_tips: [
      'Treadmill running is NOT cheating - it\'s a valid training tool',
      'Set incline to 1% to better simulate outdoor running',
      'Stay hydrated - you can\'t feel wind cooling you down',
      'Use this time for focused training without weather/safety concerns',
    ],
  };
}

/**
 * Generate race week checklist
 */
async function generateRaceChecklist(input: Record<string, unknown>) {
  const raceId = input.race_id as number;

  const race = await db.query.races.findFirst({
    where: eq(races.id, raceId),
  });

  if (!race) {
    return { error: 'Race not found' };
  }

  const raceDate = new Date(race.date);
  const daysUntilRace = Math.ceil((raceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Determine race type for specific advice
  const isMarathon = race.distanceLabel.toLowerCase().includes('marathon') && !race.distanceLabel.toLowerCase().includes('half');
  const isHalf = race.distanceLabel.toLowerCase().includes('half');
  const is5k = race.distanceLabel === '5K';
  const is10k = race.distanceLabel === '10K';

  const checklist = {
    race: {
      name: race.name,
      date: race.date,
      distance: race.distanceLabel,
      days_until: daysUntilRace,
    },
    gear_prep: {
      timing: 'By Wednesday',
      items: [
        { item: 'Race outfit laid out', description: 'NOTHING NEW ON RACE DAY - wear what you\'ve trained in' },
        { item: 'Race shoes ready', description: 'Should have 50-100 miles on them already' },
        { item: 'Bib number attached', description: 'Pin it the night before' },
        { item: 'Watch/GPS charged', description: 'Full charge, know your target pace' },
        { item: 'Weather-appropriate layers', description: 'Check race day forecast' },
      ],
    },
    nutrition: {
      week_before: [
        'Maintain normal diet early in week',
        isMarathon || isHalf ? 'Increase carbs slightly Wed-Fri' : 'Normal eating',
        'Stay well hydrated all week',
        'Avoid new or unusual foods',
      ],
      day_before: [
        'Carb-focused dinner, nothing too heavy',
        'Avoid high fiber, spicy, or greasy foods',
        'Stop drinking alcohol',
        'Lay out race morning nutrition',
      ],
      race_morning: isMarathon
        ? ['Eat 3 hours before start', 'Familiar foods only', '400-600 calories', 'Coffee if you normally drink it']
        : isHalf
        ? ['Eat 2-3 hours before start', 'Light breakfast', '300-400 calories']
        : ['Light snack 1-2 hours before', 'Banana, toast, or energy bar'],
      during_race: isMarathon
        ? ['Hydrate at every station', 'Fuel every 45 min', 'Know your gel/nutrition plan']
        : isHalf
        ? ['Hydrate every 2-3 miles', 'One gel around mile 8-9 if needed']
        : ['Hydration only, no need for fuel'],
    },
    logistics: {
      timing: 'By Thursday',
      items: [
        { item: 'Know start time and location', checked: false },
        { item: 'Plan transportation and parking', checked: false },
        { item: 'Know bag check situation', checked: false },
        { item: 'Set multiple alarms for race morning', checked: false },
        { item: 'Know corral assignment', checked: false },
        { item: 'Have backup plans for bathroom', checked: false },
      ],
    },
    mental_prep: {
      week_before: [
        'Visualize the race going well',
        'Review your race plan and pacing strategy',
        'Remember: fitness is already banked, taper is for freshness',
        'Trust your training',
      ],
      day_before: [
        'Light shakeout jog if desired',
        'Avoid race expo stress (go early, don\'t walk too much)',
        'Early to bed (even if you can\'t sleep, rest helps)',
        'Review race morning routine',
      ],
      race_morning: [
        'Stick to your routine',
        'Arrive with plenty of time',
        'Don\'t get swept up in start line excitement',
        'Remember your pace plan for the first mile',
      ],
    },
    pacing_reminders: is5k
      ? ['First 400m will feel slow - that\'s correct', 'Settle in by mile 1', 'Empty the tank last half mile']
      : is10k
      ? ['First mile should feel easy', 'Build into race pace', 'Final 2K can push']
      : isHalf
      ? ['First 3 miles EASY', 'Settle into goal pace miles 4-10', 'Run the last 5K with what you have left']
      : isMarathon
      ? ['SLOW first 10K - bank time = bonk later', 'Goal pace miles 10-20', 'Survive and surge after mile 20']
      : ['Start conservative', 'Build through the middle', 'Finish strong'],
  };

  return checklist;
}

/**
 * Activate busy week mode
 */
async function activateBusyWeek(input: Record<string, unknown>) {
  const reason = input.reason as string | undefined;
  const reductionPercent = (input.reduction_percent as number) || 40;
  const preserveKeyWorkout = input.preserve_key_workout !== false;

  // Get this week's workouts
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startStr = startOfWeek.toISOString().split('T')[0];
  const endStr = endOfWeek.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Get future workouts this week
  const weekWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, todayStr),
      lte(plannedWorkouts.date, endStr),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  if (weekWorkouts.length === 0) {
    return { message: 'No planned workouts remaining this week to modify.' };
  }

  // Identify key workout if preserving
  const keyWorkout = preserveKeyWorkout
    ? weekWorkouts.find(w => w.isKeyWorkout || w.workoutType === 'tempo' || w.workoutType === 'long')
    : null;

  const modifications = [];
  const scaleFactor = 1 - (reductionPercent / 100);

  for (const workout of weekWorkouts) {
    if (keyWorkout && workout.id === keyWorkout.id) {
      // Reduce key workout by half the normal reduction
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * (1 - reductionPercent / 200) * 10) / 10
        : null;
      modifications.push({
        workout_id: workout.id,
        original: { name: workout.name, type: workout.workoutType, distance: workout.targetDistanceMiles },
        modified: { type: workout.workoutType, distance: newDistance, note: 'Reduced but preserved as key workout' },
      });

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          description: `[Busy Week] ${workout.description}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));
    } else {
      // Convert to easy and reduce
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * scaleFactor * 10) / 10
        : null;
      modifications.push({
        workout_id: workout.id,
        original: { name: workout.name, type: workout.workoutType, distance: workout.targetDistanceMiles },
        modified: { type: 'easy', distance: newDistance, note: 'Converted to easy' },
      });

      await db.update(plannedWorkouts)
        .set({
          workoutType: 'easy' as const,
          name: 'Easy Run',
          targetDistanceMiles: newDistance,
          description: `[Busy Week] Easy run - scaled back from ${workout.name}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));
    }
  }

  return {
    success: true,
    message: `Busy week mode activated. Reduced volume by ${reductionPercent}%.`,
    reason: reason || 'Life demands',
    modifications,
    key_workout_preserved: keyWorkout ? keyWorkout.name : null,
    tip: 'Remember: a reduced week is better than no running. Stay consistent with what you can do.',
  };
}

/**
 * Set travel mode
 */
async function setTravelMode(input: Record<string, unknown>) {
  const startDate = input.start_date as string;
  const endDate = input.end_date as string;
  const destination = input.destination as string | undefined;
  const hasTreadmill = input.has_treadmill as boolean | undefined;
  const hasGym = input.has_gym as boolean | undefined;

  // Update coach settings
  await db.update(userSettings)
    .set({
      updatedAt: new Date().toISOString(),
    });

  // Get workouts during travel period
  const travelWorkouts = await db.query.plannedWorkouts.findMany({
    where: and(
      gte(plannedWorkouts.date, startDate),
      lte(plannedWorkouts.date, endDate),
      eq(plannedWorkouts.status, 'scheduled')
    ),
    orderBy: [asc(plannedWorkouts.date)],
  });

  const adjustments = [];

  for (const workout of travelWorkouts) {
    let newType = workout.workoutType;
    let newDescription = workout.description;
    let adjustmentNote = '';

    if (!hasTreadmill && (workout.workoutType === 'tempo' || workout.workoutType === 'interval')) {
      // Convert quality to easy if no treadmill for bad weather
      newType = 'easy' as const;
      newDescription = `[Travel] Easy run instead of ${workout.workoutType}. Explore your surroundings!`;
      adjustmentNote = 'No treadmill - converted to easy outdoor exploration run';
    } else if (workout.workoutType === 'long') {
      // Reduce long runs during travel
      const newDistance = workout.targetDistanceMiles
        ? Math.round(workout.targetDistanceMiles * 0.7 * 10) / 10
        : null;
      newDescription = `[Travel] Reduced long run. Enjoy a new route!`;
      adjustmentNote = 'Long run reduced for travel';

      await db.update(plannedWorkouts)
        .set({
          targetDistanceMiles: newDistance,
          description: newDescription,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));

      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: `Reduced long run (${newDistance} mi)`,
        note: adjustmentNote,
      });
      continue;
    }

    if (newType !== workout.workoutType) {
      await db.update(plannedWorkouts)
        .set({
          workoutType: newType,
          description: newDescription,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(plannedWorkouts.id, workout.id));

      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: `Easy run`,
        note: adjustmentNote,
      });
    } else {
      adjustments.push({
        date: workout.date,
        original: workout.name,
        adjusted: workout.name,
        note: 'No change needed',
      });
    }
  }

  return {
    success: true,
    travel_period: { start: startDate, end: endDate },
    destination,
    facilities: {
      treadmill: hasTreadmill || false,
      gym: hasGym || false,
    },
    workouts_affected: travelWorkouts.length,
    adjustments,
    tips: [
      'Running in new places is a great way to explore',
      'Adjust for timezone - morning runs help with jet lag',
      destination?.toLowerCase().includes('altitude') || destination?.toLowerCase().includes('denver') || destination?.toLowerCase().includes('boulder')
        ? 'Altitude will make runs feel harder - slow down!'
        : 'Have fun with your travel runs',
    ],
  };
}

/**
 * Generate a return-to-running plan
 */
async function generateReturnPlan(input: Record<string, unknown>) {
  const daysAway = input.days_away as number;
  const reason = (input.reason as string) || 'other';

  // Get user settings for baseline
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];
  const baseWeeklyMileage = s?.currentWeeklyMileage || 25;
  const easyPace = s?.easyPaceSeconds || 540;

  let returnPlan;
  let weeklyProgression;

  if (daysAway <= 4) {
    // Short break - minimal adjustment
    returnPlan = {
      phase: 'Quick Return',
      duration: '1-2 days',
      first_run: {
        type: 'easy',
        distance: 3,
        pace_note: 'Easy pace, add 10-15 sec/mi',
        description: 'Short and easy. Just shake out the legs.',
      },
      progression: 'Resume normal training after 1-2 easy runs',
    };
    weeklyProgression = null;
  } else if (daysAway <= 7) {
    // Week off - gradual return
    returnPlan = {
      phase: 'Gradual Return',
      duration: '3-4 days',
      first_run: {
        type: 'easy',
        distance: 2,
        pace_note: 'Very easy, no pace pressure',
        description: 'Just 20-25 minutes of easy jogging.',
      },
      days: [
        { day: 1, workout: '20-25 min easy' },
        { day: 2, workout: 'Rest or cross-train' },
        { day: 3, workout: '30 min easy' },
        { day: 4, workout: 'Rest' },
        { day: 5, workout: '35-40 min easy, then resume normal schedule' },
      ],
    };
    weeklyProgression = null;
  } else if (daysAway <= 14) {
    // Two weeks off - week of building
    returnPlan = {
      phase: 'Building Back',
      duration: '1 week',
      first_run: {
        type: 'easy',
        distance: 2,
        pace_note: 'Conversational pace',
        description: 'Start with a short, easy run.',
      },
      week_plan: [
        { day: 'Day 1', workout: '20 min easy' },
        { day: 'Day 2', workout: 'Rest' },
        { day: 'Day 3', workout: '25 min easy' },
        { day: 'Day 4', workout: 'Rest or cross-train' },
        { day: 'Day 5', workout: '30 min easy' },
        { day: 'Day 6', workout: 'Rest' },
        { day: 'Day 7', workout: '35-40 min easy' },
      ],
      next_week: 'Resume ~70% of normal volume',
    };
    weeklyProgression = [
      { week: 1, mileage: Math.round(baseWeeklyMileage * 0.5), note: 'Return week' },
      { week: 2, mileage: Math.round(baseWeeklyMileage * 0.7), note: 'Building' },
      { week: 3, mileage: Math.round(baseWeeklyMileage * 0.85), note: 'Approaching normal' },
      { week: 4, mileage: baseWeeklyMileage, note: 'Back to normal' },
    ];
  } else {
    // Extended time off - multi-week progression
    const weeksOff = Math.ceil(daysAway / 7);
    const returnWeeks = Math.min(weeksOff, 6);

    returnPlan = {
      phase: 'Extended Return',
      duration: `${returnWeeks} weeks`,
      first_run: {
        type: 'easy',
        distance: 1.5,
        pace_note: 'Whatever feels comfortable',
        description: 'Short and gentle. No expectations.',
      },
      note: `After ${weeksOff} weeks off, your cardiovascular fitness has decreased but it will come back faster than it was built.`,
    };

    weeklyProgression = [];
    for (let i = 1; i <= returnWeeks; i++) {
      const percentage = Math.min(40 + (i - 1) * 15, 100);
      weeklyProgression.push({
        week: i,
        mileage: Math.round(baseWeeklyMileage * (percentage / 100)),
        note: i === 1 ? 'Very easy start' :
              i === returnWeeks ? 'Back to normal' :
              `Building (${percentage}%)`,
      });
    }
  }

  // Special considerations by reason
  const specialConsiderations = [];
  if (reason === 'illness') {
    specialConsiderations.push('Wait until fever-free for 24 hours before running');
    specialConsiderations.push('Listen to your body - illness can linger');
    specialConsiderations.push('If symptoms return, stop and rest more');
  } else if (reason === 'injury') {
    specialConsiderations.push('Ensure pain-free before starting');
    specialConsiderations.push('Some discomfort is okay, pain is not');
    specialConsiderations.push('If injury symptoms return, stop immediately');
  }

  return {
    days_away: daysAway,
    reason,
    return_plan: returnPlan,
    weekly_progression: weeklyProgression,
    special_considerations: specialConsiderations.length > 0 ? specialConsiderations : null,
    mindset: [
      'Fitness comes back faster than it was built',
      'Consistency beats intensity in the return phase',
      'The goal is to avoid a setback, not to catch up',
    ],
  };
}

/**
 * Set coach mode (advisor vs autopilot)
 */
async function setCoachMode(input: Record<string, unknown>) {
  const mode = input.mode as 'advisor' | 'autopilot';

  // This would update a coach settings record
  // For now, return confirmation
  return {
    success: true,
    mode,
    description: mode === 'advisor'
      ? 'Coach will suggest changes for your approval before making them.'
      : 'Coach will automatically apply minor changes (schedule swaps, easy conversions) and flag major changes for approval.',
    auto_apply_in_autopilot: [
      'Converting quality to easy based on fatigue',
      'Swapping workout days within the same week',
      'Adjusting pace targets for weather',
      'Reducing distance by up to 20%',
    ],
    always_require_approval: [
      'Skipping key workouts',
      'Major plan restructuring',
      'Changes affecting race week',
      'Adding unscheduled hard workouts',
    ],
  };
}

/**
 * Get route progress tracking
 */
async function getRouteProgress(input: Record<string, unknown>) {
  const routeId = input.route_id as number | undefined;

  if (routeId) {
    // Get specific route
    const route = await db.query.canonicalRoutes.findFirst({
      where: eq(canonicalRoutes.id, routeId),
    });

    if (!route) {
      return { error: 'Route not found' };
    }

    // Get workouts on this route
    const routeWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.routeId, routeId),
      orderBy: [desc(workouts.date)],
      limit: 10,
    });

    const summary = getRouteProgressSummary(route as CanonicalRoute, routeWorkouts as Workout[]);

    return {
      route: {
        id: route.id,
        name: route.name,
        distance: route.distanceMiles,
        elevation_gain: route.totalElevationGain,
      },
      stats: {
        total_runs: summary.totalRuns,
        personal_best: summary.personalBest ? {
          time: formatTimeFromSeconds(summary.personalBest.time),
          pace: summary.personalBest.pace ? formatPaceFromTraining(summary.personalBest.pace) : null,
        } : null,
        average_time: summary.averageTime ? formatTimeFromSeconds(summary.averageTime) : null,
        average_pace: summary.averagePace ? formatPaceFromTraining(summary.averagePace) : null,
      },
      improvement: summary.improvement,
      recent_trend: summary.recentTrend,
      recent_runs: routeWorkouts.slice(0, 5).map(w => ({
        date: w.date,
        time: w.durationMinutes ? `${w.durationMinutes} min` : null,
        pace: w.avgPaceSeconds ? formatPaceFromTraining(w.avgPaceSeconds) : null,
      })),
    };
  } else {
    // List all routes
    const allRoutes = await db.query.canonicalRoutes.findMany({
      orderBy: [desc(canonicalRoutes.runCount)],
    });

    return {
      routes: allRoutes.map(r => ({
        id: r.id,
        name: r.name,
        distance: r.distanceMiles,
        run_count: r.runCount,
        best_time: r.bestTimeSeconds ? formatTimeFromSeconds(r.bestTimeSeconds) : null,
        best_pace: r.bestPaceSeconds ? formatPaceFromTraining(r.bestPaceSeconds) : null,
      })),
      tip: 'Run the same routes regularly to track progress over time.',
    };
  }
}

/**
 * Get workout classification details
 */
async function getWorkoutClassification(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  const classification = classifyRun(
    workout as Workout,
    s as UserSettings,
    workout.segments as WorkoutSegment[]
  );

  return {
    workout: {
      id: workout.id,
      date: workout.date,
      logged_type: workout.workoutType,
    },
    classification: {
      detected_category: classification.category,
      confidence: Math.round(classification.confidence * 100),
      summary: classification.summary,
    },
    signals: classification.signals,
    alternative_classifications: classification.alternativeCategories?.map(alt => ({
      category: alt.category,
      confidence: Math.round(alt.confidence * 100),
    })),
    note: classification.category !== workout.workoutType
      ? `Auto-detected as ${classification.category}, you logged it as ${workout.workoutType}.`
      : 'Classification matches your logged type.',
  };
}

/**
 * Get execution score for a workout
 */
async function getExecutionScoreTool(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Check if we have stored execution details
  if (workout.executionScore !== null && workout.executionDetails) {
    const details = parseExecutionDetails(workout.executionDetails);
    return {
      workout_id: workoutId,
      overall_score: workout.executionScore,
      components: details?.components,
      highlights: details?.highlights,
      concerns: details?.concerns,
      from_cache: true,
    };
  }

  // Need to compute - check if there's a planned workout
  const plannedWorkout = workout.plannedWorkoutId
    ? await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.id, workout.plannedWorkoutId),
      })
    : await db.query.plannedWorkouts.findFirst({
        where: eq(plannedWorkouts.date, workout.date),
      });

  if (!plannedWorkout) {
    return {
      workout_id: workoutId,
      error: 'No planned workout to compare against',
      suggestion: 'Execution scores require a planned workout to measure against.',
    };
  }

  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  const weather = workout.weatherTempF ? {
    tempF: workout.weatherTempF || undefined,
    feelsLikeF: workout.weatherFeelsLikeF || undefined,
    humidity: workout.weatherHumidityPct || undefined,
    windMph: workout.weatherWindMph || undefined,
  } : undefined;

  const score = computeExecutionScore(
    workout as Workout,
    plannedWorkout as PlannedWorkout,
    workout.segments as WorkoutSegment[],
    weather,
    s as UserSettings | null
  );

  return {
    workout_id: workoutId,
    overall_score: score.overall,
    components: score.components,
    diagnosis: score.diagnosis,
    suggestion: score.suggestion,
    highlights: score.highlights,
    concerns: score.concerns,
  };
}

/**
 * Get data quality report
 */
async function getDataQualityReport(input: Record<string, unknown>) {
  const workoutId = input.workout_id as number;

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: { segments: true },
  });

  if (!workout) {
    return { error: 'Workout not found' };
  }

  // Check for cached flags
  if (workout.dataQualityFlags) {
    const cached = parseDataQualityFlags(workout.dataQualityFlags);
    if (cached) {
      return {
        workout_id: workoutId,
        ...cached,
        summary: getDataQualitySummary(cached as DataQualityFlags),
        from_cache: true,
      };
    }
  }

  // Compute fresh
  const quality = checkDataQuality(workout as Workout, workout.segments as WorkoutSegment[]);

  return {
    workout_id: workoutId,
    overall_score: quality.overallScore,
    gps_quality: quality.gpsQuality,
    hr_quality: quality.hrQuality,
    pace_reliability: quality.paceReliability,
    flags: quality.flags,
    recommendations: quality.recommendations,
    summary: getDataQualitySummary(quality),
  };
}

/**
 * Log body region soreness
 */
async function logSoreness(input: Record<string, unknown>) {
  const bodyRegion = input.body_region as string;
  const severity = input.severity as number;
  const notes = input.notes as string | undefined;

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  await db.insert(sorenessEntries).values({
    date: today,
    bodyRegion,
    severity,
    notes: notes || null,
    createdAt: now,
  });

  const severityLabel = ['none', 'mild', 'moderate', 'severe'][severity] || 'unknown';

  return {
    success: true,
    logged: {
      date: today,
      body_region: bodyRegion.replace(/_/g, ' '),
      severity: severityLabel,
      notes,
    },
    recommendation: severity >= 2
      ? 'Monitor this area. Consider reducing intensity or taking extra rest if it persists.'
      : severity === 1
      ? 'Mild soreness is normal. Stay aware and warm up thoroughly.'
      : 'Good to go!',
  };
}

/**
 * Get weekly recap for sharing
 */
async function getWeeklyRecap(input: Record<string, unknown>) {
  const weekOffset = (input.week_offset as number) ?? -1;

  // Reuse weekly review logic
  const review = await getWeeklyReview({ week_offset: weekOffset });

  // Add shareable formatting
  const recap = {
    ...review,
    share_text: generateShareText(review),
    achievements: identifyAchievements(review),
  };

  return recap;
}

function generateShareText(review: Awaited<ReturnType<typeof getWeeklyReview>>): string {
  const miles = review.summary?.total_miles || 0;
  const runs = review.summary?.total_runs || 0;

  let text = `📊 Week in Review\n`;
  text += `🏃 ${miles} miles across ${runs} runs\n`;

  if (review.highlights && review.highlights.length > 0) {
    text += `✨ ${review.highlights[0]}\n`;
  }

  text += `\n#running #training`;
  return text;
}

function identifyAchievements(review: Awaited<ReturnType<typeof getWeeklyReview>>): string[] {
  const achievements = [];

  if ((review.summary?.total_miles || 0) >= 30) {
    achievements.push('30+ mile week 🎯');
  }
  if ((review.summary?.total_miles || 0) >= 50) {
    achievements.push('50+ mile week 🔥');
  }
  if ((review.plan_adherence?.percent_completed || 0) >= 100) {
    achievements.push('100% plan completion 💯');
  }
  if ((review.verdicts as Record<string, number>)?.['great'] >= 3) {
    achievements.push('3+ great runs this week 🌟');
  }

  return achievements;
}

/**
 * Get prep recommendations for tomorrow
 */
async function getPrepForTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Get tomorrow's planned workout
  const tomorrowWorkout = await db.query.plannedWorkouts.findFirst({
    where: eq(plannedWorkouts.date, tomorrowStr),
  });

  if (!tomorrowWorkout) {
    return {
      date: tomorrowStr,
      day: tomorrow.toLocaleDateString('en-US', { weekday: 'long' }),
      workout: null,
      message: 'Rest day tomorrow! Take it easy.',
    };
  }

  // Get user settings
  const settings = await db.select().from(userSettings).limit(1);
  const s = settings[0];

  // Get weather forecast (would need weather API for tomorrow)
  // For now, use generic recommendations
  const prep = {
    date: tomorrowStr,
    day: tomorrow.toLocaleDateString('en-US', { weekday: 'long' }),
    workout: {
      name: tomorrowWorkout.name,
      type: tomorrowWorkout.workoutType,
      distance: tomorrowWorkout.targetDistanceMiles,
      pace: tomorrowWorkout.targetPaceSecondsPerMile
        ? formatPaceFromTraining(tomorrowWorkout.targetPaceSecondsPerMile)
        : null,
      is_key_workout: tomorrowWorkout.isKeyWorkout,
    },
    preparation: {
      tonight: [
        'Lay out your running clothes',
        tomorrowWorkout.isKeyWorkout ? 'Get to bed on time - quality sleep for quality workout' : 'Normal bedtime routine',
        'Charge your watch/phone',
      ],
      morning: [
        tomorrowWorkout.workoutType === 'long'
          ? 'Eat breakfast 2-3 hours before'
          : 'Light snack or coffee as usual',
        'Dynamic warmup before hard efforts',
      ],
    },
    gear_checklist: [
      'Running shoes',
      'Watch/GPS',
      tomorrowWorkout.targetDistanceMiles && tomorrowWorkout.targetDistanceMiles >= 10
        ? 'Hydration/fuel'
        : null,
      tomorrowWorkout.workoutType === 'interval' ? 'Track access or measured segment' : null,
    ].filter(Boolean),
    mental_note: tomorrowWorkout.isKeyWorkout
      ? 'Key workout tomorrow - trust your training and execute the plan!'
      : 'Enjoy the run!',
  };

  return prep;
}

/**
 * Override workout structure - allows users to correct auto-categorization
 */
async function overrideWorkoutStructure(input: Record<string, unknown>) {
  let workoutId = input.workout_id as number | undefined;
  const structure = input.structure as string;
  const workoutType = input.workout_type as string | undefined;

  // If no workout_id provided, get the most recent workout
  if (!workoutId) {
    const recent = await db.query.workouts.findFirst({
      orderBy: [desc(workouts.createdAt)],
    });
    if (!recent) {
      return {
        success: false,
        error: 'No workouts found to update',
      };
    }
    workoutId = recent.id;
  }

  // Get the workout to update
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId as number),
  });

  if (!workout) {
    return {
      success: false,
      error: `Workout ${workoutId} not found`,
    };
  }

  // Build update object
  const updateData: Partial<typeof workouts.$inferInsert> = {
    structureOverride: structure,
    updatedAt: new Date().toISOString(),
  };

  // Update workout type if provided
  if (workoutType) {
    updateData.category = workoutType;
    updateData.workoutType = workoutType as WorkoutType;
  }

  // Update the workout
  await db
    .update(workouts)
    .set(updateData)
    .where(eq(workouts.id, workoutId as number));

  return {
    success: true,
    workout_id: workoutId,
    date: workout.date,
    original_type: workout.workoutType,
    new_type: workoutType || workout.workoutType,
    structure_override: structure,
    message: `Updated workout from ${workout.date}. Structure set to: "${structure}"${workoutType ? `, type changed to ${workoutType}` : ''}.`,
  };
}

/**
 * Get performance-based pace model
 */
async function getPerformanceModel() {
  const model = await buildPerformanceModel();

  // Format paces for readability
  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  return {
    fitness_level: {
      estimated_vdot: model.estimatedVdot,
      confidence: model.vdotConfidence,
      vdot_range: `${model.vdotRange.low} - ${model.vdotRange.high}`,
    },
    data_quality: {
      total_data_points: model.dataPoints,
      races: model.sources.races,
      time_trials: model.sources.timeTrials,
      workout_efforts: model.sources.workoutBestEfforts,
      most_recent_performance: model.mostRecentPerformance,
      note: model.dataPoints === 0
        ? 'No performance data found. Add race results or time trials for accurate pace recommendations.'
        : model.vdotConfidence === 'high'
          ? 'Strong data - pace recommendations are well-calibrated.'
          : 'Limited data - consider racing or time-trialing to improve accuracy.',
    },
    trend: {
      direction: model.trend,
      vdot_change_per_month: model.trendMagnitude,
      interpretation: model.trend === 'improving'
        ? 'Fitness is trending upward!'
        : model.trend === 'declining'
          ? 'Fitness has declined recently - may indicate overtraining or time off.'
          : model.trend === 'stable'
            ? 'Fitness is holding steady.'
            : 'Not enough data to determine trend.',
    },
    recommended_paces: {
      easy: `${formatPace(model.paces.easy.low)} - ${formatPace(model.paces.easy.high)}`,
      steady: `${formatPace(model.paces.steady.low)} - ${formatPace(model.paces.steady.high)}`,
      tempo: formatPace(model.paces.tempo),
      threshold: formatPace(model.paces.threshold),
      interval: formatPace(model.paces.interval),
      repetition: formatPace(model.paces.repetition),
      marathon_goal: formatPace(model.paces.marathon),
      half_marathon_goal: formatPace(model.paces.halfMarathon),
    },
    coach_guidance: model.vdotConfidence === 'low'
      ? 'I\'m estimating your paces based on limited data. A recent 5K or 10K race would help me dial in your training zones much better.'
      : model.trend === 'improving'
        ? 'Your recent performances show great progress! Your paces have been updated to reflect your improved fitness.'
        : 'Your pace zones are based on your recent race results and workout data.',
  };
}

// Get deep coaching knowledge on a specific topic
function handleGetCoachingKnowledge(input: Record<string, unknown>) {
  const topic = input.topic as KnowledgeTopic;
  const includeRelated = input.include_related as boolean;

  if (!topic) {
    return {
      error: 'Topic is required',
      available_topics: [
        'training_philosophies', 'periodization', 'workout_types', 'pacing_zones',
        'race_specific', 'nutrition_fueling', 'recovery_adaptation', 'injury_management',
        'mental_performance', 'special_populations', 'weather_conditions', 'tapering', 'plan_adjustment',
        'race_prediction_reasoning', 'advanced_pattern_analysis', 'strength_training', 'cross_training',
        'sleep_optimization', 'race_execution', 'running_form', 'shoe_guidance', 'heart_rate_training',
        'women_running', 'ultra_trail', 'doubles_training', 'goal_setting', 'workout_library',
        'race_day_timeline', 'workout_prescriptions'
      ],
    };
  }

  if (includeRelated) {
    const { primary, related } = getTopicWithRelated(topic);
    const relatedTopics = getRelatedTopics(topic);

    return {
      topic,
      knowledge: primary,
      related_topics: relatedTopics,
      related_knowledge: related,
      usage_note: 'Primary topic and related topics provided for comprehensive coaching. Synthesize as needed.',
    };
  }

  const knowledge = getCoachingKnowledge(topic);

  return {
    topic,
    knowledge,
    related_topics_available: getRelatedTopics(topic),
    usage_note: 'Use include_related=true to also fetch related topics for comprehensive answers.',
  };
}

// Prescribe a specific workout based on context
async function prescribeWorkout(input: Record<string, unknown>) {
  console.log(`=== [prescribeWorkout] START === at ${new Date().toISOString()}`);
  console.log(`[prescribeWorkout] Input:`, JSON.stringify(input));

  // Check if user wants the original algorithm or template-based
  const useTemplates = input.use_templates !== false; // Default to true

  if (useTemplates) {
    try {
      // Use the enhanced template-based prescription
      const result = await enhancedPrescribeWorkout(input);
      console.log(`=== [prescribeWorkout] END (template) === at ${new Date().toISOString()}`);
      return result;
    } catch (error) {
      console.error('[prescribeWorkout] Template selection failed, falling back to original:', error);
      // Fall back to original algorithm
    }
  }

  // Original algorithm continues below...
  const workoutType = input.workout_type as string;
  const targetDistance = input.target_distance as string;
  const phase = input.phase as string;
  const weeklyMileage = input.weekly_mileage as number;

  // Get user settings for paces
  console.log(`[prescribeWorkout] Getting profile ID...`);
  const profileId = await getActiveProfileId();
  console.log(`[prescribeWorkout] Profile ID:`, profileId);

  if (!profileId) {
    console.log(`[prescribeWorkout] No profile ID found, returning error`);
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  console.log(`[prescribeWorkout] Fetching user settings...`);
  const settings = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const userSettingsData = settings[0] || {};
  console.log(`[prescribeWorkout] User settings found:`, !!settings[0]);

  // Get recent workout data for context
  console.log(`[prescribeWorkout] Fetching recent workouts...`);
  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.profileId, profileId))
    .orderBy(desc(workouts.date))
    .limit(20); // Get more workouts for better analysis
  console.log(`[prescribeWorkout] Found ${recentWorkouts.length} recent workouts`);

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  // Get prescription knowledge
  const prescriptionKnowledge = getCoachingKnowledge('workout_prescriptions');
  const workoutLibrary = getCoachingKnowledge('workout_library');

  // Use actual user paces from their settings
  const easyPace = userSettingsData.easyPaceSeconds || 540; // 9:00 default
  const tempoPace = userSettingsData.tempoPaceSeconds || 450; // 7:30 default
  const thresholdPace = userSettingsData.thresholdPaceSeconds || 420; // 7:00 default
  const intervalPace = userSettingsData.intervalPaceSeconds || 390; // 6:30 default
  const marathonPace = userSettingsData.marathonPaceSeconds || (tempoPace + 15);
  const halfMarathonPace = userSettingsData.halfMarathonPaceSeconds || thresholdPace;

  // Get user's actual training data
  const actualWeeklyMileage = weeklyMileage || userSettingsData.currentWeeklyMileage || 25;
  const peakWeeklyTarget = userSettingsData.peakWeeklyMileageTarget || 50;
  const currentLongRunMax = userSettingsData.currentLongRunMax || 10;
  const vdot = userSettingsData.vdot || 45;
  const aggressiveness = userSettingsData.planAggressiveness || 'moderate';

  // Analyze recent training load
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const recentWeekWorkouts = recentWorkouts.filter(w => new Date(w.date) >= last7Days);
  const recentMileage = recentWeekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  // Find recent similar workouts to check progression
  const recentSimilarWorkouts = recentWorkouts.filter(w => w.workoutType === workoutType);
  const lastSimilarWorkout = recentSimilarWorkouts[0];

  // Calculate appropriate mileage multiplier based on actual user data
  const baseMultiplier = actualWeeklyMileage / 40; // Base on 40 mpw as standard
  const fitnessMultiplier = Math.sqrt(vdot / 45); // Adjust for fitness level
  const progressionFactor = aggressiveness === 'aggressive' ? 1.1 : aggressiveness === 'conservative' ? 0.9 : 1.0;
  const mileageMultiplier = Math.min(Math.max(baseMultiplier * fitnessMultiplier * progressionFactor, 0.5), 2.0);

  // Calculate hard efforts this week
  const hardEffortsThisWeek = recentWeekWorkouts.filter(w =>
    w.workoutType && ['tempo', 'threshold', 'vo2max', 'race'].includes(w.workoutType)
  ).length;

  // Build prescription based on workout type
  let prescription: {
    workout_type: string;
    structure: string;
    target_paces: string;
    total_distance: string;
    warmup: string;
    cooldown: string;
    rationale: string;
    adjustments: string;
  };

  switch (workoutType) {
    case 'tempo':
      // Calculate tempo duration based on user's fitness and recent training
      const baseTempoMinutes = vdot < 40 ? 15 : vdot < 50 ? 20 : vdot < 60 ? 25 : 30;
      let tempoMin = Math.round(baseTempoMinutes * mileageMultiplier);
      let tempoMax = Math.round((baseTempoMinutes + 10) * mileageMultiplier);

      // Check if user has done tempo recently and adjust
      const recentTempo = recentSimilarWorkouts[0];
      if (recentTempo && recentTempo.durationMinutes) {
        const lastTempoDuration = Math.round(recentTempo.durationMinutes * 0.8); // Estimate tempo portion
        tempoMin = Math.round(lastTempoDuration * 1.05); // 5% progression
        tempoMax = Math.round(lastTempoDuration * 1.15); // Up to 15% increase
      }

      prescription = {
        workout_type: 'Tempo Run',
        structure: `${tempoMin}-${tempoMax} minutes continuous at tempo pace`,
        target_paces: `Tempo pace: ${formatPace(tempoPace)} (comfortably hard, RPE 6-7)`,
        total_distance: `${Math.round((tempoMin + tempoMax) / 2 * tempoPace / 60 + 3)} miles total including warmup/cooldown`,
        warmup: `${Math.round(1.5 * mileageMultiplier)} miles easy with 4 strides`,
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `Develops lactate threshold. Based on your VDOT of ${vdot} and recent training load.`,
        adjustments: phase === 'peak' ? 'In peak phase - can push duration to upper range' :
                    phase === 'base' ? 'In base phase - stay at lower end of range' :
                    'Build duration gradually through the phase',
      };
      break;

    case 'threshold':
      // Determine interval count and duration based on fitness level
      const intervalCount = vdot < 40 ? 3 : vdot < 50 ? 4 : vdot < 60 ? 5 : 6;
      const intervalMinutes = vdot < 45 ? 6 : vdot < 55 ? 8 : 10;
      const recoveryMinutes = aggressiveness === 'aggressive' ? 2 : aggressiveness === 'conservative' ? 3 : 2.5;

      // Calculate total threshold volume
      const thresholdVolume = intervalCount * intervalMinutes * thresholdPace / 60;
      const totalWithRecovery = thresholdVolume + (intervalCount - 1) * recoveryMinutes * easyPace / 60;

      prescription = {
        workout_type: 'Threshold Intervals',
        structure: `${intervalCount} x ${intervalMinutes} minutes at threshold pace with ${recoveryMinutes} min recovery jog`,
        target_paces: `Threshold pace: ${formatPace(thresholdPace)} (RPE 7-8), Recovery: ${formatPace(easyPace)}`,
        total_distance: `${Math.round(totalWithRecovery + 3.5)} miles total including warmup/cooldown`,
        warmup: `${Math.round(2 * mileageMultiplier)} miles easy with 4 strides`,
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `Accumulates ${intervalCount * intervalMinutes} minutes at threshold. Interval structure based on VDOT ${vdot}.`,
        adjustments: lastSimilarWorkout ?
          `Last threshold workout: ${new Date(lastSimilarWorkout.date).toLocaleDateString()}. Consider reducing recovery time if feeling strong.` :
          'First threshold workout in recent training - focus on hitting pace targets',
      };
      break;

    case 'vo2max':
      // Determine interval structure based on target race and fitness
      let intervalDistance: string;
      let reps: number;

      if (targetDistance === '5K' || targetDistance === '5k') {
        intervalDistance = vdot < 45 ? '800m' : '1000m';
        reps = vdot < 40 ? 4 : vdot < 50 ? 5 : 6;
      } else {
        intervalDistance = vdot < 45 ? '1000m' : vdot < 55 ? '1200m' : '1600m';
        reps = vdot < 45 ? 4 : 5;
      }

      // Convert interval distance to miles
      const intervalMiles = intervalDistance === '800m' ? 0.5 :
                           intervalDistance === '1000m' ? 0.62 :
                           intervalDistance === '1200m' ? 0.75 : 1.0;

      const intervalTotalMiles = reps * intervalMiles;
      const recoveryMiles = reps * intervalMiles * 0.8; // Slightly less than interval distance

      prescription = {
        workout_type: 'VO2max Intervals',
        structure: `${reps} x ${intervalDistance} at 5K pace with ${intervalDistance === '800m' ? '400m' :
                    intervalDistance === '1000m' ? '600m' : '800m'} recovery jog`,
        target_paces: `Interval pace: ${formatPace(intervalPace)} (RPE 8-9, hard but controlled), Recovery: ${formatPace(easyPace + 30)}`,
        total_distance: `${Math.round(intervalTotalMiles + recoveryMiles + 3.5)} miles total`,
        warmup: '2 miles easy with 4-6 strides',
        cooldown: `${Math.round(1.5 * mileageMultiplier)} miles easy`,
        rationale: `${reps} reps at VO2max pace totaling ${intervalTotalMiles.toFixed(1)} miles. Structure optimized for ${targetDistance || 'general fitness'}.`,
        adjustments: recentMileage < actualWeeklyMileage * 0.8 ?
          'Recent mileage is lower than usual - consider reducing reps by 1' :
          'Maintain consistent pace across all reps. Last rep should feel hard but doable.',
      };
      break;

    case 'long_run':
      // Calculate long run distance based on current fitness and target
      const baseLongRun = currentLongRunMax || Math.round(actualWeeklyMileage * 0.35);
      let longDistance: number;

      // Progressive build based on recent long runs
      const recentLongRuns = recentWorkouts.filter(w =>
        w.workoutType === 'long_run' && w.distanceMiles && w.distanceMiles >= baseLongRun * 0.8
      );

      if (recentLongRuns.length > 0) {
        const lastLongRun = recentLongRuns[0];
        const daysSinceLastLong = Math.floor((new Date().getTime() - new Date(lastLongRun.date).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastLong < 5) {
          // Too soon for another long run
          longDistance = Math.round(baseLongRun * 0.7); // Recovery long run
        } else if (daysSinceLastLong < 14) {
          // Normal progression
          longDistance = Math.min(Math.round((lastLongRun.distanceMiles || baseLongRun) * 1.1), peakWeeklyTarget * 0.35);
        } else {
          // Been a while, be conservative
          longDistance = baseLongRun;
        }
      } else {
        longDistance = baseLongRun;
      }

      // Add quality component based on phase and target race
      let structure: string;
      if (phase === 'build' || phase === 'peak') {
        if (targetDistance === 'marathon') {
          const mpMiles = Math.round(longDistance * 0.4);
          structure = `${longDistance} miles with ${mpMiles} miles at marathon pace in the middle`;
        } else if (targetDistance === 'half_marathon') {
          const tempoMiles = Math.round(longDistance * 0.25);
          structure = `${longDistance} miles with final ${tempoMiles} miles at half marathon pace`;
        } else {
          structure = `${longDistance} miles easy with optional progression in final 2-3 miles`;
        }
      } else {
        structure = `${longDistance} miles at comfortable, conversational pace`;
      }

      prescription = {
        workout_type: 'Long Run',
        structure,
        target_paces: `Easy: ${formatPace(easyPace)}${
          phase === 'build' || phase === 'peak' ? `, Marathon pace: ${formatPace(marathonPace)}, Half Marathon pace: ${formatPace(halfMarathonPace)}` : ''
        }`,
        total_distance: `${longDistance} miles`,
        warmup: 'First 2 miles very easy to warm up',
        cooldown: phase === 'build' || phase === 'peak' ? 'Last mile easy to cool down' : 'Gradual slowdown in final mile',
        rationale: `${Math.round(longDistance / actualWeeklyMileage * 100)}% of weekly mileage. ${
          targetDistance ? `Building endurance for ${targetDistance}.` : 'Building aerobic base.'
        }`,
        adjustments: currentLongRunMax && longDistance > currentLongRunMax ?
          `This is ${longDistance - currentLongRunMax} miles longer than your recent max. Take it easy and focus on completion.` :
          'Focus on maintaining steady effort rather than pace, especially on hills.',
      };
      break;

    case 'fartlek':
      // Calculate fartlek duration based on fitness and recent training
      const fartlekMinutes = Math.round((45 + (vdot - 45) * 0.5) * mileageMultiplier);
      const surgeCount = Math.round(fartlekMinutes / 8); // Roughly one surge every 8 minutes

      prescription = {
        workout_type: 'Fartlek',
        structure: `${fartlekMinutes} minutes total: ${surgeCount} surges of 1-3 minutes at tempo-to-5K effort with 1-2 min easy between`,
        target_paces: `Surges: ${formatPace(tempoPace)} to ${formatPace(intervalPace)}, Recovery: ${formatPace(easyPace)}`,
        total_distance: `${Math.round(fartlekMinutes * easyPace / 60 / 1.1)} miles (will vary based on effort)`,
        warmup: 'First 10 minutes of the run serves as warmup',
        cooldown: 'Last 10 minutes easy',
        rationale: `Unstructured speed work for ${targetDistance || 'general fitness'}. Great for breaking monotony.`,
        adjustments: aggressiveness === 'aggressive' ?
          'Push the surges harder - aim for 5K effort on most' :
          'Keep surges controlled - should feel invigorating, not exhausting',
      };
      break;

    case 'progression':
      // Scale progression run based on fitness and target race
      const progressionMiles = Math.round(Math.min(actualWeeklyMileage * 0.25, 10) * mileageMultiplier);
      const tempoFinishMiles = Math.min(Math.round(progressionMiles * 0.3), 3);

      prescription = {
        workout_type: 'Progression Run',
        structure: `${progressionMiles} miles: First ${progressionMiles - tempoFinishMiles} miles easy, gradually increasing pace, final ${tempoFinishMiles} miles at tempo`,
        target_paces: `Start: ${formatPace(easyPace + 30)}, Middle: ${formatPace(easyPace)}, Finish: ${formatPace(tempoPace)}`,
        total_distance: `${progressionMiles} miles`,
        warmup: 'The gradual start serves as your warmup',
        cooldown: 'Short 5-min walk after finishing fast',
        rationale: `Simulates ${targetDistance || 'race'} fatigue. Teaches pacing discipline and mental toughness.`,
        adjustments: recentWeekWorkouts.some(w => w.workoutType === 'tempo' || w.workoutType === 'threshold') ?
          'You\'ve had quality work this week - keep the progression controlled' :
          'No hard efforts this week - you can push the final miles harder',
      };
      break;

    default:
      // Calculate easy run distance based on weekly schedule and recent hard efforts
      const easyMiles = hardEffortsThisWeek > 1 ?
        Math.round(4 * mileageMultiplier) : // More recovery needed
        Math.round(6 * mileageMultiplier);  // Standard easy run

      prescription = {
        workout_type: 'Easy Run',
        structure: `${easyMiles}-${easyMiles + 2} miles at conversational pace`,
        target_paces: `Easy pace: ${formatPace(easyPace)} (RPE 3-5, can hold conversation)`,
        total_distance: `${easyMiles}-${easyMiles + 2} miles`,
        warmup: 'Start with 5 min very easy to warm up',
        cooldown: 'Gradual cooldown in final 0.5 mile',
        rationale: hardEffortsThisWeek > 1 ?
          `Recovery run - you've had ${hardEffortsThisWeek} hard efforts this week` :
          'Aerobic maintenance run. Building easy volume for endurance base.',
        adjustments: recentMileage > actualWeeklyMileage ?
          'Recent volume is high - keep this run on the shorter side' :
          'Can add 4-6 strides at the end for neuromuscular maintenance',
      };
  }

  // Calculate training stress and recovery needs
  const avgPaceLastWeek = recentWeekWorkouts.length > 0 ?
    recentWeekWorkouts.reduce((sum, w) => sum + (w.avgPaceSeconds || easyPace), 0) / recentWeekWorkouts.length :
    easyPace;

  const trainingStress = {
    weekly_volume: `${recentMileage.toFixed(1)} miles last 7 days (target: ${actualWeeklyMileage})`,
    volume_status: recentMileage < actualWeeklyMileage * 0.8 ? 'Below target' :
                   recentMileage > actualWeeklyMileage * 1.2 ? 'Above target' : 'On target',
    recent_quality: hardEffortsThisWeek > 0 ?
      `${hardEffortsThisWeek} hard workout(s) in past week` :
      'No hard workouts in past week',
    fitness_indicators: {
      vdot: vdot,
      easy_pace: formatPace(easyPace),
      recent_avg_pace: formatPace(Math.round(avgPaceLastWeek)),
    },
  };

  const result = {
    prescription,
    context: {
      phase: phase || 'not specified',
      target_race: targetDistance || 'not specified',
      weekly_mileage: actualWeeklyMileage,
      recent_training: {
        total_runs: recentWorkouts.length,
        days_covered: 20,
        similar_workouts: recentSimilarWorkouts.length,
        last_similar: lastSimilarWorkout ?
          `${new Date(lastSimilarWorkout.date).toLocaleDateString()} (${Math.floor((new Date().getTime() - new Date(lastSimilarWorkout.date).getTime()) / (1000 * 60 * 60 * 24))} days ago)` :
          'None found',
      },
      training_stress: trainingStress,
      user_profile: {
        current_fitness: `VDOT ${vdot}`,
        training_approach: aggressiveness,
        long_run_fitness: `Recent max: ${currentLongRunMax} miles`,
      },
    },
    coach_notes: recentMileage > actualWeeklyMileage * 1.1 ?
      'Training load is high - prioritize recovery and listen to your body. Consider taking an extra easy day.' :
      recentMileage < actualWeeklyMileage * 0.7 ?
      'Training volume is low - build back gradually to avoid injury. This workout is scaled appropriately.' :
      'Training is on track. Adjust pace based on how you feel and current conditions.',
  };

  console.log(`=== [prescribeWorkout] END === at ${new Date().toISOString()}`);
  console.log(`[prescribeWorkout] Returning prescription:`, JSON.stringify(result).slice(0, 200));
  return result;
}

// Generate race day plan
async function getRaceDayPlan(input: Record<string, unknown>) {
  const raceId = input.race_id as number | undefined;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  // Get the race
  let race;
  if (raceId) {
    const raceResults = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
    race = raceResults[0];
  } else {
    // Get next upcoming race
    const today = new Date().toISOString().split('T')[0];
    const upcomingRaces = await db
      .select()
      .from(races)
      .where(and(eq(races.profileId, profileId), gte(races.date, today)))
      .orderBy(asc(races.date))
      .limit(1);
    race = upcomingRaces[0];
  }

  if (!race) {
    return {
      error: 'No race found',
      suggestion: 'Add a race first with add_race tool',
    };
  }

  // Get user settings and calculate actual pace zones
  const userSettingsResult = await db.select().from(userSettings).where(eq(userSettings.profileId, profileId)).limit(1);
  const userSettingsData = userSettingsResult[0] || {};

  // Get user's VDOT or calculate from recent races
  let vdot = userSettingsData.vdot;
  if (!vdot) {
    // Try to get VDOT from recent race results
    const recentRaceResults = await db
      .select()
      .from(raceResults)
      .where(eq(raceResults.profileId, profileId))
      .orderBy(desc(raceResults.date))
      .limit(1);

    if (recentRaceResults.length > 0) {
      const result = recentRaceResults[0];
      vdot = calculateVDOT(result.distanceMeters / 1609.34, result.actualTimeSeconds);
    }
  }

  // Calculate personalized pace zones
  const paceZones = vdot ? calculatePaceZones(vdot) : null;
  const actualPaces = {
    easy: userSettingsData.easyPaceSeconds || paceZones?.easy || 600,
    marathon: userSettingsData.marathonPaceSeconds || paceZones?.marathon || 480,
    halfMarathon: userSettingsData.halfMarathonPaceSeconds || paceZones?.halfMarathon || 450,
    tempo: userSettingsData.tempoPaceSeconds || paceZones?.tempo || 420,
    threshold: userSettingsData.thresholdPaceSeconds || paceZones?.threshold || 400,
    interval: userSettingsData.intervalPaceSeconds || paceZones?.interval || 360,
  };

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate race day pacing from target OR current fitness
  const targetTimeSeconds = race.targetTimeSeconds;
  const distanceMeters = race.distanceMeters;
  const distanceMiles = distanceMeters / 1609.34;
  const targetPaceSeconds = targetTimeSeconds ? Math.round(targetTimeSeconds / distanceMiles) : null;

  // Get race-specific pace from VDOT if no target set
  let racePaceSeconds = targetPaceSeconds;
  if (!racePaceSeconds && paceZones) {
    const distanceLabel = race.distanceLabel?.toLowerCase() || '';
    if (distanceLabel.includes('marathon') && !distanceLabel.includes('half')) {
      racePaceSeconds = actualPaces.marathon;
    } else if (distanceLabel.includes('half')) {
      racePaceSeconds = actualPaces.halfMarathon;
    } else if (distanceLabel.includes('10k')) {
      racePaceSeconds = actualPaces.threshold;
    } else if (distanceLabel.includes('5k')) {
      racePaceSeconds = actualPaces.interval;
    }
  }

  // Try to get weather forecast for race location
  let weatherInfo = null;
  if (userSettings.latitude && userSettings.longitude) {
    try {
      // Check if race is within 7 days for accurate forecast
      const daysUntil = Math.ceil((new Date(race.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7 && daysUntil >= 0) {
        const weather = await fetchCurrentWeather(userSettings.latitude, userSettings.longitude);
        if (weather) {
          const severity = calculateConditionsSeverity(weather);
          weatherInfo = {
            temperature: weather.temperature,
            conditions: weather.conditionText,
            humidity: weather.humidity,
            wind_speed: weather.windSpeed,
            severity: severity.severityScore,
            pace_adjustment: calculatePaceAdjustment(
              racePaceSeconds || actualPaces.marathon,
              severity,
              'race',
              userSettings.heatAcclimatizationScore || 50
            ),
          };
        }
      }
    } catch (e) {
      // Weather fetch failed, continue without it
    }
  }

  // Get recent training summary for warmup recommendations
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 28);
  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.profileId, profileId), gte(workouts.date, cutoffDate.toISOString().split('T')[0])))
    .orderBy(desc(workouts.date))
    .limit(20);

  const avgMileage = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) / 4;

  // Build personalized pacing strategy
  const distanceLabel = race.distanceLabel?.toLowerCase() || '';
  let pacingStrategy: string;
  let splitTargets: Array<{ segment: string; pace: string; notes: string }> = [];

  if (distanceLabel.includes('marathon') && !distanceLabel.includes('half')) {
    const marathonPace = racePaceSeconds || actualPaces.marathon;
    const adjustedPace = weatherInfo?.pace_adjustment ?
      marathonPace + weatherInfo.pace_adjustment.adjustmentSeconds : marathonPace;

    splitTargets = [
      { segment: 'Miles 1-3', pace: formatPace(adjustedPace + 15), notes: 'Controlled start, let the crowd thin' },
      { segment: 'Miles 4-6', pace: formatPace(adjustedPace + 10), notes: 'Still warming up, should feel too easy' },
      { segment: 'Miles 7-13', pace: formatPace(adjustedPace), notes: 'Goal pace, find your rhythm' },
      { segment: 'Miles 14-20', pace: formatPace(adjustedPace), notes: 'Maintain focus, real race begins here' },
      { segment: 'Miles 21-23', pace: formatPace(adjustedPace), notes: 'Dig deep, rely on mental training' },
      { segment: 'Miles 24-26.2', pace: `${formatPace(adjustedPace)} or faster`, notes: 'Everything you have left' },
    ];

    const targetTime = targetTimeSeconds ? formatTime(targetTimeSeconds) :
      formatTime(marathonPace * distanceMiles);

    pacingStrategy = `MARATHON PACING PLAN
Target: ${targetTime} (${formatPace(marathonPace)}/mi average)
${weatherInfo ? `\nWeather adjustment: ${weatherInfo.pace_adjustment.recommendation}` : ''}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

FUELING STRATEGY:
- Pre-race: 200-300 cal 2-3 hours before
- During: ${Math.floor(distanceMiles / 5)} gels (every 5 miles starting at mile 5)
- Hydration: ${weatherInfo && weatherInfo.temperature > 65 ? 'Every aid station' : 'Every other aid station'}
- Practice your exact fueling plan during long runs`;

  } else if (distanceLabel.includes('half')) {
    const halfPace = racePaceSeconds || actualPaces.halfMarathon;
    const adjustedPace = weatherInfo?.pace_adjustment ?
      halfPace + weatherInfo.pace_adjustment.adjustmentSeconds : halfPace;

    splitTargets = [
      { segment: 'Mile 1', pace: formatPace(adjustedPace + 10), notes: 'Controlled start' },
      { segment: 'Miles 2-3', pace: formatPace(adjustedPace + 5), notes: 'Settle into rhythm' },
      { segment: 'Miles 4-10', pace: formatPace(adjustedPace), notes: 'Goal pace, stay steady' },
      { segment: 'Miles 11-12', pace: formatPace(adjustedPace), notes: 'Maintain when it gets hard' },
      { segment: 'Mile 13-13.1', pace: `${formatPace(adjustedPace - 5)} or faster`, notes: 'Empty the tank' },
    ];

    const targetTime = targetTimeSeconds ? formatTime(targetTimeSeconds) :
      formatTime(halfPace * distanceMiles);

    pacingStrategy = `HALF MARATHON PACING PLAN
Target: ${targetTime} (${formatPace(halfPace)}/mi average)
${weatherInfo ? `\nWeather adjustment: ${weatherInfo.pace_adjustment.recommendation}` : ''}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

FUELING: ${avgMileage > 40 ? '1 gel at mile 7' : 'Optional gel at mile 7-8'}`;

  } else if (distanceLabel.includes('10k')) {
    const tenKPace = racePaceSeconds || actualPaces.threshold;

    splitTargets = [
      { segment: 'Mile 1', pace: formatPace(tenKPace + 5), notes: 'Controlled, find position' },
      { segment: 'Miles 2-3', pace: formatPace(tenKPace), notes: 'Lock into goal pace' },
      { segment: 'Miles 4-5', pace: formatPace(tenKPace), notes: 'Stay strong when it hurts' },
      { segment: 'Mile 6-6.2', pace: `${formatPace(tenKPace - 5)} or faster`, notes: 'Final kick' },
    ];

    pacingStrategy = `10K PACING PLAN
Target: ${targetTimeSeconds ? formatTime(targetTimeSeconds) : formatTime(tenKPace * distanceMiles)}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

STRATEGY: This will hurt from mile 2 onward. That's normal. Focus on rhythm and breathing.`;

  } else {
    const fiveKPace = racePaceSeconds || actualPaces.interval;

    splitTargets = [
      { segment: 'First 800m', pace: formatPace(fiveKPace + 5), notes: 'Controlled start' },
      { segment: 'Mile 1-2', pace: formatPace(fiveKPace), notes: 'Goal pace, it will hurt' },
      { segment: 'Mile 2.5-3.1', pace: `${formatPace(fiveKPace)} or faster`, notes: 'Everything left' },
    ];

    pacingStrategy = `5K PACING PLAN
Target: ${targetTimeSeconds ? formatTime(targetTimeSeconds) : formatTime(fiveKPace * distanceMiles)}

${splitTargets.map(s => `${s.segment}: ${s.pace} - ${s.notes}`).join('\n')}

STRATEGY: After the first mile, it should feel hard. That's the correct effort. Stay mentally tough.`;
  }

  // Personalized warmup based on distance and fitness
  const warmupRoutine = distanceMiles > 13 ?
    ['5 min easy walk', '5 min easy jog', 'Dynamic stretches', 'Use the first mile as extended warmup'] :
    distanceMiles > 6 ?
    ['10 min easy jog', 'Dynamic stretches', '4x100m strides @ race pace', '5 min before start'] :
    ['15 min easy jog', 'Dynamic stretches', '6x100m strides building to race pace', '10 min before start'];

  const daysUntil = Math.ceil((new Date(race.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return {
    race: {
      name: race.name,
      date: race.date,
      distance: race.distanceLabel,
      target_time: targetTimeSeconds ? formatTime(targetTimeSeconds) :
        racePaceSeconds ? `Projected: ${formatTime(racePaceSeconds * distanceMiles)}` : 'Not set',
      target_pace: racePaceSeconds ? formatPace(racePaceSeconds) : 'Calculate from target time',
      days_until: daysUntil,
    },
    current_fitness: {
      vdot: vdot || 'Not calculated',
      recent_mileage: `${Math.round(avgMileage)} miles/week`,
      equivalent_performances: vdot ? {
        '5K': formatTime(calculatePaceZones(vdot).vo2max * 3.10686),
        '10K': formatTime(calculatePaceZones(vdot).threshold * 6.21371),
        'Half Marathon': formatTime(calculatePaceZones(vdot).halfMarathon * 13.1094),
        'Marathon': formatTime(calculatePaceZones(vdot).marathon * 26.2188),
      } : null,
    },
    weather_forecast: weatherInfo ? {
      temperature: `${weatherInfo.temperature}°F`,
      conditions: weatherInfo.conditions,
      humidity: `${weatherInfo.humidity}%`,
      wind: `${weatherInfo.wind_speed} mph`,
      impact: weatherInfo.pace_adjustment.recommendation,
      adjusted_goal: weatherInfo.pace_adjustment.adjustedPace,
    } : daysUntil <= 7 ? 'No location set for weather forecast' : 'Check forecast closer to race day',
    pacing_strategy: pacingStrategy,
    split_targets: splitTargets,
    warmup_routine: warmupRoutine,
    race_week_plan: {
      nutrition: distanceMiles > 13 ? [
        '7 days out: Normal eating, stay hydrated',
        '4-6 days out: Increase carb percentage to 60-70%',
        '2-3 days out: High carb, lower fiber, familiar foods only',
        '1 day out: Light, early dinner. No new foods',
        'Race morning: Practiced breakfast 2-3 hours before',
      ] : [
        '2-3 days out: Slightly increase carbs',
        '1 day out: Normal eating, avoid heavy/spicy foods',
        'Race morning: Light breakfast 2+ hours before',
      ],
      taper: [
        `This week: ${Math.round(avgMileage * 0.7)}-${Math.round(avgMileage * 0.8)} miles total`,
        'Maintain intensity, reduce volume',
        '1-2 quality sessions with reduced reps',
        'Race pace strides 2-3 days before',
        'Trust the taper - less is more',
      ],
    },
    race_morning_timeline: [
      `${distanceMiles > 13 ? '3-4' : '2-3'} hours before: Wake, bathroom, eat tested breakfast`,
      `2 hours before: Hydrate (16-20oz), get dressed, apply Body Glide`,
      '90 min before: Leave for venue with extra time for parking',
      '60 min before: Check bag, final bathroom visit, light dynamic stretching',
      `${distanceMiles > 10 ? '30' : '45'} min before: Begin warmup routine`,
      '15 min before: Get to corral/start area, stay loose',
      '5 min before: Final mental prep, review pace strategy',
    ],
    personalized_tips: [
      vdot && vdot > 50 ?
        'Your fitness is strong - trust your training but respect the distance' :
        'Run your own race - ignore others\' pace in early miles',
      weatherInfo && weatherInfo.temperature > 70 ?
        'Adjust pace for heat. Better to finish strong than crash late.' :
        'Conditions look good for a strong effort',
      avgMileage > 50 ?
        'Your high mileage base is an asset - use it for a strong finish' :
        'Stay conservative early to save energy for later miles',
      distanceMiles > 13 ?
        'The race starts at mile 20 (marathon) or mile 10 (half)' :
        'Expect it to hurt - that means you\'re racing properly',
    ],
  };
}

// Remember context from conversation (now persisted to database)
async function rememberContext(input: Record<string, unknown>) {
  const contextType = input.context_type as string;
  const content = input.content as string;
  const importance = (input.importance as 'low' | 'medium' | 'high') || 'medium';

  const profileId = await getActiveProfileId();
  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  const now = new Date().toISOString();

  // Generate a unique key based on type and content hash
  const contextKey = `${contextType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // Import at function level to avoid circular dependency
    const { coachContext } = await import('@/lib/db');

    // Check if we already have too many contexts for this profile
    const existingContexts = await db
      .select()
      .from(coachContext)
      .where(eq(coachContext.profileId, profileId))
      .orderBy(desc(coachContext.createdAt));

    // Keep only last 100 contexts per profile
    if (existingContexts.length >= 100) {
      // Delete oldest contexts
      const toDelete = existingContexts.slice(99);
      for (const ctx of toDelete) {
        await db.delete(coachContext).where(eq(coachContext.id, ctx.id));
      }
    }

    // Insert new context
    await db.insert(coachContext).values({
      profileId,
      contextType,
      contextKey,
      contextValue: content,
      importance,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: `Remembered: ${content}`,
      context_type: contextType,
      importance,
    };
  } catch (error) {
    console.error('Error saving context:', error);
    return {
      success: false,
      error: 'Failed to save context',
    };
  }
}

// Recall stored context (now from database)
async function recallContext(input: Record<string, unknown>) {
  const contextType = input.context_type as string;
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return { error: 'No active profile. Please complete onboarding first.' };
  }

  try {
    // Import at function level to avoid circular dependency
    const { coachContext } = await import('@/lib/db');

    // Query contexts from database
    let contexts;
    if (contextType && contextType !== 'all') {
      contexts = await db
        .select()
        .from(coachContext)
        .where(and(
          eq(coachContext.profileId, profileId),
          eq(coachContext.contextType, contextType)
        ))
        .orderBy(desc(coachContext.createdAt));
    } else {
      contexts = await db
        .select()
        .from(coachContext)
        .where(eq(coachContext.profileId, profileId))
        .orderBy(desc(coachContext.createdAt));
    }

    if (contexts.length === 0) {
      return {
        has_context: false,
        message: 'No context stored yet.',
      };
    }

    // Group by type
    const grouped: Record<string, string[]> = {};
    for (const ctx of contexts) {
      if (!grouped[ctx.contextType]) {
        grouped[ctx.contextType] = [];
      }
      grouped[ctx.contextType].push(`[${ctx.importance}] ${ctx.contextValue}`);
    }

    // Calculate time ago for recent contexts
    const recentContexts = contexts.slice(0, 10).map(c => {
      const minutesAgo = Math.round((new Date().getTime() - new Date(c.createdAt).getTime()) / 1000 / 60);
      const timeAgo = minutesAgo < 60
        ? `${minutesAgo} minutes ago`
        : minutesAgo < 1440
        ? `${Math.round(minutesAgo / 60)} hours ago`
        : `${Math.round(minutesAgo / 1440)} days ago`;

      return {
        type: c.contextType,
        content: c.contextValue,
        importance: c.importance,
        time_ago: timeAgo,
      };
    });

    return {
      has_context: true,
      context_count: contexts.length,
      contexts_by_type: grouped,
      recent_contexts: recentContexts,
      usage_note: 'Use this context to inform your coaching. Reference relevant past decisions and preferences.',
    };
  } catch (error) {
    console.error('Error recalling context:', error);
    return {
      has_context: false,
      error: 'Failed to retrieve context',
    };
  }
}
