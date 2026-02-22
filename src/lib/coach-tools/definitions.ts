// Coach tool definitions for Claude function calling
// Auto-generated from coach-tools.ts split

import { vibeCheckDefinition, adaptWorkoutDefinition } from '../vibe-check-tool';

const MUTATING_COACH_TOOL_NAMES = new Set<string>([
  'log_workout',
  'update_workout',
  'log_assessment',
  'add_clothing_item',
  'log_outfit_feedback',
  'update_user_profile',
  'add_race',
  'add_race_result',
  'modify_todays_workout',
  'update_planned_workout',
  'swap_workouts',
  'reschedule_workout',
  'skip_workout',
  'make_down_week',
  'insert_rest_day',
  'adjust_workout_distance',
  'convert_to_easy',
  'log_injury',
  'clear_injury',
  'set_travel_status',
  'update_race',
  'delete_race',
  'generate_training_plan',
  'activate_busy_week',
  'set_travel_mode',
  'set_coach_mode',
  'log_soreness',
  'override_workout_structure',
  'remember_context',
  'save_memory',
  'create_master_plan',
]);

export function isMutatingCoachTool(toolName: string): boolean {
  return MUTATING_COACH_TOOL_NAMES.has(toolName);
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
          description: 'Optional filter by workout type',
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
    description: 'Update user profile fields. Use when user provides information about themselves (training preferences, goals, background, comfort levels, recovery, schedule, PRs, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        // Bio
        name: { type: 'string', description: 'User\'s name' },
        age: { type: 'number', description: 'User\'s age' },
        years_running: { type: 'number', description: 'Years of running experience' },
        athletic_background: { type: 'string', description: 'Athletic background (comma-separated, _e.g. "cross_country, track")' },
        resting_hr: { type: 'number', description: 'Resting heart rate in bpm' },
        // Training state
        current_weekly_mileage: { type: 'number', description: 'Current weekly running mileage' },
        runs_per_week: { type: 'number', description: 'Current runs per week' },
        current_long_run_max: { type: 'number', description: 'Current longest run in miles' },
        peak_weekly_mileage_target: { type: 'number', description: 'Target peak weekly mileage' },
        quality_sessions_per_week: { type: 'number', description: 'Number of quality/hard sessions per week (1-4)' },
        // Preferences
        preferred_long_run_day: {
          type: 'string', description: 'Preferred day for long runs',
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        preferred_quality_days: { type: 'array', description: 'Preferred days for quality workouts', items: { type: 'string' } },
        plan_aggressiveness: {
          type: 'string', description: 'How aggressive the training plan should be',
          enum: ['conservative', 'moderate', 'aggressive', 'not_sure'],
        },
        // Training philosophy
        training_philosophy: {
          type: 'string', description: 'Primary training philosophy (legacy single-select)',
          enum: ['pfitzinger', 'hansons', 'daniels', 'lydiard', 'polarized', 'balanced', 'not_sure'],
        },
        training_philosophies: {
          type: 'array', description: 'Training philosophies (multi-select)',
          items: { type: 'string', enum: ['pfitzinger', 'hansons', 'daniels', 'lydiard', 'polarized', 'balanced', 'not_sure'] },
        },
        down_week_frequency: {
          type: 'string', description: 'How often to schedule down/recovery weeks',
          enum: ['every_3_weeks', 'every_4_weeks', 'as_needed', 'rarely', 'not_sure'],
        },
        long_run_style: {
          type: 'string', description: 'Long run style preference',
          enum: ['traditional', 'hansons_style', 'progressive', 'not_sure'],
        },
        fatigue_management_style: {
          type: 'string', description: 'How to handle fatigue',
          enum: ['back_off', 'balanced', 'push_through', 'modify', 'not_sure'],
        },
        workout_variety_pref: {
          type: 'string', description: 'Preference for workout variety',
          enum: ['same', 'moderate', 'lots', 'not_sure'],
        },
        mlr_preference: { type: 'boolean', description: 'Whether user likes mid-long runs' },
        progressive_long_runs_ok: { type: 'boolean', description: 'Whether user is open to progressive long runs' },
        // Comfort levels (1-5 scale)
        comfort_vo2max: { type: 'number', description: 'Comfort with VO2max workouts (1=low, 5=high)' },
        comfort_tempo: { type: 'number', description: 'Comfort with tempo runs (1=low, 5=high)' },
        comfort_hills: { type: 'number', description: 'Comfort with hill workouts (1=low, 5=high)' },
        comfort_long_runs: { type: 'number', description: 'Comfort with long runs (1=low, 5=high)' },
        comfort_track_work: { type: 'number', description: 'Comfort with track workouts (1=low, 5=high)' },
        open_to_doubles: { type: 'boolean', description: 'Whether user is open to double runs' },
        train_by: { type: 'string', description: 'Preferred training metric', enum: ['pace', 'heart_rate', 'feel', 'mixed', 'not_sure'] },
        speedwork_experience: { type: 'string', description: 'Level of speedwork experience', enum: ['none', 'beginner', 'intermediate', 'advanced', 'not_sure'] },
        workout_complexity: { type: 'string', description: 'How complex/structured workouts should be', enum: ['basic', 'moderate', 'detailed', 'not_sure'] },
        coaching_detail_level: { type: 'string', description: 'How much explanation to include with workouts', enum: ['minimal', 'moderate', 'detailed', 'not_sure'] },
        // Recovery
        typical_sleep_hours: { type: 'number', description: 'Typical hours of sleep per night' },
        sleep_quality: { type: 'string', description: 'Sleep quality', enum: ['poor', 'fair', 'good', 'excellent'] },
        stress_level: { type: 'string', description: 'Current life stress level', enum: ['low', 'moderate', 'high', 'very_high'] },
        needs_extra_rest: { type: 'boolean', description: 'Whether user needs extra rest days' },
        common_injuries: { type: 'array', description: 'Common injury areas (e.g. ["knee", "achilles"])', items: { type: 'string' } },
        current_injuries: { type: 'string', description: 'Description of current injuries or niggles' },
        injury_history: { type: 'string', description: 'Description of past injuries' },
        // Schedule & environment
        preferred_run_time: {
          type: 'string', description: 'Preferred time of day to run',
          enum: ['early_morning', 'morning', 'midday', 'evening', 'flexible'],
        },
        surface_preference: { type: 'string', description: 'Preferred running surface', enum: ['road', 'trail', 'track', 'mixed'] },
        group_vs_solo: { type: 'string', description: 'Solo or group running preference', enum: ['solo', 'group', 'either'] },
        heat_sensitivity: { type: 'number', description: 'Heat sensitivity (1=low, 5=high)' },
        cold_sensitivity: { type: 'number', description: 'Cold sensitivity (1=low, 5=high)' },
        // Race PRs (in seconds)
        marathon_pr: { type: 'number', description: 'Marathon PR in seconds' },
        half_marathon_pr: { type: 'number', description: 'Half marathon PR in seconds' },
        ten_k_pr: { type: 'number', description: '10K PR in seconds' },
        five_k_pr: { type: 'number', description: '5K PR in seconds' },
        // Coach context
        coach_context: { type: 'string', description: 'Additional context for the coach (goals, preferences, constraints)' },
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race'],
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
    description: 'Generate a training plan for an upcoming race. Creates a macro roadmap (all weeks) with detailed workouts for the first 3 weeks. Future weeks auto-generate as the athlete approaches them. Use when user asks to create a plan for their race.',
    input_schema: {
      type: 'object' as const,
      properties: {
        race_id: {
          type: 'number',
          description: 'ID of the race to generate a plan for. Optional if race_name is provided or only one A-race exists.',
        },
        race_name: {
          type: 'string',
          description: 'Name of the race (fuzzy matched against upcoming races). Use if race_id is unknown.',
        },
        override_current_mileage: {
          type: 'number',
          description: 'Optional: Override detected current weekly mileage if user says their typical week is different',
        },
      },
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
          enum: ['recovery', 'easy', 'steady', 'marathon', 'tempo', 'threshold', 'interval', 'repetition', 'long', 'race', 'cross_train', 'other'],
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
    description: 'Get the user\'s performance-based pace model and training analytics. Returns estimated fitness level, pace zones, trend, confidence, PLUS fatigue resistance (how well they hold pace late in runs), split tendencies (positive/negative/even by workout type), and running economy trend (cardiac cost over time). Use this to understand their strengths and areas for improvement.',
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
        raw_request: {
          type: 'string',
          description: 'The original user request text (e.g., "give me a super advanced tempo workout")',
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
  // Vibe check tool
  vibeCheckDefinition,
  // Adapt workout tool
  adaptWorkoutDefinition,
  // Memory tools
  {
    name: 'save_memory',
    description: `Explicitly save important information about the athlete. Use when:
    - User shares preferences ("I prefer morning runs")
    - User mentions constraints ("I can only run 4 days a week")
    - User sets goals ("I want to break 3:30 in the marathon")
    - User provides feedback ("That workout was too hard")
    - You notice patterns in their training`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback'],
          description: 'Type of information being saved'
        },
        insight: {
          type: 'string',
          description: 'The specific information to remember'
        },
        confidence: {
          type: 'number',
          description: 'How confident you are in this information (0-1)',
          minimum: 0,
          maximum: 1
        },
        source: {
          type: 'string',
          enum: ['explicit', 'inferred'],
          description: 'Whether user stated this directly or you inferred it'
        },
        expires_in_days: {
          type: 'number',
          description: 'Optional: Days until this insight expires (e.g., "feeling tired" might expire in 7 days)'
        }
      },
      required: ['category', 'insight', 'confidence', 'source']
    }
  },
  {
    name: 'recall_memory',
    description: `Retrieve saved memories about the athlete. Use when:
    - Starting a conversation to get context
    - Making decisions that depend on preferences
    - Checking for conflicting information
    - User asks "what do you know about me?"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback', 'all'],
          description: 'Category to filter by, or "all" for everything'
        },
        context: {
          type: 'string',
          description: 'Optional context to find relevant memories (e.g., "morning runs")'
        },
        include_expired: {
          type: 'boolean',
          description: 'Whether to include expired insights',
          default: false
        }
      },
      required: ['category']
    }
  },
  // Fitness assessment tool
  {
    name: 'assess_fitness',
    description: `Analyze user's recent training history to understand current fitness level. Use before creating training plans or when user asks about their fitness/readiness.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        include_details: {
          type: 'boolean',
          description: 'Include detailed weekly breakdown',
          default: false
        }
      }
    }
  },
];
