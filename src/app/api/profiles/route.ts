import { NextResponse } from 'next/server';
import { getProfiles, createProfile, initializeDefaultProfiles } from '@/actions/profiles';

export async function GET() {
  try {
    // Initialize default profiles if needed
    await initializeDefaultProfiles();

    const profiles = await getProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Failed to get profiles:', error);
    return NextResponse.json(
      { error: 'Failed to get profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, avatarColor } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'personal' && type !== 'demo') {
      return NextResponse.json(
        { error: 'Type must be "personal" or "demo"' },
        { status: 400 }
      );
    }

    const profile = await createProfile({ name, type, avatarColor });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Failed to create profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
