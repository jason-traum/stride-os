import { NextResponse } from 'next/server';
import { backfillBestEfforts } from '@/actions/strava-repull';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await backfillBestEfforts({
    batchSize: body.batchSize ?? 50,
    delayMs: body.delayMs ?? 300,
    profileId: body.profileId,
  });

  return NextResponse.json(result);
}
