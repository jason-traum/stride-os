import { NextResponse } from 'next/server';
import { fullReprocess } from '@/actions/vdot-sync';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await fullReprocess();
  return NextResponse.json(result);
}
