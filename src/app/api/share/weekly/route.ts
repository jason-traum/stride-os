import { NextRequest, NextResponse } from 'next/server';
import { db, workouts } from '@/lib/db';
import { desc, gte, lte, eq, and } from 'drizzle-orm';
import { getFitnessTrendData } from '@/actions/fitness';
import type { Workout } from '@/lib/schema';
import { validateShareToken } from '@/lib/share-tokens';

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
  return miles.toFixed(1);
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// ── Date helpers ──────────────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getSunday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  const monMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const sunMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
  const monDay = monday.getDate();
  const sunDay = sunday.getDate();

  if (monMonth === sunMonth) {
    return `${monMonth} ${monDay}-${sunDay}`;
  }
  return `${monMonth} ${monDay} - ${sunMonth} ${sunDay}`;
}

// ── Route handler ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileIdStr = searchParams.get('profileId');

  if (!profileIdStr) {
    return new NextResponse(errorHtml('Missing profileId parameter'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const profileId = parseInt(profileIdStr, 10);
  if (isNaN(profileId)) {
    return new NextResponse(errorHtml('Invalid profileId'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Validate share token
  const token = searchParams.get('token');
  if (!token || !validateShareToken('weekly', profileId, token, profileId)) {
    return new NextResponse(errorHtml('Invalid or missing share token'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(monday);
  const mondayStr = toLocalDateString(monday);
  const sundayStr = toLocalDateString(sunday);

  // Fetch all workouts for the current week
  const weekWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        gte(workouts.date, mondayStr),
        lte(workouts.date, sundayStr)
      )
    )
    .orderBy(desc(workouts.date));

  if (weekWorkouts.length === 0) {
    return new NextResponse(emptyWeekHtml(formatWeekLabel(monday, sunday)), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Aggregate stats
  const totalMiles = weekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalRuns = weekWorkouts.length;
  const totalDurationMinutes = weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  const withPace = weekWorkouts.filter(w => w.avgPaceSeconds && w.avgPaceSeconds > 0 && w.avgPaceSeconds < 1800);
  const avgPaceSeconds = withPace.length > 0
    ? Math.round(withPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / withPace.length)
    : null;

  // Key workout: highest TRIMP, then longest distance, then fastest pace
  let keyWorkout: Workout | null = null;
  const sorted = [...weekWorkouts].sort((a, b) => {
    const trimpA = a.intervalAdjustedTrimp || a.trimp || 0;
    const trimpB = b.intervalAdjustedTrimp || b.trimp || 0;
    if (trimpB !== trimpA) return trimpB - trimpA;
    const distA = a.distanceMiles || 0;
    const distB = b.distanceMiles || 0;
    if (distB !== distA) return distB - distA;
    const paceA = a.avgPaceSeconds || 9999;
    const paceB = b.avgPaceSeconds || 9999;
    return paceA - paceB;
  });
  keyWorkout = sorted[0];

  // Fitness trend
  let fitnessTrend: 'up' | 'down' | 'stable' = 'stable';
  let ctlChange: number | null = null;
  let ctlEnd: number | null = null;

  try {
    const fitnessNow = await getFitnessTrendData(14, profileId);
    const fitnessWeekStart = await getFitnessTrendData(14, profileId, monday);

    if (fitnessNow.metrics.length > 0 && fitnessWeekStart.metrics.length > 0) {
      ctlEnd = Math.round(fitnessNow.currentCtl * 10) / 10;
      const ctlStart = Math.round(fitnessWeekStart.currentCtl * 10) / 10;
      ctlChange = Math.round((ctlEnd - ctlStart) * 10) / 10;

      if (ctlChange > 1) {
        fitnessTrend = 'up';
      } else if (ctlChange < -1) {
        fitnessTrend = 'down';
      }
    }
  } catch {
    // Fitness data not available
  }

  // Build the daily activity bar chart (Mon-Sun)
  const dailyMiles: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dStr = toLocalDateString(d);
    const dayMiles = weekWorkouts
      .filter(w => w.date === dStr)
      .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
    dailyMiles.push(dayMiles);
  }

  const weekLabel = formatWeekLabel(monday, sunday);

  const html = buildWeeklyCardHtml({
    weekLabel,
    totalMiles,
    totalRuns,
    totalDurationMinutes,
    avgPaceSeconds,
    keyWorkout,
    fitnessTrend,
    ctlChange,
    ctlEnd,
    dailyMiles,
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

interface WeeklyCardData {
  weekLabel: string;
  totalMiles: number;
  totalRuns: number;
  totalDurationMinutes: number;
  avgPaceSeconds: number | null;
  keyWorkout: Workout | null;
  fitnessTrend: 'up' | 'down' | 'stable';
  ctlChange: number | null;
  ctlEnd: number | null;
  dailyMiles: number[];
}

function buildWeeklyCardHtml(data: WeeklyCardData): string {
  const {
    weekLabel,
    totalMiles,
    totalRuns,
    totalDurationMinutes,
    avgPaceSeconds,
    keyWorkout,
    fitnessTrend,
    ctlChange,
    ctlEnd,
    dailyMiles,
  } = data;

  // Key workout section
  const keyWorkoutAccent = keyWorkout ? getWorkoutTypeAccent(keyWorkout.workoutType) : '#a78bfa';
  const keyWorkoutLabel = keyWorkout ? getWorkoutTypeLabel(keyWorkout.workoutType) : '';
  const keyWorkoutName = keyWorkout?.stravaName || keyWorkoutLabel;

  // Fitness trend arrow and label
  const trendArrow = fitnessTrend === 'up' ? '&#9650;' : fitnessTrend === 'down' ? '&#9660;' : '&#9644;';
  const trendColor = fitnessTrend === 'up' ? '#4ade80' : fitnessTrend === 'down' ? '#f87171' : '#94a3b8';
  const trendLabel = fitnessTrend === 'up' ? 'Fitness Rising' : fitnessTrend === 'down' ? 'Fitness Declining' : 'Fitness Stable';

  // Daily bars
  const maxMiles = Math.max(...dailyMiles, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const barsHtml = dailyMiles.map((miles, i) => {
    const heightPct = maxMiles > 0 ? (miles / maxMiles) * 100 : 0;
    const opacity = miles > 0 ? 0.5 + (miles / maxMiles) * 0.5 : 0.15;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:100%;height:80px;display:flex;align-items:flex-end;justify-content:center;">
        <div style="width:70%;border-radius:4px 4px 0 0;background:#a78bfa;opacity:${opacity.toFixed(2)};height:${Math.max(heightPct, 4).toFixed(0)}%;" title="${miles.toFixed(1)} mi"></div>
      </div>
      <span style="font-size:10px;color:#8888a0;letter-spacing:0.04em;">${dayLabels[i]}</span>
    </div>`;
  }).join('\n          ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Week of ${escapeHtml(weekLabel)} | Dreamy</title>
<meta property="og:title" content="Week of ${escapeHtml(weekLabel)} | Dreamy">
<meta property="og:description" content="${escapeHtml(formatDistance(totalMiles))} mi | ${totalRuns} run${totalRuns !== 1 ? 's' : ''} | ${escapeHtml(formatDuration(totalDurationMinutes))}">
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

.accent-bar{
  height:4px;
  background:linear-gradient(90deg, #a78bfa, #f0a06c, transparent);
}

.content{
  flex:1;
  padding:28px 32px 20px;
  display:flex;
  flex-direction:column;
  gap:20px;
}

.header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
}
.week-title{
  font-size:22px;
  font-weight:700;
  letter-spacing:-0.02em;
  color:#ededf2;
  line-height:1.2;
}
.week-subtitle{
  font-size:13px;
  color:#8888a0;
  margin-top:4px;
}
.trend-badge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:6px 14px;
  border-radius:8px;
  font-size:12px;
  font-weight:600;
  letter-spacing:0.02em;
  white-space:nowrap;
}

/* Big number hero */
.hero{
  text-align:center;
  padding:8px 0;
}
.hero-value{
  font-size:56px;
  font-weight:800;
  letter-spacing:-0.04em;
  background:linear-gradient(135deg, #a78bfa, #f0a06c);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
  line-height:1;
}
.hero-label{
  font-size:14px;
  text-transform:uppercase;
  letter-spacing:0.1em;
  color:#8888a0;
  margin-top:4px;
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

/* Daily chart */
.daily-chart{
  display:flex;
  gap:4px;
  padding:0 4px;
}

/* Key workout */
.key-workout{
  display:flex;
  align-items:center;
  gap:12px;
  background:#0a0a0f;
  border-radius:12px;
  padding:12px 16px;
  border:1px solid #333345;
}
.key-workout-badge{
  display:inline-block;
  padding:4px 10px;
  border-radius:6px;
  font-size:11px;
  font-weight:600;
  letter-spacing:0.02em;
  text-transform:uppercase;
  white-space:nowrap;
}
.key-workout-info{
  flex:1;
  min-width:0;
}
.key-workout-name{
  font-size:14px;
  font-weight:600;
  color:#ededf2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.key-workout-stats{
  font-size:12px;
  color:#8888a0;
  margin-top:2px;
}
.key-workout-label{
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:#8888a0;
  margin-bottom:6px;
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

/* Responsive: IG square format */
@media (min-width:1080px){
  .card{width:1080px;min-height:1080px}
  .content{padding:48px 56px 32px;gap:36px}
  .week-title{font-size:36px}
  .week-subtitle{font-size:16px}
  .trend-badge{font-size:14px;padding:8px 18px}
  .hero-value{font-size:96px}
  .hero-label{font-size:18px}
  .stat-value{font-size:36px}
  .stat-label{font-size:12px}
  .stat{padding:20px 12px}
  .daily-chart div div:first-child{height:120px !important}
  .key-workout{padding:16px 20px}
  .key-workout-name{font-size:18px}
  .key-workout-stats{font-size:14px}
  .key-workout-badge{font-size:13px;padding:5px 12px}
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
        <div class="week-title">Week of ${escapeHtml(weekLabel)}</div>
        <div class="week-subtitle">${totalRuns} run${totalRuns !== 1 ? 's' : ''} this week</div>
      </div>
      <div class="trend-badge" style="color:${trendColor};background:${trendColor}18;border:1px solid ${trendColor}30;">
        <span style="font-size:14px;">${trendArrow}</span>
        ${escapeHtml(trendLabel)}${ctlChange !== null ? ` (${ctlChange > 0 ? '+' : ''}${ctlChange.toFixed(1)})` : ''}
      </div>
    </div>

    <!-- Hero: total miles -->
    <div class="hero">
      <div class="hero-value">${formatDistance(totalMiles)}</div>
      <div class="hero-label">Total Miles</div>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat">
        <div class="stat-value">${totalRuns}</div>
        <div class="stat-label">runs</div>
      </div>
      <div class="stat">
        <div class="stat-value">${escapeHtml(formatDuration(totalDurationMinutes))}</div>
        <div class="stat-label">total time</div>
      </div>
      <div class="stat">
        <div class="stat-value">${escapeHtml(formatPace(avgPaceSeconds))}</div>
        <div class="stat-label">avg pace</div>
      </div>
      ${ctlEnd !== null ? `<div class="stat">
        <div class="stat-value" style="color:${trendColor}">${ctlEnd.toFixed(0)}</div>
        <div class="stat-label">fitness (CTL)</div>
      </div>` : ''}
    </div>

    <!-- Daily activity chart -->
    <div class="daily-chart">
      ${barsHtml}
    </div>

    ${keyWorkout ? `
    <!-- Key workout highlight -->
    <div>
      <div class="key-workout-label">&#9733; Key Workout</div>
      <div class="key-workout">
        <div class="key-workout-badge" style="color:${keyWorkoutAccent};background:${keyWorkoutAccent}18;border:1px solid ${keyWorkoutAccent}30;">
          ${escapeHtml(keyWorkoutLabel)}
        </div>
        <div class="key-workout-info">
          <div class="key-workout-name">${escapeHtml(keyWorkoutName)}</div>
          <div class="key-workout-stats">
            ${keyWorkout.distanceMiles ? escapeHtml(formatDistance(keyWorkout.distanceMiles)) + ' mi' : ''}${keyWorkout.distanceMiles && keyWorkout.avgPaceSeconds ? ' &middot; ' : ''}${keyWorkout.avgPaceSeconds && keyWorkout.avgPaceSeconds < 1800 ? escapeHtml(formatPace(keyWorkout.avgPaceSeconds)) + '/mi' : ''}${(keyWorkout.distanceMiles || keyWorkout.avgPaceSeconds) && keyWorkout.durationMinutes ? ' &middot; ' : ''}${keyWorkout.durationMinutes ? escapeHtml(formatDuration(keyWorkout.durationMinutes)) : ''}
          </div>
        </div>
      </div>
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

// ── Empty week page ──────────────────────────────────────────────────

function emptyWeekHtml(weekLabel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Week of ${escapeHtml(weekLabel)} | Dreamy</title>
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
  <h1>Week of ${escapeHtml(weekLabel)}</h1>
  <p>No workouts logged this week yet.</p>
  <p style="margin-top:16px"><a href="https://getdreamy.run">getdreamy.run</a></p>
</div>
</body>
</html>`;
}

// ── Error page ────────────────────────────────────────────────────────

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error | Dreamy</title>
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
  <h1>Oops</h1>
  <p>${escapeHtml(message)}</p>
  <p style="margin-top:16px"><a href="https://getdreamy.run">getdreamy.run</a></p>
</div>
</body>
</html>`;
}
