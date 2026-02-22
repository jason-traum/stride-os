'use server';

import { generateShareToken } from '@/lib/share-tokens';

/**
 * Server action to generate a share token for a resource.
 * Called from client components that need to build share URLs.
 */
export async function getShareToken(
  resourceType: string,
  resourceId: number,
  profileId: number,
): Promise<string> {
  return generateShareToken(resourceType, resourceId, profileId);
}
