import { NextResponse } from 'next/server';
import { syncStravaGearForProfile } from '@/actions/gear-sync';
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

  const profileId = body.profileId ?? settings.profileId;

  try {
    const result = await syncStravaGearForProfile(profileId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
