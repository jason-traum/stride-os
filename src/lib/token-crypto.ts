/**
 * Token encryption/decryption using AES-256-GCM.
 *
 * Encrypts API tokens (Strava, Intervals.icu) before storing in the database.
 * Requires TOKEN_ENCRYPTION_KEY env var (32-byte hex string, 64 hex chars).
 * Falls back to plaintext if no key is set (development only).
 *
 * Encrypted format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) return null;
  if (keyHex.length !== 64) {
    console.warn('[token-crypto] TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.');
    return null;
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext token. Returns encrypted string or plaintext if no key.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted token. Handles both encrypted and legacy plaintext values.
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext value — return as-is
    return stored;
  }

  const key = getEncryptionKey();
  if (!key) {
    console.warn('[token-crypto] Encrypted token found but no TOKEN_ENCRYPTION_KEY set');
    return '';
  }

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    console.error('[token-crypto] Invalid encrypted token format');
    return '';
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
