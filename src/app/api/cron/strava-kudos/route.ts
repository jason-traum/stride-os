import { NextResponse } from 'next/server';
import { refreshStravaKudos } from '@/actions/strava-kudos-refresh';

export const maxDuration = 60; // 1 minute max for cron

export async function GET(request: Request) {
  // Verify cron secret (Vercel cron sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also accept admin secret for manual triggers
    const adminSecret = request.headers.get('x-admin-secret');
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await refreshStravaKudos({ maxActivities: 20 });

  return NextResponse.json(result);
}
