import { createHmac, randomBytes } from 'crypto';

function getSessionSecret(): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (secret) return secret;

  // Derive a fallback from auth passwords so sessions work even without a dedicated secret.
  const fallback = process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD;
  if (fallback) return `derived:${fallback}`;

  if (process.env.NODE_ENV === 'production') {
    // Last resort: warn but don't crash — use a per-deploy random secret.
    // Sessions won't survive redeploys but login won't break.
    if (!(globalThis as Record<string, unknown>).__sessionFallback) {
      (globalThis as Record<string, unknown>).__sessionFallback = require('crypto').randomBytes(32).toString('hex');
    }
    return (globalThis as Record<string, unknown>).__sessionFallback as string;
  }
  return 'dev-fallback-secret';
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
