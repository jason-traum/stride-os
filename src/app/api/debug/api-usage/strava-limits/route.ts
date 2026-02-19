import { NextResponse } from 'next/server';
import { getStravaRateLimitStatus } from '@/lib/api-usage';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const limits = await getStravaRateLimitStatus();
    return NextResponse.json(limits);
  } catch (error) {
    console.error('[API Usage] Failed to get Strava limits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Strava rate limits' },
      { status: 500 }
    );
  }
}
