/**
 * Import Strava Bulk Export
 *
 * Parses the Strava data export (activities.csv + shoes.csv) and inserts
 * missing run activities into the local SQLite database.
 *
 * Usage:
 *   npx tsx scripts/import-strava-export.ts                         # full import
 *   npx tsx scripts/import-strava-export.ts --dry-run               # preview only
 *   npx tsx scripts/import-strava-export.ts --limit 10              # first N runs
 *   npx tsx scripts/import-strava-export.ts --dry-run --limit 5     # preview first 5
 *
 * After importing, run:
 *   npx tsx scripts/reprocess-workouts.ts
 * to classify workouts, compute TRIMP, zones, etc.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EXPORT_DIR = path.join(process.cwd(), 'docs', 'export_113202952-2');
const ACTIVITIES_CSV = path.join(EXPORT_DIR, 'activities.csv');
const SHOES_CSV = path.join(EXPORT_DIR, 'shoes.csv');
const PROFILE_ID = 1;

// Activity types we care about
const RUN_TYPES = new Set(['Run', 'Virtual Run', 'VirtualRun', 'TrailRun', 'Trail Run']);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined;

// ---------------------------------------------------------------------------
// CSV Parser (handles quoted fields with commas, newlines in quotes, etc.)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes ("")
      if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if (ch === ',' && !inQuote) {
      fields.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsvFile(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf8') as string;
  const lines = content.split('\n');
  const rows: string[][] = [];

  // Handle multi-line quoted fields
  let pendingLine = '';
  let inQuote = false;

  for (const rawLine of lines) {
    if (pendingLine) {
      pendingLine += '\n' + rawLine;
    } else {
      pendingLine = rawLine;
    }

    // Count quotes to check if line is complete
    let quoteCount = 0;
    for (const ch of pendingLine) {
      if (ch === '"') quoteCount++;
    }
    inQuote = quoteCount % 2 !== 0;

    if (!inQuote) {
      if (pendingLine.trim()) {
        rows.push(parseCsvLine(pendingLine));
      }
      pendingLine = '';
    }
  }

  // If there's a dangling line, parse it anyway
  if (pendingLine && pendingLine.trim()) {
    rows.push(parseCsvLine(pendingLine));
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Column index map — Strava CSV has duplicate column names, so we use indices
//
// 0  Activity ID
// 1  Activity Date        (e.g. "Jan 28, 2023, 2:53:30 PM")
// 2  Activity Name
// 3  Activity Type        (Run, Walk, Ride, ...)
// 4  Activity Description
// 5  Elapsed Time         (summary, seconds as float — same as col 15)
// 6  Distance             (summary, meters — same as col 17)
// 7  Max Heart Rate       (summary)
// 8  Relative Effort      (summary)
// 9  Commute              (summary)
// 10 Activity Private Note
// 11 Activity Gear        (human-readable name, e.g. "HOKA Clifton 8 🧱")
// 12 Filename             (path like "activities/8466171603.gpx")
// 13 Athlete Weight
// 14 Bike Weight
// 15 Elapsed Time         (detail, seconds as float)
// 16 Moving Time          (seconds as float)
// 17 Distance             (detail, meters)
// 18 Max Speed            (m/s)
// 19 Average Speed        (m/s)
// 20 Elevation Gain       (meters)
// 21 Elevation Loss
// 22 Elevation Low
// 23 Elevation High
// 24-27 Grade fields
// 28 Max Cadence
// 29 Average Cadence
// 30 Max Heart Rate       (detail)
// 31 Average Heart Rate
// 32-33 Watts
// 34 Calories
// 35-36 Temperature
// 37 Relative Effort (detail)
// 38 Total Work
// 39 Number of Runs
// 40-42 Time breakdowns
// 43 Perceived Exertion
// 44 Type
// 45 Start Time           (Unix timestamp as float)
// ...
// 55 Weather Condition    (WMO code)
// 56 Weather Temperature  (Celsius)
// 57 Apparent Temperature (Celsius)
// 58 Dewpoint
// 59 Humidity             (0-1 fraction)
// 60 Weather Pressure
// 61 Wind Speed           (m/s)
// 62 Wind Gust
// 63 Wind Bearing
// ...
// 69 Gear                 (numeric Strava gear ID)
// ...
// 88 Training Load
// ---------------------------------------------------------------------------

const COL = {
  ACTIVITY_ID: 0,
  ACTIVITY_DATE: 1,
  ACTIVITY_NAME: 2,
  ACTIVITY_TYPE: 3,
  ACTIVITY_DESCRIPTION: 4,
  ELAPSED_TIME_SUMMARY: 5,
  DISTANCE_SUMMARY: 6,
  MAX_HR_SUMMARY: 7,
  RELATIVE_EFFORT_SUMMARY: 8,
  ACTIVITY_GEAR: 11,
  FILENAME: 12,
  ELAPSED_TIME: 15,
  MOVING_TIME: 16,
  DISTANCE: 17,
  MAX_SPEED: 18,
  AVERAGE_SPEED: 19,
  ELEVATION_GAIN: 20,
  ELEVATION_LOSS: 21,
  AVERAGE_CADENCE: 29,
  MAX_HR: 30,
  AVERAGE_HR: 31,
  CALORIES: 34,
  PERCEIVED_EXERTION: 43,
  START_TIME: 45,
  WEATHER_CONDITION: 55,
  WEATHER_TEMP_C: 56,
  APPARENT_TEMP_C: 57,
  HUMIDITY: 59,
  WIND_SPEED: 61,
  GEAR_ID: 69,
  TRAINING_LOAD: 88,
};

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

function metersToFeet(m: number): number {
  return m / METERS_PER_FOOT;
}

/** Convert m/s average speed to seconds per mile pace */
function avgSpeedMpsToSecondsPerMile(mps: number): number {
  if (mps <= 0) return 0;
  // mps = meters / second
  // seconds per mile = METERS_PER_MILE / mps
  return Math.round(METERS_PER_MILE / mps);
}

/** Convert m/s to mph */
function mpsToMph(mps: number): number {
  return mps * 3600 / METERS_PER_MILE;
}

/** Celsius to Fahrenheit */
function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

/** m/s wind to mph */
function windMpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

/**
 * Parse Strava export date format: "Jan 28, 2023, 2:53:30 PM"
 * Returns ISO date string (YYYY-MM-DD)
 */
function parseStravaDate(dateStr: string): { isoDate: string; startTimeLocal: string | null } | null {
  if (!dateStr || dateStr.trim() === '') return null;

  try {
    // "Jan 28, 2023, 2:53:30 PM"
    // JavaScript's Date can parse this format
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) {
      // Try manual parsing
      return parseStravaDateManual(dateStr);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return {
      isoDate: `${year}-${month}-${day}`,
      startTimeLocal: `${hours}:${minutes}`,
    };
  } catch {
    return parseStravaDateManual(dateStr);
  }
}

function parseStravaDateManual(dateStr: string): { isoDate: string; startTimeLocal: string | null } | null {
  // "Jan 28, 2023, 2:53:30 PM"
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };

  const match = dateStr.match(
    /^(\w{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/
  );
  if (!match) return null;

  const [, mon, dayStr, yearStr, hourStr, minStr, , ampm] = match;
  const month = months[mon];
  if (!month) return null;

  let hour = parseInt(hourStr, 10);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const day = dayStr.padStart(2, '0');
  const hours = String(hour).padStart(2, '0');
  const minutes = minStr;

  return {
    isoDate: `${yearStr}-${month}-${day}`,
    startTimeLocal: `${hours}:${minutes}`,
  };
}

function parseFloat_(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseInt_(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// WMO weather code to our condition string
// ---------------------------------------------------------------------------
function wmoCodeToCondition(code: number): string | null {
  // WMO Weather interpretation codes
  // 0: Clear, 1-3: Cloudy, 45-48: Fog, 51-57: Drizzle,
  // 61-67: Rain, 71-77: Snow, 80-82: Rain showers, 85-86: Snow showers
  // 95-99: Thunderstorm
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return null;
}

// ---------------------------------------------------------------------------
// Database setup — ensure columns exist
// ---------------------------------------------------------------------------

function ensureColumns(sqlite: InstanceType<typeof Database>) {
  // Check which columns exist
  const existingCols = new Set(
    (sqlite.prepare('PRAGMA table_info(workouts)').all() as Array<{ name: string }>)
      .map((c: { name: string }) => c.name)
  );

  const columnsToAdd: Array<{ name: string; type: string; default_?: string }> = [
    { name: 'strava_gear_id', type: 'TEXT' },
    { name: 'strava_max_speed', type: 'REAL' },
    { name: 'strava_average_cadence', type: 'REAL' },
    { name: 'strava_perceived_exertion', type: 'REAL' },
    { name: 'strava_description', type: 'TEXT' },
    { name: 'start_time_local', type: 'TEXT' },
  ];

  let addedCount = 0;
  for (const col of columnsToAdd) {
    if (!existingCols.has(col.name)) {
      const defaultClause = col.default_ ? ` DEFAULT ${col.default_}` : '';
      if (DRY_RUN) {
        console.log(`  Would add missing column: workouts.${col.name}`);
      } else {
        console.log(`  Adding missing column: workouts.${col.name}`);
        sqlite.prepare(`ALTER TABLE workouts ADD COLUMN ${col.name} ${col.type}${defaultClause}`).run();
      }
      addedCount++;
    }
  }

  // Shoes table — add strava_gear_id if missing
  const shoeCols = new Set(
    (sqlite.prepare('PRAGMA table_info(shoes)').all() as Array<{ name: string }>)
      .map((c: { name: string }) => c.name)
  );
  if (!shoeCols.has('strava_gear_id')) {
    if (DRY_RUN) {
      console.log('  Would add missing column: shoes.strava_gear_id');
    } else {
      console.log('  Adding missing column: shoes.strava_gear_id');
      sqlite.prepare('ALTER TABLE shoes ADD COLUMN strava_gear_id TEXT').run();
    }
    addedCount++;
  }

  if (addedCount === 0) {
    console.log('  All required columns present');
  }
}

// ---------------------------------------------------------------------------
// Shoe import
// ---------------------------------------------------------------------------

function importShoes(sqlite: InstanceType<typeof Database>): Map<string, number> {
  // Map "brand + model" -> shoe DB id (for gear linking)
  const shoeMap = new Map<string, number>();

  // Load existing shoes
  const existing = sqlite.prepare('SELECT id, name, brand, model FROM shoes WHERE profile_id = ?').all(PROFILE_ID) as Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
  }>;

  for (const shoe of existing) {
    const key = `${shoe.brand.trim().toLowerCase()}|${shoe.model.trim().toLowerCase()}`;
    shoeMap.set(key, shoe.id);
    // Also map by name
    if (shoe.name) {
      shoeMap.set(`name:${shoe.name.trim().toLowerCase()}`, shoe.id);
    }
  }

  console.log(`  Existing shoes in DB: ${existing.length}`);

  if (!fs.existsSync(SHOES_CSV)) {
    console.log('  shoes.csv not found, skipping shoe import');
    return shoeMap;
  }

  const rows = parseCsvFile(SHOES_CSV);
  if (rows.length < 2) {
    console.log('  shoes.csv is empty');
    return shoeMap;
  }

  // Header: Shoe Name, Shoe Brand, Shoe Model, Shoe Default Sport Types
  let imported = 0;
  let skipped = 0;

  const insertShoe = sqlite.prepare(`
    INSERT INTO shoes (profile_id, name, brand, model, category, intended_use, total_miles, is_retired, created_at)
    VALUES (?, ?, ?, ?, 'daily_trainer', '[]', 0, 0, ?)
  `);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const name = row[0] || '';
    const brand = row[1] || '';
    const model = row[2] || '';

    if (!brand && !model) continue;

    const key = `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
    if (shoeMap.has(key)) {
      skipped++;
      continue;
    }

    const displayName = name || `${brand} ${model}`.trim();

    if (!DRY_RUN) {
      const result = insertShoe.run(
        PROFILE_ID,
        displayName,
        brand.trim(),
        model.trim(),
        new Date().toISOString()
      );
      shoeMap.set(key, (result as { lastInsertRowid: number }).lastInsertRowid);
      if (displayName) {
        shoeMap.set(`name:${displayName.trim().toLowerCase()}`, (result as { lastInsertRowid: number }).lastInsertRowid);
      }
    }
    imported++;
  }

  console.log(`  Shoes imported: ${imported}, skipped (existing): ${skipped}`);
  return shoeMap;
}

// ---------------------------------------------------------------------------
// Build gear-name-to-shoe-id map from the activities CSV "Activity Gear" col
// ---------------------------------------------------------------------------

function buildGearNameMap(
  sqlite: InstanceType<typeof Database>,
  shoeMap: Map<string, number>,
): Map<string, number> {
  // The "Activity Gear" column has human-readable names like "HOKA Clifton 8 🧱"
  // We need to match them to shoes in the DB by brand + model
  const gearNameToShoeId = new Map<string, number>();

  // Get all shoes from DB
  const allShoes = sqlite.prepare('SELECT id, name, brand, model FROM shoes WHERE profile_id = ?').all(PROFILE_ID) as Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
  }>;

  for (const shoe of allShoes) {
    // Try matching by "Brand Model" pattern in gear name
    const brandModel = `${shoe.brand} ${shoe.model}`.trim().toLowerCase();
    gearNameToShoeId.set(brandModel, shoe.id);

    // Also store exact name matches
    if (shoe.name) {
      gearNameToShoeId.set(shoe.name.trim().toLowerCase(), shoe.id);
    }
  }

  return gearNameToShoeId;
}

function findShoeIdForGearName(
  gearName: string,
  gearNameMap: Map<string, number>,
  sqlite: InstanceType<typeof Database>,
): number | null {
  if (!gearName || gearName.trim() === '') return null;

  const clean = gearName.trim().toLowerCase();

  // Direct match by name
  if (gearNameMap.has(clean)) return gearNameMap.get(clean)!;

  // Try matching partial — gear name often has emoji suffixes
  // e.g. "HOKA Clifton 8 🧱" should match shoe with brand=HOKA, model=Clifton 8
  const allShoes = sqlite.prepare('SELECT id, name, brand, model FROM shoes WHERE profile_id = ?').all(PROFILE_ID) as Array<{
    id: number;
    name: string;
    brand: string;
    model: string;
  }>;

  for (const shoe of allShoes) {
    const brandModel = `${shoe.brand} ${shoe.model}`.trim().toLowerCase();
    if (clean.includes(brandModel) || brandModel.includes(clean)) {
      return shoe.id;
    }
    // Try brand + first word of model
    const modelFirstWord = shoe.model.trim().split(/\s+/)[0].toLowerCase();
    if (clean.includes(shoe.brand.toLowerCase()) && clean.includes(modelFirstWord)) {
      return shoe.id;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

interface ImportResult {
  imported: number;
  skipped: number;
  matched: number;
  errors: Array<{ activityId: string; error: string }>;
  samples: Array<{ activityId: string; date: string; name: string; distanceMi: string; pace: string }>;
}

function importActivities(sqlite: InstanceType<typeof Database>, shoeMap: Map<string, number>): ImportResult {
  const rows = parseCsvFile(ACTIVITIES_CSV);
  if (rows.length < 2) {
    console.log('  activities.csv is empty');
    return { imported: 0, skipped: 0, matched: 0, errors: [], samples: [] };
  }

  // Gather existing strava_activity_ids
  const existingIds = new Set<number>();
  const existingRows = sqlite.prepare(
    'SELECT strava_activity_id FROM workouts WHERE strava_activity_id IS NOT NULL'
  ).all() as Array<{ strava_activity_id: number }>;
  for (const row of existingRows) {
    existingIds.add(row.strava_activity_id);
  }
  console.log(`  Existing strava activity IDs in DB: ${existingIds.size}`);

  // Also check by date+distance for approximate dupe detection (for workouts imported via API without strava_activity_id)
  const existingByDateDist = new Map<string, number>();
  const allWorkouts = sqlite.prepare(
    'SELECT id, date, distance_miles, duration_minutes FROM workouts WHERE profile_id = ?'
  ).all(PROFILE_ID) as Array<{ id: number; date: string; distance_miles: number | null; duration_minutes: number | null }>;
  for (const w of allWorkouts) {
    if (w.distance_miles) {
      // Round to 1 decimal for fuzzy matching
      const key = `${w.date}|${w.distance_miles.toFixed(1)}`;
      existingByDateDist.set(key, w.id);
    }
  }
  console.log(`  Existing workouts for dupe checking (date+distance): ${existingByDateDist.size}`);

  const gearNameMap = buildGearNameMap(sqlite, shoeMap);

  // Only prepare write statements when not in dry-run mode
  const insertStmt = DRY_RUN ? null : sqlite.prepare(`
    INSERT INTO workouts (
      profile_id, date, distance_miles, duration_minutes, avg_pace_seconds,
      avg_hr, max_hr, elevation_gain_ft, elevation_gain_feet,
      workout_type, source, notes, strava_activity_id, strava_name,
      strava_description,
      weather_temp_f, weather_feels_like_f, weather_humidity_pct, weather_wind_mph,
      weather_conditions,
      shoe_id, strava_gear_id, strava_max_speed, strava_average_cadence,
      strava_perceived_exertion, start_time_local,
      elapsed_time_minutes, training_load,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?,
      ?, ?, ?, ?,
      ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?
    )
  `);

  // For workouts that already exist by date+distance, update their strava_activity_id
  const updateExistingStmt = DRY_RUN ? null : sqlite.prepare(`
    UPDATE workouts SET
      strava_activity_id = ?,
      strava_name = COALESCE(strava_name, ?),
      strava_gear_id = COALESCE(strava_gear_id, ?),
      strava_perceived_exertion = COALESCE(strava_perceived_exertion, ?),
      strava_average_cadence = COALESCE(strava_average_cadence, ?),
      strava_max_speed = COALESCE(strava_max_speed, ?),
      strava_description = COALESCE(strava_description, ?),
      start_time_local = COALESCE(start_time_local, ?),
      updated_at = ?
    WHERE id = ?
  `);

  let imported = 0;
  let skipped = 0;
  let matched = 0;
  const errors: Array<{ activityId: string; error: string }> = [];
  const samples: Array<{ activityId: string; date: string; name: string; distanceMi: string; pace: string }> = [];

  // Skip header row
  const dataRows = rows.slice(1);
  console.log(`  Total rows in CSV: ${dataRows.length}`);

  let runCount = 0;

  for (const fields of dataRows) {
    const activityType = fields[COL.ACTIVITY_TYPE];
    if (!RUN_TYPES.has(activityType)) continue;

    runCount++;
    if (LIMIT && runCount > LIMIT) break;

    const activityIdStr = fields[COL.ACTIVITY_ID];
    const activityId = parseInt_(activityIdStr);

    try {
      // Skip if already in DB by strava_activity_id
      if (activityId && existingIds.has(activityId)) {
        skipped++;
        continue;
      }

      // Parse date
      const dateResult = parseStravaDate(fields[COL.ACTIVITY_DATE]);
      if (!dateResult) {
        errors.push({ activityId: activityIdStr, error: `Could not parse date: "${fields[COL.ACTIVITY_DATE]}"` });
        continue;
      }

      // Parse core fields
      const distanceM = parseFloat_(fields[COL.DISTANCE]);
      const movingTimeSec = parseFloat_(fields[COL.MOVING_TIME]);
      const elapsedTimeSec = parseFloat_(fields[COL.ELAPSED_TIME]);
      const avgSpeedMps = parseFloat_(fields[COL.AVERAGE_SPEED]);
      const maxSpeedMps = parseFloat_(fields[COL.MAX_SPEED]);
      const elevationGainM = parseFloat_(fields[COL.ELEVATION_GAIN]);
      const avgHr = parseFloat_(fields[COL.AVERAGE_HR]);
      const maxHr = parseFloat_(fields[COL.MAX_HR]);
      const avgCadence = parseFloat_(fields[COL.AVERAGE_CADENCE]);
      const perceivedExertion = parseFloat_(fields[COL.PERCEIVED_EXERTION]);
      const trainingLoad = parseFloat_(fields[COL.TRAINING_LOAD]);

      // Conversions
      const distanceMiles = distanceM ? metersToMiles(distanceM) : null;
      const durationMinutes = movingTimeSec ? Math.round(movingTimeSec / 60) : null;
      const elapsedTimeMinutes = elapsedTimeSec ? Math.round(elapsedTimeSec / 60) : null;
      const avgPaceSeconds = avgSpeedMps ? avgSpeedMpsToSecondsPerMile(avgSpeedMps) : null;
      const maxSpeedMph = maxSpeedMps ? mpsToMph(maxSpeedMps) : null;
      const elevationGainFt = elevationGainM ? metersToFeet(elevationGainM) : null;

      // Weather
      const weatherTempC = parseFloat_(fields[COL.WEATHER_TEMP_C]);
      const apparentTempC = parseFloat_(fields[COL.APPARENT_TEMP_C]);
      const humidity = parseFloat_(fields[COL.HUMIDITY]);
      const windSpeedMps = parseFloat_(fields[COL.WIND_SPEED]);
      const weatherCondCode = parseFloat_(fields[COL.WEATHER_CONDITION]);

      const weatherTempF = weatherTempC !== null ? cToF(weatherTempC) : null;
      const weatherFeelsLikeF = apparentTempC !== null ? cToF(apparentTempC) : null;
      const weatherHumidityPct = humidity !== null ? Math.round(humidity * 100) : null;
      const weatherWindMph = windSpeedMps !== null ? windMpsToMph(windSpeedMps) : null;
      const weatherConditions = weatherCondCode !== null ? wmoCodeToCondition(weatherCondCode) : null;

      // Gear
      const activityGearName = fields[COL.ACTIVITY_GEAR] || '';
      const gearIdStr = fields[COL.GEAR_ID] || '';
      const shoeId = findShoeIdForGearName(activityGearName, gearNameMap, sqlite);

      // Activity details
      const activityName = fields[COL.ACTIVITY_NAME] || '';
      const activityDesc = fields[COL.ACTIVITY_DESCRIPTION] || '';

      // Check for approximate duplicate (same date + similar distance) — patch instead of insert
      const dupeKey = distanceMiles ? `${dateResult.isoDate}|${distanceMiles.toFixed(1)}` : null;
      if (dupeKey && existingByDateDist.has(dupeKey)) {
        const existingWorkoutId = existingByDateDist.get(dupeKey)!;
        if (!DRY_RUN && updateExistingStmt) {
          updateExistingStmt.run(
            activityId,
            activityName || null,
            gearIdStr || null,
            perceivedExertion,
            avgCadence,
            maxSpeedMph,
            activityDesc || null,
            dateResult.startTimeLocal,
            new Date().toISOString(),
            existingWorkoutId,
          );
        }
        matched++;
        continue;
      }

      // Build notes from weather and description
      let notes = '';
      if (activityDesc) {
        notes = activityDesc;
      }

      // Collect sample for preview
      if (samples.length < 10) {
        const paceFmt = avgPaceSeconds
          ? `${Math.floor(avgPaceSeconds / 60)}:${String(Math.round(avgPaceSeconds % 60)).padStart(2, '0')}/mi`
          : '--';
        samples.push({
          activityId: activityIdStr,
          date: dateResult.isoDate,
          name: activityName || '(unnamed)',
          distanceMi: distanceMiles ? distanceMiles.toFixed(2) : '?',
          pace: paceFmt,
        });
      }

      const now = new Date().toISOString();

      if (!DRY_RUN && insertStmt) {
        insertStmt.run(
          PROFILE_ID,
          dateResult.isoDate,
          distanceMiles,
          durationMinutes,
          avgPaceSeconds,
          avgHr !== null ? Math.round(avgHr) : null,
          maxHr !== null ? Math.round(maxHr) : null,
          elevationGainFt,
          elevationGainFt, // both columns
          'easy', // default workoutType, reprocess-workouts will fix it
          'strava',
          notes || null,
          activityId,
          activityName || null,
          activityDesc || null,
          weatherTempF,
          weatherFeelsLikeF,
          weatherHumidityPct,
          weatherWindMph,
          weatherConditions,
          shoeId,
          gearIdStr || null,
          maxSpeedMph,
          avgCadence,
          perceivedExertion,
          dateResult.startTimeLocal,
          elapsedTimeMinutes,
          trainingLoad !== null ? Math.round(trainingLoad) : null,
          now,
          now,
        );
      }

      imported++;
    } catch (err) {
      errors.push({ activityId: activityIdStr, error: String(err) });
    }
  }

  console.log(`  Matched to existing workouts (updated strava IDs): ${matched}`);
  return { imported, skipped, matched, errors, samples };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== Strava Export Import ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}`);
  if (LIMIT) console.log(`Limit: first ${LIMIT} run activities`);
  console.log(`Export directory: ${EXPORT_DIR}`);
  console.log('');

  // Validate export exists
  if (!fs.existsSync(ACTIVITIES_CSV)) {
    console.error(`ERROR: activities.csv not found at ${ACTIVITIES_CSV}`);
    process.exit(1);
  }

  // Open DB
  const dbPath = path.join(process.cwd(), 'data', 'stride.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database not found at ${dbPath}`);
    process.exit(1);
  }

  const sqlite = new Database(dbPath, { readonly: false });

  // Ensure required columns exist (always check, only apply in live mode)
  console.log('Checking database schema...');
  ensureColumns(sqlite);
  console.log('');

  // Import shoes
  console.log('Importing shoes...');
  const shoeMap = importShoes(sqlite);
  console.log('');

  // Import activities
  console.log('Importing run activities...');
  const result = importActivities(sqlite, shoeMap);
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log(`  New runs:  ${result.imported}`);
  console.log(`  Matched:   ${result.matched} (existing workouts updated with strava IDs)`);
  console.log(`  Skipped:   ${result.skipped} (strava_activity_id already in DB)`);
  console.log(`  Errors:    ${result.errors.length}`);

  // Sample preview
  if (result.samples.length > 0) {
    console.log('');
    console.log(`Sample ${DRY_RUN ? 'would-be-' : ''}imported runs:`);
    for (const s of result.samples) {
      console.log(`  ${s.date}  ${s.distanceMi.padStart(6)} mi  ${s.pace.padStart(9)}  ${s.name}`);
    }
    if (result.imported > result.samples.length) {
      console.log(`  ... and ${result.imported - result.samples.length} more`);
    }
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log('Errors (first 10):');
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  Activity ${err.activityId}: ${err.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  if (DRY_RUN) {
    console.log('');
    console.log('This was a dry run. To apply changes, run without --dry-run:');
    console.log('  npx tsx scripts/import-strava-export.ts');
  } else {
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run classification: npx tsx scripts/reprocess-workouts.ts');
    console.log('  2. (Optional) Backfill VDOT: npx tsx scripts/backfill-vdot-and-reclassify.ts');
  }

  sqlite.close();
}

main();
