import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('session-tokens', () => {
  const SECRET = 'b'.repeat(64);

  beforeEach(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('generates a signed session token', async () => {
    const { createSessionToken } = await import('../session-tokens');
    const token = createSessionToken('admin');
    expect(token).toBeTruthy();
    expect(token).toContain('.');
    expect(token.length).toBeGreaterThan(20);
  });

  it('validates a correct session token', async () => {
    const { createSessionToken, validateSessionToken } = await import('../session-tokens');
    const token = createSessionToken('admin');
    expect(validateSessionToken('admin', token)).toBe(true);
  });

  it('rejects a token for wrong role', async () => {
    const { createSessionToken, validateSessionToken } = await import('../session-tokens');
    const token = createSessionToken('admin');
    expect(validateSessionToken('user', token)).toBe(false);
  });

  it('rejects a tampered token', async () => {
    const { validateSessionToken } = await import('../session-tokens');
    expect(validateSessionToken('admin', 'tampered.garbage')).toBe(false);
  });

  it('rejects empty/null tokens', async () => {
    const { validateSessionToken } = await import('../session-tokens');
    expect(validateSessionToken('admin', '')).toBe(false);
    expect(validateSessionToken('admin', 'no-dot')).toBe(false);
  });
});
