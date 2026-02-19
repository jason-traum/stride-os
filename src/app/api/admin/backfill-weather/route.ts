import { NextResponse } from 'next/server';
import { backfillWeather } from '@/actions/backfill-weather';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await backfillWeather({
    limit: body.limit,
    dryRun: body.dryRun,
  });

  return NextResponse.json(result);
}
