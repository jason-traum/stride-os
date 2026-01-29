/**
 * Migrate local SQLite database to production Postgres (Neon)
 * Uses raw SQL for maximum compatibility
 *
 * Run with: DATABASE_URL="postgres://..." npx tsx scripts/migrate-sqlite-to-postgres.ts
 */

import Database from 'better-sqlite3';
import postgres from 'postgres';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const SQLITE_PATH = path.join(process.cwd(), 'data', 'stride.db');

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sqliteDb = new Database(SQLITE_PATH);
const pg = postgres(DATABASE_URL);

// Helper to convert SQLite value to Postgres-safe value
function pgVal(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  return String(v);
}

async function migrate() {
  console.log('🔄 Starting migration from SQLite to Postgres...\n');

  try {
    // 1. Read all data from SQLite
    console.log('📖 Reading data from local SQLite...');

    const userSettings = sqliteDb.prepare('SELECT * FROM user_settings').all() as any[];
    const shoes = sqliteDb.prepare('SELECT * FROM shoes').all() as any[];
    const workouts = sqliteDb.prepare('SELECT * FROM workouts').all() as any[];
    const assessments = sqliteDb.prepare('SELECT * FROM assessments').all() as any[];
    const races = sqliteDb.prepare('SELECT * FROM races').all() as any[];
    const raceResults = sqliteDb.prepare('SELECT * FROM race_results').all() as any[];
    const plannedWorkouts = sqliteDb.prepare('SELECT * FROM planned_workouts').all() as any[];
    const trainingBlocks = sqliteDb.prepare('SELECT * FROM training_blocks').all() as any[];
    const clothingItems = sqliteDb.prepare('SELECT * FROM clothing_items').all() as any[];
    const chatMessages = sqliteDb.prepare('SELECT * FROM chat_messages').all() as any[];

    console.log(`  User settings: ${userSettings.length}`);
    console.log(`  Shoes: ${shoes.length}`);
    console.log(`  Workouts: ${workouts.length}`);
    console.log(`  Assessments: ${assessments.length}`);
    console.log(`  Races: ${races.length}`);
    console.log(`  Race results: ${raceResults.length}`);
    console.log(`  Planned workouts: ${plannedWorkouts.length}`);
    console.log(`  Training blocks: ${trainingBlocks.length}`);
    console.log(`  Clothing items: ${clothingItems.length}`);
    console.log(`  Chat messages: ${chatMessages.length}`);

    // 2. Clear Postgres tables
    console.log('\n🗑️  Clearing Postgres tables...');

    const tablesToClear = [
      'chat_messages', 'assessments', 'planned_workouts', 'training_blocks',
      'workouts', 'shoes', 'race_results', 'races', 'clothing_items', 'user_settings'
    ];

    for (const table of tablesToClear) {
      try {
        await pg.unsafe(`DELETE FROM ${table}`);
        console.log(`  ✓ ${table}`);
      } catch (e: any) {
        console.log(`  - ${table} (skipped)`);
      }
    }

    // 3. Insert data
    console.log('\n📝 Inserting data...');

    // User settings
    if (userSettings.length > 0) {
      const s = userSettings[0];
      // Some fields might have column names as values due to migration issues - fix them
      const safeInt = (v: any) => typeof v === 'number' ? v : null;
      const safeStr = (v: any, allowedVals?: string[]) => {
        if (typeof v !== 'string') return null;
        if (allowedVals && !allowedVals.includes(v)) return null;
        return v;
      };

      await pg`INSERT INTO user_settings (
        id, name, runner_persona, latitude, longitude, city_name,
        temperature_preference, temperature_preference_scale, heat_acclimatization_score,
        default_target_pace_seconds, weekly_volume_target_miles, onboarding_completed, onboarding_step,
        age, gender, years_running, current_weekly_mileage, current_long_run_max,
        runs_per_week_current, runs_per_week_target, peak_weekly_mileage_target,
        preferred_long_run_day, preferred_quality_days, required_rest_days,
        plan_aggressiveness, quality_sessions_per_week, open_to_doubles,
        vdot, easy_pace_seconds, tempo_pace_seconds, threshold_pace_seconds,
        interval_pace_seconds, marathon_pace_seconds, half_marathon_pace_seconds,
        typical_sleep_hours, stress_level, train_by, surface_preference, group_vs_solo,
        comfort_vo2max, comfort_tempo, comfort_hills, comfort_long_runs,
        heat_sensitivity, cold_sensitivity,
        marathon_pr_seconds, half_marathon_pr_seconds, ten_k_pr_seconds, five_k_pr_seconds,
        coach_name, coach_color, coach_context,
        created_at, updated_at
      ) VALUES (
        ${s.id}, ${s.name}, ${s.runner_persona}, ${s.latitude}, ${s.longitude}, ${s.city_name},
        ${s.temperature_preference}, ${s.temperature_preference_scale}, ${s.heat_acclimatization_score},
        ${s.default_target_pace_seconds}, ${s.weekly_volume_target_miles}, ${Boolean(s.onboarding_completed)}, ${s.onboarding_step},
        ${s.age}, ${s.gender}, ${s.years_running}, ${s.current_weekly_mileage}, ${s.current_long_run_max},
        ${s.runs_per_week_current}, ${s.runs_per_week_target}, ${s.peak_weekly_mileage_target},
        ${s.preferred_long_run_day}, ${s.preferred_quality_days}, ${s.required_rest_days},
        ${s.plan_aggressiveness}, ${s.quality_sessions_per_week}, ${Boolean(s.open_to_doubles)},
        ${s.vdot}, ${s.easy_pace_seconds}, ${s.tempo_pace_seconds}, ${s.threshold_pace_seconds},
        ${s.interval_pace_seconds}, ${s.marathon_pace_seconds}, ${s.half_marathon_pace_seconds},
        ${s.typical_sleep_hours}, ${s.stress_level}, ${s.train_by}, ${s.surface_preference}, ${s.group_vs_solo},
        ${safeInt(s.comfort_vo2max)}, ${safeInt(s.comfort_tempo)}, ${safeInt(s.comfort_hills)}, ${safeInt(s.comfort_long_runs)},
        ${safeInt(s.heat_sensitivity)}, ${safeInt(s.cold_sensitivity)},
        ${safeInt(s.marathon_pr_seconds)}, ${safeInt(s.half_marathon_pr_seconds)}, ${safeInt(s.ten_k_pr_seconds)}, ${safeInt(s.five_k_pr_seconds)},
        ${s.coach_name}, ${s.coach_color}, ${s.coach_context},
        NOW(), NOW()
      )`;
      console.log('  ✓ User settings');
    }

    // Shoes
    for (const s of shoes) {
      await pg`INSERT INTO shoes (
        id, name, brand, model, category, intended_use, total_miles, is_retired, purchase_date, notes, created_at
      ) VALUES (
        ${s.id}, ${s.name || null}, ${s.brand || null}, ${s.model || null}, ${s.category || 'daily_trainer'},
        ${s.intended_use || '[]'}, ${s.total_miles ?? 0}, ${Boolean(s.is_retired)}, ${s.purchase_date || null}, ${s.notes || null}, NOW()
      )`;
    }
    if (shoes.length > 0) console.log('  ✓ Shoes');

    // Races - use nullish coalescing (??) for numbers to preserve 0
    for (const r of races) {
      await pg`INSERT INTO races (
        id, name, date, distance_meters, distance_label, priority, target_time_seconds, target_pace_seconds_per_mile,
        location, notes, training_plan_generated, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.name}, ${r.date}, ${r.distance_meters ?? 0}, ${r.distance_label}, ${r.priority || 'B'},
        ${r.target_time_seconds ?? null}, ${r.target_pace_seconds_per_mile ?? null},
        ${r.location || null}, ${r.notes || null}, ${Boolean(r.training_plan_generated)}, NOW(), NOW()
      )`;
    }
    if (races.length > 0) console.log('  ✓ Races');

    // Race results
    for (const r of raceResults) {
      await pg`INSERT INTO race_results (
        id, race_name, date, distance_meters, distance_label, finish_time_seconds,
        calculated_vdot, effort_level, conditions, notes, created_at
      ) VALUES (
        ${r.id}, ${r.race_name || null}, ${r.date}, ${r.distance_meters ?? 0}, ${r.distance_label},
        ${r.finish_time_seconds ?? 0}, ${r.calculated_vdot ?? null}, ${r.effort_level || null},
        ${r.conditions || null}, ${r.notes || null}, NOW()
      )`;
    }
    if (raceResults.length > 0) console.log('  ✓ Race results');

    // Training blocks
    for (const b of trainingBlocks) {
      await pg`INSERT INTO training_blocks (
        id, race_id, name, phase, start_date, end_date, week_number, target_mileage, focus, notes, created_at
      ) VALUES (
        ${b.id}, ${b.race_id || null}, ${b.name || null}, ${b.phase || null}, ${b.start_date || null}, ${b.end_date || null},
        ${b.week_number || null}, ${b.target_mileage || null}, ${b.focus || null}, ${b.notes || null}, NOW()
      )`;
    }
    if (trainingBlocks.length > 0) console.log('  ✓ Training blocks');

    // Planned workouts
    for (const p of plannedWorkouts) {
      await pg`INSERT INTO planned_workouts (
        id, race_id, training_block_id, date, template_id, workout_type, name, description,
        target_distance_miles, target_duration_minutes, target_pace_seconds_per_mile,
        structure, rationale, alternatives, is_key_workout, status, completed_workout_id, created_at, updated_at
      ) VALUES (
        ${p.id}, ${p.race_id || null}, ${p.training_block_id || null}, ${p.date || null}, ${p.template_id || null},
        ${p.workout_type || 'easy'}, ${p.name || null}, ${p.description || null},
        ${p.target_distance_miles || null}, ${p.target_duration_minutes || null}, ${p.target_pace_seconds_per_mile || null},
        ${p.structure || null}, ${p.rationale || null}, ${p.alternatives || null}, ${Boolean(p.is_key_workout)},
        ${p.status || 'scheduled'}, ${p.completed_workout_id || null}, NOW(), NOW()
      )`;
    }
    if (plannedWorkouts.length > 0) console.log('  ✓ Planned workouts');

    // Workouts
    for (const w of workouts) {
      await pg`INSERT INTO workouts (
        id, date, distance_miles, duration_minutes, avg_pace_seconds, avg_hr, max_hr,
        elevation_gain_ft, route_name, shoe_id, workout_type, source, notes,
        weather_temp_f, weather_feels_like_f, weather_humidity_pct, weather_wind_mph,
        weather_conditions, weather_severity_score, planned_workout_id, created_at, updated_at
      ) VALUES (
        ${w.id}, ${w.date || null}, ${w.distance_miles || null}, ${w.duration_minutes || null}, ${w.avg_pace_seconds || null},
        ${w.avg_hr || null}, ${w.max_hr || null}, ${w.elevation_gain_ft || null}, ${w.route_name || null},
        ${w.shoe_id || null}, ${w.workout_type || 'easy'}, ${w.source || 'manual'}, ${w.notes || null},
        ${w.weather_temp_f || null}, ${w.weather_feels_like_f || null}, ${w.weather_humidity_pct || null}, ${w.weather_wind_mph || null},
        ${w.weather_conditions || null}, ${w.weather_severity_score || null}, ${w.planned_workout_id || null}, NOW(), NOW()
      )`;
    }
    if (workouts.length > 0) console.log('  ✓ Workouts');

    // Assessments
    for (const a of assessments) {
      await pg`INSERT INTO assessments (
        id, workout_id, verdict, was_intended_workout, issues, rpe, legs_feel, legs_tags,
        breathing_feel, perceived_heat, sleep_quality, sleep_hours, stress, soreness, mood,
        life_tags, hydration, hydration_tags, fueling, underfueled, caffeine, alcohol_24h,
        illness, stomach, forgot_electrolytes, wind_hills_difficulty, felt_temp, surface, note,
        time_of_run, created_at
      ) VALUES (
        ${a.id}, ${a.workout_id}, ${a.verdict || 'good'}, ${a.was_intended_workout || 'yes'}, ${a.issues || '[]'},
        ${a.rpe || 5}, ${a.legs_feel || null}, ${a.legs_tags || '[]'},
        ${a.breathing_feel || null}, ${a.perceived_heat || null}, ${a.sleep_quality || null}, ${a.sleep_hours || null},
        ${a.stress || null}, ${a.soreness || null}, ${a.mood || null},
        ${a.life_tags || '[]'}, ${a.hydration || null}, ${a.hydration_tags || '[]'},
        ${a.fueling || null}, ${Boolean(a.underfueled)}, ${a.caffeine || null}, ${a.alcohol_24h || null},
        ${a.illness || null}, ${a.stomach || null}, ${Boolean(a.forgot_electrolytes)},
        ${a.wind_hills_difficulty || null}, ${a.felt_temp || null}, ${a.surface || null}, ${a.note || null},
        ${a.time_of_run || null}, NOW()
      )`;
    }
    if (assessments.length > 0) console.log('  ✓ Assessments');

    // Clothing items
    for (const c of clothingItems) {
      await pg`INSERT INTO clothing_items (
        id, name, category, warmth_rating, is_active, notes, created_at
      ) VALUES (
        ${c.id}, ${c.name || null}, ${c.category || null}, ${c.warmth_rating || null}, ${Boolean(c.is_active)}, ${c.notes || null}, NOW()
      )`;
    }
    if (clothingItems.length > 0) console.log('  ✓ Clothing items');

    // Chat messages
    for (const m of chatMessages) {
      await pg`INSERT INTO chat_messages (
        id, role, content, created_at
      ) VALUES (
        ${m.id}, ${m.role || null}, ${m.content || null}, NOW()
      )`;
    }
    if (chatMessages.length > 0) console.log('  ✓ Chat messages');

    // Reset sequences
    console.log('\n🔧 Resetting ID sequences...');
    const sequences = [
      ['user_settings', 'user_settings_id_seq'],
      ['shoes', 'shoes_id_seq'],
      ['workouts', 'workouts_id_seq'],
      ['assessments', 'assessments_id_seq'],
      ['races', 'races_id_seq'],
      ['race_results', 'race_results_id_seq'],
      ['planned_workouts', 'planned_workouts_id_seq'],
      ['training_blocks', 'training_blocks_id_seq'],
      ['clothing_items', 'clothing_items_id_seq'],
      ['chat_messages', 'chat_messages_id_seq'],
    ];

    for (const [table, seq] of sequences) {
      try {
        await pg.unsafe(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
      } catch (e) {
        // Ignore if sequence doesn't exist
      }
    }
    console.log('  ✓ Done');

    console.log('\n========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');
    console.log('Your production app now has your local data:');
    console.log(`  • ${workouts.length} workouts`);
    console.log(`  • ${shoes.length} shoes`);
    console.log(`  • ${races.length} races`);
    console.log(`  • ${plannedWorkouts.length} planned workouts`);
    console.log(`  • ${trainingBlocks.length} training blocks`);
    console.log(`  • ${clothingItems.length} wardrobe items`);
    console.log('\n📱 Share your Vercel URL with friends!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pg.end();
  }
}

migrate();
