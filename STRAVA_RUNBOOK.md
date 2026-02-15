# Strava Integration Runbook

> Last updated: 2026-02-15
> Status: Local auth script works. Production OAuth needs testing after middleware fix.

## Quick Reference

| Setting | Value |
|---------|-------|
| Strava Client ID | `199902` |
| Strava Athlete ID | `113202952` |
| Production domain | `www.getdreamy.run` (non-www redirects to www) |
| OAuth scopes needed | `read,activity:read_all` |
| Strava API settings | https://www.strava.com/settings/api |

---

## How Strava OAuth Works (The Happy Path)

1. User clicks "Connect with Strava" on settings page
2. Browser redirects to `https://www.strava.com/oauth/authorize?...` with `scope=read,activity:read_all`
3. User authorizes on Strava
4. Strava redirects browser to `https://www.getdreamy.run/api/strava/callback?code=XXX`
5. Callback route exchanges the code for access + refresh tokens
6. Tokens saved to `user_settings` table
7. Sync can now fetch activities

## Known Failure Points (In Order of Likelihood)

### 1. Authorization Callback Domain Mismatch
**Symptom:** `{"message":"Bad Request","errors":[{"resource":"Application","field":"redirect_uri","code":"invalid"}]}`

**Cause:** Strava's "Authorization Callback Domain" (at https://www.strava.com/settings/api) doesn't match the domain the redirect_uri comes from.

**Critical rules:**
- This field accepts ONE domain only (not comma-separated)
- `getdreamy.run` redirects to `www.getdreamy.run`, so the callback domain MUST be `www.getdreamy.run` for production
- For the local auth script, it must temporarily be `localhost`
- No `https://`, no path — just the bare domain

### 2. Password Gate Blocking Callback
**Symptom:** OAuth redirect silently fails, user lands on `/gate` instead of completing auth.

**Cause:** The site middleware requires a `site-auth` cookie. While the user's browser usually has this cookie, the `/api/strava/webhook` endpoint (called by Strava's servers) definitely won't.

**Fix (applied 2026-02-15):** `/api/strava` routes are in the `PUBLIC_PATHS` list in `src/middleware.ts`.

### 3. Wrong Token Scope
**Symptom:** Shows "Strava Connected" but "Failed to sync activities."

**Cause:** Tokens have `read` scope only, not `activity:read_all`. This happens when using the tokens displayed on Strava's API settings page (those only have `read` scope) via the Manual API Keys flow.

**The only way to get `activity:read_all` tokens is through the OAuth flow** (either production or local script).

### 4. Token Expiration
**Symptom:** Sync worked before but now fails.

**Cause:** Access tokens expire every 6 hours. The app should auto-refresh using the refresh token, but if refresh fails, tokens may appear stale.

**The refresh flow** is handled by `getValidAccessToken()` in `src/actions/strava.ts` and `getStravaStatus()` in `src/actions/strava-fix.ts`.

### 5. Strava Athlete Limit
**Symptom:** "You've hit the number of athletes who can use this app."

**Cause:** Unverified Strava apps have a ~15 athlete limit.

**Fix:** Revoke unused athletes at https://www.strava.com/settings/apps, or create a new Strava API app for a fresh slate.

---

## Procedure: Local Auth Script (Reliable Workaround)

Use this when the production OAuth flow isn't working.

### Prerequisites
- Node.js installed locally
- Access to the project's `.env.local` with `DATABASE_URL`
- Access to Strava API settings (https://www.strava.com/settings/api)

### Steps

1. **Set Strava callback domain to `localhost`**
   - Go to https://www.strava.com/settings/api
   - Set "Authorization Callback Domain" to: `localhost`
   - Save

2. **Run the auth script**
   ```bash
   cd /path/to/stride-os
   export $(grep -v '^#' .env.local | xargs) && node scripts/strava-auth.mjs
   ```

3. **Open http://localhost:5174 in your browser**
   - You'll be redirected to Strava
   - Click "Authorize"
   - The script exchanges the code, saves tokens to the DB, and verifies

4. **Verify in the script output:**
   - "Token exchange successful!"
   - "Database updated!"
   - Activity access shows "Working!"

5. **Change Strava callback domain back to `www.getdreamy.run`**

6. **Go to getdreamy.run**
   - It should show "Strava Connected"
   - Click the sync (refresh) button
   - Do NOT click Connect, Disconnect, or Manual API Keys

### If tokens get wiped after the script
The production app may clear tokens if it detects them as invalid (e.g., through the `strava-fix.ts` status check or if you click Connect/Manual). If this happens:
- Re-run the script
- Go directly to the sync action — avoid the settings page entirely until synced

---

## Procedure: Production OAuth (When It Works)

### Prerequisites
- Strava callback domain set to `www.getdreamy.run`
- `STRAVA_CLIENT_SECRET` env var set in Vercel
- `NEXT_PUBLIC_STRAVA_CLIENT_ID` env var set in Vercel
- Middleware allows `/api/strava` routes (check `src/middleware.ts`)

### Steps

1. Go to Settings on getdreamy.run
2. Under Strava, choose "Quick Connect"
3. Click "Connect with Strava"
4. Authorize on Strava
5. You'll be redirected to `/strava-sync?strava=success`
6. Activities sync automatically

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/StravaAttribution.tsx` | The "Connect with Strava" button + OAuth URL builder |
| `src/components/StravaConnect.tsx` | Main Strava settings UI (connect/disconnect/sync) |
| `src/app/api/strava/callback/route.ts` | OAuth callback handler |
| `src/app/api/strava/webhook/route.ts` | Webhook receiver (activity create/update/delete) |
| `src/lib/strava.ts` | Core Strava API functions (token exchange, refresh, activity fetch) |
| `src/lib/strava-api.ts` | Rate-limited fetch wrapper for Strava API |
| `src/lib/strava-client.ts` | Client-safe auth URL builder |
| `src/actions/strava.ts` | Server actions (sync, connect, disconnect) |
| `src/actions/strava-fix.ts` | Enhanced status check with token refresh |
| `src/actions/strava-manual.ts` | Manual token entry (only gives `read` scope!) |
| `src/middleware.ts` | Password gate — must exempt `/api/strava` |
| `scripts/strava-auth.mjs` | Local auth server (the reliable workaround) |

---

## TODO: Make Production OAuth Reliable

The production OAuth *should* work now with these fixes applied:
- [x] Middleware exempts `/api/strava` routes (2026-02-15)
- [x] SSR fallback URL uses `www.getdreamy.run`
- [ ] **Test production OAuth with callback domain set to `www.getdreamy.run`**
- [ ] Implement webhook `activity.create` handler (currently a TODO — new activities aren't auto-synced)
- [ ] Add better error messages when token scope is insufficient
- [ ] Consider applying for Strava API verification to lift athlete limit
