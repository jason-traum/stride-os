import { createHmac, randomBytes } from 'crypto';

function getSessionSecret(): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY or SESSION_SECRET required for sessions');
    }
    return 'dev-fallback-secret';
  }
  return secret;
}

/**
 * Create a signed opaque session token for a role.
 * Format: <random_nonce>.<hmac_signature>
 * The HMAC signs: role + nonce, so it can't be reused across roles.
 */
export function createSessionToken(role: string): string {
  const nonce = randomBytes(16).toString('hex');
  const secret = getSessionSecret();
  const signature = createHmac('sha256', secret)
    .update(`${role}:${nonce}`)
    .digest('hex')
    .slice(0, 32);
  return `${nonce}.${signature}`;
}

/**
 * Validate a session token for a given role.
 */
export function validateSessionToken(role: string, token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const dotIndex = token.indexOf('.');
  const nonce = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!nonce || !signature) return false;
  try {
    const secret = getSessionSecret();
    const expected = createHmac('sha256', secret)
      .update(`${role}:${nonce}`)
      .digest('hex')
      .slice(0, 32);
    return expected === signature;
  } catch {
    return false;
  }
}
