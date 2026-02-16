import { NextResponse } from 'next/server';
import { recategorizeAllWorkouts } from '@/actions/recategorize';

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await recategorizeAllWorkouts();
  return NextResponse.json(result);
}
