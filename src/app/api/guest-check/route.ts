import { NextResponse } from 'next/server';
import { isGuestUser } from '@/lib/guest-mode';

export async function GET() {
  const isGuest = await isGuestUser();
  return NextResponse.json({ isGuest });
}
