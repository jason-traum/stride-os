/**
 * Migrate data from SQLite to Postgres
 * Run with: npx tsx scripts/migrate-to-postgres.ts
 */

import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import path from 'path';

// Load env
const fs = require('fs');
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Initialize databases
const sqlitePath = path.join(process.cwd(), 'data', 'stride.db');
const sqlite = new Database(sqlitePath);
const sql = neon(DATABASE_URL);

async function runQuery(query: string, values: any[]) {
  // Use sql.query for parameterized queries
  return (sql as any).query(query, values);
}

async function migrateTable(tableName: string, columns: string[]) {
  console.log(`Migrating ${tableName}...`);

  const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as any[];

  if (rows.length === 0) {
    console.log(`  No data in ${tableName}`);
    return 0;
  }

  // Build insert query
  const colNames = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let migrated = 0;

  for (const row of rows) {
    try {
      const values = columns.map(col => row[col] ?? null);
      await runQuery(query, values);
      migrated++;
    } catch (error: any) {
      if (!error.message?.includes('duplicate') && !error.message?.includes('UNIQUE')) {
        console.error(`  Error inserting into ${tableName}:`, error.message?.slice(0, 100));
      }
    }
  }

  console.log(`  Migrated ${migrated}/${rows.length} rows`);
  return migrated;
}

async function main() {
  console.log('Starting migration from SQLite to Postgres...\n');

  // Migrate user_settings first (no dependencies)
  await migrateTable('user_settings', [
    'id', 'name', 'preferred_long_run_day', 'preferred_workout_days', 'weekly_volume_target_miles',
    'latitude', 'longitude', 'city_name', 'heat_acclimatization_score', 'default_target_pace_seconds',
    'coach_context', 'coach_name', 'coach_color', 'coach_persona', 'temperature_preference',
    'temperature_preference_scale', 'age', 'gender', 'height_inches', 'weight_lbs', 'resting_hr',
    'years_running', 'athletic_background', 'highest_weekly_mileage_ever', 'weeks_at_highest_mileage',
    'time_since_peak_fitness', 'current_weekly_mileage', 'current_long_run_max', 'runs_per_week_current',
    'runs_per_week_target', 'peak_weekly_mileage_target', 'plan_aggressiveness', 'quality_sessions_per_week',
    'open_to_doubles', 'preferred_quality_days', 'required_rest_days', 'vdot', 'easy_pace_seconds',
    'tempo_pace_seconds', 'threshold_pace_seconds', 'interval_pace_seconds', 'marathon_pace_seconds',
    'half_marathon_pace_seconds', 'injury_history', 'current_injuries', 'needs_extra_rest',
    'time_constraints_notes', 'typical_sleep_hours', 'stress_level', 'surface_preference',
    'workout_variety_preference', 'group_vs_solo', 'train_by', 'runner_persona', 'runner_persona_notes',
    'onboarding_completed', 'onboarding_step', 'default_run_time_hour', 'default_run_time_minute',
    'default_workout_duration_minutes', 'comfort_vo2max', 'comfort_tempo', 'comfort_hills',
    'comfort_long_runs', 'comfort_track_work', 'longest_run_ever', 'last_marathon_date',
    'last_half_marathon_date', 'speedwork_experience', 'sleep_quality', 'preferred_run_time',
    'weekday_availability_minutes', 'weekend_availability_minutes', 'heat_sensitivity', 'cold_sensitivity',
    'marathon_pr_seconds', 'half_marathon_pr_seconds', 'ten_k_pr_seconds', 'five_k_pr_seconds',
    'common_injuries', 'strava_athlete_id', 'strava_access_token', 'strava_refresh_token',
    'strava_token_expires_at', 'strava_last_sync_at', 'strava_auto_sync', 'intervals_athlete_id',
    'intervals_api_key', 'intervals_last_sync_at', 'intervals_auto_sync', 'created_at', 'updated_at'
  ]);

  // Migrate shoes (no dependencies)
  await migrateTable('shoes', [
    'id', 'name', 'brand', 'model', 'category', 'intended_use', 'total_miles',
    'is_retired', 'purchase_date', 'notes', 'created_at'
  ]);

  // Migrate clothing_items (no dependencies)
  await migrateTable('clothing_items', [
    'id', 'name', 'category', 'warmth_rating', 'is_active', 'notes', 'created_at'
  ]);

  // Migrate races (no dependencies)
  await migrateTable('races', [
    'id', 'name', 'date', 'distance', 'distance_miles', 'location', 'priority',
    'goal_time_seconds', 'actual_time_seconds', 'notes', 'training_plan_weeks',
    'created_at', 'updated_at'
  ]);

  // Migrate race_results
  await migrateTable('race_results', [
    'id', 'race_id', 'finish_time_seconds', 'overall_place', 'age_group_place',
    'conditions_notes', 'race_report', 'created_at'
  ]);

  // Migrate workouts (depends on shoes)
  await migrateTable('workouts', [
    'id', 'date', 'distance_miles', 'duration_minutes', 'avg_pace_seconds', 'avg_hr', 'max_hr',
    'elevation_gain_ft', 'route_name', 'shoe_id', 'workout_type', 'source', 'notes',
    'weather_temp_f', 'weather_feels_like_f', 'weather_humidity_pct', 'weather_wind_mph',
    'weather_conditions', 'weather_severity_score', 'planned_workout_id', 'created_at', 'updated_at'
  ]);

  // Migrate assessments (depends on workouts)
  await migrateTable('assessments', [
    'id', 'workout_id', 'verdict', 'was_intended_workout', 'issues', 'rpe', 'legs_feel',
    'legs_tags', 'breathing_feel', 'perceived_heat', 'sleep_quality', 'sleep_hours',
    'stress', 'soreness', 'mood', 'life_tags', 'hydration', 'hydration_tags', 'fueling',
    'underfueled', 'caffeine', 'alcohol_24h', 'illness', 'stomach', 'forgot_electrolytes',
    'wind_hills_difficulty', 'felt_temp', 'surface', 'mental_energy', 'time_of_run',
    'created_at', 'updated_at'
  ]);

  // Migrate workout_segments (depends on workouts)
  await migrateTable('workout_segments', [
    'id', 'workout_id', 'segment_number', 'segment_type', 'distance_miles', 'duration_seconds',
    'pace_seconds_per_mile', 'avg_hr', 'max_hr', 'elevation_gain_ft', 'notes', 'created_at'
  ]);

  // Migrate training_blocks (depends on races)
  await migrateTable('training_blocks', [
    'id', 'race_id', 'name', 'phase', 'start_date', 'end_date', 'week_number',
    'weekly_mileage_target', 'notes', 'created_at'
  ]);

  // Migrate workout_templates
  await migrateTable('workout_templates', [
    'id', 'name', 'category', 'description', 'warm_up_description', 'main_set_description',
    'cool_down_description', 'typical_duration_minutes', 'typical_distance_miles',
    'intensity_level', 'created_at'
  ]);

  // Migrate planned_workouts
  await migrateTable('planned_workouts', [
    'id', 'race_id', 'training_block_id', 'template_id', 'date', 'workout_type',
    'description', 'target_distance_miles', 'target_duration_minutes', 'target_pace_seconds',
    'notes', 'status', 'completed_workout_id', 'created_at', 'updated_at'
  ]);

  // Migrate chat_messages
  await migrateTable('chat_messages', [
    'id', 'role', 'content', 'created_at'
  ]);

  console.log('\nMigration complete!');

  // Verify counts
  const pgCounts = await sql`
    SELECT
      (SELECT COUNT(*) FROM workouts) as workouts,
      (SELECT COUNT(*) FROM shoes) as shoes,
      (SELECT COUNT(*) FROM assessments) as assessments,
      (SELECT COUNT(*) FROM user_settings) as settings
  `;

  console.log('\nPostgres database now has:');
  console.log(`- ${pgCounts[0].workouts} workouts`);
  console.log(`- ${pgCounts[0].shoes} shoes`);
  console.log(`- ${pgCounts[0].assessments} assessments`);
  console.log(`- ${pgCounts[0].settings} user settings`);
}

main().catch(console.error);
