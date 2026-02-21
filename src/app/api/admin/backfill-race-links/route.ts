import { NextResponse } from 'next/server';
import { backfillRaceLinks } from '@/actions/races';

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await backfillRaceLinks(body.profileId);

  return NextResponse.json(result);
}
