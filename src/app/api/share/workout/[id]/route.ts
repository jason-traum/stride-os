import { NextRequest, NextResponse } from 'next/server';
import { db, workouts, workoutSegments } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// Public endpoint — no auth needed
export const dynamic = 'force-dynamic';

// ── Formatting helpers (self-contained, no external deps) ──────────────

function formatPace(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return '--:--';
  if (totalSeconds >= 1800) return '-';
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDistance(miles: number | null | undefined): string {
  if (!miles) return '0.0';
  return miles.toFixed(2);
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.round((minutes % 1) * 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (secs > 0) return `${mins}m ${secs}s`;
  return `${mins}m`;
}

function formatDateLong(dateString: string): string {
  // Append noon to avoid timezone shift on date-only strings
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(dateString + 'T12:00:00')
    : new Date(dateString);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getWorkoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    recovery: 'Recovery',
    easy: 'Easy',
    steady: 'Steady',
    marathon: 'Marathon Pace',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Interval',
    repetition: 'Repetition',
    long: 'Long Run',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

function getWorkoutTypeAccent(type: string): string {
  const colors: Record<string, string> = {
    recovery: '#94a3b8',
    easy: '#38bdf8',
    steady: '#38bdf8',
    marathon: '#60a5fa',
    tempo: '#818cf8',
    threshold: '#a78bfa',
    interval: '#f87171',
    repetition: '#fb7185',
    long: '#2dd4bf',
    race: '#fbbf24',
    cross_train: '#a78bfa',
    other: '#a8a29e',
  };
  return colors[type] || '#a78bfa';
}

function getWeatherIcon(conditions: string | null): string {
  if (!conditions) return '';
  const icons: Record<string, string> = {
    clear: '&#9728;&#65039;',
    cloudy: '&#9729;&#65039;',
    fog: '&#127787;&#65039;',
    drizzle: '&#127782;&#65039;',
    rain: '&#127783;&#65039;',
    snow: '&#127784;&#65039;',
    thunderstorm: '&#9928;&#65039;',
  };
  return icons[conditions] || '';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── VDOT calculation (simplified Daniels formula) ─────────────────────

function calculateVDOT(distanceMeters: number, timeSeconds: number): number | null {
  if (distanceMeters < 1500 || timeSeconds <= 0) return null;
  const velocity = distanceMeters / timeSeconds; // m/s
  const timeMinutes = timeSeconds / 60;
  // VO2 cost of running (ml/kg/min)
  const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  const vo2 = -4.60 + 0.182258 * velocity * 60
    + 0.000104 * Math.pow(velocity * 60, 2);
  const vdot = vo2 / percentVO2max;
  if (vdot < 15 || vdot > 85) return null;
  return Math.round(vdot * 10) / 10;
}

// ── Route handler ─────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workoutId = parseInt(id, 10);
  if (isNaN(workoutId)) {
    return NextResponse.json({ error: 'Invalid workout ID' }, { status: 400 });
  }

  // Fetch workout with related data
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
    with: {
      shoe: true,
      assessment: true,
    },
  });

  if (!workout) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Fetch splits for the mini chart
  let splits: Array<{
    segmentNumber: number;
    paceSecondsPerMile: number | null;
    distanceMiles: number | null;
  }> = [];
  try {
    splits = await db.query.workoutSegments.findMany({
      where: eq(workoutSegments.workoutId, workoutId),
      orderBy: (seg: { segmentNumber: any }, { asc }: { asc: (col: any) => any }) => [asc(seg.segmentNumber)],
      columns: {
        segmentNumber: true,
        paceSecondsPerMile: true,
        distanceMiles: true,
      },
    });
  } catch {
    // Splits not available
  }

  // Compute derived values
  const avgHr = workout.avgHeartRate || workout.avgHr;
  const elevation = workout.elevationGainFeet || workout.elevationGainFt;
  const accentColor = getWorkoutTypeAccent(workout.workoutType);
  const typeLabel = getWorkoutTypeLabel(workout.workoutType);
  const displayName = workout.stravaName || typeLabel;

  // VDOT for races
  let vdot: number | null = null;
  if (workout.workoutType === 'race' && workout.distanceMiles && workout.durationMinutes) {
    const distMeters = workout.distanceMiles * 1609.34;
    const timeSec = workout.durationMinutes * 60;
    vdot = calculateVDOT(distMeters, timeSec);
  }

  const html = buildShareCardHtml({
    workout,
    splits,
    avgHr,
    elevation,
    accentColor,
    typeLabel,
    displayName,
    vdot,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

// ── HTML builder ──────────────────────────────────────────────────────

interface ShareCardData {
  workout: any;
  splits: Array<{ segmentNumber: number; paceSecondsPerMile: number | null; distanceMiles: number | null }>;
  avgHr: number | null | undefined;
  elevation: number | null | undefined;
  accentColor: string;
  typeLabel: string;
  displayName: string;
  vdot: number | null;
}

function buildShareCardHtml(data: ShareCardData): string {
  const { workout, splits, avgHr, elevation, accentColor, typeLabel, displayName, vdot } = data;

  const dateStr = formatDateLong(workout.date);
  const distance = formatDistance(workout.distanceMiles);
  const duration = formatDuration(workout.durationMinutes);
  const pace = formatPace(workout.avgPaceSeconds);

  // Build mini split chart bars
  const splitBars = buildSplitChart(splits, accentColor);

  // Weather section
  const weatherHtml = buildWeatherSection(workout);

  // Stat pills
  const statPills: string[] = [];
  if (workout.distanceMiles) {
    statPills.push(`<div class="stat"><div class="stat-value">${escapeHtml(distance)}</div><div class="stat-label">miles</div></div>`);
  }
  if (workout.durationMinutes) {
    statPills.push(`<div class="stat"><div class="stat-value">${escapeHtml(duration)}</div><div class="stat-label">time</div></div>`);
  }
  if (workout.avgPaceSeconds && workout.avgPaceSeconds < 1800) {
    statPills.push(`<div class="stat"><div class="stat-value">${escapeHtml(pace)}</div><div class="stat-label">/mile</div></div>`);
  }
  if (avgHr) {
    statPills.push(`<div class="stat"><div class="stat-value">${avgHr}</div><div class="stat-label">avg hr</div></div>`);
  }
  if (elevation && elevation > 0) {
    statPills.push(`<div class="stat"><div class="stat-value">${Math.round(elevation)}</div><div class="stat-label">ft elev</div></div>`);
  }
  if (vdot) {
    statPills.push(`<div class="stat"><div class="stat-value">${vdot.toFixed(1)}</div><div class="stat-label">VDOT</div></div>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(displayName)} — ${escapeHtml(dateStr)} | Dreamy</title>
<meta property="og:title" content="${escapeHtml(displayName)} — ${escapeHtml(dateStr)}">
<meta property="og:description" content="${escapeHtml(distance)} mi | ${escapeHtml(pace)}/mi | ${escapeHtml(duration)}">
<meta property="og:site_name" content="Dreamy">
<meta name="twitter:card" content="summary">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  background:#0a0a0f;
  color:#ededf2;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:100vh;
  padding:24px;
}

/* Card container — 600×400 link-preview size by default, scales for IG */
.card{
  width:600px;
  min-height:400px;
  background:#141420;
  border:1px solid #42425a;
  border-radius:20px;
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
}

/* Accent gradient stripe at top */
.accent-bar{
  height:4px;
  background:linear-gradient(90deg, ${accentColor}, ${accentColor}88, transparent);
}

/* Content area */
.content{
  flex:1;
  padding:28px 32px 20px;
  display:flex;
  flex-direction:column;
  gap:20px;
}

/* Header */
.header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
}
.workout-name{
  font-size:22px;
  font-weight:700;
  letter-spacing:-0.02em;
  color:#ededf2;
  line-height:1.2;
}
.workout-date{
  font-size:13px;
  color:#8888a0;
  margin-top:4px;
}
.type-badge{
  display:inline-block;
  padding:4px 12px;
  border-radius:6px;
  font-size:12px;
  font-weight:600;
  letter-spacing:0.02em;
  text-transform:uppercase;
  color:${accentColor};
  background:${accentColor}18;
  border:1px solid ${accentColor}30;
  white-space:nowrap;
}

/* Stats row */
.stats-row{
  display:flex;
  gap:0;
  background:#0a0a0f;
  border-radius:12px;
  overflow:hidden;
}
.stat{
  flex:1;
  text-align:center;
  padding:14px 8px;
  border-right:1px solid #333345;
}
.stat:last-child{border-right:none}
.stat-value{
  font-size:22px;
  font-weight:700;
  letter-spacing:-0.02em;
  color:#ededf2;
}
.stat-label{
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:#8888a0;
  margin-top:2px;
}

/* Split chart */
.splits{
  flex:1;
  display:flex;
  flex-direction:column;
  gap:4px;
}
.splits-title{
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:#8888a0;
  margin-bottom:2px;
}
.split-bars{
  display:flex;
  align-items:flex-end;
  gap:3px;
  height:60px;
}
.split-bar{
  flex:1;
  border-radius:3px 3px 0 0;
  min-width:4px;
  transition:opacity 0.2s;
}

/* Weather */
.weather{
  display:flex;
  align-items:center;
  gap:12px;
  font-size:13px;
  color:#b8b8c8;
}
.weather-item{
  display:flex;
  align-items:center;
  gap:4px;
}

/* Footer / branding */
.footer{
  padding:12px 32px;
  border-top:1px solid #333345;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.brand{
  font-size:14px;
  font-weight:700;
  letter-spacing:-0.01em;
  background:linear-gradient(135deg, #a78bfa, #f0a06c);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
}
.brand-sub{
  font-size:11px;
  color:#8888a0;
}
.brand-url{
  font-size:11px;
  color:#8888a0;
  letter-spacing:0.02em;
}

/* Verdict dot */
.verdict{
  display:inline-block;
  width:8px;
  height:8px;
  border-radius:50%;
  margin-right:6px;
  vertical-align:middle;
}
.verdict-great{background:#4ade80}
.verdict-good{background:#22c55e}
.verdict-fine{background:#fbbf24}
.verdict-rough{background:#f97316}
.verdict-awful{background:#ef4444}

/* VDOT highlight */
.vdot-highlight{
  display:flex;
  align-items:center;
  gap:8px;
  background:linear-gradient(135deg, ${accentColor}15, #141420);
  border:1px solid ${accentColor}30;
  border-radius:10px;
  padding:10px 16px;
}
.vdot-value{
  font-size:28px;
  font-weight:800;
  letter-spacing:-0.03em;
  color:${accentColor};
}
.vdot-label{
  font-size:11px;
  color:#8888a0;
  text-transform:uppercase;
  letter-spacing:0.06em;
}

/* Responsive: IG square format */
@media (min-width:1080px){
  .card{width:1080px;min-height:1080px}
  .content{padding:48px 56px 32px;gap:32px}
  .workout-name{font-size:36px}
  .workout-date{font-size:16px}
  .type-badge{font-size:14px;padding:6px 16px}
  .stat-value{font-size:36px}
  .stat-label{font-size:12px}
  .stat{padding:20px 12px}
  .split-bars{height:100px}
  .footer{padding:20px 56px}
  .brand{font-size:18px}
}
</style>
</head>
<body>
<div class="card">
  <div class="accent-bar"></div>
  <div class="content">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="workout-name">
          ${workout.assessment ? `<span class="verdict verdict-${escapeHtml(workout.assessment.verdict)}"></span>` : ''}${escapeHtml(displayName)}
        </div>
        <div class="workout-date">${escapeHtml(dateStr)}</div>
      </div>
      <div class="type-badge">${escapeHtml(typeLabel)}</div>
    </div>

    <!-- Primary stats -->
    <div class="stats-row">
      ${statPills.join('\n      ')}
    </div>

    ${vdot ? `
    <!-- VDOT highlight for races -->
    <div class="vdot-highlight">
      <div>
        <div class="vdot-value">${vdot.toFixed(1)}</div>
        <div class="vdot-label">VDOT Equivalent</div>
      </div>
    </div>
    ` : ''}

    ${splitBars ? `
    <!-- Split chart -->
    <div class="splits">
      <div class="splits-title">Pace by Split</div>
      <div class="split-bars">
        ${splitBars}
      </div>
    </div>
    ` : ''}

    ${weatherHtml ? `
    <!-- Weather conditions -->
    <div class="weather">
      ${weatherHtml}
    </div>
    ` : ''}
  </div>

  <!-- Branding footer -->
  <div class="footer">
    <div>
      <div class="brand">dreamy</div>
      <div class="brand-sub">AI running coach</div>
    </div>
    <div class="brand-url">getdreamy.run</div>
  </div>
</div>
</body>
</html>`;
}

// ── Split chart builder ───────────────────────────────────────────────

function buildSplitChart(
  splits: Array<{ segmentNumber: number; paceSecondsPerMile: number | null; distanceMiles: number | null }>,
  accentColor: string,
): string {
  // Filter to valid pace splits
  const valid = splits.filter(s => s.paceSecondsPerMile && s.paceSecondsPerMile > 0 && s.paceSecondsPerMile < 1800);
  if (valid.length < 2) return '';

  const paces = valid.map(s => s.paceSecondsPerMile!);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const range = slowest - fastest || 1;

  // Build bars — taller = faster, color intensity = faster
  return valid.map(s => {
    const p = s.paceSecondsPerMile!;
    // Height: faster pace → taller bar (inverted)
    const normalized = 1 - (p - fastest) / range;
    const heightPct = 20 + normalized * 80; // 20%–100%
    // Opacity: faster = more vibrant
    const opacity = 0.4 + normalized * 0.6;
    return `<div class="split-bar" style="height:${heightPct.toFixed(0)}%;background:${accentColor};opacity:${opacity.toFixed(2)}" title="Mile ${s.segmentNumber}: ${formatPace(p)}/mi"></div>`;
  }).join('\n        ');
}

// ── Weather section builder ───────────────────────────────────────────

function buildWeatherSection(workout: any): string {
  if (workout.weatherTempF == null) return '';

  const parts: string[] = [];
  const icon = getWeatherIcon(workout.weatherConditions);
  if (icon) {
    parts.push(`<span class="weather-item">${icon}</span>`);
  }
  parts.push(`<span class="weather-item">${workout.weatherTempF}&deg;F</span>`);
  if (workout.weatherFeelsLikeF != null && workout.weatherFeelsLikeF !== workout.weatherTempF) {
    parts.push(`<span class="weather-item" style="color:#8888a0">(feels ${workout.weatherFeelsLikeF}&deg;)</span>`);
  }
  if (workout.weatherHumidityPct != null) {
    parts.push(`<span class="weather-item">${workout.weatherHumidityPct}% humidity</span>`);
  }
  if (workout.weatherWindMph != null) {
    parts.push(`<span class="weather-item">${workout.weatherWindMph} mph wind</span>`);
  }
  return parts.join('\n      ');
}

// ── 404 page ──────────────────────────────────────────────────────────

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Workout not found | Dreamy</title>
<style>
body{background:#0a0a0f;color:#ededf2;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.msg{text-align:center}
h1{font-size:24px;margin-bottom:8px}
p{color:#8888a0;font-size:14px}
a{color:#a78bfa;text-decoration:none}
</style>
</head>
<body>
<div class="msg">
  <h1>Workout not found</h1>
  <p>This workout may have been deleted or the link is incorrect.</p>
  <p style="margin-top:16px"><a href="https://getdreamy.run">getdreamy.run</a></p>
</div>
</body>
</html>`;
}
