/**
 * Weekly Training Summary Email - API Endpoint
 *
 * Generates a rendered HTML email with the previous week's training summary.
 * Secured with CRON_SECRET (Vercel cron) or ADMIN_SECRET header.
 *
 * GET /api/email/weekly-summary
 *   - Returns HTML email for the previous completed week
 *   - Query param ?preview=true returns the HTML directly viewable in browser
 *   - Query param ?date=YYYY-MM-DD generates the report for the week containing that date
 *
 * Intended cron: Every Monday at 8am UTC
 * Add to vercel.json: { "path": "/api/email/weekly-summary", "schedule": "0 8 * * 1" }
 *
 * Note: This endpoint generates the email HTML only. Actual email sending
 * (via Resend, SendGrid, etc.) will be wired up separately.
 */

import { NextResponse } from 'next/server';
import { getTrainingReportData } from '@/actions/training-report';
import { renderWeeklySummaryEmail } from '@/lib/email/weekly-summary';
import { toLocalDateString } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  // ── Auth: accept Vercel cron Bearer token or x-admin-secret header ──
  const authHeader = request.headers.get('authorization');
  const adminSecret = request.headers.get('x-admin-secret');
  const url = new URL(request.url);
  const isPreview = url.searchParams.get('preview') === 'true';

  // In preview mode with ADMIN_SECRET, or standard cron/admin auth
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    adminSecret === process.env.ADMIN_SECRET;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Determine which week to generate the report for.
    // Default: the previous completed week (last Monday through Sunday).
    // If ?date= is provided, generate for the week containing that date.
    let dateParam = url.searchParams.get('date') ?? undefined;

    if (!dateParam) {
      // Default to last week: go back 7 days from today to land in the previous week
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      dateParam = toLocalDateString(lastWeek);
    }

    const result = await getTrainingReportData('week', dateParam);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    const data = result.data;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.getdreamy.run';
    const html = renderWeeklySummaryEmail(data, { baseUrl });

    // If preview mode, return the HTML directly so it renders in the browser
    if (isPreview) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Standard response: return the HTML in a JSON envelope along with metadata.
    // This makes it easy for a future email-sending integration to consume.
    return NextResponse.json({
      success: true,
      period: data.periodLabel,
      startDate: data.startDate,
      endDate: data.endDate,
      totalRuns: data.totalRuns,
      totalMiles: data.totalMiles,
      html,
      // Metadata useful for email sending
      subject: `Your Week in Review: ${data.totalMiles.toFixed(1)} mi across ${data.totalRuns} runs`,
      preheader: data.totalRuns > 0
        ? `${data.totalMiles.toFixed(1)} miles across ${data.totalRuns} runs this week`
        : 'Your weekly training summary from Dreamy',
    });
  } catch (error) {
    console.error('[weekly-summary] Error generating email:', error);
    return NextResponse.json(
      { error: 'Failed to generate weekly summary', details: String(error) },
      { status: 500 }
    );
  }
}
