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

// Random number in range
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random float in range
function randFloat(min: number, max: number, decimals: number = 1): number {
  const val = Math.random() * (max - min) + min;
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Calculate training load (simplified TSS-like calculation)
function calculateTrainingLoad(durationMinutes: number, intensity: number): number {
  // intensity: 0.5 = easy, 0.7 = moderate, 0.85 = tempo, 1.0 = interval/race
  return Math.round(durationMinutes * intensity * intensity * 100 / 60);
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
        current_weekly_mileage = 35,
        current_long_run_max = 14,
        runs_per_week_current = 5,
        runs_per_week_target = 5,

        -- Training goals (REQUIRED for plan generation)
        peak_weekly_mileage_target = 50,
        weekly_volume_target_miles = 40,

        -- Training preferences (REQUIRED for plan generation)
        preferred_long_run_day = 'sunday',
        preferred_quality_days = '["tuesday", "thursday"]',
        required_rest_days = '["friday"]',
        plan_aggressiveness = 'moderate',
        quality_sessions_per_week = 2,
        open_to_doubles = 0,

        -- Pacing (from VDOT 48)
        vdot = 48,
        default_target_pace_seconds = 480,
        easy_pace_seconds = 540,
        tempo_pace_seconds = 420,
        threshold_pace_seconds = 400,
        interval_pace_seconds = 360,
        marathon_pace_seconds = 450,
        half_marathon_pace_seconds = 420,

        -- PRs
        marathon_pr_seconds = 12600,
        half_marathon_pr_seconds = 5700,
        ten_k_pr_seconds = 2580,
        five_k_pr_seconds = 1200,

        -- Bio
        years_running = 5,
        age = 34,
        gender = 'male',
        height_inches = 70,
        weight_lbs = 165,
        resting_hr = 52,

        -- Environment
        heat_acclimatization_score = 70,
        temperature_preference = 'neutral',
        temperature_preference_scale = 5,
        heat_sensitivity = 3,
        cold_sensitivity = 2,

        -- Lifestyle
        typical_sleep_hours = 7.5,
        sleep_quality = 'good',
        stress_level = 'moderate',
        train_by = 'pace',
        surface_preference = 'road',
        group_vs_solo = 'solo',
        preferred_run_time = 'morning',
        weekday_availability_minutes = 60,
        weekend_availability_minutes = 150,

        -- Training comfort
        comfort_vo2max = 3,
        comfort_tempo = 4,
        comfort_hills = 3,
        comfort_long_runs = 5,
        comfort_track_work = 3,
        speedwork_experience = 'intermediate',

        -- Coach settings
        coach_name = 'Coach',
        coach_color = 'blue',
        coach_persona = 'encouraging',

        -- Onboarding status
        onboarding_completed = 1,
        onboarding_step = 10,

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
        marathon_pr_seconds, half_marathon_pr_seconds, ten_k_pr_seconds, five_k_pr_seconds,
        years_running, age, gender, height_inches, weight_lbs, resting_hr,
        heat_acclimatization_score, temperature_preference, temperature_preference_scale,
        heat_sensitivity, cold_sensitivity,
        typical_sleep_hours, sleep_quality, stress_level, train_by, surface_preference, group_vs_solo,
        preferred_run_time, weekday_availability_minutes, weekend_availability_minutes,
        comfort_vo2max, comfort_tempo, comfort_hills, comfort_long_runs, comfort_track_work,
        speedwork_experience, coach_name, coach_color, coach_persona,
        onboarding_completed, onboarding_step, created_at, updated_at
      ) VALUES (
        'Demo Runner', 'self_coached', 40.7128, -74.0060, 'New York, NY',
        35, 14, 5, 5,
        50, 40,
        'sunday', '["tuesday", "thursday"]', '["friday"]',
        'moderate', 2, 0,
        48, 480, 540, 420,
        400, 360, 450, 420,
        12600, 5700, 2580, 1200,
        5, 34, 'male', 70, 165, 52,
        70, 'neutral', 5,
        3, 2,
        7.5, 'good', 'moderate', 'pace', 'road', 'solo',
        'morning', 60, 150,
        3, 4, 3, 5, 3,
        'intermediate', 'Coach', 'blue', 'encouraging',
        1, 10, datetime('now'), datetime('now')
      )
    `).run();
  }
}

// Seed shoes
function seedShoes() {
  db.prepare('DELETE FROM shoes').run();
  console.log('Creating demo shoes...');

  const shoes = [
    { name: 'Nike Pegasus 40', brand: 'Nike', model: 'Pegasus 40', category: 'daily_trainer', miles: 312.5 },
    { name: 'Saucony Endorphin Speed 3', brand: 'Saucony', model: 'Endorphin Speed 3', category: 'tempo', miles: 156.2 },
    { name: 'Nike Vaporfly Next% 2', brand: 'Nike', model: 'Vaporfly Next% 2', category: 'race', miles: 67.3 },
    { name: 'Brooks Ghost 15', brand: 'Brooks', model: 'Ghost 15', category: 'recovery', miles: 425.8 },
    { name: 'Hoka Speedgoat 5', brand: 'Hoka', model: 'Speedgoat 5', category: 'trail', miles: 89.4 },
  ];

  const stmt = db.prepare(`
    INSERT INTO shoes (name, brand, model, category, total_miles, is_retired, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `);

  for (const shoe of shoes) {
    stmt.run(shoe.name, shoe.brand, shoe.model, shoe.category, shoe.miles);
  }
}

// Seed 90+ days of workouts with realistic patterns
function seedWorkouts() {
  // Clear existing workouts and assessments
  db.prepare('DELETE FROM assessments').run();
  db.prepare('DELETE FROM workouts').run();
  console.log('Creating 90+ days of demo workouts...');

  // Get shoe IDs
  const pegasus = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Pegasus%'").get() as { id: number } | undefined;
  const speed = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Speed%'").get() as { id: number } | undefined;
  const ghost = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Ghost%'").get() as { id: number } | undefined;
  const vaporfly = db.prepare("SELECT id FROM shoes WHERE name LIKE '%Vaporfly%'").get() as { id: number } | undefined;

  const workoutStmt = db.prepare(`
    INSERT INTO workouts (
      date, distance_miles, duration_minutes, avg_pace_seconds,
      workout_type, shoe_id, source, avg_heart_rate, elevation_gain_feet, training_load,
      weather_temp_f, weather_humidity_pct, weather_wind_mph,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'demo', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const assessmentStmt = db.prepare(`
    INSERT INTO assessments (
      workout_id, verdict, rpe, legs_feel, sleep_quality, stress, soreness, mood,
      breathing_feel, perceived_heat, was_intended_workout, time_of_run, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  // Generate 90 days of training data
  // Pattern: Build weeks with quality on Tue/Thu, long run Sun, recovery Fri, easy Mon/Wed/Sat
  // Every 4th week is a down/recovery week

  const workouts: Array<{
    daysAgo: number;
    type: string;
    distance: number;
    intensity: number; // 0.5-1.0
    shoeId: number | undefined;
    hr: number;
  }> = [];

  for (let week = 0; week < 13; week++) {
    const weekStart = week * 7;
    const isDownWeek = week % 4 === 3;
    const weekMultiplier = isDownWeek ? 0.7 : 1 + (week * 0.02); // Gradual progression

    // Monday - Easy
    workouts.push({
      daysAgo: 90 - weekStart,
      type: 'easy',
      distance: randFloat(4.5, 6, 1) * weekMultiplier,
      intensity: 0.55,
      shoeId: pegasus?.id,
      hr: rand(135, 145),
    });

    // Tuesday - Quality (tempo or intervals)
    const tuesdayType = week % 2 === 0 ? 'tempo' : 'interval';
    workouts.push({
      daysAgo: 90 - weekStart - 1,
      type: tuesdayType,
      distance: randFloat(5.5, 7, 1) * (isDownWeek ? 0.75 : 1),
      intensity: tuesdayType === 'tempo' ? 0.85 : 0.92,
      shoeId: speed?.id,
      hr: tuesdayType === 'tempo' ? rand(160, 170) : rand(168, 178),
    });

    // Wednesday - Easy
    workouts.push({
      daysAgo: 90 - weekStart - 2,
      type: 'easy',
      distance: randFloat(4, 5.5, 1) * weekMultiplier,
      intensity: 0.55,
      shoeId: pegasus?.id,
      hr: rand(132, 142),
    });

    // Thursday - Quality (threshold or fartlek)
    const thursdayType = week % 2 === 0 ? 'interval' : 'tempo';
    workouts.push({
      daysAgo: 90 - weekStart - 3,
      type: thursdayType,
      distance: randFloat(5, 6.5, 1) * (isDownWeek ? 0.75 : 1),
      intensity: thursdayType === 'tempo' ? 0.85 : 0.90,
      shoeId: speed?.id,
      hr: rand(162, 172),
    });

    // Friday - Rest or very easy recovery
    if (Math.random() > 0.6) {
      workouts.push({
        daysAgo: 90 - weekStart - 4,
        type: 'recovery',
        distance: randFloat(2.5, 3.5, 1),
        intensity: 0.45,
        shoeId: ghost?.id,
        hr: rand(120, 130),
      });
    }

    // Saturday - Easy/Steady
    workouts.push({
      daysAgo: 90 - weekStart - 5,
      type: Math.random() > 0.5 ? 'easy' : 'steady',
      distance: randFloat(5, 7, 1) * weekMultiplier,
      intensity: 0.60,
      shoeId: pegasus?.id,
      hr: rand(140, 150),
    });

    // Sunday - Long run
    const longRunDistance = isDownWeek
      ? randFloat(8, 10, 1)
      : Math.min(randFloat(12, 16, 1) * (1 + week * 0.03), 18);
    workouts.push({
      daysAgo: 90 - weekStart - 6,
      type: 'long',
      distance: longRunDistance,
      intensity: 0.65,
      shoeId: pegasus?.id,
      hr: rand(145, 158),
    });
  }

  // Add a race result (10K race 45 days ago)
  workouts.push({
    daysAgo: 45,
    type: 'race',
    distance: 6.21,
    intensity: 1.0,
    shoeId: vaporfly?.id,
    hr: rand(175, 182),
  });

  const verdicts = ['great', 'good', 'good', 'good', 'fine', 'fine', 'rough'];
  const breathingFeels = ['easy', 'easy', 'controlled', 'controlled', 'hard'];
  const perceivedHeats = ['cool', 'normal', 'normal', 'normal', 'hot'];
  const timeOfRuns = ['early_morning', 'morning', 'morning', 'morning', 'evening'];

  // Sort by date (most recent last)
  workouts.sort((a, b) => b.daysAgo - a.daysAgo);

  for (const w of workouts) {
    if (w.daysAgo < 0) continue; // Skip future dates

    const paceBase = w.type === 'easy' ? 540 : w.type === 'recovery' ? 600 :
                     w.type === 'long' ? 530 : w.type === 'tempo' ? 420 :
                     w.type === 'interval' ? 380 : w.type === 'race' ? 400 : 500;
    const pace = paceBase + rand(-15, 15);
    const duration = Math.round((w.distance * pace) / 60);
    const trainingLoad = calculateTrainingLoad(duration, w.intensity);

    // Weather varies by "season" (based on days ago)
    const seasonTemp = w.daysAgo > 60 ? rand(35, 50) : w.daysAgo > 30 ? rand(45, 65) : rand(55, 75);

    const result = workoutStmt.run(
      daysAgo(w.daysAgo),
      w.distance,
      duration,
      pace,
      w.type,
      w.shoeId || null,
      w.hr,
      rand(50, 300), // elevation
      trainingLoad,
      seasonTemp,
      rand(40, 80), // humidity
      rand(0, 15), // wind
    );

    const workoutId = result.lastInsertRowid;

    // RPE correlates with intensity
    const rpeBase = Math.round(w.intensity * 10);
    const rpe = Math.min(10, Math.max(1, rpeBase + rand(-1, 1)));

    assessmentStmt.run(
      workoutId,
      verdicts[rand(0, verdicts.length - 1)],
      rpe,
      rand(5, 8), // legs_feel
      rand(5, 9), // sleep_quality
      rand(2, 6), // stress
      rand(2, 5), // soreness
      rand(6, 9), // mood
      breathingFeels[Math.min(Math.floor(w.intensity * 5), breathingFeels.length - 1)],
      perceivedHeats[rand(0, perceivedHeats.length - 1)],
      'yes',
      timeOfRuns[rand(0, timeOfRuns.length - 1)],
    );
  }

  console.log(`  Created ${workouts.length} workouts with assessments`);
}

// Seed goal races
function seedRaces() {
  db.prepare('DELETE FROM races').run();
  console.log('Creating demo races...');

  // A race - Half Marathon in 10 weeks
  db.prepare(`
    INSERT INTO races (
      name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, notes, created_at, updated_at
    ) VALUES (
      'Brooklyn Half Marathon', ?, 21097, 'Half Marathon', 'A',
      5400, 412, 'Brooklyn, NY', 'Goal: Sub-1:30', datetime('now'), datetime('now')
    )
  `).run(daysFromNow(70));

  // B race - 10K in 4 weeks
  db.prepare(`
    INSERT INTO races (
      name, date, distance_meters, distance_label, priority,
      target_time_seconds, target_pace_seconds_per_mile, location, created_at, updated_at
    ) VALUES (
      'Central Park 10K', ?, 10000, '10K', 'B',
      2520, 406, 'New York, NY', datetime('now'), datetime('now')
    )
  `).run(daysFromNow(28));

  // C race - 5K tune-up in 2 weeks
  db.prepare(`
    INSERT INTO races (
      name, date, distance_meters, distance_label, priority,
      target_time_seconds, location, created_at, updated_at
    ) VALUES (
      'NYRR 5K', ?, 5000, '5K', 'C',
      1170, 'Central Park, NY', datetime('now'), datetime('now')
    )
  `).run(daysFromNow(14));
}

// Seed race results for VDOT calculation
function seedRaceResults() {
  db.prepare('DELETE FROM race_results').run();
  console.log('Creating demo race results...');

  // Recent 10K - 45 days ago (matches workout above)
  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, conditions, notes, created_at
    ) VALUES (
      'NYC Runs 10K', ?, 10000, '10K', 2580,
      48.2, 'all_out', '{"temp": 55, "conditions": "clear"}', 'PR! Felt great.', datetime('now')
    )
  `).run(daysAgo(45));

  // 5K - 3 months ago
  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, conditions, created_at
    ) VALUES (
      'Turkey Trot 5K', ?, 5000, '5K', 1200,
      48.0, 'all_out', '{"temp": 42, "conditions": "cloudy"}', datetime('now')
    )
  `).run(daysAgo(90));

  // Half marathon - 6 months ago
  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, conditions, notes, created_at
    ) VALUES (
      'Philadelphia Half', ?, 21097, 'Half Marathon', 5700,
      47.5, 'all_out', '{"temp": 48, "conditions": "rain"}', 'Tough conditions but happy with result', datetime('now')
    )
  `).run(daysAgo(180));

  // Marathon - 1 year ago
  db.prepare(`
    INSERT INTO race_results (
      race_name, date, distance_meters, distance_label, finish_time_seconds,
      calculated_vdot, effort_level, conditions, notes, created_at
    ) VALUES (
      'NYC Marathon', ?, 42195, 'Marathon', 12600,
      46.8, 'all_out', '{"temp": 52, "conditions": "clear"}', 'First marathon! Bonked at mile 22 but finished strong.', datetime('now')
    )
  `).run(daysAgo(365));
}

// Seed wardrobe items
function seedWardrobe() {
  db.prepare('DELETE FROM clothing_items').run();
  console.log('Creating demo wardrobe...');

  const items = [
    // Tops
    { name: 'Nike Dri-FIT Tee', category: 'top_short_sleeve', warmth: 1 },
    { name: 'Tracksmith Van Cortlandt Singlet', category: 'top_short_sleeve', warmth: 1 },
    { name: 'Lululemon Swiftly LS', category: 'top_long_sleeve_thin', warmth: 2 },
    { name: 'Tracksmith Brighton Base Layer', category: 'top_long_sleeve_standard', warmth: 3 },
    { name: 'Nike Therma-FIT', category: 'top_long_sleeve_warm', warmth: 4 },

    // Outerwear
    { name: 'Nike Element Half-Zip', category: 'outer_quarter_zip', warmth: 3 },
    { name: 'Patagonia Houdini', category: 'outer_shell', warmth: 2 },
    { name: 'Nike Windrunner', category: 'outer_hoodie', warmth: 4 },

    // Bottoms
    { name: 'Nike 5" Flex Stride', category: 'bottom_shorts', warmth: 1 },
    { name: 'Tracksmith Session Shorts', category: 'bottom_shorts', warmth: 1 },
    { name: 'Nike Half Tights', category: 'bottom_half_tights', warmth: 2 },
    { name: 'Nike Phenom Tights', category: 'bottom_leggings', warmth: 4 },

    // Accessories
    { name: 'Smartwool PhD Socks', category: 'socks_thin', warmth: 1 },
    { name: 'Smartwool Merino Socks', category: 'socks_warm', warmth: 3 },
    { name: 'Buff Headwear', category: 'buff', warmth: 2 },
    { name: 'Nike Fleece Beanie', category: 'beanie', warmth: 4 },
    { name: 'Nike Lightweight Gloves', category: 'gloves_thin', warmth: 2 },
    { name: 'Brooks Greenlight Gloves', category: 'gloves_medium', warmth: 3 },
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
  console.log('\nYou now have:');
  console.log('  - 90+ days of workout history with HR and training load');
  console.log('  - Full user profile with VDOT 48');
  console.log('  - 5 shoes with realistic mileage');
  console.log('  - 3 upcoming races (A, B, C priority)');
  console.log('  - 4 race results for VDOT history');
  console.log('  - 18 wardrobe items');
} catch (error) {
  console.error('Seed error:', error);
  process.exit(1);
}
