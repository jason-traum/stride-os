import { pgTable, text, integer, serial, real, boolean, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Re-export all enums from the main schema
export * from './schema-enums';

// Import enums
import {
  workoutTypes, workoutSources, verdicts, wasIntendedOptions, breathingFeels,
  perceivedHeats, caffeineOptions, feltTempOptions, surfaceOptions, shoeCategories,
  daysOfWeek, clothingCategories, temperaturePreferences, outfitRatings,
  extremityRatings, runnerPersonas, genders, timeSincePeakFitnessOptions,
  planAggressivenessOptions, stressLevelOptions, surfacePreferenceOptions,
  workoutVarietyOptions, groupVsSoloOptions, trainByOptions, trainingPhases,
  racePriorities, raceStatuses, plannedWorkoutStatuses, workoutTemplateCategories,
  weatherConditions, chatRoles, speedworkExperienceOptions, sleepQualityOptions,
  preferredRunTimeOptions, coachPersonas, profileTypes,
  aiProviders, claudeModels, openaiModels,
  trainingPhilosophyOptions, downWeekFrequencyOptions, longRunMaxStyleOptions,
  fatigueManagementStyleOptions, workoutVarietyPrefOptions,
  workoutComplexityOptions, coachingDetailLevelOptions,
  shoeComfortOptions, painReportOptions, energyLevelOptions,
} from './schema-enums';

// Profiles table for multi-profile support
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),                    // "Jason", "Demo Runner"
  type: text('type', { enum: profileTypes }).notNull().default('personal'),
  avatarColor: text('avatar_color').default('#3b82f6'),  // For visual distinction
  auraColorStart: text('aura_color_start'),
  auraColorEnd: text('aura_color_end'),
  isProtected: boolean('is_protected').default(false), // Demo profiles can't be deleted
  settingsSnapshot: text('settings_snapshot'),     // JSON backup for demo reset
  dataSnapshot: text('data_snapshot'),             // JSON backup for demo reset
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Clothing item table for wardrobe
export const clothingItems = pgTable('clothing_items', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  name: text('name').notNull(),
  category: text('category', { enum: clothingCategories }).notNull(),
  warmthRating: integer('warmth_rating').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Shoe table
export const shoes = pgTable('shoes', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  category: text('category', { enum: shoeCategories }).notNull(),
  intendedUse: text('intended_use').notNull().default('[]'),
  totalMiles: real('total_miles').notNull().default(0),
  isRetired: boolean('is_retired').notNull().default(false),
  purchaseDate: text('purchase_date'),
  notes: text('notes'),
  stravaGearId: text('strava_gear_id'), // Strava gear ID (e.g. "g12345") for auto-linking
  stravaOverrides: text('strava_overrides'), // JSON string[] of field names user manually edited
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Workout table
export const workouts = pgTable('workouts', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  date: text('date').notNull(),
  distanceMiles: real('distance_miles'),
  durationMinutes: integer('duration_minutes'),
  avgPaceSeconds: integer('avg_pace_seconds'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: real('elevation_gain_ft'),
  routeName: text('route_name'),
  shoeId: integer('shoe_id').references(() => shoes.id),
  workoutType: text('workout_type', { enum: workoutTypes }).notNull().default('easy'),
  source: text('source', { enum: workoutSources }).notNull().default('manual'),
  notes: text('notes'),
  weatherTempF: integer('weather_temp_f'),
  weatherFeelsLikeF: integer('weather_feels_like_f'),
  weatherHumidityPct: integer('weather_humidity_pct'),
  weatherWindMph: integer('weather_wind_mph'),
  weatherConditions: text('weather_conditions', { enum: weatherConditions }),
  weatherSeverityScore: integer('weather_severity_score'),
  plannedWorkoutId: integer('planned_workout_id'),
  stravaActivityId: bigint('strava_activity_id', { mode: 'number' }),
  intervalsActivityId: text('intervals_activity_id'),
  avgHeartRate: integer('avg_heart_rate'),
  elevationGainFeet: real('elevation_gain_feet'),
  trainingLoad: real('training_load'),
  // New fields for dreamy features
  autoCategory: text('auto_category'), // System-detected run category
  category: text('category'), // User-confirmed category (if different from auto)
  structureOverride: text('structure_override'), // User-defined structure like "1wu, 3x3mi@tempo, 1cd"
  stravaName: text('strava_name'), // Activity name from Strava (e.g. "Tempo Tuesday")
  autoSummary: text('auto_summary'), // AI-generated one-line description
  aiExplanation: text('ai_explanation'), // "Why this felt hard" explanation
  qualityRatio: real('quality_ratio'), // Fraction of time at/above tempo effort
  trimp: real('trimp'), // Training impulse score
  intervalAdjustedTrimp: real('interval_adjusted_trimp'), // TRIMP with per-segment discount for intervals
  intervalStressDetails: text('interval_stress_details'), // JSON interval stress breakdown
  executionScore: integer('execution_score'), // 0-100 execution score
  executionDetails: text('execution_details'), // JSON component breakdown
  dataQualityFlags: text('data_quality_flags'), // JSON data integrity flags
  routeFingerprint: text('route_fingerprint'), // JSON for route matching
  routeId: integer('route_id'), // FK to canonical route
  polyline: text('polyline'), // Encoded polyline from Strava for route map
  zoneDistribution: text('zone_distribution'), // JSON: { recovery: 2.1, easy: 25.3, tempo: 8.5, ... } (minutes per zone)
  zoneDominant: text('zone_dominant'), // The dominant effort zone
  zoneClassifiedAt: text('zone_classified_at'), // ISO timestamp of last classification
  zoneBoundariesUsed: text('zone_boundaries_used'), // JSON: { easy, steady, marathon, tempo, threshold, interval } in seconds/mile
  elapsedTimeMinutes: integer('elapsed_time_minutes'), // Strava elapsed_time (vs moving_time in durationMinutes)
  // Workout exclusion from fitness estimates
  excludeFromEstimates: boolean('exclude_from_estimates').default(false),
  autoExcluded: boolean('auto_excluded').default(false),
  excludeReason: text('exclude_reason'),
  // Comprehensive Strava data capture
  stravaDescription: text('strava_description'),
  stravaKudosCount: integer('strava_kudos_count'),
  stravaCommentCount: integer('strava_comment_count'),
  stravaAchievementCount: integer('strava_achievement_count'),
  stravaPhotoCount: integer('strava_photo_count'),
  stravaAthleteCount: integer('strava_athlete_count'),
  stravaMaxSpeed: real('strava_max_speed'), // mph (converted from m/s)
  stravaAverageCadence: real('strava_average_cadence'),
  stravaSufferScore: integer('strava_suffer_score'),
  stravaPerceivedExertion: real('strava_perceived_exertion'),
  stravaGearId: text('strava_gear_id'),
  stravaDeviceName: text('strava_device_name'),
  startLatitude: real('start_latitude'),
  startLongitude: real('start_longitude'),
  endLatitude: real('end_latitude'),
  endLongitude: real('end_longitude'),
  stravaIsTrainer: boolean('strava_is_trainer'),
  stravaIsCommute: boolean('strava_is_commute'),
  stravaKudosLastChecked: text('strava_kudos_last_checked'),
  startTimeLocal: text('start_time_local'), // "HH:MM" from Strava start_date_local
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Assessment table
export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().unique().references(() => workouts.id, { onDelete: 'cascade' }),
  verdict: text('verdict', { enum: verdicts }).notNull(),
  wasIntendedWorkout: text('was_intended_workout', { enum: wasIntendedOptions }).notNull().default('yes'),
  issues: text('issues').notNull().default('[]'),
  rpe: integer('rpe').notNull(),
  legsFeel: integer('legs_feel'),
  legsTags: text('legs_tags').notNull().default('[]'),
  breathingFeel: text('breathing_feel', { enum: breathingFeels }),
  perceivedHeat: text('perceived_heat', { enum: perceivedHeats }),
  sleepQuality: integer('sleep_quality'),
  sleepHours: real('sleep_hours'),
  stress: integer('stress'),
  soreness: integer('soreness'),
  mood: integer('mood'),
  lifeTags: text('life_tags').notNull().default('[]'),
  hydration: integer('hydration'),
  hydrationTags: text('hydration_tags').notNull().default('[]'),
  fueling: integer('fueling'),
  underfueled: boolean('underfueled').notNull().default(false),
  caffeine: text('caffeine', { enum: caffeineOptions }),
  alcohol24h: integer('alcohol_24h'),
  illness: integer('illness'),
  stomach: integer('stomach'),
  forgotElectrolytes: boolean('forgot_electrolytes').notNull().default(false),
  windHillsDifficulty: integer('wind_hills_difficulty'),
  feltTemp: text('felt_temp', { enum: feltTempOptions }),
  surface: text('surface', { enum: surfaceOptions }),
  note: text('note'),
  timeOfRun: text('time_of_run'),
  wasWorkday: boolean('was_workday'),
  hoursWorkedBefore: integer('hours_worked_before'),
  workStress: integer('work_stress'),
  mentalEnergyPreRun: text('mental_energy_pre_run'),
  outfitRating: text('outfit_rating', { enum: outfitRatings }),
  handsRating: text('hands_rating', { enum: extremityRatings }),
  faceRating: text('face_rating', { enum: extremityRatings }),
  removedLayers: text('removed_layers'),
  sorenessMap: text('soreness_map'), // JSON body region soreness data
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// UserSettings table
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  name: text('name').notNull(),
  preferredLongRunDay: text('preferred_long_run_day', { enum: daysOfWeek }),
  preferredWorkoutDays: text('preferred_workout_days').notNull().default('[]'),
  weeklyVolumeTargetMiles: integer('weekly_volume_target_miles'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  cityName: text('city_name'),
  heatAcclimatizationScore: integer('heat_acclimatization_score').default(50),
  defaultTargetPaceSeconds: integer('default_target_pace_seconds'),
  coachContext: text('coach_context'),
  coachName: text('coach_name').default('Coach Dreamy'),
  coachColor: text('coach_color').default('blue'),
  coachPersona: text('coach_persona', { enum: coachPersonas }).default('encouraging'),
  // AI Provider settings
  aiProvider: text('ai_provider', { enum: aiProviders }).default('claude'),
  claudeModel: text('claude_model', { enum: claudeModels }).default('claude-sonnet-4-20250514'),
  openaiModel: text('openai_model', { enum: openaiModels }).default('gpt-5.2'),
  // API Keys (stored encrypted in production)
  anthropicApiKey: text('anthropic_api_key'),
  openaiApiKey: text('openai_api_key'),
  temperaturePreference: text('temperature_preference', { enum: temperaturePreferences }).default('neutral'),
  temperaturePreferenceScale: integer('temperature_preference_scale').default(5),
  age: integer('age'),
  gender: text('gender', { enum: genders }),
  heightInches: integer('height_inches'),
  weightLbs: real('weight_lbs'),
  restingHr: integer('resting_hr'),
  yearsRunning: real('years_running'),
  athleticBackground: text('athletic_background'),
  highestWeeklyMileageEver: integer('highest_weekly_mileage_ever'),
  weeksAtHighestMileage: integer('weeks_at_highest_mileage'),
  timeSincePeakFitness: text('time_since_peak_fitness', { enum: timeSincePeakFitnessOptions }),
  currentWeeklyMileage: integer('current_weekly_mileage'),
  currentLongRunMax: integer('current_long_run_max'),
  runsPerWeekCurrent: integer('runs_per_week_current'),
  runsPerWeekTarget: integer('runs_per_week_target'),
  peakWeeklyMileageTarget: integer('peak_weekly_mileage_target'),
  planAggressiveness: text('plan_aggressiveness', { enum: planAggressivenessOptions }),
  qualitySessionsPerWeek: integer('quality_sessions_per_week'),
  openToDoubles: boolean('open_to_doubles').default(false),
  preferredQualityDays: text('preferred_quality_days'),
  requiredRestDays: text('required_rest_days'),
  vdot: real('vdot'),
  easyPaceSeconds: integer('easy_pace_seconds'),
  tempoPaceSeconds: integer('tempo_pace_seconds'),
  thresholdPaceSeconds: integer('threshold_pace_seconds'),
  intervalPaceSeconds: integer('interval_pace_seconds'),
  marathonPaceSeconds: integer('marathon_pace_seconds'),
  halfMarathonPaceSeconds: integer('half_marathon_pace_seconds'),
  injuryHistory: text('injury_history'),
  currentInjuries: text('current_injuries'),
  needsExtraRest: boolean('needs_extra_rest').default(false),
  timeConstraintsNotes: text('time_constraints_notes'),
  typicalSleepHours: real('typical_sleep_hours'),
  stressLevel: text('stress_level', { enum: stressLevelOptions }),
  surfacePreference: text('surface_preference', { enum: surfacePreferenceOptions }),
  workoutVarietyPreference: text('workout_variety_preference', { enum: workoutVarietyOptions }),
  groupVsSolo: text('group_vs_solo', { enum: groupVsSoloOptions }),
  trainBy: text('train_by', { enum: trainByOptions }),

  // Training Philosophy (from onboarding step 7b)
  trainingPhilosophy: text('training_philosophy', { enum: trainingPhilosophyOptions }),
  downWeekFrequency: text('down_week_frequency', { enum: downWeekFrequencyOptions }),
  longRunMaxStyle: text('long_run_max_style', { enum: longRunMaxStyleOptions }),
  fatigueManagementStyle: text('fatigue_management_style', { enum: fatigueManagementStyleOptions }),
  workoutVarietyPref: text('workout_variety_pref', { enum: workoutVarietyPrefOptions }),
  workoutComplexity: text('workout_complexity', { enum: workoutComplexityOptions }),
  coachingDetailLevel: text('coaching_detail_level', { enum: coachingDetailLevelOptions }),
  trainingPhilosophies: text('training_philosophies'), // JSON array for multi-select
  mlrPreference: boolean('mlr_preference'),
  progressiveLongRunsOk: boolean('progressive_long_runs_ok'),

  runnerPersona: text('runner_persona', { enum: runnerPersonas }),
  runnerPersonaNotes: text('runner_persona_notes'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingStep: integer('onboarding_step').default(0),
  defaultRunTimeHour: integer('default_run_time_hour').default(7),
  defaultRunTimeMinute: integer('default_run_time_minute').default(0),
  defaultWorkoutDurationMinutes: integer('default_workout_duration_minutes').default(45),

  // ==================== Extended Athlete Profile Fields ====================

  // Workout Type Comfort Levels (1-5 scale: 1=uncomfortable, 5=love it)
  comfortVO2max: integer('comfort_vo2max'),
  comfortTempo: integer('comfort_tempo'),
  comfortHills: integer('comfort_hills'),
  comfortLongRuns: integer('comfort_long_runs'),
  comfortTrackWork: integer('comfort_track_work'),

  // Training History Details
  longestRunEver: integer('longest_run_ever'),
  lastMarathonDate: text('last_marathon_date'),
  lastHalfMarathonDate: text('last_half_marathon_date'),
  speedworkExperience: text('speedwork_experience', { enum: speedworkExperienceOptions }),

  // Enhanced Lifestyle
  sleepQuality: text('sleep_quality', { enum: sleepQualityOptions }),
  preferredRunTime: text('preferred_run_time', { enum: preferredRunTimeOptions }),
  weekdayAvailabilityMinutes: integer('weekday_availability_minutes'),
  weekendAvailabilityMinutes: integer('weekend_availability_minutes'),

  // Weather Sensitivity (1-5 scale)
  heatSensitivity: integer('heat_sensitivity'),
  coldSensitivity: integer('cold_sensitivity'),

  // Race History PRs (in seconds)
  marathonPR: integer('marathon_pr_seconds'),
  halfMarathonPR: integer('half_marathon_pr_seconds'),
  tenKPR: integer('ten_k_pr_seconds'),
  fiveKPR: integer('five_k_pr_seconds'),

  // Common injuries (JSON array)
  commonInjuries: text('common_injuries'),

  // Strava Integration
  stravaAthleteId: integer('strava_athlete_id'),
  stravaAccessToken: text('strava_access_token'),
  stravaRefreshToken: text('strava_refresh_token'),
  stravaTokenExpiresAt: integer('strava_token_expires_at'),
  stravaLastSyncAt: text('strava_last_sync_at'),
  stravaAutoSync: boolean('strava_auto_sync').default(true),

  // Intervals.icu Integration
  intervalsAthleteId: text('intervals_athlete_id'),
  intervalsApiKey: text('intervals_api_key'),
  intervalsLastSyncAt: text('intervals_last_sync_at'),
  intervalsAutoSync: boolean('intervals_auto_sync').default(true),

  // Data source preference - prefer real data over demo
  preferRealData: boolean('prefer_real_data').default(true),

  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Chat messages table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  role: text('role', { enum: chatRoles }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Workout Templates
export const workoutTemplates = pgTable('workout_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', { enum: workoutTemplateCategories }).notNull(),
  phaseAppropriate: text('phase_appropriate').notNull().default('[]'),
  description: text('description').notNull(),
  structure: text('structure').notNull(),
  targetEffortMin: integer('target_effort_min'),
  targetEffortMax: integer('target_effort_max'),
  typicalDistanceMilesMin: real('typical_distance_miles_min'),
  typicalDistanceMilesMax: real('typical_distance_miles_max'),
  typicalDurationMinutesMin: integer('typical_duration_minutes_min'),
  typicalDurationMinutesMax: integer('typical_duration_minutes_max'),
  purpose: text('purpose'),
  progressionNotes: text('progression_notes'),
  isKeyWorkout: boolean('is_key_workout').default(false),
  intensityLevel: text('intensity_level').default('moderate'),
  isCustom: boolean('is_custom').default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Race Results
export const raceResults = pgTable('race_results', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  raceName: text('race_name'),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(),
  finishTimeSeconds: integer('finish_time_seconds').notNull(),
  calculatedVdot: real('calculated_vdot'),
  effortLevel: text('effort_level', { enum: ['all_out', 'hard', 'moderate', 'easy'] }),
  conditions: text('conditions'),
  notes: text('notes'),
  workoutId: integer('workout_id').references(() => workouts.id),
  raceId: integer('race_id').references(() => races.id),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// VDOT History - Track fitness changes over time
export const vdotHistory = pgTable('vdot_history', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  date: text('date').notNull(),
  vdot: real('vdot').notNull(),
  source: text('source').notNull(), // 'race', 'time_trial', 'workout', 'estimate', 'manual'
  sourceId: integer('source_id'),
  confidence: text('confidence').default('medium'), // 'high', 'medium', 'low'
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Races
export const races = pgTable('races', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  name: text('name').notNull(),
  date: text('date').notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  distanceLabel: text('distance_label').notNull(),
  priority: text('priority', { enum: racePriorities }).notNull().default('B'),
  targetTimeSeconds: integer('target_time_seconds'),
  targetPaceSecondsPerMile: integer('target_pace_seconds_per_mile'),
  location: text('location'),
  notes: text('notes'),
  trainingPlanGenerated: boolean('training_plan_generated').default(false),
  status: text('status', { enum: raceStatuses }).notNull().default('upcoming'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Training Blocks
export const trainingBlocks = pgTable('training_blocks', {
  id: serial('id').primaryKey(),
  raceId: integer('race_id').references(() => races.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phase: text('phase', { enum: trainingPhases }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  weekNumber: integer('week_number').notNull(),
  targetMileage: integer('target_mileage'),
  longRunTarget: real('long_run_target'),
  qualitySessionsTarget: integer('quality_sessions_target'),
  isDownWeek: boolean('is_down_week').default(false),
  focus: text('focus'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Planned Workouts
export const plannedWorkouts = pgTable('planned_workouts', {
  id: serial('id').primaryKey(),
  raceId: integer('race_id').references(() => races.id, { onDelete: 'cascade' }),
  trainingBlockId: integer('training_block_id').references(() => trainingBlocks.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  templateId: text('template_id').references(() => workoutTemplates.id),
  workoutType: text('workout_type', { enum: workoutTypes }).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  targetDistanceMiles: real('target_distance_miles'),
  targetDurationMinutes: integer('target_duration_minutes'),
  targetPaceSecondsPerMile: integer('target_pace_seconds_per_mile'),
  structure: text('structure'),
  rationale: text('rationale'),
  alternatives: text('alternatives'),
  isKeyWorkout: boolean('is_key_workout').default(false),
  status: text('status', { enum: plannedWorkoutStatuses }).default('scheduled'),
  completedWorkoutId: integer('completed_workout_id').references(() => workouts.id),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Workout Segments
export const workoutSegments = pgTable('workout_segments', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  segmentNumber: integer('segment_number').notNull(),
  segmentType: text('segment_type').notNull(),
  distanceMiles: real('distance_miles'),
  durationSeconds: integer('duration_seconds'),
  paceSecondsPerMile: integer('pace_seconds_per_mile'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  elevationGainFt: integer('elevation_gain_ft'),
  notes: text('notes'),
  paceZone: text('pace_zone'), // recovery/easy/steady/marathon/tempo/threshold/interval/warmup/cooldown/anomaly
  paceZoneConfidence: real('pace_zone_confidence'), // 0.0-1.0
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Strava Best Efforts — verified PRs at standard distances
export const stravaBestEfforts = pgTable('strava_best_efforts', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  stravaEffortId: integer('strava_effort_id').notNull(),
  name: text('name').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  elapsedTimeSeconds: integer('elapsed_time_seconds').notNull(),
  movingTimeSeconds: integer('moving_time_seconds').notNull(),
  prRank: integer('pr_rank'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

export const stravaBestEffortsRelations = relations(stravaBestEfforts, ({ one }) => ({
  workout: one(workouts, {
    fields: [stravaBestEfforts.workoutId],
    references: [workouts.id],
  }),
}));

// Raw workout stream storage for deep segment analysis
export const workoutStreams = pgTable('workout_streams', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().unique().references(() => workouts.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').references(() => profiles.id),
  source: text('source').notNull().default('strava'),
  sampleCount: integer('sample_count').notNull().default(0),
  distanceMiles: text('distance_miles').notNull(),
  timeSeconds: text('time_seconds').notNull(),
  heartrate: text('heartrate'),
  paceSecondsPerMile: text('pace_seconds_per_mile'),
  altitudeFeet: text('altitude_feet'),
  maxHr: integer('max_hr'),
  hasGpsGaps: boolean('has_gps_gaps').notNull().default(false),
  gpsGapCount: integer('gps_gap_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Post-Run Reflections - Lightweight post-run check-in
export const postRunReflections = pgTable('post_run_reflections', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().unique().references(() => workouts.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').references(() => profiles.id),
  rpe: integer('rpe').notNull(), // 1-10
  shoeComfort: text('shoe_comfort', { enum: shoeComfortOptions }),
  painReport: text('pain_report', { enum: painReportOptions }),
  painLocation: text('pain_location'),
  energyLevel: text('energy_level', { enum: energyLevelOptions }),
  contextualAnswer: text('contextual_answer'),
  quickNote: text('quick_note'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Relations (same as SQLite schema)
export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  shoe: one(shoes, { fields: [workouts.shoeId], references: [shoes.id] }),
  assessment: one(assessments, { fields: [workouts.id], references: [assessments.workoutId] }),
  reflection: one(postRunReflections, { fields: [workouts.id], references: [postRunReflections.workoutId] }),
  plannedWorkout: one(plannedWorkouts, { fields: [workouts.plannedWorkoutId], references: [plannedWorkouts.id] }),
  segments: many(workoutSegments),
  stream: one(workoutStreams, { fields: [workouts.id], references: [workoutStreams.workoutId] }),
  fitnessSignals: many(workoutFitnessSignals),
}));

export const shoesRelations = relations(shoes, ({ many }) => ({
  workouts: many(workouts),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  workout: one(workouts, { fields: [assessments.workoutId], references: [workouts.id] }),
}));

export const raceResultsRelations = relations(raceResults, ({ one }) => ({
  workout: one(workouts, {
    fields: [raceResults.workoutId],
    references: [workouts.id],
  }),
  race: one(races, {
    fields: [raceResults.raceId],
    references: [races.id],
  }),
}));

export const racesRelations = relations(races, ({ many }) => ({
  trainingBlocks: many(trainingBlocks),
  plannedWorkouts: many(plannedWorkouts),
  raceResults: many(raceResults),
}));

export const trainingBlocksRelations = relations(trainingBlocks, ({ one, many }) => ({
  race: one(races, { fields: [trainingBlocks.raceId], references: [races.id] }),
  plannedWorkouts: many(plannedWorkouts),
}));

export const plannedWorkoutsRelations = relations(plannedWorkouts, ({ one }) => ({
  race: one(races, { fields: [plannedWorkouts.raceId], references: [races.id] }),
  trainingBlock: one(trainingBlocks, { fields: [plannedWorkouts.trainingBlockId], references: [trainingBlocks.id] }),
  template: one(workoutTemplates, { fields: [plannedWorkouts.templateId], references: [workoutTemplates.id] }),
  completedWorkout: one(workouts, { fields: [plannedWorkouts.completedWorkoutId], references: [workouts.id] }),
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ many }) => ({
  plannedWorkouts: many(plannedWorkouts),
}));

export const workoutSegmentsRelations = relations(workoutSegments, ({ one }) => ({
  workout: one(workouts, { fields: [workoutSegments.workoutId], references: [workouts.id] }),
}));

export const workoutStreamsRelations = relations(workoutStreams, ({ one }) => ({
  workout: one(workouts, { fields: [workoutStreams.workoutId], references: [workouts.id] }),
}));

// Workout fitness signals — cached per-workout derived metrics for race prediction
export const workoutFitnessSignals = pgTable('workout_fitness_signals', {
  id: serial('id').primaryKey(),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').references(() => profiles.id),
  effectiveVo2max: real('effective_vo2max'),
  efficiencyFactor: real('efficiency_factor'),
  aerobicDecouplingPct: real('aerobic_decoupling_pct'),
  weatherAdjustedPace: integer('weather_adjusted_pace'),
  elevationAdjustedPace: integer('elevation_adjusted_pace'),
  hrReservePct: real('hr_reserve_pct'),
  isSteadyState: boolean('is_steady_state').default(false),
  bestSegmentVdot: real('best_segment_vdot'),
  bestSegmentConfidence: text('best_segment_confidence'),
  computedAt: text('computed_at').notNull(),
});

export const workoutFitnessSignalsRelations = relations(workoutFitnessSignals, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutFitnessSignals.workoutId],
    references: [workouts.id],
  }),
}));

// ==================== New Feature Tables ====================

// Canonical Routes - Detected running routes for progress tracking
export const canonicalRoutes = pgTable('canonical_routes', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  name: text('name').notNull(),
  fingerprint: text('fingerprint').notNull(), // JSON: startLatLng, endLatLng, distance, elevationGain, boundingBox
  runCount: integer('run_count').notNull().default(1),
  bestTimeSeconds: integer('best_time_seconds'),
  bestPaceSeconds: integer('best_pace_seconds'),
  averageTimeSeconds: integer('average_time_seconds'),
  averagePaceSeconds: integer('average_pace_seconds'),
  totalElevationGain: integer('total_elevation_gain'),
  distanceMiles: real('distance_miles'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Coach Interactions - Chat history for coach conversations
export const coachInteractions = pgTable('coach_interactions', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  userMessage: text('user_message').notNull(),
  coachResponse: text('coach_response').notNull(),
  context: text('context'), // JSON: { workoutId, readinessScore, phase, etc }
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Coach Actions - Audit log for coach recommendations and changes
export const coachActions = pgTable('coach_actions', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
  actionType: text('action_type').notNull(), // plan_modification, workout_adjustment, schedule_change, mode_activation, recommendation
  description: text('description').notNull(),
  dataSnapshot: text('data_snapshot'), // JSON snapshot of relevant data at time of action
  approved: boolean('approved'), // null = pending, true = approved, false = rejected
  appliedAt: text('applied_at'), // When the action was actually applied
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Soreness Entries - Body region soreness tracking
export const sorenessEntries = pgTable('soreness_entries', {
  id: serial('id').primaryKey(),
  assessmentId: integer('assessment_id').references(() => assessments.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  bodyRegion: text('body_region').notNull(), // left_calf, right_knee, etc.
  severity: integer('severity').notNull(), // 0=none, 1=mild, 2=moderate, 3=severe
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Coach Settings - User preferences for coach behavior
export const coachSettings = pgTable('coach_settings', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  mode: text('mode').notNull().default('advisor'), // advisor or autopilot
  autoApproveMinorChanges: boolean('auto_approve_minor_changes').default(false),
  travelModeActive: boolean('travel_mode_active').default(false),
  travelModeStart: text('travel_mode_start'),
  travelModeEnd: text('travel_mode_end'),
  travelDestination: text('travel_destination'),
  travelHasTreadmill: boolean('travel_has_treadmill'),
  travelHasGym: boolean('travel_has_gym'),
  busyWeekActive: boolean('busy_week_active').default(false),
  busyWeekReason: text('busy_week_reason'),
  busyWeekStartDate: text('busy_week_start_date'),
  busyWeekEndDate: text('busy_week_end_date'),
  lastWeeklyRecapDate: text('last_weekly_recap_date'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

export const postRunReflectionsRelations = relations(postRunReflections, ({ one }) => ({
  workout: one(workouts, {
    fields: [postRunReflections.workoutId],
    references: [workouts.id],
  }),
}));

// Relations for new tables
export const canonicalRoutesRelations = relations(canonicalRoutes, ({ many }) => ({
  workouts: many(workouts),
}));

export const sorenessEntriesRelations = relations(sorenessEntries, ({ one }) => ({
  assessment: one(assessments, {
    fields: [sorenessEntries.assessmentId],
    references: [assessments.id],
  }),
}));

// Profile relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  userSettings: many(userSettings),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  profile: one(profiles, {
    fields: [userSettings.profileId],
    references: [profiles.id],
  }),
}));

// Types
export type Shoe = typeof shoes.$inferSelect;
export type NewShoe = typeof shoes.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ClothingItem = typeof clothingItems.$inferSelect;
export type NewClothingItem = typeof clothingItems.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type ProfileType = typeof profileTypes[number];
export type WorkoutSegment = typeof workoutSegments.$inferSelect;
export type NewWorkoutSegment = typeof workoutSegments.$inferInsert;
export type WorkoutStream = typeof workoutStreams.$inferSelect;
export type NewWorkoutStream = typeof workoutStreams.$inferInsert;
export type StravaBestEffort = typeof stravaBestEfforts.$inferSelect;
export type NewStravaBestEffort = typeof stravaBestEfforts.$inferInsert;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type RaceResult = typeof raceResults.$inferSelect;
export type NewRaceResult = typeof raceResults.$inferInsert;
export type VdotHistory = typeof vdotHistory.$inferSelect;
export type NewVdotHistory = typeof vdotHistory.$inferInsert;
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type TrainingBlock = typeof trainingBlocks.$inferSelect;
export type NewTrainingBlock = typeof trainingBlocks.$inferInsert;
export type PlannedWorkout = typeof plannedWorkouts.$inferSelect;
export type NewPlannedWorkout = typeof plannedWorkouts.$inferInsert;

// New feature types
export type CanonicalRoute = typeof canonicalRoutes.$inferSelect;
export type NewCanonicalRoute = typeof canonicalRoutes.$inferInsert;
export type CoachAction = typeof coachActions.$inferSelect;
export type NewCoachAction = typeof coachActions.$inferInsert;
export type SorenessEntry = typeof sorenessEntries.$inferSelect;
export type NewSorenessEntry = typeof sorenessEntries.$inferInsert;
export type CoachSettingsType = typeof coachSettings.$inferSelect;
export type NewCoachSettings = typeof coachSettings.$inferInsert;

// Master Plans - Layer 1 of coaching architecture
export const masterPlans = pgTable('master_plans', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  goalRaceId: integer('goal_race_id').notNull().references(() => races.id),
  status: text('status').notNull().default('draft'), // draft, active, completed, archived
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
  planName: text('plan_name').notNull(),
  totalWeeks: integer('total_weeks').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  currentVdot: real('current_vdot').notNull(),
  currentWeeklyMileage: real('current_weekly_mileage').notNull(),
  targetPeakMileage: real('target_peak_mileage').notNull(),
  phases: text('phases').notNull(), // JSON array of TrainingPhase objects
  weeklyTargets: text('weekly_targets').notNull(), // JSON array of WeeklyTarget objects
});

// Coaching Insights - Coach's memory/learning system
export const coachingInsights = pgTable('coaching_insights', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  category: text('category').notNull(), // 'preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback'
  subcategory: text('subcategory'),
  insight: text('insight').notNull(),
  confidence: real('confidence').notNull().default(0.5), // 0-1 confidence score
  source: text('source').notNull(), // 'explicit', 'inferred'
  extractedFrom: text('extracted_from').notNull(),
  metadata: text('metadata'), // JSON with additional context
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  lastValidated: text('last_validated').notNull().default(new Date().toISOString()),
  expiresAt: text('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
});

// Conversation Summaries - Compressed chat history
export const conversationSummaries = pgTable('conversation_summaries', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  conversationDate: text('conversation_date').notNull(),
  messageCount: integer('message_count').notNull(),
  summary: text('summary').notNull(),
  messageHash: text('message_hash'), // Hash of compressed messages for dedup (used by conversation-compression)
  keyDecisions: text('key_decisions'), // JSON array
  keyPreferences: text('key_preferences'), // JSON array
  keyFeedback: text('key_feedback'), // JSON array
  tags: text('tags'), // JSON array
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Insight Connections - Knowledge graph relationships
export const insightConnections = pgTable('insight_connections', {
  id: serial('id').primaryKey(),
  fromInsightId: integer('from_insight_id').notNull().references(() => coachingInsights.id),
  toInsightId: integer('to_insight_id').notNull().references(() => coachingInsights.id),
  connectionType: text('connection_type').notNull(), // 'contradicts', 'supports', 'related_to', 'supersedes'
  strength: real('strength').notNull().default(0.5),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// Response Cache - Local intelligence caching
export const responseCache = pgTable('response_cache', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => profiles.id),
  queryHash: text('query_hash').notNull(),
  query: text('query').notNull(),
  response: text('response').notNull(),
  context: text('context'), // JSON context data
  model: text('model').notNull(),
  tokensUsed: integer('tokens_used'),
  responseTimeMs: integer('response_time_ms'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// API Usage Tracking
import { apiServices } from './schema-enums';

export const apiUsageLogs = pgTable('api_usage_logs', {
  id: serial('id').primaryKey(),
  service: text('service', { enum: apiServices }).notNull(),
  endpoint: text('endpoint').notNull(),
  method: text('method').default('GET'),
  statusCode: integer('status_code'),
  responseTimeMs: integer('response_time_ms'),
  tokensUsed: integer('tokens_used'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  errorMessage: text('error_message'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
});

// Coach Context - Persistent memory for AI coach conversations
export const coachContext = pgTable('coach_context', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  contextType: text('context_type').notNull(),
  contextKey: text('context_key').notNull(),
  contextValue: text('context_value').notNull(),
  importance: text('importance', { enum: ['low', 'medium', 'high'] }).notNull().default('medium'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type CoachContext = typeof coachContext.$inferSelect;
export type NewCoachContext = typeof coachContext.$inferInsert;

export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert;
export type MasterPlan = typeof masterPlans.$inferSelect;
export type NewMasterPlan = typeof masterPlans.$inferInsert;
export type CoachingInsight = typeof coachingInsights.$inferSelect;
export type NewCoachingInsight = typeof coachingInsights.$inferInsert;
export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type NewConversationSummary = typeof conversationSummaries.$inferInsert;
export type InsightConnection = typeof insightConnections.$inferSelect;
export type NewInsightConnection = typeof insightConnections.$inferInsert;
export type ResponseCache = typeof responseCache.$inferSelect;
export type NewResponseCache = typeof responseCache.$inferInsert;
export type WorkoutFitnessSignal = typeof workoutFitnessSignals.$inferSelect;
export type NewWorkoutFitnessSignal = typeof workoutFitnessSignals.$inferInsert;
export type PostRunReflection = typeof postRunReflections.$inferSelect;
export type NewPostRunReflection = typeof postRunReflections.$inferInsert;
