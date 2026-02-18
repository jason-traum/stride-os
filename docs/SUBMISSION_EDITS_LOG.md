# Submission Edits Log
Date started: February 18, 2026
Purpose: Track temporary compliance-focused wording/UX changes for Strava submission so they can be reworded, kept, or reverted for athlete and investor messaging.

## How To Use This Log
- `Status` meanings:
  - `Applied`: already in code.
  - `Candidate`: suggested change, not yet implemented.
  - `Reverted`: intentionally undone.
- `Reword/Revert Plan`:
  - `Keep`: permanent product behavior.
  - `Reword later`: keep feature, change language after approval.
  - `Optional revert`: can safely roll back after submission.

## Applied Edits
### 2026-02-18 — Public support/compliance routes
- Status: `Applied`
- Change:
  - Made `/support`, `/privacy`, `/terms`, `/guide` publicly accessible in middleware.
  - Added dedicated `/support` page with support + deletion contact.
- Why (submission): reviewers must be able to see support/legal pages without credentials.
- Reword/Revert Plan: `Keep`
- Files:
  - `src/middleware.ts`
  - `src/app/support/page.tsx`

### 2026-02-18 — Support contact email update
- Status: `Applied`
- Change: replaced support email with `jasontraum8@gmail.com`.
- Why (submission): keeps support contact consistent between app and Strava form.
- Reword/Revert Plan: `Reword later` (replace with domain-based support inbox when ready)
- Files:
  - `src/app/support/page.tsx`
  - `src/app/privacy/page.tsx`
  - `src/app/terms/page.tsx`
  - `src/app/guide/page.tsx`

### 2026-02-18 — Guest/read-only hardening
- Status: `Applied`
- Change:
  - Read-only roles redirect away from mutation-heavy pages.
  - Role-scoped navigation for viewer/coach.
  - Viewer/coach land on `/history` after login.
- Why (submission): avoids broken reviewer flows and enforces least-privilege access.
- Reword/Revert Plan: `Keep`
- Files:
  - `src/middleware.ts`
  - `src/components/Navigation.tsx`
  - `src/app/gate/page.tsx`
  - `src/app/layout.tsx`

### 2026-02-18 — Cross-browser profile consistency
- Status: `Applied`
- Change:
  - Server sets `stride_active_profile` cookie at login (prefers connected profile).
  - Profile context now respects cookie first.
- Why (submission): stable Strava connection/sync behavior across browsers/devices.
- Reword/Revert Plan: `Keep`
- Files:
  - `src/app/api/gate/route.ts`
  - `src/lib/profile-context.tsx`

## Candidate Edits (Not Applied Yet)
### Submission-safe marketing copy pass
- Status: `Candidate`
- Change: review high-visibility copy to avoid ML-training phrasing while under review.
- Why (submission): reduce risk of reviewer interpreting Strava data use as model training.
- Reword/Revert Plan: `Reword later`
- Likely files:
  - `src/app/welcome/page.tsx`
  - `src/app/guide/page.tsx`
  - `docs/APPLICATION_SUMMARY_REPORT.md`

### Add explicit Strava attribution where data is shown
- Status: `Candidate`
- Change: add "Data from Strava" / "View on Strava" cues near imported activity surfaces.
- Why (submission): improves brand-guideline clarity in screenshots.
- Reword/Revert Plan: `Keep`
- Likely files:
  - `src/app/history/page.tsx`
  - `src/app/analytics/page.tsx`
  - `src/app/strava-sync/page.tsx`

## Pre-Submission Messaging Guardrails
- Avoid wording:
  - "train models"
  - "dataset"
  - "learn across users"
  - "model improvement from Strava data"
- Prefer wording:
  - "user-authorized import"
  - "personalized coaching logic for that user"
  - "display and analysis of a runner's own activities"

## Screenshot Pack Checklist
1. Connect entry point (button + copy)
2. OAuth approval screen
3. Connected state (athlete + disconnect)
4. Sync center
5. History list with imported activities
6. Workout detail with Strava-derived fields
7. Analytics chart using imported data
8. Settings connection controls
9. Support page with deletion/contact instructions
10. Strava attribution or "View on Strava" placement
