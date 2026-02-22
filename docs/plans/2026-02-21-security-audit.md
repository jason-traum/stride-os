# Security Audit - 2026-02-21

## Summary

Systematic security review of the Stride OS codebase covering secrets management,
authentication, token storage, API route authorization, XSS, SQL injection, and
environment variable hygiene.

**Fixed: 4 issues (1 critical, 1 high, 2 medium)**
**Documented for design discussion: 2 issues**

---

## FIXED Issues

### 1. [CRITICAL] Auth-role cookie bypass allows privilege escalation

**File:** `src/lib/auth-access.ts` (lines 47-65)

**Problem:** The fallback auth path trusted the `auth-role` cookie combined with ANY
non-empty token cookie to grant access. An attacker could set:
- `auth-role=admin`
- `site-auth=anything-non-empty`

...and gain full admin access without knowing any password.

**Fix:** The fallback now verifies that the token cookie value matches the actual
password from env vars (for built-in roles). Customer role continues to use opaque
session tokens with profile cookie verification.

**Severity:** Critical -- unauthenticated privilege escalation on production.

---

### 2. [HIGH] Hardcoded fallback admin secret in profiles route

**File:** `src/app/api/admin/profiles/route.ts` (line 5)

**Before:**
```ts
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dreamy-admin-2026';
```

**Problem:** If `ADMIN_SECRET` env var is not set, anyone who guesses or discovers
the hardcoded fallback `'dreamy-admin-2026'` can list all profiles and delete any
non-primary profile (destructive admin operation).

**Fix:** Removed hardcoded fallback. If `ADMIN_SECRET` is not configured, the
endpoint returns 401 for all requests. Also added `Number.isFinite` validation on
the profile ID parameter.

**Severity:** High -- default credential allows destructive data deletion.

---

### 3. [MEDIUM] Client secret partial exposure in debug-strava route

**File:** `src/app/api/debug-strava/route.ts`

**Problem:** On token exchange failure, the error response included
`clientSecretFirst4` and `clientSecretLast4` (first/last 4 chars of the Strava
client secret). While the route is dev-only (`NODE_ENV !== 'production'`), this
is unnecessary exposure. The error response also included full stack traces.

**Fix:** Removed `clientSecretFirst4`, `clientSecretLast4`, and `error.stack`
from error responses. Kept `clientSecretLength` for debugging without exposure.

**Severity:** Medium -- dev-only but reveals partial secret.

---

### 4. [MEDIUM] Missing TOKEN_ENCRYPTION_KEY and ADMIN_SECRET in env examples

**Files:** `.env.example`, `.env.production.example`

**Problem:** `TOKEN_ENCRYPTION_KEY` (required to encrypt Strava tokens at rest)
and `ADMIN_SECRET` (required for admin API endpoints) were not documented in
either env example file. Operators deploying the app would not know to set them,
resulting in plaintext token storage and potentially no admin API access.

**Fix:** Added both variables with generation instructions to both example files.

**Severity:** Medium -- operational gap leading to plaintext token storage.

---

## Issues Requiring Design Discussion

### 5. [MEDIUM] Plaintext passwords stored in auth cookies

**Files:** `src/app/api/gate/route.ts` (line 148), `src/lib/auth-access.ts`

**Problem:** For built-in roles (admin, user, viewer, coach), the raw password is
stored directly as the value of the authentication cookie (`site-auth`, `user-auth`,
etc.). While cookies are httpOnly and secure (in production), the password is visible
in browser dev tools, any cookie-logging proxy, and server logs that dump headers.

If the password leaks (e.g., via a header logging service), an attacker gains
persistent access. Additionally, the auth-access fallback (Issue #1) now depends on
this pattern for verification.

**Recommended fix:** Replace password-in-cookie with HMAC-based opaque session
tokens. On login, generate `HMAC(role + username + timestamp, AUTH_SECRET)` and
store that. On verification, recompute and compare. This requires coordinated
changes to:
- `src/app/api/gate/route.ts` -- generate token on login
- `src/lib/auth-access.ts` -- verify HMAC instead of password comparison
- `src/middleware.ts` -- refresh mechanism

**Severity:** Medium -- requires coordinated multi-file change and session migration.

---

### 6. [LOW] No CSRF protection on state-changing endpoints

**Problem:** The app uses cookie-based auth but does not implement CSRF tokens.
State-changing operations (POST to `/api/gate`, `/api/profiles`, `/api/access-mode`,
etc.) could theoretically be triggered by a malicious site if a user visits it while
authenticated.

**Mitigating factors:**
- All auth cookies use `sameSite: 'lax'`, which prevents CSRF on POST requests
  from cross-origin forms/XHR in modern browsers.
- The app is single-user / small-team, limiting the attack surface.

**Recommendation:** The `sameSite: 'lax'` setting provides adequate protection for
the current threat model. No immediate action needed, but if the app grows to support
many users, consider adding CSRF tokens.

**Severity:** Low -- mitigated by sameSite cookie setting.

---

## Audit Results (No Issues Found)

### Token storage and encryption
- `src/lib/token-crypto.ts` implements AES-256-GCM encryption correctly.
- IV is randomly generated per encryption (12 bytes), auth tag is stored.
- Falls back to plaintext only when `TOKEN_ENCRYPTION_KEY` is not set (documented above).
- Strava tokens are encrypted before storage via `encryptToken()` in webhook and
  sync handlers.
- Tokens are never returned in API responses.

### SQL injection
- Drizzle ORM parametrizes all queries by default.
- `sql.raw()` usage in `profiles/route.ts` DELETE handler uses a hardcoded table
  allowlist and parseInt-validated profileId. Not injectable but added explicit
  `Number.isFinite()` validation as defense in depth.
- `sql.raw()` usage in `customer-auth.ts` for CREATE TABLE IF NOT EXISTS uses a
  hardcoded constant table name. Safe.

### XSS
- Server-rendered HTML with `dangerouslySetInnerHTML` in the methodology page and
  layout only uses hardcoded content strings. No user input flows into them. Safe.
- `innerHTML` in `clear-demo/route.ts` renders localStorage keys -- self-XSS only
  (attacker would need to already have write access to victim's localStorage). Negligible.

### API route authorization
- All `/api/admin/*` routes check `x-admin-secret` header against `process.env.ADMIN_SECRET`.
- Cron routes check `authorization: Bearer CRON_SECRET` with admin-secret fallback.
- `/api/seed-demo` requires `SEED_SECRET_KEY` env var and rejects if not configured.
- Debug routes (`debug-strava`, `debug/api-usage`) check `NODE_ENV === 'production'`
  and return 404 in prod.
- Test routes (`test-stream`, `test-chat`, `chat/test`) also guard on NODE_ENV.
- Middleware enforces role-based access for `/admin`, `/api/admin`, and restricts
  viewer/coach/customer roles from sensitive paths.

### Environment variables
- `.env.local` and `.env.vercel` are both in `.gitignore` (`.env*.local` pattern
  and explicit `.env.vercel` entry). Neither has been committed to git history.
- `NEXT_PUBLIC_*` vars contain only non-sensitive values (Strava client ID, app URL).
- Server-only secrets (`ANTHROPIC_API_KEY`, `STRAVA_CLIENT_SECRET`, `DATABASE_URL`)
  are properly accessed only in server-side code.

### Error handling
- `src/app/error.tsx` only shows error messages in development mode. Safe.
- API routes return generic error messages; stack traces are not exposed in responses
  (except the debug-strava route which was fixed above).

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/auth-access.ts` | Fixed auth-role cookie bypass (Issue #1) |
| `src/app/api/admin/profiles/route.ts` | Removed hardcoded fallback secret, added input validation (Issue #2) |
| `src/app/api/debug-strava/route.ts` | Removed partial secret and stack trace from responses (Issue #3) |
| `.env.example` | Added TOKEN_ENCRYPTION_KEY and ADMIN_SECRET documentation (Issue #4) |
| `.env.production.example` | Added TOKEN_ENCRYPTION_KEY and ADMIN_SECRET documentation (Issue #4) |
