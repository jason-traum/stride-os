export type AppViewMode = 'private' | 'share' | 'publish';

export function getAppViewMode(): AppViewMode {
  const explicitRaw = (
    process.env.APP_VIEW_MODE
    || process.env.NEXT_PUBLIC_APP_VIEW_MODE
    || ''
  ).trim().toLowerCase();

  if (explicitRaw === 'share' || explicitRaw === 'publish' || explicitRaw === 'private') {
    return explicitRaw;
  }

  const legacyRaw = (
    process.env.APP_ACCESS_MODE
    || process.env.NEXT_PUBLIC_APP_ACCESS_MODE
    || 'private'
  ).trim().toLowerCase();

  if (legacyRaw === 'public') return 'share';
  if (legacyRaw === 'publish') return 'publish';
  return 'private';
}

export function getAppAccessMode(): 'public' | 'private' {
  return getAppViewMode() === 'share' ? 'public' : 'private';
}

export function isPublicAccessMode(): boolean {
  const legacyPublicFlag = (
    process.env.ENABLE_GUEST_FULL_ACCESS
    || process.env.NEXT_PUBLIC_ENABLE_GUEST_FULL_ACCESS
    || 'false'
  ).trim().toLowerCase();

  return getAppViewMode() === 'share' || legacyPublicFlag === 'true';
}

export function isPublishAccessMode(): boolean {
  return getAppViewMode() === 'publish';
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
