/**
 * Weekly Training Summary Email Template
 *
 * Renders a mobile-friendly HTML email from TrainingReportData.
 * All styles are inlined for email client compatibility.
 * Uses table-based layout (no flexbox/grid).
 * Works in both light and dark email clients.
 */

import type { TrainingReportData, KeyWorkout } from '@/actions/training-report';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPace(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return '--:--';
  if (totalSeconds >= 1800) return '-';
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '--:--';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function capitalizeType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function trendArrow(value: number): string {
  if (value > 0) return '&#9650;'; // ▲
  if (value < 0) return '&#9660;'; // ▼
  return '&#8212;'; // —
}

function trendColor(value: number, positiveIsGood: boolean = true): string {
  if (value === 0) return '#8b8fa3';
  const isPositive = positiveIsGood ? value > 0 : value < 0;
  return isPositive ? '#22c55e' : '#ef4444';
}

function signedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

// ─── Color Palette ───────────────────────────────────────────────────────────
// Designed to work in both light and dark email clients.
// Uses a dark background with light text for universality.

const colors = {
  bg: '#1a1a2e',
  cardBg: '#252540',
  cardBorder: '#3a3a5c',
  accent: '#7c6cf0',
  accentLight: '#9d8ff5',
  textPrimary: '#f0f0f5',
  textSecondary: '#b0b3c6',
  textTertiary: '#8b8fa3',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  divider: '#3a3a5c',
};

// ─── Sub-sections ────────────────────────────────────────────────────────────

function renderSummaryStats(data: TrainingReportData): string {
  const stats = [
    { label: 'Miles', value: data.totalMiles.toFixed(1) },
    { label: 'Runs', value: `${data.totalRuns}` },
    { label: 'Time', value: formatDuration(data.totalMinutes) },
    { label: 'Avg Pace', value: data.avgPaceSeconds ? `${formatPace(data.avgPaceSeconds)}/mi` : '--' },
  ];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
      <tr>
        ${stats
          .map(
            (s, i) => `
          <td width="50%" style="padding: ${i < 2 ? '0 8px 12px 0' : '0 8px 0 0'}; vertical-align: top;">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px;">
              <tr>
                <td style="text-align: center;">
                  <div style="font-size: 28px; font-weight: 700; color: ${colors.textPrimary}; line-height: 1.2;">${s.value}</div>
                  <div style="font-size: 12px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${s.label}</div>
                </td>
              </tr>
            </table>
          </td>
          ${i === 1 ? '</tr><tr>' : ''}
        `
          )
          .join('')}
      </tr>
    </table>
  `;
}

function renderWorkoutBreakdown(data: TrainingReportData): string {
  if (data.workoutBreakdown.length === 0) return '';

  const rows = data.workoutBreakdown
    .map(
      (wb) => `
      <tr>
        <td style="padding: 10px 12px; color: ${colors.textPrimary}; font-size: 14px; border-bottom: 1px solid ${colors.divider};">
          ${capitalizeType(wb.type)}
        </td>
        <td style="padding: 10px 12px; color: ${colors.textSecondary}; font-size: 14px; text-align: center; border-bottom: 1px solid ${colors.divider};">
          ${wb.count}
        </td>
        <td style="padding: 10px 12px; color: ${colors.textSecondary}; font-size: 14px; text-align: right; border-bottom: 1px solid ${colors.divider};">
          ${wb.miles.toFixed(1)} mi
        </td>
        <td style="padding: 10px 12px; color: ${colors.textTertiary}; font-size: 13px; text-align: right; border-bottom: 1px solid ${colors.divider};">
          ${wb.percentage}%
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td colspan="4" style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">
          Workout Breakdown
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${colors.divider};">Type</td>
        <td style="padding: 8px 12px; font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; border-bottom: 1px solid ${colors.divider};">Runs</td>
        <td style="padding: 8px 12px; font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-bottom: 1px solid ${colors.divider};">Miles</td>
        <td style="padding: 8px 12px; font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-bottom: 1px solid ${colors.divider};">Share</td>
      </tr>
      ${rows}
    </table>
  `;
}

function renderKeyWorkout(workout: KeyWorkout): string {
  const paceStr = workout.avgPaceSeconds ? `${formatPace(workout.avgPaceSeconds)}/mi` : '';
  const durationStr = formatDuration(workout.durationMinutes);
  const detail = [
    `${workout.distanceMiles.toFixed(1)} mi`,
    durationStr,
    paceStr,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid ${colors.divider};">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <div style="background-color: ${colors.accent}; color: ${colors.white}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                ${workout.label}
              </div>
            </td>
            <td style="vertical-align: top;">
              <div style="font-size: 14px; color: ${colors.textPrimary}; font-weight: 600;">
                ${capitalizeType(workout.type)} &mdash; ${formatShortDate(workout.date)}
              </div>
              <div style="font-size: 13px; color: ${colors.textSecondary}; margin-top: 2px;">
                ${detail}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderKeyWorkouts(data: TrainingReportData): string {
  if (data.keyWorkouts.length === 0) return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">
          Key Workouts
        </td>
      </tr>
      ${data.keyWorkouts.map(renderKeyWorkout).join('')}
    </table>
  `;
}

function renderFitnessTrend(data: TrainingReportData): string {
  if (!data.fitness) return '';

  const { fitness } = data;
  const ctlDir = trendArrow(fitness.ctlChange);
  const ctlColor = trendColor(fitness.ctlChange);

  // TSB interpretation
  let tsbStatus: string;
  let tsbColor: string;
  if (fitness.endTsb > 10) {
    tsbStatus = 'Fresh';
    tsbColor = colors.success;
  } else if (fitness.endTsb > -10) {
    tsbStatus = 'Balanced';
    tsbColor = colors.warning;
  } else {
    tsbStatus = 'Fatigued';
    tsbColor = colors.danger;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">
          Fitness Trend
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" style="padding: 8px; text-align: center;">
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Fitness (CTL)</div>
                <div style="font-size: 22px; font-weight: 700; color: ${colors.textPrimary};">${fitness.endCtl}</div>
                <div style="font-size: 12px; color: ${ctlColor}; margin-top: 2px;">${ctlDir} ${signedNumber(fitness.ctlChange)}</div>
              </td>
              <td width="33%" style="padding: 8px; text-align: center; border-left: 1px solid ${colors.divider}; border-right: 1px solid ${colors.divider};">
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Fatigue (ATL)</div>
                <div style="font-size: 22px; font-weight: 700; color: ${colors.textPrimary};">${fitness.endAtl}</div>
                <div style="font-size: 12px; color: ${colors.textSecondary}; margin-top: 2px;">from ${fitness.startAtl}</div>
              </td>
              <td width="33%" style="padding: 8px; text-align: center;">
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Form (TSB)</div>
                <div style="font-size: 22px; font-weight: 700; color: ${tsbColor};">${fitness.endTsb}</div>
                <div style="font-size: 12px; color: ${tsbColor}; margin-top: 2px;">${tsbStatus}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderVdotUpdate(data: TrainingReportData): string {
  if (!data.vdot.endVdot || data.vdot.change === null || data.vdot.change === 0) return '';

  const change = data.vdot.change;
  const arrow = trendArrow(change);
  const color = trendColor(change);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">VDOT Update</div>
                <div style="font-size: 14px; color: ${colors.textSecondary}; margin-top: 4px;">
                  Your estimated fitness level ${change > 0 ? 'improved' : 'decreased'} this week.
                </div>
              </td>
              <td style="text-align: right; vertical-align: middle; padding-left: 16px;">
                <div style="font-size: 28px; font-weight: 700; color: ${colors.textPrimary};">${data.vdot.endVdot}</div>
                <div style="font-size: 13px; color: ${color};">${arrow} ${signedNumber(change)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderConsistency(data: TrainingReportData): string {
  const { consistency } = data;
  const streakText =
    consistency.currentStreak > 0
      ? `${consistency.currentStreak}-day streak`
      : 'No active streak';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">
          Consistency
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 12px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" style="padding: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: ${colors.textPrimary};">${consistency.daysRun}/${consistency.totalDaysInPeriod}</div>
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Days Run</div>
              </td>
              <td width="33%" style="padding: 8px; text-align: center; border-left: 1px solid ${colors.divider}; border-right: 1px solid ${colors.divider};">
                <div style="font-size: 22px; font-weight: 700; color: ${colors.accent};">${streakText}</div>
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Current</div>
              </td>
              <td width="33%" style="padding: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: ${colors.textPrimary};">${consistency.longestStreakInPeriod}d</div>
                <div style="font-size: 11px; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Best Streak</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderDailyMileage(data: TrainingReportData): string {
  if (data.dailyMileage.length === 0) return '';

  const maxMiles = Math.max(...data.dailyMileage.map((d) => d.miles), 1);

  const bars = data.dailyMileage
    .map((day) => {
      const heightPct = Math.max((day.miles / maxMiles) * 100, day.miles > 0 ? 4 : 0);
      const barColor = day.miles > 0 ? colors.accent : colors.cardBg;
      return `
        <td width="14%" style="padding: 0 2px; vertical-align: bottom; text-align: center;">
          <div style="font-size: 10px; color: ${colors.textSecondary}; margin-bottom: 4px;">${day.miles > 0 ? day.miles.toFixed(1) : ''}</div>
          <div style="background-color: ${barColor}; height: ${Math.round(heightPct)}px; min-height: ${day.miles > 0 ? '4px' : '0'}; border-radius: 4px 4px 0 0; max-height: 80px;"></div>
          <div style="font-size: 10px; color: ${colors.textTertiary}; margin-top: 4px;">${day.dayLabel}</div>
        </td>
      `;
    })
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.textTertiary}; text-transform: uppercase; letter-spacing: 1px;">
          Daily Mileage
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 12px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>${bars}</tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderPRs(data: TrainingReportData): string {
  if (data.prsAchieved.length === 0) return '';

  function formatPrTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  const rows = data.prsAchieved
    .map(
      (pr) => `
      <tr>
        <td style="padding: 10px 12px; color: ${colors.textPrimary}; font-size: 14px; border-bottom: 1px solid ${colors.divider};">
          ${pr.distanceLabel}
        </td>
        <td style="padding: 10px 12px; color: ${colors.success}; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid ${colors.divider};">
          ${formatPrTime(pr.timeSeconds)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td colspan="2" style="padding: 16px 12px 8px; font-size: 13px; font-weight: 600; color: ${colors.success}; text-transform: uppercase; letter-spacing: 1px;">
          &#127942; New Personal Records
        </td>
      </tr>
      ${rows}
    </table>
  `;
}

// ─── Main Template ───────────────────────────────────────────────────────────

export function renderWeeklySummaryEmail(
  data: TrainingReportData,
  options?: {
    baseUrl?: string;
    unsubscribeUrl?: string;
  }
): string {
  const baseUrl = options?.baseUrl || 'https://www.getdreamy.run';
  const unsubscribeUrl = options?.unsubscribeUrl || `${baseUrl}/settings`;
  const reportUrl = `${baseUrl}/report`;

  // Determine if there's any data to show
  const hasData = data.totalRuns > 0;

  const emptyState = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 32px 16px; text-align: center;">
          <div style="font-size: 16px; color: ${colors.textSecondary}; margin-bottom: 8px;">No runs logged this week.</div>
          <div style="font-size: 14px; color: ${colors.textTertiary};">Rest weeks count too &mdash; recovery is training.</div>
        </td>
      </tr>
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>Your Week in Review - Dreamy</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">

  <!-- Preheader text (hidden, shows in email preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${hasData ? `${data.totalMiles.toFixed(1)} miles across ${data.totalRuns} runs this week` : 'Your weekly training summary from Dreamy'}
    &#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.bg};">
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- Email container (max 600px) -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="padding: 24px 0 20px; text-align: center;">
              <div style="font-size: 28px; font-weight: 800; color: ${colors.accent}; letter-spacing: -0.5px;">dreamy</div>
            </td>
          </tr>

          <!-- Title & Date Range -->
          <tr>
            <td style="padding: 0 0 24px; text-align: center;">
              <div style="font-size: 22px; font-weight: 700; color: ${colors.textPrimary}; margin-bottom: 8px;">Your Week in Review</div>
              <div style="font-size: 14px; color: ${colors.textSecondary};">${data.periodLabel}</div>
            </td>
          </tr>

          ${hasData ? `
          <!-- Summary Stats (2x2 grid) -->
          <tr>
            <td>
              ${renderSummaryStats(data)}
            </td>
          </tr>

          <!-- Daily Mileage Chart -->
          <tr>
            <td>
              ${renderDailyMileage(data)}
            </td>
          </tr>

          <!-- Workout Breakdown -->
          <tr>
            <td>
              ${renderWorkoutBreakdown(data)}
            </td>
          </tr>

          <!-- Key Workouts -->
          <tr>
            <td>
              ${renderKeyWorkouts(data)}
            </td>
          </tr>

          <!-- PRs (if any) -->
          <tr>
            <td>
              ${renderPRs(data)}
            </td>
          </tr>

          <!-- Fitness Trend -->
          <tr>
            <td>
              ${renderFitnessTrend(data)}
            </td>
          </tr>

          <!-- VDOT Update -->
          <tr>
            <td>
              ${renderVdotUpdate(data)}
            </td>
          </tr>

          <!-- Consistency / Streak -->
          <tr>
            <td>
              ${renderConsistency(data)}
            </td>
          </tr>
          ` : `
          <!-- Empty State -->
          <tr>
            <td>
              ${emptyState}
            </td>
          </tr>
          `}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 0 32px; text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: ${colors.accent}; border-radius: 8px;">
                    <a href="${reportUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${colors.white}; text-decoration: none; letter-spacing: 0.3px;">
                      View Full Report
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 0 24px;">
              <div style="height: 1px; background-color: ${colors.divider};"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 0 32px; text-align: center;">
              <div style="font-size: 13px; color: ${colors.textTertiary}; margin-bottom: 8px;">
                <a href="${baseUrl}" target="_blank" style="color: ${colors.accent}; text-decoration: none; font-weight: 600;">dreamy</a>
                &mdash; AI-powered training insights for runners
              </div>
              <div style="font-size: 12px; color: ${colors.textTertiary};">
                <a href="${unsubscribeUrl}" target="_blank" style="color: ${colors.textTertiary}; text-decoration: underline;">
                  Manage email preferences
                </a>
              </div>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}
