// Seed script for demo/testing data
// Run with: npx tsx scripts/seed-demo-data.ts

import Database from 'better-sqlite3';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const db = new Database(path.join(dataDir, 'stride.db'));

// Helper to generate dates
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// Seed user settings with ALL fields needed for training plan generation
function seedUserSettings() {
  const existing = db.prepare('SELECT id FROM user_settings LIMIT 1').get();
  if (existing) {
    console.log('User settings already exist, updating with full profile...');
    db.prepare(`
      UPDATE user_settings SET
        -- Basic info
        name = 'Demo Runner',
        runner_persona = 'self_coached',

        -- Location
        latitude = 40.7128,
        longitude = -74.0060,
        city_name = 'New York, NY',

        -- Current training state (REQUIRED for plan generation)
        current_weekly_mileage = 30,
        current_long_run_max = 12,
        runs_per_week_current = 5,
        runs_per_week_target = 5,

        -- Training goals (REQUIRED for plan generation)
        peak_weekly_mileage_target = 45,
        weekly_volume_target_miles = 35,

        -- Training preferences (REQUIRED for plan generation)
        preferred_long_run_day = 'sunday',
        preferred_quality_days = '["tuesday", "thursday"]',
        required_rest_days = '["friday"]',
        plan_aggressiveness = 'moderate',
        quality_sessions_per_week = 2,
        open_to_doubles = 0,

        -- Pacing (from VDOT 45)
        vdot = 45,
        default_target_pace_seconds = 510,
        easy_pace_seconds = 570,
        tempo_pace_seconds = 450,
        threshold_pace_seconds = 420,
        interval_pace_seconds = 390,
        marathon_pace_seconds = 480,
        half_marathon_pace_seconds = 450,

        -- Bio (optional but nice)
        years_running = 3.5,
        age = 32,
        gender = 'male',

        -- Environment
        heat_acclimatization_score = 65,
        temperature_preference = 'neutral',
        temperature_preference_scale = 5,

        -- Lifestyle
        typical_sleep_hours = 7.5,
        stress_level = 'moderate',
        train_by = 'pace',
        surface_preference = 'road',
        group_vs_solo = 'solo',

        -- Onboarding status
        onboarding_completed = 1,
        onboarding_step = 5,

        updated_at = datetime('now')
      WHERE id = 1
    `).run();
  } else {
    console.log('Creating user settings with full profile...');
    db.prepare(`
      INSERT INTO user_settings (
        name, runner_persona, latitude, longitude, city_name,
        current_weekly_mileage, current_long_run_max, runs_per_week_current, runs_per_week_target,
        peak_weekly_mileage_target, weekly_volume_target_miles,
        preferred_long_run_day, preferred_quality_days, required_rest_days,
        plan_aggressiveness, quality_sessions_per_week, open_to_doubles,
        vdot, default_target_pace_seconds, easy_pace_seconds, tempo_pace_seconds,
        threshold_pace_seconds, interval_pace_seconds, marathon_pace_seconds, half_marathon_pace_seconds,
        years_running, age, gender,
        heat_acclimatization_score, temperature_preference, temperature_preference_scale,
        typical_sleep_hours, stress_level, train_by, surface_preference, group_vs_solo,
        onboarding_completed, onboarding_step, created_at, updated_at
      ) VALUES (
        'Demo Runner', 'self_coached', 40.7128, -74.0060, 'New York, NY',
        30, 12, 5, 5,
        45, 35,
        'sunday', '["tuesday", "thursday"]', '["friday"]',
        'moderate', 2, 0,
        45, 510, 570, 450,
        420, 390, 480, 450,
        3.5, 32, 'male',
        65, 'neutral', 5,
        7.5, 'moderate', 'pace', 'road', 'solo',
        1, 5, datetime('now'), datetime('now')
      )
    `).run();
  }
}

// Seed shoes
function seedShoes() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM shoes').get() as { count: number };
  if (existing.count > 0) {
    console.log('Shoes already exist, skipping...');
    return;
  }

  console.log('Creating demo shoes...');
  const shoes = [
    { name: 'Nike Pegasus 40', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', miles: 245.3 },
    { name: 'Saucony Endorphin Speed 3', brand: 'Saucony', model: 'Endorphin Speed 3', category: 'tempo', miles: 128.7 },
    { name: 'Nike Vaporfly Next% 2', brand: 'Nike', model: 'Vaporfly Next% 2', category: 'race', miles: 52.1 },
    { name: 'Brooks Ghost 15', brand: 'Brooks', model: 'Ghost 15', category: 'recovery', miles: 312.5 },
  ];

  const stmt = db.prepare(`
    INSERT INTO shoes (name, brand, model, category, total_miles, is_retired, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `);

  for (const shoe of shoes) {
    stmt.run(shoe.name, shoe.brand, shoe.model, shoe.category, shoe.miles);
  }
}

// Seed workouts for the past 30 days
function seedWorkouts() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM workouts').get() as { count: number };
  if (existing.count > 10) {
    console.log('Workouts already exist, skipping...');
    return;
  }

  console.log('Creating demo workouts...');

  // Get shoe IDs
  const pegasus = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Pegasus%'").get() as { id: number } | undefined;
  const speed = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Speed%'").get() as { id: number } | undefined;
  const ghost = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Ghost%'").get() as { id: number } | undefined;

  const workoutPatterns = [
    // Week -4
    { daysAgo: 28, type: 'easy', distance: 5.2, duration: 50, shoeId: pegasus?.id },
    { daysAgo: 27, type: 'tempo', distance: 6.0, duration: 48, shoeId: speed?.id },
    { daysAgo: 26, type: 'easy', distance: 4.5, duration: 43, shoeId: ghost?.id },
    { daysAgo: 25, type: 'interval', distance: 5.5, duration: 45, shoeId: speed?.id },
    { daysAgo: 24, type: 'recovery', distance: 3.0, duration: 32, shoeId: ghost?.id },
    { daysAgo: 22, type: 'long', distance: 12.0, duration: 115, shoeId: pegasus?.id },

    // Week -3
    { daysAgo: 21, type: 'easy', distance: 5.5, duration: 52, shoeId: pegasus?.id },
    { daysAgo: 20, type: 'tempo', distance: 7.0, duration: 55, shoeId: speed?.id },
    { daysAgo: 19, type: 'easy', distance: 5.0, duration: 48, shoeId: pegasus?.id },
    { daysAgo: 18, type: 'interval', distance: 6.0, duration: 50, shoeId: speed?.id },
    { daysAgo: 17, type: 'recovery', distance: 3.5, duration: 36, shoeId: ghost?.id },
    { daysAgo: 15, type: 'long', distance: 13.0, duration: 125, shoeId: pegasus?.id },

    // Week -2 (down week)
    { daysAgo: 14, type: 'easy', distance: 4.0, duration: 38, shoeId: pegasus?.id },
    { daysAgo: 13, type: 'steady', distance: 5.0, duration: 42, shoeId: pegasus?.id },
    { daysAgo: 12, type: 'easy', distance: 4.0, duration: 38, shoeId: ghost?.id },
    { daysAgo: 10, type: 'recovery', distance: 3.0, duration: 32, shoeId: ghost?.id },
    { daysAgo: 8, type: 'long', distance: 10.0, duration: 96, shoeId: pegasus?.id },

    // Week -1
    { daysAgo: 7, type: 'easy', distance: 5.0, duration: 48, shoeId: pegasus?.id },
    { daysAgo: 6, type: 'tempo', distance: 6.5, duration: 52, shoeId: speed?.id },
    { daysAgo: 5, type: 'easy', distance: 5.2, duration: 50, shoeId: pegasus?.id },
    { daysAgo: 4, type: 'interval', distance: 5.0, duration: 42, shoeId: speed?.id },
    { daysAgo: 3, type: 'recovery', distance: 3.5, duration: 36, shoeId: ghost?.id },
    { daysAgo: 1, type: 'long', distance: 14.0, duration: 135, shoeId: pegasus?.id },
  ];

  const verdicts = ['great', 'good', 'good', 'fine', 'good'];
  const rpes = [5, 6, 5, 7, 6, 6, 7, 5];

  const workoutStmt = db.prepare(`
    INSERT INTO workouts (
      date, distance_miles, duration_minutes, avg_pace_seconds,
      workout_type, shoe_id, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'demo', datetime('now'), datetime('now'))
  `);

  const assessmentStmt = db.prepare(`
    INSERT INTO assessments (
      workout_id, verdict, rpe, legs_feel, sleep_quality, stress, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  for (let i = 0; i < workoutPatterns.length; i++) {
    const w = workoutPatterns[i];
    const pace = Math.round((w.duration * 60) / w.distance);

    const result = workoutStmt.run(
      daysAgo(w.daysAgo),
      w.distance,
      w.duration,
      pace,
      w.type,
      w.shoeId || null
    );

    const workoutId = result.lastInsertRowid;

    // Add assessment
    assessmentStmt.run(
      workoutId,
      verdicts[i % verdicts.length],
      rpes[i % rpes.length],
      6 + Math.floor(Math.random() * 3), // legs_feel 6-8
      6 + Math.floor(Math.random() * 3), // sleep_quality 6-8
      3 + Math.floor(Math.random() * 4)  // stress 3-6
    );
  }
}

// Seed a goal race
function seedRaces() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM races').get() as { count: number };
  if (existing.count > 0) {
    console.log('Races already exist, skipping...');
    return;
  }

  console.log('Creating demo race...');
  db.prepare(`
    INSERT INTO races (
      name, date, distance_meters, distance_label, priority,
      target_time_seconds, location, created_at, updated_at
    ) VALUES (
      'Brooklyn Half Marathon', ?, 21097, 'Half Marathon', 'A',
      5700, 'Brooklyn, NY', datetime('now'), datetime('now')
    )
  `).run(daysFromNow(70));

  // Add a B race too
  db.prepare(`
    INSERT INTO races (
      name, date, distance_meters, distance_label, priority,
      target_time_seconds, location, created_at, updated_at
    ) VALUES (
      'Central Park 10K', ?, 10000, '10K', 'B',
      2700, 'New York, NY', datetime('now'), datetime('now')
    )
  `).run(daysFromNow(28));
}

// Seed race results for VDOT calculation
function seedRaceResults() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM race_results').get() as { count: number };
  if (existing.count > 0) {
    console.log('Race results already exist, skipping...');
    return;
  }

  console.log('Creating demo race results...');
  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, created_at
    ) VALUES (
      'NYC 10K', ?, 10000, '10K', 2820,
      45.2, 'all_out', datetime('now')
    )
  `).run(daysAgo(90));

  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, created_at
    ) VALUES (
      'Turkey Trot 5K', ?, 5000, '5K', 1320,
      44.8, 'all_out', datetime('now')
    )
  `).run(daysAgo(180));
}

// Seed wardrobe items
function seedWardrobe() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM clothing_items').get() as { count: number };
  if (existing.count > 0) {
    console.log('Wardrobe items already exist, skipping...');
    return;
  }

  console.log('Creating demo wardrobe...');
  const items = [
    { name: 'Nike Dri-FIT Tee', category: 'top_short_sleeve', warmth: 1 },
    { name: 'Lululemon Swiftly LS', category: 'top_long_sleeve_thin', warmth: 2 },
    { name: 'Tracksmith Brighton Base', category: 'top_long_sleeve_standard', warmth: 3 },
    { name: 'Nike Element Half-Zip', category: 'outer_quarter_zip', warmth: 3 },
    { name: 'Patagonia Houdini', category: 'outer_shell', warmth: 2 },
    { name: 'Nike 5" Flex Stride', category: 'bottom_shorts', warmth: 1 },
    { name: 'Nike Phenom Tights', category: 'bottom_leggings', warmth: 4 },
    { name: 'Smartwool PhD Socks', category: 'socks_thin', warmth: 1 },
    { name: 'Smartwool Merino Socks', category: 'socks_warm', warmth: 3 },
    { name: 'Buff Headwear', category: 'buff', warmth: 2 },
    { name: 'Nike Fleece Beanie', category: 'beanie', warmth: 4 },
  ];

  const stmt = db.prepare(`
    INSERT INTO clothing_items (name, category, warmth_rating, is_active, created_at)
    VALUES (?, ?, ?, 1, datetime('now'))
  `);

  for (const item of items) {
    stmt.run(item.name, item.category, item.warmth);
  }
}

// Run all seed functions
console.log('=== Seeding Demo Data ===\n');

try {
  seedUserSettings();
  seedShoes();
  seedWorkouts();
  seedRaces();
  seedRaceResults();
  seedWardrobe();
  console.log('\n=== Seed Complete ===');
} catch (error) {
  console.error('Seed error:', error);
  process.exit(1);
}
