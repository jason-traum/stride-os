import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('share-tokens', () => {
  beforeEach(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'a'.repeat(64));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('generates a token for a resource', async () => {
    const { generateShareToken } = await import('../share-tokens');
    const token = generateShareToken('workout', 42, 1);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(32);
  });

  it('validates a correct token', async () => {
    const { generateShareToken, validateShareToken } = await import('../share-tokens');
    const token = generateShareToken('workout', 42, 1);
    expect(validateShareToken('workout', 42, token, 1)).toBe(true);
  });

  it('rejects wrong resource type', async () => {
    const { generateShareToken, validateShareToken } = await import('../share-tokens');
    const token = generateShareToken('workout', 42, 1);
    expect(validateShareToken('pr', 42, token, 1)).toBe(false);
  });

  it('rejects wrong resource id', async () => {
    const { generateShareToken, validateShareToken } = await import('../share-tokens');
    const token = generateShareToken('workout', 42, 1);
    expect(validateShareToken('workout', 99, token, 1)).toBe(false);
  });

  it('rejects wrong profileId', async () => {
    const { generateShareToken, validateShareToken } = await import('../share-tokens');
    const token = generateShareToken('workout', 42, 1);
    expect(validateShareToken('workout', 42, token, 2)).toBe(false);
  });

  it('rejects tampered token', async () => {
    const { validateShareToken } = await import('../share-tokens');
    expect(validateShareToken('workout', 42, 'fakefakefake', 1)).toBe(false);
  });

  it('generates different tokens for different resources', async () => {
    const { generateShareToken } = await import('../share-tokens');
    const t1 = generateShareToken('workout', 1, 1);
    const t2 = generateShareToken('workout', 2, 1);
    expect(t1).not.toBe(t2);
  });
});
