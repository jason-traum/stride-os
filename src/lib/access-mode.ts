export function getAppAccessMode(): 'public' | 'private' {
  const raw = (
    process.env.APP_ACCESS_MODE
    || process.env.NEXT_PUBLIC_APP_ACCESS_MODE
    || 'private'
  );
  const normalized = raw.trim().toLowerCase();

  return normalized === 'public' ? 'public' : 'private';
}

export function isPublicAccessMode(): boolean {
  const legacyPublicFlag = (
    process.env.ENABLE_GUEST_FULL_ACCESS
    || process.env.NEXT_PUBLIC_ENABLE_GUEST_FULL_ACCESS
    || 'false'
  ).trim().toLowerCase();

  return getAppAccessMode() === 'public' || legacyPublicFlag === 'true';
}

export function getPublicProfileId(defaultId: number = 1): number {
  const raw = (
    process.env.PUBLIC_PROFILE_ID
    || process.env.NEXT_PUBLIC_PUBLIC_PROFILE_ID
    || process.env.GUEST_PROFILE_ID
    || process.env.NEXT_PUBLIC_GUEST_PROFILE_ID
    || `${defaultId}`
  ).trim();

  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultId : parsed;
}
