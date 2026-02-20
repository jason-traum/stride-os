import { NextResponse } from 'next/server';
import { syncStravaActivities } from '@/actions/strava';
import { db, userSettings } from '@/lib/db';
import { isNotNull } from 'drizzle-orm';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // Find the profile with Strava credentials
  const settings = await db.query.userSettings.findFirst({
    where: isNotNull(userSettings.stravaAccessToken),
    columns: { profileId: true },
  });

  if (!settings?.profileId) {
    return NextResponse.json({ error: 'No Strava-connected profile found' }, { status: 404 });
  }

  const result = await syncStravaActivities({
    fullSync: body.fullSync ?? true,
    since: body.since,
    until: body.until,
    profileId: body.profileId ?? settings.profileId,
    debug: body.debug ?? false,
  });

  return NextResponse.json(result);
}
