import { createHmac } from 'crypto';

const ALGORITHM = 'sha256';

function getShareSecret(): string {
  const secret = process.env.SHARE_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('SHARE_SECRET or TOKEN_ENCRYPTION_KEY env var required for share links');
  }
  return secret;
}

/**
 * Generate an HMAC token for a shareable resource.
 * Token encodes: resourceType + resourceId + profileId so it can't be reused.
 */
export function generateShareToken(
  resourceType: string,
  resourceId: number,
  profileId: number,
): string {
  const secret = getShareSecret();
  const payload = `${resourceType}:${resourceId}:${profileId}`;
  return createHmac(ALGORITHM, secret).update(payload).digest('hex').slice(0, 32);
}

/**
 * Validate a share token against a resource.
 */
export function validateShareToken(
  resourceType: string,
  resourceId: number,
  token: string,
  profileId: number,
): boolean {
  if (!token || token.length < 10) return false;
  try {
    const secret = getShareSecret();
    const payload = `${resourceType}:${resourceId}:${profileId}`;
    const expected = createHmac(ALGORITHM, secret).update(payload).digest('hex').slice(0, 32);
    return expected === token;
  } catch {
    return false;
  }
}
