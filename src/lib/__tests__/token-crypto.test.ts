import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('token-crypto', () => {
  const VALID_KEY = 'a'.repeat(64);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('encrypts and decrypts roundtrip', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', VALID_KEY);
    const { encryptToken, decryptToken } = await import('../token-crypto');
    const encrypted = encryptToken('my-secret-token');
    expect(encrypted).toContain('enc:v1:');
    expect(decryptToken(encrypted)).toBe('my-secret-token');
  });

  it('throws when key is missing in production', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { encryptToken } = await import('../token-crypto');
    expect(() => encryptToken('test')).toThrow('TOKEN_ENCRYPTION_KEY is required in production');
  });

  it('allows plaintext fallback in development', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    const { encryptToken } = await import('../token-crypto');
    expect(encryptToken('test')).toBe('test');
  });

  it('throws on invalid key length', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'tooshort');
    const { encryptToken } = await import('../token-crypto');
    expect(() => encryptToken('test')).toThrow('64 hex chars');
  });

  it('handles legacy plaintext values in decrypt', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', VALID_KEY);
    const { decryptToken } = await import('../token-crypto');
    expect(decryptToken('plain-text-value')).toBe('plain-text-value');
  });
});
