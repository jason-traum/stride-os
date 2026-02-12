import { NextResponse } from 'next/server';
import { getApiUsageStats } from '@/actions/api-usage';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  try {
    const stats = await getApiUsageStats(days);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get API usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage stats' },
      { status: 500 }
    );
  }
}