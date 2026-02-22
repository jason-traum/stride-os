/**
 * Strava CSV Export Parser
 *
 * Shared parsing logic for Strava bulk export CSV files.
 * Used by both the web import page and the CLI import script.
 *
 * The Strava export CSV (activities.csv) has ~90+ columns.
 * This module parses it and converts rows into a normalized format
 * ready for DB insertion.
 */

// ---------------------------------------------------------------------------
// CSV Parser (handles quoted fields with commas, newlines in quotes, etc.)
// ---------------------------------------------------------------------------

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let inQuote = false;
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
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

export function parseCsvText(content: string): string[][] {
  const lines = content.split('\n');
  const rows: string[][] = [];

  let pendingLine = '';
  let inQuote = false;

  for (const rawLine of lines) {
    if (pendingLine) {
      pendingLine += '\n' + rawLine;
    } else {
      pendingLine = rawLine;
    }

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

  if (pendingLine && pendingLine.trim()) {
    rows.push(parseCsvLine(pendingLine));
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Column index map
// ---------------------------------------------------------------------------

export const COL = {
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

// Activity types we care about
export const RUN_TYPES = new Set([
  'Run', 'Virtual Run', 'VirtualRun', 'TrailRun', 'Trail Run',
]);

// All known activity types for summary display
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  Run: 'runs',
  'Virtual Run': 'virtual runs',
  VirtualRun: 'virtual runs',
  TrailRun: 'trail runs',
  'Trail Run': 'trail runs',
  Walk: 'walks',
  Hike: 'hikes',
  Ride: 'rides',
  Swim: 'swims',
  Yoga: 'yoga sessions',
  WeightTraining: 'weight training',
  'Weight Training': 'weight training',
  Workout: 'workouts',
  Elliptical: 'elliptical sessions',
  CrossFit: 'CrossFit sessions',
};

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

export function metersToFeet(m: number): number {
  return m / METERS_PER_FOOT;
}

export function avgSpeedMpsToSecondsPerMile(mps: number): number {
  if (mps <= 0) return 0;
  return Math.round(METERS_PER_MILE / mps);
}

export function mpsToMph(mps: number): number {
  return mps * 3600 / METERS_PER_MILE;
}

export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export function windMpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

export function parseStravaDate(dateStr: string): { isoDate: string; startTimeLocal: string | null } | null {
  if (!dateStr || dateStr.trim() === '') return null;

  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
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

  return {
    isoDate: `${yearStr}-${month}-${day}`,
    startTimeLocal: `${hours}:${minStr}`,
  };
}

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

export function parseFloat_(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function parseInt_(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// WMO weather code mapping
// ---------------------------------------------------------------------------

export function wmoCodeToCondition(code: number): string | null {
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
// Parsed activity type — the shape sent from client to server action
// ---------------------------------------------------------------------------

export interface ParsedStravaActivity {
  activityId: number | null;
  date: string;              // YYYY-MM-DD
  startTimeLocal: string | null; // HH:MM
  name: string | null;
  description: string | null;
  distanceMiles: number | null;
  durationMinutes: number | null;
  elapsedTimeMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainFt: number | null;
  maxSpeedMph: number | null;
  avgCadence: number | null;
  perceivedExertion: number | null;
  trainingLoad: number | null;
  weatherTempF: number | null;
  weatherFeelsLikeF: number | null;
  weatherHumidityPct: number | null;
  weatherWindMph: number | null;
  weatherConditions: string | null;
  gearName: string | null;
  gearId: string | null;
  calories: number | null;
}

// ---------------------------------------------------------------------------
// Activity type summary — counts per activity type in CSV
// ---------------------------------------------------------------------------

export interface ActivityTypeSummary {
  type: string;
  label: string;
  count: number;
  isRun: boolean;
}

/**
 * Summarize activity types found in the CSV without full parsing.
 * Used for the preview display.
 */
export function summarizeActivityTypes(csvText: string): {
  summary: ActivityTypeSummary[];
  totalRows: number;
  totalRuns: number;
} {
  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    return { summary: [], totalRows: 0, totalRuns: 0 };
  }

  const typeCounts = new Map<string, number>();
  const dataRows = rows.slice(1);

  for (const fields of dataRows) {
    const activityType = fields[COL.ACTIVITY_TYPE] || 'Unknown';
    typeCounts.set(activityType, (typeCounts.get(activityType) || 0) + 1);
  }

  let totalRuns = 0;
  const summary: ActivityTypeSummary[] = [];

  for (const [type, count] of Array.from(typeCounts)) {
    const isRun = RUN_TYPES.has(type);
    if (isRun) totalRuns += count;
    summary.push({
      type,
      label: ACTIVITY_TYPE_LABELS[type] || type.toLowerCase(),
      count,
      isRun,
    });
  }

  // Sort: runs first, then by count descending
  summary.sort((a, b) => {
    if (a.isRun && !b.isRun) return -1;
    if (!a.isRun && b.isRun) return 1;
    return b.count - a.count;
  });

  return { summary, totalRows: dataRows.length, totalRuns };
}

/**
 * Parse all run activities from Strava CSV text.
 * Returns an array of ParsedStravaActivity ready for server action.
 */
export function parseStravaRunsFromCsv(csvText: string): ParsedStravaActivity[] {
  const rows = parseCsvText(csvText);
  if (rows.length < 2) return [];

  const activities: ParsedStravaActivity[] = [];
  const dataRows = rows.slice(1);

  for (const fields of dataRows) {
    const activityType = fields[COL.ACTIVITY_TYPE];
    if (!RUN_TYPES.has(activityType)) continue;

    const activityIdStr = fields[COL.ACTIVITY_ID];
    const activityId = parseInt_(activityIdStr);

    const dateResult = parseStravaDate(fields[COL.ACTIVITY_DATE]);
    if (!dateResult) continue;

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
    const calories = parseFloat_(fields[COL.CALORIES]);

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

    activities.push({
      activityId: activityId,
      date: dateResult.isoDate,
      startTimeLocal: dateResult.startTimeLocal,
      name: fields[COL.ACTIVITY_NAME] || null,
      description: fields[COL.ACTIVITY_DESCRIPTION] || null,
      distanceMiles: distanceMiles ? Math.round(distanceMiles * 100) / 100 : null,
      durationMinutes,
      elapsedTimeMinutes,
      avgPaceSeconds,
      avgHr: avgHr !== null ? Math.round(avgHr) : null,
      maxHr: maxHr !== null ? Math.round(maxHr) : null,
      elevationGainFt: elevationGainFt ? Math.round(elevationGainFt * 10) / 10 : null,
      maxSpeedMph: maxSpeedMph ? Math.round(maxSpeedMph * 100) / 100 : null,
      avgCadence,
      perceivedExertion,
      trainingLoad: trainingLoad !== null ? Math.round(trainingLoad) : null,
      weatherTempF,
      weatherFeelsLikeF,
      weatherHumidityPct,
      weatherWindMph,
      weatherConditions,
      gearName: fields[COL.ACTIVITY_GEAR] || null,
      gearId: fields[COL.GEAR_ID] || null,
      calories: calories !== null ? Math.round(calories) : null,
    });
  }

  return activities;
}
