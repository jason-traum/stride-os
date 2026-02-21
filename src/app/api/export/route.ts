import { NextRequest, NextResponse } from 'next/server';
import { db, workouts, raceResults, workoutFitnessSignals } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { resolveAuthRoleFromGetter, isPrivilegedRole } from '@/lib/auth-access';

export const maxDuration = 120;

// ── Helpers ──────────────────────────────────────────────────────────────

function formatPace(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds >= 1800) return '';
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  return minutes.toFixed(1);
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(',');
}

// ── Workout export columns ──────────────────────────────────────────────

const WORKOUT_CSV_HEADERS = [
  'Date',
  'Strava Name',
  'Workout Type',
  'Distance (mi)',
  'Duration (min)',
  'Avg Pace',
  'Avg HR',
  'Max HR',
  'Elevation Gain (ft)',
  'Temp (F)',
  'Humidity (%)',
  'Feels Like (F)',
  'Wind (mph)',
  'Weather',
  'TRIMP',
  'Training Load',
  'Quality Ratio',
  'Effective VO2max',
  'Efficiency Factor',
  'Weather-Adj Pace',
  'Elevation-Adj Pace',
  'Best Segment VDOT',
  'Cadence',
  'Max Speed (mph)',
  'Kudos',
  'Source',
  'Notes',
];

interface WorkoutRow {
  id: number;
  date: string;
  stravaName: string | null;
  workoutType: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainFt: number | null;
  weatherTempF: number | null;
  weatherHumidityPct: number | null;
  weatherFeelsLikeF: number | null;
  weatherWindMph: number | null;
  weatherConditions: string | null;
  trimp: number | null;
  trainingLoad: number | null;
  qualityRatio: number | null;
  stravaSufferScore: number | null;
  stravaAverageCadence: number | null;
  stravaMaxSpeed: number | null;
  stravaKudosCount: number | null;
  source: string;
  notes: string | null;
  // From fitness signals join
  effectiveVo2max?: number | null;
  efficiencyFactor?: number | null;
  weatherAdjustedPace?: number | null;
  elevationAdjustedPace?: number | null;
  bestSegmentVdot?: number | null;
}

function workoutToCSVRow(w: WorkoutRow): string {
  return csvRow([
    w.date,
    w.stravaName,
    w.workoutType,
    w.distanceMiles != null ? w.distanceMiles.toFixed(2) : '',
    formatDuration(w.durationMinutes),
    formatPace(w.avgPaceSeconds),
    w.avgHr,
    w.maxHr,
    w.elevationGainFt != null ? Math.round(w.elevationGainFt) : '',
    w.weatherTempF,
    w.weatherHumidityPct,
    w.weatherFeelsLikeF,
    w.weatherWindMph,
    w.weatherConditions,
    w.trimp != null ? w.trimp.toFixed(1) : '',
    w.trainingLoad,
    w.qualityRatio != null ? w.qualityRatio.toFixed(2) : '',
    w.effectiveVo2max != null ? w.effectiveVo2max.toFixed(1) : '',
    w.efficiencyFactor != null ? w.efficiencyFactor.toFixed(3) : '',
    formatPace(w.weatherAdjustedPace),
    formatPace(w.elevationAdjustedPace),
    w.bestSegmentVdot != null ? w.bestSegmentVdot.toFixed(1) : '',
    w.stravaAverageCadence != null ? w.stravaAverageCadence.toFixed(0) : '',
    w.stravaMaxSpeed != null ? w.stravaMaxSpeed.toFixed(1) : '',
    w.stravaKudosCount,
    w.source,
    w.notes,
  ]);
}

function workoutToJSON(w: WorkoutRow) {
  return {
    date: w.date,
    stravaName: w.stravaName,
    workoutType: w.workoutType,
    distanceMiles: w.distanceMiles,
    durationMinutes: w.durationMinutes,
    avgPace: formatPace(w.avgPaceSeconds),
    avgPaceSeconds: w.avgPaceSeconds,
    avgHr: w.avgHr,
    maxHr: w.maxHr,
    elevationGainFt: w.elevationGainFt,
    weatherTempF: w.weatherTempF,
    weatherHumidityPct: w.weatherHumidityPct,
    weatherFeelsLikeF: w.weatherFeelsLikeF,
    weatherWindMph: w.weatherWindMph,
    weatherConditions: w.weatherConditions,
    trimp: w.trimp,
    trainingLoad: w.trainingLoad,
    qualityRatio: w.qualityRatio,
    effectiveVo2max: w.effectiveVo2max ?? null,
    efficiencyFactor: w.efficiencyFactor ?? null,
    weatherAdjustedPace: w.weatherAdjustedPace ?? null,
    elevationAdjustedPace: w.elevationAdjustedPace ?? null,
    bestSegmentVdot: w.bestSegmentVdot ?? null,
    cadence: w.stravaAverageCadence,
    maxSpeedMph: w.stravaMaxSpeed,
    kudos: w.stravaKudosCount,
    source: w.source,
    notes: w.notes,
  };
}

// ── Race result export columns ──────────────────────────────────────────

const RACE_CSV_HEADERS = [
  'Date',
  'Race Name',
  'Distance',
  'Distance (m)',
  'Finish Time',
  'Finish Time (sec)',
  'VDOT',
  'Effort Level',
  'Conditions',
  'Notes',
];

interface RaceRow {
  date: string;
  raceName: string | null;
  distanceLabel: string;
  distanceMeters: number;
  finishTimeSeconds: number;
  calculatedVdot: number | null;
  effortLevel: string | null;
  conditions: string | null;
  notes: string | null;
}

function raceToCSVRow(r: RaceRow): string {
  return csvRow([
    r.date,
    r.raceName,
    r.distanceLabel,
    r.distanceMeters,
    formatTime(r.finishTimeSeconds),
    r.finishTimeSeconds,
    r.calculatedVdot != null ? r.calculatedVdot.toFixed(1) : '',
    r.effortLevel,
    r.conditions,
    r.notes,
  ]);
}

function raceToJSON(r: RaceRow) {
  return {
    date: r.date,
    raceName: r.raceName,
    distanceLabel: r.distanceLabel,
    distanceMeters: r.distanceMeters,
    finishTime: formatTime(r.finishTimeSeconds),
    finishTimeSeconds: r.finishTimeSeconds,
    calculatedVdot: r.calculatedVdot,
    effortLevel: r.effortLevel,
    conditions: r.conditions,
    notes: r.notes,
  };
}

// ── Data fetchers ────────────────────────────────────────────────────────

async function fetchWorkouts(profileId?: number): Promise<WorkoutRow[]> {
  const conditions = profileId != null ? eq(workouts.profileId, profileId) : undefined;

  const rows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      stravaName: workouts.stravaName,
      workoutType: workouts.workoutType,
      distanceMiles: workouts.distanceMiles,
      durationMinutes: workouts.durationMinutes,
      avgPaceSeconds: workouts.avgPaceSeconds,
      avgHr: workouts.avgHr,
      maxHr: workouts.maxHr,
      elevationGainFt: workouts.elevationGainFt,
      weatherTempF: workouts.weatherTempF,
      weatherHumidityPct: workouts.weatherHumidityPct,
      weatherFeelsLikeF: workouts.weatherFeelsLikeF,
      weatherWindMph: workouts.weatherWindMph,
      weatherConditions: workouts.weatherConditions,
      trimp: workouts.trimp,
      trainingLoad: workouts.trainingLoad,
      qualityRatio: workouts.qualityRatio,
      stravaSufferScore: workouts.stravaSufferScore,
      stravaAverageCadence: workouts.stravaAverageCadence,
      stravaMaxSpeed: workouts.stravaMaxSpeed,
      stravaKudosCount: workouts.stravaKudosCount,
      source: workouts.source,
      notes: workouts.notes,
      // Fitness signals (left join)
      effectiveVo2max: workoutFitnessSignals.effectiveVo2max,
      efficiencyFactor: workoutFitnessSignals.efficiencyFactor,
      weatherAdjustedPace: workoutFitnessSignals.weatherAdjustedPace,
      elevationAdjustedPace: workoutFitnessSignals.elevationAdjustedPace,
      bestSegmentVdot: workoutFitnessSignals.bestSegmentVdot,
    })
    .from(workouts)
    .leftJoin(workoutFitnessSignals, eq(workouts.id, workoutFitnessSignals.workoutId))
    .where(conditions)
    .orderBy(desc(workouts.date));

  return rows;
}

async function fetchRaces(profileId?: number): Promise<RaceRow[]> {
  const conditions = profileId != null ? eq(raceResults.profileId, profileId) : undefined;

  const rows = await db
    .select({
      date: raceResults.date,
      raceName: raceResults.raceName,
      distanceLabel: raceResults.distanceLabel,
      distanceMeters: raceResults.distanceMeters,
      finishTimeSeconds: raceResults.finishTimeSeconds,
      calculatedVdot: raceResults.calculatedVdot,
      effortLevel: raceResults.effortLevel,
      conditions: raceResults.conditions,
      notes: raceResults.notes,
    })
    .from(raceResults)
    .where(conditions)
    .orderBy(desc(raceResults.date));

  return rows;
}

// ── Route handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth: accept x-admin-secret header (for curl/external) OR cookie-based admin/user auth (for UI)
  const secret = request.headers.get('x-admin-secret');
  const hasAdminSecret = secret && secret === process.env.ADMIN_SECRET;

  let hasCookieAuth = false;
  if (!hasAdminSecret) {
    const role = resolveAuthRoleFromGetter((name) => request.cookies.get(name)?.value);
    hasCookieAuth = isPrivilegedRole(role);
  }

  if (!hasAdminSecret && !hasCookieAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format') || 'json';
  const type = searchParams.get('type') || 'all';
  const profileIdParam = searchParams.get('profileId');
  const profileId = profileIdParam ? parseInt(profileIdParam, 10) : undefined;

  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use csv or json.' }, { status: 400 });
  }
  if (!['workouts', 'races', 'all'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Use workouts, races, or all.' }, { status: 400 });
  }

  const now = new Date().toISOString().slice(0, 10);

  // ── JSON format ──

  if (format === 'json') {
    if (type === 'workouts') {
      const data = await fetchWorkouts(profileId);
      return NextResponse.json(
        { exportedAt: new Date().toISOString(), count: data.length, workouts: data.map(workoutToJSON) },
        {
          headers: {
            'Content-Disposition': `attachment; filename="dreamy-workouts-${now}.json"`,
          },
        }
      );
    }

    if (type === 'races') {
      const data = await fetchRaces(profileId);
      return NextResponse.json(
        { exportedAt: new Date().toISOString(), count: data.length, raceResults: data.map(raceToJSON) },
        {
          headers: {
            'Content-Disposition': `attachment; filename="dreamy-races-${now}.json"`,
          },
        }
      );
    }

    // type === 'all'
    const [workoutData, raceData] = await Promise.all([
      fetchWorkouts(profileId),
      fetchRaces(profileId),
    ]);
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        workouts: { count: workoutData.length, data: workoutData.map(workoutToJSON) },
        raceResults: { count: raceData.length, data: raceData.map(raceToJSON) },
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="dreamy-export-${now}.json"`,
        },
      }
    );
  }

  // ── CSV format ──

  if (type === 'workouts' || type === 'all') {
    const data = await fetchWorkouts(profileId);
    const lines = [WORKOUT_CSV_HEADERS.join(',')];
    for (const w of data) {
      lines.push(workoutToCSVRow(w));
    }

    if (type === 'all') {
      // Append race results section after a blank separator
      const raceData = await fetchRaces(profileId);
      lines.push('');
      lines.push('--- Race Results ---');
      lines.push(RACE_CSV_HEADERS.join(','));
      for (const r of raceData) {
        lines.push(raceToCSVRow(r));
      }
    }

    const csv = lines.join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dreamy-${type === 'all' ? 'export' : 'workouts'}-${now}.csv"`,
      },
    });
  }

  // type === 'races' with CSV
  const raceData = await fetchRaces(profileId);
  const lines = [RACE_CSV_HEADERS.join(',')];
  for (const r of raceData) {
    lines.push(raceToCSVRow(r));
  }
  const csv = lines.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dreamy-races-${now}.csv"`,
    },
  });
}
