import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getProfiles, createProfile, initializeDefaultProfiles } from '@/actions/profiles';
import { getPublicProfileId, isPublicAccessMode } from '@/lib/access-mode';
import {
  isPrivilegedRole,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

export async function GET() {
  try {
    // Initialize default profiles if needed
    await initializeDefaultProfiles();

    const profiles = await getProfiles();
    const cookieStore = await cookies();
    const getCookie = (name: string) => cookieStore.get(name)?.value;
    const role = resolveAuthRoleFromGetter(getCookie);
    const sessionOverride = resolveSessionModeOverrideFromGetter(getCookie);
    const globalPublicMode = isPublicAccessMode();
    const publicModeEnabled = resolveEffectivePublicMode({
      role,
      sessionOverride,
      globalPublicMode,
    });

    if (publicModeEnabled) {
      const pinnedId = getPublicProfileId(1);
      const pinned = profiles.find((p) => p.id === pinnedId) || profiles[0];
      return NextResponse.json({
        profiles: pinned ? [pinned] : [],
        publicMode: true,
        globalPublicMode,
        canEdit: false,
      });
    }

    return NextResponse.json({
      profiles,
      publicMode: false,
      globalPublicMode,
      canEdit: isPrivilegedRole(role),
    });
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
