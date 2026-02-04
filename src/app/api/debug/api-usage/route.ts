import { NextRequest, NextResponse } from 'next/server';
import { getApiUsageStats } from '@/lib/api-usage';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30');

  try {
    const stats = await getApiUsageStats(days);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API Usage] Failed to get stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API usage stats' },
      { status: 500 }
    );
  }
}
