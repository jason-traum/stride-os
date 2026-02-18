# Strava Full Access Submission Plan
Date: February 18, 2026

## Official Requirements (Current)
- Single Player Mode starts at athlete capacity = 1.
- To onboard additional athletes, submit the Strava Developer Program form.
- Strava review checks demand, API agreement compliance, and brand compliance.

References:
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/docs/getting-started/
- https://developers.strava.com/docs/webhooks/
- https://developers.strava.com/guidelines/
- https://www.strava.com/legal/api
- https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8

## Readiness Status (This Repo)
### Completed in this pass
- Removed public/manual Strava token paths from primary connection UIs.
- Removed hardcoded Strava secrets/tokens from app pages and setup helpers.
- Added `/privacy` and `/terms` pages for submission URLs.
- Implemented webhook `activity.create` ingestion (auto-import + lap sync).
- Added read-only viewer mode via `VIEWER_PASSWORD` to let friends inspect data safely.
- Confirmed production OAuth connect now succeeds end-to-end.
- Registered production webhook subscription successfully (ID: `330845`, callback: `https://www.getdreamy.run/api/strava/webhook`).
- Set production `STRAVA_WEBHOOK_VERIFY_TOKEN`.

## Strava Sync Runbook (Historical + Final Fix)
### Current working process (confirmed)
1. In Strava app settings, keep callback domain as `www.getdreamy.run`.
2. In production env, set matching credentials:
- `STRAVA_CLIENT_ID`
- `NEXT_PUBLIC_STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
3. Ensure the secret value is clean (no trailing whitespace/newline).
4. Connect from Dreamy Settings using standard OAuth button.
5. Verify `/admin` > Strava Sync Health:
- `Profiles Connected` increments
- `Expired Tokens` returns to `0` after refresh/sync
6. Run `/strava-sync` and confirm imported activities.

### Previous troubleshooting attempts (kept for history)
- Revoking/reconnecting app access in Strava.
- Middleware/public route fixes for `/api/strava/*`.
- Redirect URI stabilization across domains.
- OAuth authorize flow moved server-side (`/api/strava/authorize`).
- Form-encoded token exchange with explicit callback URI.
- Profile-binding via OAuth `state` to avoid wrong-profile token writes.

### Final root cause that actually resolved it
- Strava returned `Authorization Error` / `resource: "Application"` because the production `STRAVA_CLIENT_SECRET` had an extra hidden trailing character.
- Runtime logs showed `secret_len=41` instead of expected `40`.
- Fix: re-enter secret without trailing characters and trim credentials in code before OAuth exchange/refresh.

### Still required before submission
1. Strava secret rotation
- Rotate Strava `client_secret` now (it previously existed in repo history).
- Update environment values in all deployed environments.

2. Webhook end-to-end validation
- Verify create/update/delete events against a real connected test athlete.

3. Compliance copy polish
- Confirm privacy/terms text exactly matches your current data processors and support contact.
- Add explicit “how to request account/data deletion” procedure in product docs/support flow.

4. Submission evidence pack
- 1-2 minute screen recording of full OAuth flow + where Strava data is displayed.
- Screenshots of every page showing Strava data and attribution.
- Usage metrics from your logs (`/debug/api-usage`) showing need and growth.

## Suggested Submission Narrative
- Product: AI running coach with workout analysis, planning, and readiness.
- Why Strava: source of truth for activity/lap data to personalize coaching.
- User value: importing complete activity context reduces manual logging and improves accuracy.
- Technical maturity: OAuth, token refresh, webhook handling, rate-limit backoff, attribution, privacy/terms.
- Request: increase athlete capacity and, if needed, higher rate limits as usage grows.

## Viewer Sharing Mode (Temporary Collaboration)
Use this to let friends inspect your real data while preventing edits.

Environment variables:
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` = full access
- `USER_USERNAME` / `USER_PASSWORD` = full app access (no admin API endpoints)
- `VIEWER_USERNAME` / `VIEWER_PASSWORD` = read-only access
- `COACH_USERNAME` / `COACH_PASSWORD` = read-only access (coach-style account)

Behavior:
- Admin/user: normal app access.
- Viewer/coach: read-only browsing; mutation requests are blocked by middleware.

## Next 48 Hours Checklist
1. Rotate Strava client secret and redeploy.
2. Run webhook verification in production.
3. Test OAuth from a second Strava athlete account.
4. Capture screenshots/video evidence.
5. Submit Developer Program form.
