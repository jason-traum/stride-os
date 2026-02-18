import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getProfiles, createProfile, initializeDefaultProfiles } from '@/actions/profiles';
import { getPublicProfileId, isPublicAccessMode } from '@/lib/access-mode';
import {
  CUSTOMER_PROFILE_COOKIE,
  isWritableRole,
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
    const customerProfileRaw = cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value;
    const customerProfileId = parseInt(customerProfileRaw || '', 10);

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

    if (role === 'customer') {
      const pinned = profiles.find((p) => p.id === customerProfileId);
      return NextResponse.json({
        profiles: pinned ? [pinned] : [],
        publicMode: false,
        globalPublicMode,
        canEdit: true,
      });
    }

    return NextResponse.json({
      profiles,
      publicMode: false,
      globalPublicMode,
      canEdit: isWritableRole(role),
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
    const cookieStore = await cookies();
    const getCookie = (name: string) => cookieStore.get(name)?.value;
    const role = resolveAuthRoleFromGetter(getCookie);
    if (role === 'customer') {
      return NextResponse.json(
        { error: 'Customer accounts cannot create additional profiles' },
        { status: 403 }
      );
    }
    if (!isWritableRole(role)) {
      return NextResponse.json(
        { error: "Oops, can't do that in guest mode! Public mode is read-only." },
        { status: 403 }
      );
    }

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
