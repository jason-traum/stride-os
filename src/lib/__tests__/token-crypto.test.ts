import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomBytes } from 'crypto';

// We need to control the env var across tests, so we use dynamic imports
// after setting process.env.TOKEN_ENCRYPTION_KEY.

const VALID_KEY = randomBytes(32).toString('hex'); // 64 hex chars
const ANOTHER_KEY = randomBytes(32).toString('hex'); // different key for rotation test

describe('token-crypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.TOKEN_ENCRYPTION_KEY;
    // Reset module cache so each test gets fresh module state
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.TOKEN_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });

  async function loadModule() {
    return await import('../token-crypto');
  }

  describe('encryptToken', () => {
    it('returns plaintext when no encryption key is set', async () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      const { encryptToken } = await loadModule();
      const token = 'my-strava-access-token-abc123';
      expect(encryptToken(token)).toBe(token);
    });

    it('returns encrypted string with enc:v1: prefix when key is set', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { encryptToken } = await loadModule();
      const token = 'my-strava-access-token-abc123';
      const encrypted = encryptToken(token);
      expect(encrypted).toMatch(/^enc:v1:/);
      expect(encrypted).not.toContain(token);
    });

    it('produces different ciphertexts for the same input (random IV)', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { encryptToken } = await loadModule();
      const token = 'my-strava-access-token-abc123';
      const a = encryptToken(token);
      const b = encryptToken(token);
      expect(a).not.toBe(b); // Different IVs => different ciphertexts
    });

    it('falls back to plaintext when key is wrong length', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'tooshort';
      const { encryptToken } = await loadModule();
      const token = 'my-strava-access-token-abc123';
      expect(encryptToken(token)).toBe(token);
    });
  });

  describe('decryptToken', () => {
    it('returns plaintext values as-is (backwards compatibility)', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { decryptToken } = await loadModule();
      const plaintext = 'ya29.some-legacy-plaintext-token';
      expect(decryptToken(plaintext)).toBe(plaintext);
    });

    it('round-trips encrypt then decrypt', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { encryptToken, decryptToken } = await loadModule();
      const original = 'strava-refresh-token-xyz789!@#$%';
      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles empty string plaintext', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { encryptToken, decryptToken } = await loadModule();
      const encrypted = encryptToken('');
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles unicode tokens', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { encryptToken, decryptToken } = await loadModule();
      const original = 'token-with-unicode-\u00e9\u00e8\u00ea-\u2603';
      const encrypted = encryptToken(original);
      expect(decryptToken(encrypted)).toBe(original);
    });

    it('returns empty string when encrypted token found but no key set', async () => {
      // First encrypt with a key
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const mod1 = await loadModule();
      const encrypted = mod1.encryptToken('secret-token');

      // Now try to decrypt without a key
      delete process.env.TOKEN_ENCRYPTION_KEY;
      vi.resetModules();
      const mod2 = await loadModule();
      expect(mod2.decryptToken(encrypted)).toBe('');
    });

    it('returns empty string gracefully when key has changed (key rotation)', async () => {
      // Encrypt with one key
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const mod1 = await loadModule();
      const encrypted = mod1.encryptToken('secret-token');

      // Try to decrypt with a different key
      process.env.TOKEN_ENCRYPTION_KEY = ANOTHER_KEY;
      vi.resetModules();
      const mod2 = await loadModule();
      // Should not throw, should return empty string
      const result = mod2.decryptToken(encrypted);
      expect(result).toBe('');
    });

    it('returns empty string for malformed encrypted format', async () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
      const { decryptToken } = await loadModule();
      // Has prefix but wrong number of parts
      expect(decryptToken('enc:v1:only-two-parts')).toBe('');
    });
  });
});
