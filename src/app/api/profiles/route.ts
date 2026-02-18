import { NextResponse } from 'next/server';
import { getProfiles, createProfile, initializeDefaultProfiles } from '@/actions/profiles';

export async function GET() {
  try {
    // Initialize default profiles if needed
    await initializeDefaultProfiles();

    const profiles = await getProfiles();
    const accessMode = (process.env.APP_ACCESS_MODE || 'private').toLowerCase();
    const publicModeEnabled = accessMode === 'public' || process.env.ENABLE_GUEST_FULL_ACCESS === 'true';

    if (publicModeEnabled) {
      const pinnedId = parseInt(process.env.PUBLIC_PROFILE_ID || process.env.GUEST_PROFILE_ID || '1', 10);
      const pinned = profiles.find((p) => p.id === pinnedId) || profiles[0];
      return NextResponse.json({
        profiles: pinned ? [pinned] : [],
        publicMode: true,
      });
    }

    return NextResponse.json({ profiles, publicMode: false });
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
