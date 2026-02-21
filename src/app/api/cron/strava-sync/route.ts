import { NextResponse } from 'next/server';
import { syncStravaActivities } from '@/actions/strava';
import { db, userSettings } from '@/lib/db';
import { isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  // Verify cron secret (Vercel cron sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    const adminSecret = request.headers.get('x-admin-secret');
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Find all profiles with Strava connected and auto-sync enabled
  const connectedProfiles = await db
    .select({ profileId: userSettings.profileId })
    .from(userSettings)
    .where(isNotNull(userSettings.stravaAccessToken));

  const results: Array<{ profileId: number | null; imported: number; skipped: number; error?: string }> = [];

  for (const { profileId } of connectedProfiles) {
    if (!profileId) continue;
    try {
      const result = await syncStravaActivities({ profileId });
      results.push({ profileId, imported: result.imported, skipped: result.skipped, error: result.error });
    } catch (err) {
      results.push({ profileId, imported: 0, skipped: 0, error: String(err) });
    }
  }

  const totalImported = results.reduce((sum, r) => sum + r.imported, 0);

  return NextResponse.json({
    profiles: results.length,
    totalImported,
    results,
  });
}
