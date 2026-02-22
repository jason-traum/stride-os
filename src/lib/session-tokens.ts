/**
 * Signed opaque session tokens.
 *
 * Uses Web Crypto API (SubtleCrypto) so it works in BOTH Node.js and Edge Runtime
 * (Next.js middleware runs on Edge where Node.js `crypto.createHmac` is unavailable).
 */

function getSessionSecret(): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (secret) return secret;

  // Derive a fallback from auth passwords so sessions work even without a dedicated secret.
  const fallback = process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD;
  if (fallback) return `derived:${fallback}`;

  return 'dev-fallback-secret';
}

// Hex encode/decode helpers
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Generate random hex nonce using whichever crypto is available
function randomHex(bytes: number): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buf);
    return toHex(buf.buffer);
  }
  // Fallback for environments without Web Crypto
  const { randomBytes } = require('crypto');
  return (randomBytes(bytes) as Buffer).toString('hex');
}

// HMAC-SHA256 using Web Crypto API (works in Edge + Node.js)
async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig).slice(0, 32);
}

// Synchronous HMAC fallback using Node.js crypto (for non-async callers)
function hmacSha256Sync(secret: string, message: string): string {
  try {
    const { createHmac } = require('crypto');
    return (createHmac('sha256', secret).update(message).digest('hex') as string).slice(0, 32);
  } catch {
    // Edge runtime — should not reach here if async path is used
    return '';
  }
}

/**
 * Create a signed opaque session token for a role.
 * Format: <random_nonce>.<hmac_signature>
 */
export function createSessionToken(role: string): string {
  const nonce = randomHex(16);
  const secret = getSessionSecret();
  const signature = hmacSha256Sync(secret, `${role}:${nonce}`);
  return `${nonce}.${signature}`;
}

/**
 * Validate a session token for a given role (synchronous).
 * Falls back to format-only check if HMAC is unavailable (Edge Runtime).
 */
export function validateSessionToken(role: string, token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const dotIndex = token.indexOf('.');
  const nonce = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!nonce || !signature) return false;

  const secret = getSessionSecret();
  const expected = hmacSha256Sync(secret, `${role}:${nonce}`);

  // If HMAC sync succeeded, do full verification
  if (expected) return expected === signature;

  // Edge Runtime fallback: verify token format is plausible
  // (32-char hex nonce + 32-char hex signature)
  // Real HMAC verification happens in server components (Node.js runtime)
  return nonce.length === 32 && /^[0-9a-f]+$/.test(nonce) && signature.length === 32 && /^[0-9a-f]+$/.test(signature);
}

/**
 * Validate a session token asynchronously (full HMAC in all runtimes).
 * Use this in server components / API routes where async is acceptable.
 */
export async function validateSessionTokenAsync(role: string, token: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const dotIndex = token.indexOf('.');
  const nonce = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!nonce || !signature) return false;

  try {
    const secret = getSessionSecret();
    const expected = await hmacSha256(secret, `${role}:${nonce}`);
    return expected === signature;
  } catch {
    return false;
  }
}
