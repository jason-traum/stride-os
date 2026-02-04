# Overnight Development Report - Stride OS (Dreamy)

**Session Start:** 2026-02-03
**Branch:** `overnight-gap-fixes`
**Operator:** Claude Code (Autonomous Mode)

---

## BATCH 0: REPO REALITY CHECK + ROADMAP

### System Map

#### Stack
- **Framework:** Next.js 14.2.35 (App Router)
- **Language:** TypeScript 5
- **Database:** Drizzle ORM with dual support:
  - **Production:** Neon Serverless Postgres (`@neondatabase/serverless`)
  - **Local Dev:** Better-SQLite3
- **AI:** Anthropic SDK (claude-sonnet-4-20250514)
- **UI:** Tailwind CSS, Lucide React icons
- **Image Processing:** Sharp

#### Entry Points
| Route | Purpose | File |
|-------|---------|------|
| `/` | Redirects to `/today` | `src/app/page.tsx` |
| `/today` | Main dashboard | `src/app/today/page.tsx` |
| `/analytics` | Charts, heatmap, fitness | `src/app/analytics/page.tsx` |
| `/coach` | AI chat interface | `src/app/coach/page.tsx` |
| `/log` | Manual workout entry | `src/app/log/page.tsx` |
| `/history` | Workout list | `src/app/history/page.tsx` |
| `/plan` | Training plan calendar | `src/app/plan/page.tsx` |
| `/races` | Goal races management | `src/app/races/page.tsx` |
| `/settings` | User preferences, integrations | `src/app/settings/page.tsx` |
| `/shoes` | Shoe rotation | `src/app/shoes/page.tsx` |
| `/wardrobe` | Clothing items | `src/app/wardrobe/page.tsx` |
| `/pace-calculator` | Pace with weather adjustment | `src/app/pace-calculator/page.tsx` |
| `/onboarding` | Initial setup wizard | `src/app/onboarding/page.tsx` |
| `/workout/[id]` | Workout detail view | `src/app/workout/[id]/page.tsx` |

#### API Routes
| Route | Purpose |
|-------|---------|
| `/api/chat` | AI coach streaming endpoint |
| `/api/strava/callback` | OAuth callback |
| `/api/calendar/export` | ICS export |
| `/api/share/[type]/[id]` | OG image generation |
| `/api/profiles` | Profile management |
| `/api/seed-demo` | Demo data seeding |

#### Database Layer
- **Schema files:**
  - `src/lib/schema.ts` (SQLite)
  - `src/lib/schema.pg.ts` (Postgres)
  - `src/lib/schema-enums.ts` (shared enums)
- **Connection:** `src/lib/db.ts` (singleton pattern with auto-detection)
- **Config:** `drizzle.config.ts` (SQLite), `drizzle.pg.config.ts` (Postgres)
- **Key Tables:**
  - `profiles` - Multi-profile support
  - `user_settings` - Per-profile preferences, Strava tokens
  - `workouts` - Activity data
  - `workout_segments` - Laps/splits (THE MISSING LAPS TABLE)
  - `assessments` - Post-run feedback
  - `races` - Goal races
  - `planned_workouts` - Training plan workouts
  - `training_blocks` - Plan phases
  - `shoes`, `clothing_items` - Gear
  - `canonical_routes` - Route detection
  - `coach_actions` - Audit log
  - `coach_settings` - Advisor/autopilot mode

#### Background Jobs/Schedulers
- **NONE DETECTED** - No cron jobs, no background workers
- Strava sync is on-demand (manual trigger from settings page)
- No automatic overnight sync

#### Integrations
| Integration | Status | Files |
|-------------|--------|-------|
| Strava | OAuth 2.0 complete | `src/lib/strava.ts`, `src/actions/strava.ts` |
| Intervals.icu | Basic Auth | `src/actions/intervals.ts` |
| Open-Meteo | Free API | `src/lib/weather.ts` |
| Anthropic | API key | `src/app/api/chat/route.ts` |

#### Deployment
- **Platform:** Likely Vercel (Next.js optimized)
- **Database:** Neon Postgres (inferred from `@neondatabase/serverless`)
- **No CI/CD config detected** in repo root
- **No `vercel.json`** - using defaults
- **Environment Variables Required:**
  - `DATABASE_URL` (Postgres connection string)
  - `NEXT_PUBLIC_STRAVA_CLIENT_ID`
  - `STRAVA_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
  - (Optional) `INTERVALS_API_KEY`

---

### What's Built vs. Missing (File Evidence)

#### Confirmed Built
| Feature | Evidence |
|---------|----------|
| Multi-profile | `src/lib/schema.ts:85` (profiles table), `ProfileSwitcher.tsx` |
| Strava OAuth | `src/lib/strava.ts:55-74` (getStravaAuthUrl), `src/actions/strava.ts` |
| Lap sync code | `src/lib/strava.ts:311-328` (getStravaActivityLaps), `src/actions/laps.ts` |
| Workout segments table | `src/lib/schema.ts:541-554` (workoutSegments definition) |
| Activity heatmap | `src/components/charts/ActivityHeatmap.tsx` |
| AI Coach | `src/app/api/chat/route.ts`, 60+ tools in `src/lib/coach-tools.ts` |

#### Partially Built
| Feature | Status | Missing |
|---------|--------|---------|
| Lap display UI | Segments table exists | No visible lap display in workout detail page |
| Route detection | Table + matcher exists | Not auto-triggered on workout save |
| Coach approval workflow | Table exists | No UI for approve/reject |
| HR zones | Backend function exists | UI not confirmed |

#### Not Built
| Feature | Status |
|---------|--------|
| Living Pace Model | VDOT is still primary |
| Quick time rewrite | Not found |
| Auto-explainer | Not found |
| Treadmill conversion | Not found |
| Race week checklist | Not found |
| Weekly recap card | Not found |

---

### ROOT CAUSE HYPOTHESES: "Laps Went Missing"

After analyzing the codebase, here are the likely causes for missing laps:

#### Hypothesis 1: Delete-Then-Insert Pattern (MOST LIKELY)
**Location:** `src/actions/laps.ts:54-73`

```typescript
export async function saveWorkoutLaps(...) {
  // DELETE FIRST - this clears all laps
  await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));

  // Then insert - if this fails or laps array is empty, data is lost
  if (laps.length > 0) {
    await db.insert(workoutSegments).values(...);
  }
}
```

**Risk:** If the Strava API returns empty laps array OR the insert fails, the delete already happened. Data is lost.

#### Hypothesis 2: Missing Profile Scoping in Sync
**Location:** `src/actions/strava.ts:251-264`

The sync inserts workouts but does NOT set `profileId`. If you're viewing with a profile filter, workouts appear but their segments may not be associated.

```typescript
await db.insert(workouts).values({
  // NO profileId field!
  date: workoutData.date,
  ...
});
```

#### Hypothesis 3: Incremental Sync Only Fetches New Activities
**Location:** `src/actions/strava.ts:196-203`

```typescript
if (settings.stravaLastSyncAt) {
  // Only sync AFTER last sync date
  afterTimestamp = Math.floor(new Date(settings.stravaLastSyncAt).getTime() / 1000);
}
```

Existing activities that were imported but had lap fetch failures won't be retried.

#### Hypothesis 4: Rate Limiting / Silent Failures
**Location:** `src/actions/strava.ts:271-279`

```typescript
try {
  const stravaLaps = await getStravaActivityLaps(...);
  // Only saves if laps exist
  if (stravaLaps.length > 0) {
    await saveWorkoutLaps(...);
  }
} catch (lapError) {
  console.warn(`Failed to fetch laps...`);
  // CONTINUES WITHOUT LAPS - no retry mechanism
}
```

If Strava rate limits the laps endpoint, it silently continues without laps.

#### Hypothesis 5: Lap Sync Function Doesn't Check All Workouts
**Location:** `src/actions/strava.ts:324-341`

The `syncStravaLaps()` function only processes workouts with `source='strava'`:

```typescript
const stravaWorkouts = await db.query.workouts.findMany({
  where: and(
    eq(workouts.source, 'strava'),
  ),
});
```

This is correct, but it checks `existingLaps` and skips if ANY lap exists - it doesn't verify lap count matches expected.

---

### Roadmap: Gap Items → Batches

| Batch | Items | Focus |
|-------|-------|-------|
| **0** (this) | Setup | Repo analysis, GAP_CHECKLIST.md, OVERNIGHT_REPORT.md |
| **1** | GAP-004, GAP-029 | BLOCKER: Fix Strava lap sync, diagnostics, ensure laps persist |
| **2** | GAP-010, GAP-022 | BLOCKER: Analytics/heatmap data population, pipeline tracing |
| **3** | GAP-021, GAP-028, GAP-039, GAP-040 | UX bugs (greeting verified OK), real races added |
| **4** | GAP-041 | Integrated plan for United Half + Jersey City Marathon |
| **5+** | All remaining | In priority order per gap analysis |

---

## BATCH EXECUTION LOG

### Batch 0 Complete
- [x] Read `dreamy-gap-analysis.md`
- [x] Created `GAP_CHECKLIST.md` with all 66 items
- [x] Created `OVERNIGHT_REPORT.md` with system map
- [x] Identified 5 hypotheses for missing laps
- [x] Created branch `overnight-gap-fixes`

**Next:** Batch 1 - Fix Strava laps/streams sync

---

## Gap Status Table

| GAP-ID | Title | Status | Batch |
|--------|-------|--------|-------|
| GAP-001 | Soreness Body Map | partial | 5+ |
| GAP-002 | Coach Actions Audit | partial | 5+ |
| GAP-003 | Route Detection Auto-Run | partial | 5+ |
| GAP-004 | Workout Segments/Laps | partial | 1 |
| GAP-005 | Share Cards Polish | partial | 5+ |
| GAP-006 | Busy Week/Travel Mode | partial | 5+ |
| GAP-007 | Quick Workout Rewrite | not started | 5+ |
| GAP-008 | Auto-Explainer | not started | 5+ |
| GAP-009 | Auto-Categorization Full | partial | 5+ |
| GAP-010 | Multi-Mode Heatmap | partial | 2 |
| GAP-011 | Treadmill Conversion | not started | 5+ |
| GAP-012 | Race Week Checklist | not started | 5+ |
| GAP-013 | Weekly Recap Card | not started | 5+ |
| GAP-014 | Coach Dry-Run/Preview | not started | 5+ |
| GAP-015 | Gear Prep Reminder | not started | 5+ |
| GAP-016 | Sentiment-Aware Coach | partial | 5+ |
| GAP-017 | Living Pace Model | not started | 5+ |
| GAP-018 | Standard Plan Import | not started | 5+ |
| GAP-019 | Ultra Marathon Support | not started | 5+ |
| GAP-020 | Warm Color Palette | partial | 5+ |
| GAP-021 | Agenda-First Home | partial | 3 |
| GAP-022 | Charts/Heatmap Fix | in progress | 2 |
| GAP-023 | 16 Weeks Demo Data | not started | 5+ |
| GAP-024 | TRIMP Sqrt Normalization | implemented | - |
| GAP-025 | Pace Sanity Checks | implemented | - |
| GAP-026 | Running Power Values | not started | 5+ |
| GAP-027 | Multi-Benefit Run Purpose | implemented | - |
| GAP-028 | UX Bugs (Greeting, etc) | partial | 3 |
| GAP-029 | Lap Data Sync Debug | partial | 1 |
| GAP-030 | Pace Prediction Timeline | partial | 5+ |
| GAP-031 | HR Zone Per Activity | partial | 5+ |
| GAP-032 | Training Distribution | not started | 5+ |
| GAP-033 | Period Totals Dashboard | partial | 5+ |
| GAP-034 | Weekly Summary Sidebar | not started | 5+ |
| GAP-035 | Activity Cards Mini Zones | not started | 5+ |
| GAP-036 | Pace Curve/Critical Speed | partial | 5+ |
| GAP-037 | Ramp Rate Warning | not started | 5+ |
| GAP-038 | Wellness Trends | partial | 5+ |
| GAP-039 | United Half Race | not started | 3 |
| GAP-040 | Jersey City Marathon | not started | 3 |
| GAP-041 | Integrated Plan | not started | 4 |

---

*Report generated: Batch 0 - 2026-02-03*
