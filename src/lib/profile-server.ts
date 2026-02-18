import { cookies } from 'next/headers';
import { getPublicProfileId, isPublicAccessMode } from '@/lib/access-mode';
import {
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

const ACTIVE_PROFILE_KEY = 'stride_active_profile';

/**
 * Get the active profile ID from cookies (server-side)
 * Returns the profile ID or undefined if not set
 */
export async function getActiveProfileId(): Promise<number | undefined> {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const publicModeEnabled = resolveEffectivePublicMode({
    role: resolveAuthRoleFromGetter(getCookie),
    sessionOverride: resolveSessionModeOverrideFromGetter(getCookie),
    globalPublicMode: isPublicAccessMode(),
  });

  // In public mode we always pin server actions/pages to one profile.
  if (publicModeEnabled) {
    const pinned = getPublicProfileId(1);
    if (!isNaN(pinned)) {
      return pinned;
    }
  }

  const profileCookie = cookieStore.get(ACTIVE_PROFILE_KEY);

  if (profileCookie?.value) {
    const id = parseInt(profileCookie.value, 10);
    if (!isNaN(id)) {
      return id;
    }
  }

  // Legacy guest fallback for backward compatibility.
  if (publicModeEnabled) {
    const fallback = getPublicProfileId(1);
    if (!isNaN(fallback)) {
      return fallback;
    }
  }

  return undefined;
}
