import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stravaBestEfforts, workouts } from '@/lib/schema';
import { eq, and, asc } from 'drizzle-orm';

export const runtime = 'nodejs';

// Public endpoint — no auth needed
export const dynamic = 'force-dynamic';

// ── Standard distances ────────────────────────────────────────────────

const STANDARD_DISTANCES = [
  { key: '400m', label: '400m', meters: 400, stravaNames: ['400m'] },
  { key: '1K', label: '1K', meters: 1000, stravaNames: ['1k', '1K'] },
  { key: '1mi', label: '1 Mile', meters: 1609.34, stravaNames: ['1 mile'] },
  { key: '5K', label: '5K', meters: 5000, stravaNames: ['5k', '5K'] },
  { key: '10K', label: '10K', meters: 10000, stravaNames: ['10k', '10K'] },
  { key: 'HM', label: 'Half Marathon', meters: 21097, stravaNames: ['Half-Marathon', 'half marathon'] },
  { key: 'Marathon', label: 'Marathon', meters: 42195, stravaNames: ['Marathon', 'marathon'] },
] as const;

const stravaNameToDistance = new Map<string, typeof STANDARD_DISTANCES[number]>();
STANDARD_DISTANCES.forEach(d => {
  d.stravaNames.forEach(n => stravaNameToDistance.set(n.toLowerCase(), d));
});

// ── Formatting helpers (self-contained, no external deps) ──────────────

function formatEffortTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatImprovementTime(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

function formatDateLong(dateString: string): string {
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── VDOT calculation (simplified Daniels formula) ─────────────────────

function calculateVDOT(distanceMeters: number, timeSeconds: number): number | null {
  if (distanceMeters < 400 || timeSeconds <= 0) return null;
  const velocity = distanceMeters / timeSeconds; // m/s
  const timeMinutes = timeSeconds / 60;
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format'); // 'story' for IG 1080x1920
  const effortId = parseInt(id, 10);
  if (isNaN(effortId)) {
    return NextResponse.json({ error: 'Invalid effort ID' }, { status: 400 });
  }

  // Fetch the PR best effort with workout data
  const prEffort = await db
    .select({
      id: stravaBestEfforts.id,
      workoutId: stravaBestEfforts.workoutId,
      name: stravaBestEfforts.name,
      distanceMeters: stravaBestEfforts.distanceMeters,
      movingTimeSeconds: stravaBestEfforts.movingTimeSeconds,
      prRank: stravaBestEfforts.prRank,
      workoutDate: workouts.date,
      workoutName: workouts.stravaName,
      profileId: workouts.profileId,
    })
    .from(stravaBestEfforts)
    .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
    .where(eq(stravaBestEfforts.id, effortId))
    .limit(1);

  if (prEffort.length === 0) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const pr = prEffort[0];
  const dist = stravaNameToDistance.get(pr.name.toLowerCase());
  const distanceLabel = dist?.label ?? pr.name;
  const distanceMeters = dist?.meters ?? pr.distanceMeters;

  // Find the previous best at this distance (before the PR date)
  const allEffortsAtDistance = await db
    .select({
      id: stravaBestEfforts.id,
      movingTimeSeconds: stravaBestEfforts.movingTimeSeconds,
      workoutDate: workouts.date,
    })
    .from(stravaBestEfforts)
    .innerJoin(workouts, eq(stravaBestEfforts.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.profileId, pr.profileId),
        eq(stravaBestEfforts.name, pr.name),
      )
    )
    .orderBy(asc(stravaBestEfforts.movingTimeSeconds));

  // Previous best = fastest effort that occurred before the PR date
  type EffortRow = typeof allEffortsAtDistance[number];
  const previousBest = allEffortsAtDistance.find(
    (e: EffortRow) => e.workoutDate < pr.workoutDate && e.id !== pr.id
  );

  const newVdot = calculateVDOT(distanceMeters, pr.movingTimeSeconds);
  const oldVdot = previousBest
    ? calculateVDOT(distanceMeters, previousBest.movingTimeSeconds)
    : null;

  const improvementSeconds = previousBest
    ? previousBest.movingTimeSeconds - pr.movingTimeSeconds
    : null;
  const improvementPct = previousBest
    ? ((previousBest.movingTimeSeconds - pr.movingTimeSeconds) / previousBest.movingTimeSeconds) * 100
    : null;
  const vdotChange = newVdot !== null && oldVdot !== null
    ? Math.round((newVdot - oldVdot) * 10) / 10
    : null;

  const html = buildPRShareCardHtml({
    distanceLabel,
    newTimeSeconds: pr.movingTimeSeconds,
    oldTimeSeconds: previousBest?.movingTimeSeconds ?? null,
    improvementSeconds,
    improvementPct: improvementPct !== null ? Math.round(improvementPct * 100) / 100 : null,
    newVdot,
    oldVdot,
    vdotChange,
    date: pr.workoutDate,
    workoutName: pr.workoutName,
    format,
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

interface PRShareCardData {
  distanceLabel: string;
  newTimeSeconds: number;
  oldTimeSeconds: number | null;
  improvementSeconds: number | null;
  improvementPct: number | null;
  newVdot: number | null;
  oldVdot: number | null;
  vdotChange: number | null;
  date: string;
  workoutName: string | null;
  format: string | null;
}

function buildPRShareCardHtml(data: PRShareCardData): string {
  const {
    distanceLabel,
    newTimeSeconds,
    oldTimeSeconds,
    improvementSeconds,
    improvementPct,
    newVdot,
    oldVdot,
    vdotChange,
    date,
    workoutName,
    format,
  } = data;

  const cardClass = format === 'story' ? 'card story' : 'card';
  const dateStr = formatDateLong(date);
  const displayName = workoutName || `${distanceLabel} PR`;

  // Build improvement section
  let improvementHtml = '';
  if (oldTimeSeconds !== null && improvementSeconds !== null && improvementPct !== null) {
    improvementHtml = `
    <div class="comparison">
      <div class="comparison-row">
        <div class="time-block new-time">
          <div class="time-value">${escapeHtml(formatEffortTime(newTimeSeconds))}</div>
          <div class="time-label">New PR</div>
        </div>
        <div class="improvement-arrow">
          <div class="improvement-delta">-${escapeHtml(formatImprovementTime(improvementSeconds))}</div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
        </div>
        <div class="time-block old-time">
          <div class="time-value">${escapeHtml(formatEffortTime(oldTimeSeconds))}</div>
          <div class="time-label">Previous</div>
        </div>
      </div>
      <div class="improvement-pct">
        <span class="pct-value">${improvementPct.toFixed(1)}%</span> faster
      </div>
    </div>`;
  } else {
    // First effort at this distance — just show the time prominently
    improvementHtml = `
    <div class="comparison">
      <div class="solo-time">
        <div class="time-value">${escapeHtml(formatEffortTime(newTimeSeconds))}</div>
        <div class="time-label">First recorded effort</div>
      </div>
    </div>`;
  }

  // VDOT section
  let vdotHtml = '';
  if (newVdot !== null) {
    let vdotChangeHtml = '';
    if (vdotChange !== null && vdotChange !== 0) {
      vdotChangeHtml = `<span class="vdot-change ${vdotChange > 0 ? 'positive' : 'negative'}">${vdotChange > 0 ? '+' : ''}${vdotChange.toFixed(1)}</span>`;
    }
    let oldVdotHtml = '';
    if (oldVdot !== null) {
      oldVdotHtml = `<span class="vdot-old">was ${oldVdot.toFixed(1)}</span>`;
    }
    vdotHtml = `
    <div class="vdot-section">
      <div class="vdot-row">
        <span class="vdot-label">VDOT</span>
        <span class="vdot-value">${newVdot.toFixed(1)}</span>
        ${vdotChangeHtml}
        ${oldVdotHtml}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(distanceLabel)} PR &#8212; ${escapeHtml(dateStr)} | Dreamy</title>
<meta property="og:title" content="New ${escapeHtml(distanceLabel)} PR! ${escapeHtml(formatEffortTime(newTimeSeconds))}">
<meta property="og:description" content="${improvementPct !== null ? `${improvementPct.toFixed(1)}% faster` : escapeHtml(formatEffortTime(newTimeSeconds))}${newVdot !== null ? ` | VDOT ${newVdot.toFixed(1)}` : ''} | ${escapeHtml(dateStr)}">
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
  min-height:380px;
  background:#141420;
  border:1px solid #42425a;
  border-radius:20px;
  overflow:hidden;
  position:relative;
  display:flex;
  flex-direction:column;
}

/* Gold accent gradient stripe */
.accent-bar{
  height:4px;
  background:linear-gradient(90deg, #fbbf24, #f59e0b, #d97706, transparent);
}

/* Confetti decoration (static for share card) */
.confetti-dot{
  position:absolute;
  border-radius:2px;
  opacity:0.6;
}

.content{
  flex:1;
  padding:28px 32px 20px;
  display:flex;
  flex-direction:column;
  gap:20px;
}

/* Header with trophy */
.header{
  display:flex;
  align-items:center;
  gap:14px;
}
.trophy-icon{
  width:48px;
  height:48px;
  background:linear-gradient(135deg, #fbbf2420, #d9770620);
  border:1px solid #fbbf2430;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
}
.header-text{
  flex:1;
}
.pr-title{
  font-size:22px;
  font-weight:700;
  letter-spacing:-0.02em;
  color:#fbbf24;
  line-height:1.2;
}
.pr-subtitle{
  font-size:13px;
  color:#8888a0;
  margin-top:3px;
}

/* Distance badge */
.distance-badge{
  display:inline-block;
  padding:5px 14px;
  border-radius:8px;
  font-size:13px;
  font-weight:700;
  letter-spacing:0.02em;
  color:#fbbf24;
  background:#fbbf2418;
  border:1px solid #fbbf2430;
  white-space:nowrap;
}

/* Time comparison */
.comparison{
  background:#0a0a0f;
  border-radius:14px;
  padding:20px;
}
.comparison-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.time-block{
  text-align:center;
  flex:1;
}
.time-value{
  font-size:32px;
  font-weight:800;
  letter-spacing:-0.03em;
  line-height:1;
}
.new-time .time-value{
  color:#fbbf24;
}
.old-time .time-value{
  color:#8888a0;
  font-size:24px;
  font-weight:700;
}
.solo-time{
  text-align:center;
}
.solo-time .time-value{
  font-size:40px;
  font-weight:800;
  color:#fbbf24;
  letter-spacing:-0.03em;
}
.time-label{
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:0.08em;
  color:#8888a0;
  margin-top:6px;
}
.improvement-arrow{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:4px;
  padding:0 4px;
}
.improvement-delta{
  font-size:14px;
  font-weight:700;
  color:#4ade80;
  white-space:nowrap;
}
.improvement-pct{
  text-align:center;
  margin-top:14px;
  padding-top:14px;
  border-top:1px solid #333345;
  font-size:14px;
  color:#8888a0;
}
.pct-value{
  font-weight:700;
  color:#4ade80;
  font-size:18px;
}

/* VDOT section */
.vdot-section{
  background:linear-gradient(135deg, #fbbf2410, #141420);
  border:1px solid #fbbf2425;
  border-radius:12px;
  padding:14px 20px;
}
.vdot-row{
  display:flex;
  align-items:center;
  gap:10px;
}
.vdot-label{
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:0.06em;
  color:#8888a0;
}
.vdot-value{
  font-size:26px;
  font-weight:800;
  letter-spacing:-0.03em;
  color:#fbbf24;
}
.vdot-change{
  font-size:14px;
  font-weight:700;
}
.vdot-change.positive{color:#4ade80}
.vdot-change.negative{color:#ef4444}
.vdot-old{
  font-size:12px;
  color:#8888a0;
  margin-left:auto;
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
  .content{padding:56px 64px 40px;gap:36px}
  .pr-title{font-size:36px}
  .pr-subtitle{font-size:18px}
  .distance-badge{font-size:16px;padding:8px 20px}
  .trophy-icon{width:64px;height:64px;border-radius:18px}
  .trophy-icon svg{width:32px;height:32px}
  .time-value{font-size:48px}
  .old-time .time-value{font-size:36px}
  .solo-time .time-value{font-size:56px}
  .improvement-delta{font-size:20px}
  .pct-value{font-size:24px}
  .vdot-value{font-size:40px}
  .footer{padding:20px 64px}
  .brand{font-size:18px}
}

/* IG Story format: 1080x1920 (9:16) — activated via .card.story */
.card.story{
  width:1080px;
  min-height:1920px;
  border-radius:0;
  border:none;
}
.card.story .content{
  padding:100px 72px 56px;
  gap:56px;
  justify-content:center;
}
.card.story .pr-title{font-size:52px}
.card.story .pr-subtitle{font-size:22px}
.card.story .distance-badge{font-size:20px;padding:10px 24px;border-radius:12px}
.card.story .trophy-icon{width:80px;height:80px;border-radius:22px}
.card.story .trophy-icon svg{width:40px;height:40px}
.card.story .comparison{padding:32px;border-radius:20px}
.card.story .time-value{font-size:64px}
.card.story .old-time .time-value{font-size:48px}
.card.story .solo-time .time-value{font-size:72px}
.card.story .time-label{font-size:14px}
.card.story .improvement-delta{font-size:24px}
.card.story .pct-value{font-size:32px}
.card.story .improvement-pct{font-size:18px}
.card.story .vdot-section{padding:20px 28px;border-radius:16px}
.card.story .vdot-value{font-size:48px}
.card.story .vdot-label{font-size:14px}
.card.story .vdot-change{font-size:18px}
.card.story .vdot-old{font-size:14px}
.card.story .footer{padding:32px 72px}
.card.story .brand{font-size:26px}
.card.story .brand-sub{font-size:16px}
.card.story .brand-url{font-size:16px}
</style>
</head>
<body>
<div class="${cardClass}">
  <!-- Decorative confetti dots -->
  <div class="confetti-dot" style="top:12px;left:8%;width:6px;height:6px;background:#fbbf24;transform:rotate(15deg)"></div>
  <div class="confetti-dot" style="top:24px;left:22%;width:5px;height:5px;background:#4ade80;transform:rotate(45deg)"></div>
  <div class="confetti-dot" style="top:8px;left:45%;width:7px;height:7px;background:#f59e0b;transform:rotate(-20deg)"></div>
  <div class="confetti-dot" style="top:20px;left:65%;width:5px;height:5px;background:#a78bfa;transform:rotate(60deg)"></div>
  <div class="confetti-dot" style="top:10px;left:80%;width:6px;height:6px;background:#fcd34d;transform:rotate(-40deg)"></div>
  <div class="confetti-dot" style="top:30px;left:92%;width:4px;height:4px;background:#ef4444;transform:rotate(30deg)"></div>

  <div class="accent-bar"></div>
  <div class="content">
    <!-- Header -->
    <div class="header">
      <div class="trophy-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        </svg>
      </div>
      <div class="header-text">
        <div class="pr-title">New ${escapeHtml(distanceLabel)} PR!</div>
        <div class="pr-subtitle">${escapeHtml(dateStr)}</div>
      </div>
      <div class="distance-badge">${escapeHtml(distanceLabel)}</div>
    </div>

    <!-- Time comparison -->
    ${improvementHtml}

    ${vdotHtml}
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

// ── 404 page ──────────────────────────────────────────────────────────

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PR not found | Dreamy</title>
<style>
body{background:#0a0a0f;color:#ededf2;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.msg{text-align:center}
h1{font-size:24px;margin-bottom:8px}
p{color:#8888a0;font-size:14px}
a{color:#fbbf24;text-decoration:none}
</style>
</head>
<body>
<div class="msg">
  <h1>PR not found</h1>
  <p>This personal record may have been deleted or the link is incorrect.</p>
  <p style="margin-top:16px"><a href="https://getdreamy.run">getdreamy.run</a></p>
</div>
</body>
</html>`;
}
