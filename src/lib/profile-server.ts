import { cookies } from 'next/headers';
import { getPublicProfileId, isPublicAccessMode } from '@/lib/access-mode';

const ACTIVE_PROFILE_KEY = 'stride_active_profile';

/**
 * Get the active profile ID from cookies (server-side)
 * Returns the profile ID or undefined if not set
 */
export async function getActiveProfileId(): Promise<number | undefined> {
  const publicModeEnabled = isPublicAccessMode();

  // In public mode we always pin server actions/pages to one profile.
  if (publicModeEnabled) {
    const pinned = getPublicProfileId(1);
    if (!isNaN(pinned)) {
      return pinned;
    }
  }

  const cookieStore = await cookies();
  const profileCookie = cookieStore.get(ACTIVE_PROFILE_KEY);

  if (profileCookie?.value) {
    const id = parseInt(profileCookie.value, 10);
    if (!isNaN(id)) {
      return id;
    }
  }

  // Legacy guest fallback for backward compatibility.
  if (isPublicAccessMode()) {
    const fallback = getPublicProfileId(1);
    if (!isNaN(fallback)) {
      return fallback;
    }
  }

  return undefined;
}
