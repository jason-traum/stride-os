# STRIDE-OS (Dreamy) - Forensic Codebase Review

**Generated**: 2026-02-03
**Reviewer**: Claude Opus 4.5 (Forensic Analysis)
**Codebase Version**: As of commit at time of review

---

## A) Executive Summary

Stride-OS (branded "Dreamy") is a **full-featured AI-powered running coach and training management platform**. Based strictly on code analysis:

- **Next.js 14 App Router application** with TypeScript, Tailwind CSS, and Drizzle ORM
- **17 user-facing pages** covering training planning, workout logging, analytics, equipment tracking, and AI coaching
- **Claude-powered AI coach** with 60+ tools for conversational run logging, plan modifications, and contextual advice
- **Dual-database architecture**: SQLite for local dev, PostgreSQL (Neon) for production
- **External integrations**: Strava OAuth, Intervals.icu API, Open-Meteo weather (no API key needed)
- **PWA-capable** with offline support via service worker, installable on mobile
- **Sophisticated training intelligence**: VDOT-based pacing (Jack Daniels), CTL/ATL/TSB fitness modeling, automated workout classification, 50+ workout templates
- **Demo mode** using localStorage for risk-free exploration without database

---

## B) Repository Architecture Map

### Directory Structure

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages (17 routes) |
| `src/app/api/` | API routes (6 endpoints) |
| `src/actions/` | Server actions (29 files, 150+ functions) |
| `src/components/` | React components (70+ files) |
| `src/lib/` | Core utilities, integrations, training algorithms |
| `src/lib/training/` | Training intelligence (12 files, VDOT, CTL/ATL, classification) |
| `scripts/` | Migration, seeding, and utility scripts (20 files) |
| `drizzle/` | SQLite migrations |
| `public/` | Static assets, PWA manifest, service worker |
| `data/` | SQLite database file (`stride.db`) |

### Runtimes & Frameworks

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, custom design system |
| Backend | Next.js Server Actions, API Routes |
| Database (dev) | SQLite via better-sqlite3 |
| Database (prod) | PostgreSQL via @neondatabase/serverless |
| ORM | Drizzle ORM 0.45.1 |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Icons | Lucide React |

### Entrypoints

| Entrypoint | File | Purpose |
|------------|------|---------|
| App Bootstrap | `src/app/layout.tsx` | Root layout with providers, navigation |
| Home Page | `src/app/page.tsx` | Redirects to `/onboarding` or `/today` |
| API | `src/app/api/**/route.ts` | 6 API endpoints |
| Service Worker | `public/sw.js` | Offline caching |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, npm scripts |
| `next.config.mjs` | Next.js config (eslint/typescript errors ignored during build) |
| `drizzle.config.ts` | SQLite schema config |
| `drizzle.pg.config.ts` | PostgreSQL schema config |
| `vercel.json` | Vercel deployment (iad1 region, 30s function timeout) |
| `public/manifest.json` | PWA manifest |
| `tailwind.config.ts` | Tailwind customization |
| `.env.example` | Environment variable template |

---

## C) Feature Catalog

### C1. Authentication & Profiles

#### Feature: Multi-Profile Support
- **What it does**: Supports multiple runner profiles within a single app instance (e.g., personal, demo, shared device)
- **How triggered**: Profile switcher in sidebar/mobile nav, or via `/api/profiles`
- **Inputs**: Profile name, type (personal/demo), avatar color
- **Outputs**: Profile record with settings snapshot
- **Data model**: `profiles` table (id, name, type, avatarColor, isProtected, settingsSnapshot)
- **Auth**: None (profile ID stored in cookies)
- **Code refs**: `src/actions/profiles.ts:1-200`, `src/components/ProfileSwitcher.tsx`
- **Constraints**: Protected profiles cannot be deleted; demo profiles have `isProtected=true`
- **External deps**: None

---

### C2. Onboarding

#### Feature: 10-Step Setup Wizard
- **What it does**: Collects comprehensive user profile through guided wizard: name, training state, race goals, preferences, injury history, PRs
- **How triggered**: Auto-redirect from `/` if `onboardingCompleted=false`, or via `/onboarding`
- **Inputs**:
  - Step 1: Name, persona, current mileage, runs/week, long run max
  - Step 2: Peak mileage target, preferred days, rest days, aggressiveness
  - Step 3: Recent race result (optional) for VDOT
  - Step 4: Goal race (required): name, date, distance, target time
  - Steps 5-10: Athletic background, comfort levels, injury history, schedule, PRs
- **Outputs**: Populated `userSettings`, optional `race` and `raceResult` records
- **Data model**: `userSettings` (100+ fields), `races`, `raceResults`
- **Auth**: None
- **Code refs**: `src/app/onboarding/page.tsx:1-800`, `src/actions/onboarding.ts:1-250`
- **Constraints**: VDOT auto-calculated from race result if provided (all-out effort)
- **External deps**: None

---

### C3. Today Dashboard

#### Feature: Daily Training Hub
- **What it does**: Shows today's planned workout, current weather conditions, outfit recommendation, weekly stats, alerts, and quick actions
- **How triggered**: Navigate to `/today` (default landing after onboarding)
- **Inputs**: User location (from settings), current date
- **Outputs**: Planned workout card, weather display, outfit suggestion, recent workouts, streak badge, alerts
- **Data model**: `plannedWorkouts`, `workouts`, `userSettings`, `clothingItems`
- **Auth**: None
- **Code refs**: `src/app/today/page.tsx:1-400`
- **Constraints**: Weather requires location; falls back to 55°F cloudy if unavailable
- **External deps**: Open-Meteo API (weather)

#### Feature: Proactive Alerts System
- **What it does**: Detects and displays warnings (injury status, high fatigue, shoe mileage) and celebrations (milestones, PRs)
- **How triggered**: Automatic on page load
- **Inputs**: Recent workouts, settings, shoes
- **Outputs**: Alert cards with severity and actionable advice
- **Data model**: Cross-references `workouts`, `shoes`, `userSettings`
- **Code refs**: `src/actions/alerts.ts`, `src/components/AlertsDisplay.tsx`

---

### C4. Workout Logging

#### Feature: Manual Run Entry
- **What it does**: Full workout logging form with weather, location, shoe tracking, and auto-calculations
- **How triggered**: Navigate to `/log` or click "Log Run" anywhere
- **Inputs**: Date, time, distance OR duration (auto-calculates missing), workout type, route name, shoe, notes
- **Outputs**: New `workout` record, updated shoe mileage
- **Data model**: `workouts`, `shoes`, `assessments`
- **Auth**: None
- **Code refs**: `src/app/log/page.tsx:1-500`, `src/actions/workouts.ts:1-150`
- **Constraints**: Pace sanity check (warns if <3:00/mi or >20:00/mi); requires at least distance OR duration
- **External deps**: Open-Meteo (auto-captures weather at run time)

#### Feature: Post-Run Assessment
- **What it does**: Captures subjective workout feedback: verdict (great/good/fine/rough/awful), RPE 1-10, legs feel, breathing, sleep quality, stress, soreness, hydration
- **How triggered**: Modal after saving workout, or edit from workout detail
- **Inputs**: 15+ assessment fields across physical, sleep, life factors
- **Outputs**: `assessment` record linked to workout
- **Data model**: `assessments` (30+ fields)
- **Code refs**: `src/components/AssessmentModal.tsx`, `src/actions/workouts.ts:150-250`
- **Constraints**: RPE required, verdict required; other fields optional

---

### C5. AI Coach

#### Feature: Conversational AI Coach
- **What it does**: Claude-powered chat interface for natural language run logging, training advice, plan modifications, and contextual coaching
- **How triggered**: Navigate to `/coach`, floating chat button on any page, or quick prompts on Today page
- **Inputs**: User message, conversation history, user settings context
- **Outputs**: Streaming text response with tool calls for data modifications
- **Data model**: `chatMessages`, reads/writes all training tables via tools
- **Auth**: Requires `ANTHROPIC_API_KEY`
- **Code refs**: `src/app/api/chat/route.ts:1-300`, `src/lib/coach-prompt.ts:1-600`, `src/components/Chat.tsx`
- **Constraints**: Streaming via SSE; 30s function timeout; persona modifies tone not knowledge
- **External deps**: Anthropic Claude API (claude-sonnet-4-20250514)

#### Feature: Coach Tools (60+ tools)
Tools available to the AI coach, grouped by category:

**Workout Management (12 tools)**:
- `get_recent_workouts`, `get_workout_detail`, `log_workout`, `log_assessment`, `get_training_summary`, `search_workouts`, `get_todays_workout`, `get_week_workouts`, `compare_workouts`, `analyze_completed_workout`, `analyze_workout_patterns`, `estimate_workout_quality`

**Plan Management (14 tools)**:
- `get_weekly_plan`, `get_todays_planned_workout`, `update_planned_workout`, `modify_todays_workout`, `suggest_workout_modification`, `swap_workouts`, `reschedule_workout`, `skip_workout`, `make_down_week`, `insert_rest_day`, `adjust_workout_distance`, `convert_to_easy`, `suggest_plan_adjustment`, `generate_training_plan`

**Pace & Performance (6 tools)**:
- `get_pace_zones`, `calculate_adjusted_pace`, `predict_race_time`, `get_altitude_pace_adjustment`, `get_training_philosophy`, `get_training_load`

**Analytics & Insights (10 tools)**:
- `get_fitness_trend`, `get_fatigue_indicators`, `get_plan_adherence`, `get_readiness_score`, `get_proactive_alerts`, `analyze_recovery_pattern`, `get_pre_run_briefing`, `get_weekly_review`, `get_upcoming_week_preview`, `suggest_next_workout`

**Code refs**: `src/lib/coach-prompt.ts` (tool definitions inlined in system prompt)

#### Feature: Coach Personas (5 styles)
- **Encouraging**: Supportive, celebrates small wins
- **Analytical**: Data-driven, specific metrics
- **Tough Love**: Direct, accountability-focused
- **Zen**: Calm, present-focused, mindful
- **Hype**: High energy, motivational

**Code refs**: `src/lib/coach-personas.ts:1-210`

---

### C6. Training Plan Management

#### Feature: AI-Generated Training Plans
- **What it does**: Creates periodized 12-24 week training plans for goal races with phases (base→build→peak→taper), daily workouts, and mileage progression
- **How triggered**: Click "Generate Plan" on `/plan` page, or via coach chat
- **Inputs**: Goal race, current fitness, preferences, aggressiveness
- **Outputs**: `trainingBlocks` (phases), `plannedWorkouts` (daily workouts)
- **Data model**: `races`, `trainingBlocks`, `plannedWorkouts`, `workoutTemplates`
- **Auth**: None
- **Code refs**: `src/lib/training/plan-generator.ts:1-400`, `src/actions/training-plan.ts:1-400`
- **Constraints**: Requires goal race with date; respects preferred days; 50+ workout templates
- **External deps**: None (deterministic algorithm)

#### Feature: Plan Modification
- **What it does**: Adjust planned workouts: scale down intensity, swap with alternative, move to different date, skip with reason
- **How triggered**: Click workout on `/plan`, or via coach chat
- **Inputs**: Workout ID, modification type, new values
- **Outputs**: Updated `plannedWorkout` record
- **Code refs**: `src/components/plan/WorkoutModifyModal.tsx`, `src/actions/training-plan.ts:200-350`

#### Feature: Plan Import
- **What it does**: Import training plans from CSV or ICS (iCalendar) files
- **How triggered**: Import button on `/plan` page
- **Inputs**: File content, format (csv/ics), target race ID
- **Outputs**: Imported `plannedWorkout` records
- **Code refs**: `src/actions/plan-import.ts:1-200`, `src/components/PlanImportModal.tsx`
- **Constraints**: CSV must have date, name, distance columns; ICS parses VEVENT blocks

---

### C7. Race Management

#### Feature: Goal Race Tracking
- **What it does**: Track upcoming races with priority (A/B/C), target times, countdown
- **How triggered**: Navigate to `/races`, click "Add Race"
- **Inputs**: Race name, date, distance, priority, target time, location
- **Outputs**: `race` record
- **Data model**: `races` (id, name, date, distanceMeters, distanceLabel, priority, targetTimeSeconds)
- **Code refs**: `src/app/races/page.tsx:1-300`, `src/actions/races.ts:1-150`

#### Feature: Race Results Logging
- **What it does**: Log completed races with auto VDOT calculation
- **How triggered**: Click "Log Result" on `/races`
- **Inputs**: Race name, date, distance, finish time, effort level, conditions
- **Outputs**: `raceResult` record, auto-updated VDOT in settings
- **Data model**: `raceResults`, `userSettings.vdot`
- **Code refs**: `src/actions/races.ts:150-300`
- **Constraints**: VDOT only updates from "all_out" or "hard" efforts

---

### C8. Analytics & Insights

#### Feature: Training Analytics Dashboard
- **What it does**: 20+ visualizations of training data: mileage trends, fitness curves, workout distribution, best efforts, PRs
- **How triggered**: Navigate to `/analytics`
- **Inputs**: 90 days of workout history
- **Outputs**: Charts, stats cards, trend analysis
- **Data model**: `workouts`, `assessments`, `raceResults`
- **Code refs**: `src/app/analytics/page.tsx:1-400`, `src/actions/analytics.ts:1-300`

Key visualizations:
- Weekly mileage chart (8 weeks)
- CTL/ATL/TSB fitness trend (Banister model)
- Training load bar
- Best efforts table (5K, 10K, Half, Marathon)
- Pace curve
- Training distribution (80/20 analysis)
- Activity heatmap (GitHub-style)
- Monthly calendar
- Streak badges

#### Feature: Fitness Scoring (CTL/ATL/TSB)
- **What it does**: Calculates training stress balance using impulse-response model
- **Calculations**:
  - CTL (fitness): 42-day exponential weighted average of training load
  - ATL (fatigue): 7-day exponential weighted average
  - TSB (form): CTL - ATL
- **Code refs**: `src/lib/training/fitness-calculations.ts:1-150`

#### Feature: Readiness Score
- **What it does**: Daily readiness assessment (0-100) based on sleep, training stress, soreness, life factors
- **How triggered**: Today page, coach context
- **Calculation**: Weighted: Sleep 35%, Training 25%, Physical 25%, Life 15%
- **Code refs**: `src/lib/readiness.ts:1-200`, `src/actions/readiness.ts`

---

### C9. Pace & Weather Tools

#### Feature: Pace Calculator with Weather Adjustment
- **What it does**: Calculates adjusted pace based on temperature, humidity, wind, workout type
- **How triggered**: Navigate to `/pace-calculator`
- **Inputs**: Target pace, weather conditions (live or manual), workout type, acclimatization score
- **Outputs**: Adjusted pace with reasoning, severity score
- **Code refs**: `src/app/pace-calculator/page.tsx:1-400`, `src/lib/conditions.ts:1-250`
- **Calculation**: Heat index (Rothfusz), wind chill, severity scoring (0-100)

#### Feature: Weather Integration
- **What it does**: Fetches current and forecast weather for outfit/pace recommendations
- **API**: Open-Meteo (free, no API key)
- **Caching**: 30-minute TTL, coordinates rounded to 2 decimals
- **Code refs**: `src/lib/weather.ts:1-200`

#### Feature: Outfit Recommendation
- **What it does**: Recommends clothing layers based on "Vibes Temp" calculation
- **Calculation**: VT = feels_like + effort_heat + distance_adjustment + personal_preference
  - Effort heat: recovery +20°F → race +40°F
  - Personal: runs_cold -8°F, runs_hot +8°F
- **Code refs**: `src/lib/outfit.ts:1-200`

---

### C10. Equipment Management

#### Feature: Shoe Rotation Tracking
- **What it does**: Track shoes with mileage, category, retirement status
- **How triggered**: Navigate to `/shoes`
- **Inputs**: Nickname, brand, model, category, intended use
- **Outputs**: `shoe` record with auto-updating mileage from workouts
- **Data model**: `shoes` (id, name, brand, model, category, totalMiles, isRetired)
- **Categories**: daily_trainer, tempo, race, trail, recovery
- **Code refs**: `src/app/shoes/page.tsx`, `src/actions/shoes.ts`

#### Feature: Wardrobe Management
- **What it does**: Track running clothing inventory for outfit recommendations
- **How triggered**: Navigate to `/wardrobe`
- **Inputs**: Name, category, warmth rating (1-5)
- **Outputs**: `clothingItem` records
- **Categories**: 18 types (top_short_sleeve, outer_shell, bottom_leggings, gloves_thin, beanie, etc.)
- **Code refs**: `src/app/wardrobe/page.tsx`, `src/actions/wardrobe.ts`

---

### C11. Route Tracking

#### Feature: Canonical Route Detection
- **What it does**: Automatically detects and tracks repeated running routes for PR tracking
- **How triggered**: Background processing after workout save
- **Inputs**: Workout distance, elevation, GPS if available
- **Outputs**: `canonicalRoute` with best time, average time, run count
- **Data model**: `canonicalRoutes`, `workouts.routeId`
- **Matching**: Distance within ±0.1 miles, elevation ±50 feet, GPS start/end <0.1 miles
- **Code refs**: `src/lib/training/route-matcher.ts:1-200`, `src/app/routes/page.tsx`

---

### C12. External Integrations

#### Feature: Strava Sync
- **What it does**: OAuth-based import of activities from Strava with laps and HR zones
- **How triggered**: Settings page → Connect Strava, or auto-sync on page load
- **Auth**: OAuth 2.0 with refresh token flow
- **Data imported**: Distance, duration, pace, HR, elevation, laps, workout type
- **Code refs**: `src/actions/strava.ts:1-300`, `src/lib/strava.ts:1-200`
- **Constraints**: Rate limit handling; Strava-only activities (not Apple Watch uploads)

#### Feature: Intervals.icu Sync
- **What it does**: Import activities and fitness data from Intervals.icu via API key
- **How triggered**: Settings page → Enter Athlete ID + API Key
- **Auth**: HTTP Basic Auth with API key
- **Data imported**: Activities, training load, wellness data
- **Code refs**: `src/actions/intervals.ts:1-200`, `src/lib/intervals.ts:1-150`

---

### C13. Demo Mode

#### Feature: Browser-Only Demo
- **What it does**: Full app experience using localStorage instead of database for zero-setup demos
- **How triggered**: URL parameter `?demo=true` or `?demo=true&sample=true`
- **Storage**: localStorage keys: `dreamy_demo_settings`, `dreamy_demo_workouts`, `dreamy_demo_shoes`
- **Sample data**: Pre-seeded runner "Alex" with 10 workouts, 3 shoes, training for marathon
- **Code refs**: `src/lib/demo-mode.ts:1-340`, `src/components/DemoModeProvider.tsx`
- **Constraints**: No persistence across browsers; custom events for cross-component refresh

---

## D) API Catalog

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/chat` | ANTHROPIC_API_KEY | AI coach streaming chat |
| GET | `/api/calendar/export` | None | Export plan as ICS file |
| GET | `/api/strava/callback` | Strava OAuth | OAuth callback handler |
| GET/POST | `/api/profiles` | None | List/create profiles |
| POST/GET | `/api/seed-demo` | SEED_SECRET_KEY | Seed demo data |
| GET | `/api/share/[type]/[id]` | None | Generate OG share images |

### Detailed API Specifications

#### POST `/api/chat`
```typescript
Request: {
  messages: Array<{role: 'user'|'assistant', content: string}>,
  newMessage: string,
  isDemo?: boolean,
  demoData?: DemoData
}
Response: text/event-stream (SSE)
Events: {type: 'text'|'tool_call'|'demo_action'|'done'|'error', content: string}
```

#### GET `/api/calendar/export`
```typescript
Query: { weeks?: number, includeCompleted?: boolean }
Response: text/calendar (ICS file)
```

#### GET `/api/share/[type]/[id]`
```typescript
Params: type = 'workout' | 'weekly', id = number
Query (weekly): { week, miles, runs, pace, adherence?, highlight? }
Response: image/png (600x400 Open Graph image)
```

---

## E) UI/Screens Catalog

| Route | Page Type | Purpose |
|-------|-----------|---------|
| `/` | Server | Redirect to /onboarding or /today |
| `/today` | Server | Daily dashboard |
| `/coach` | Server+Client | AI chat interface |
| `/log` | Client | Manual workout entry |
| `/plan` | Client | Training plan view/management |
| `/races` | Client | Goal races and results |
| `/history` | Server | Workout history list |
| `/workout/[id]` | Server | Workout detail with splits |
| `/analytics` | Server | Training analytics (20+ charts) |
| `/shoes` | Client | Shoe inventory |
| `/wardrobe` | Client | Clothing inventory |
| `/pace-calculator` | Client | Weather-adjusted pace calculator |
| `/routes` | Server | Detected routes list |
| `/routes/[id]` | Server | Route detail with PRs |
| `/settings` | Client | User preferences, integrations |
| `/onboarding` | Client | 10-step setup wizard |
| `/guide` | Client | App documentation |

### Key User Journeys

**Journey 1: New User Setup**
1. Visit `/` → redirect to `/onboarding`
2. Complete 10-step wizard (basic info → goal race → preferences)
3. Redirect to `/today`
4. Optionally connect Strava/Intervals in Settings

**Journey 2: Daily Training Flow**
1. `/today` → View planned workout, weather, outfit
2. Complete run
3. `/log` → Enter workout data
4. Assessment modal → Rate how it felt
5. `/today` → See celebration, updated stats

**Journey 3: Plan Generation**
1. `/races` → Add goal race
2. `/plan` → Click "Generate Plan"
3. Review generated phases and workouts
4. Modify individual workouts as needed

**Journey 4: Coach Interaction**
1. `/coach` or floating chat
2. Natural language: "How did my week go?"
3. Coach analyzes and responds with insights
4. "Make today's workout easier" → Coach modifies plan

---

## F) Integrations Catalog

| Integration | Auth Method | Data Flow | Code Location |
|-------------|-------------|-----------|---------------|
| **Anthropic Claude** | API Key | Outbound chat | `src/app/api/chat/route.ts` |
| **Strava** | OAuth 2.0 | Inbound activities | `src/lib/strava.ts`, `src/actions/strava.ts` |
| **Intervals.icu** | API Key (Basic Auth) | Inbound activities | `src/lib/intervals.ts`, `src/actions/intervals.ts` |
| **Open-Meteo** | None (public) | Inbound weather | `src/lib/weather.ts` |

### Strava Integration Details
- **OAuth endpoints**: `strava.com/oauth/authorize`, `/token`, `/deauthorize`
- **API endpoints**: `/athlete`, `/athlete/activities`, `/activities/{id}/laps`, `/activities/{id}/streams`
- **Token refresh**: Automatic with 5-minute buffer
- **Rate limit handling**: Returns partial data on 429

### Intervals.icu Integration Details
- **API endpoints**: `/athlete/{id}`, `/activities`, `/wellness`
- **Data mapped**: Activities → workouts, training load, intensity scores
- **Wellness data**: Sleep, HRV, stress, mood, fatigue

### Weather Integration Details
- **Endpoints**: Forecast API, Archive API, Geocoding API
- **Caching**: 30-minute TTL server-side
- **Fallback**: 55°F cloudy on error

---

## G) Background Jobs/Workers Catalog

No dedicated background job infrastructure. All processing is:
1. **Request-triggered**: Sync on page load or user action
2. **Server action-based**: `syncStravaActivities()`, `syncIntervalsActivities()`
3. **Async fire-and-forget**: Strava sync initiated after OAuth callback

Potential future jobs (not implemented):
- Scheduled Strava/Intervals sync
- Weekly recap email
- Stale data cleanup

---

## H) Data Model Catalog

### Core Tables

| Table | Purpose | Key Fields | Related To |
|-------|---------|------------|------------|
| `profiles` | Multi-user support | id, name, type, avatarColor | userSettings, all data |
| `userSettings` | User preferences (100+ fields) | profileId, name, vdot, paces, location, integrations | profiles |
| `workouts` | Completed runs | date, distance, duration, pace, type, HR, weather | shoes, assessments, segments |
| `assessments` | Post-run feedback | workoutId, verdict, rpe, legsFeel, sleep, stress | workouts |
| `workoutSegments` | Laps/splits | workoutId, segmentNumber, distance, pace, HR | workouts |
| `shoes` | Shoe inventory | name, brand, model, category, totalMiles, isRetired | workouts |
| `clothingItems` | Wardrobe | name, category, warmthRating, isActive | profiles |

### Training Plan Tables

| Table | Purpose | Key Fields | Related To |
|-------|---------|------------|------------|
| `races` | Goal races | name, date, distanceMeters, priority, targetTime | trainingBlocks, plannedWorkouts |
| `raceResults` | Completed races | date, distanceMeters, finishTimeSeconds, calculatedVdot | profiles |
| `trainingBlocks` | Plan phases | raceId, phase, startDate, endDate, targetMileage | races, plannedWorkouts |
| `plannedWorkouts` | Scheduled workouts | date, workoutType, targetDistance, status | races, trainingBlocks, workoutTemplates |
| `workoutTemplates` | Workout library | id, name, category, structure, purpose | plannedWorkouts |

### Advanced Feature Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `chatMessages` | Coach conversation history | profileId, role, content |
| `canonicalRoutes` | Detected running routes | name, fingerprint, bestTimeSeconds, runCount |
| `sorenessEntries` | Body region soreness tracking | assessmentId, bodyRegion, severity |
| `coachSettings` | Coach mode preferences | mode (advisor/autopilot), travelMode, busyWeek |
| `coachActions` | Audit log of coach recommendations | actionType, description, approved |

---

## I) Configuration & Environment Variables

### Required for Production

| Variable | Purpose | Example |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude API access | `sk-ant-api03-...` |
| `DATABASE_URL` | PostgreSQL connection | `postgres://user:pass@host:5432/db` |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_STRAVA_CLIENT_ID` | Strava OAuth | None |
| `STRAVA_CLIENT_SECRET` | Strava OAuth | None |
| `SEED_SECRET_KEY` | Demo seed endpoint auth | `demo-seed-2024` |
| `NEXT_PUBLIC_BASE_URL` | App base URL | Auto-detected |

### Local Development

SQLite database at `./data/stride.db` - no DATABASE_URL needed.

### npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:push` | Push SQLite schema |
| `npm run db:push:pg` | Push PostgreSQL schema |
| `npm run db:studio` | Drizzle Studio GUI |
| `npm run db:seed:demo` | Seed demo data |

---

## J) Known Issues / TODOs / Missing Pieces

### TODOs in Code

| Location | Issue |
|----------|-------|
| `src/actions/training-plan.ts:218` | `TODO: Map workout.templateId to correct DB template IDs` |

### Build Configuration Concerns

**`next.config.mjs:3-9`**: Both ESLint and TypeScript errors are ignored during builds:
```javascript
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true }
```
This may mask issues in production.

### Incomplete Features (based on code patterns)

1. **Routes Page**: `canonicalRoutes` table exists and route-matcher.ts is implemented, but route detection doesn't appear to run automatically
2. **Coach Actions Audit**: `coachActions` table exists but approval workflow not fully implemented
3. **Soreness Map**: `sorenessEntries` table and `SorenessMap.tsx` component exist but body-region tracking UI incomplete
4. **Workout Segments**: Import from Strava works, but manual lap entry UI not visible

### Potential Security Concerns

1. **No authentication**: App relies on profile ID in cookies; no user accounts
2. **OAuth tokens stored in DB**: Strava/Intervals tokens in `userSettings` table (standard practice but sensitive)
3. **Demo endpoint**: `/api/seed-demo` has weak auth (`SEED_SECRET_KEY` defaults to `demo-seed-2024`)

### Missing Error Boundaries

Several pages lack error boundaries for graceful failure handling.

---

## K) "How to Verify" Checklist

### Setup Verification
- [ ] Clone repo, run `npm install`
- [ ] Run `npm run dev`, visit `localhost:3000`
- [ ] Verify redirect to `/onboarding`

### Onboarding Flow
- [ ] Complete all 10 onboarding steps
- [ ] Enter a race result, verify VDOT calculates
- [ ] Add goal race, verify it appears on `/races`
- [ ] Check `/today` loads with personalized greeting

### Workout Logging
- [ ] Navigate to `/log`
- [ ] Enter distance and duration, verify pace calculates
- [ ] Submit workout, verify assessment modal appears
- [ ] Complete assessment, verify workout appears in `/history`
- [ ] Click workout in history, verify detail page loads with all data

### Training Plan
- [ ] Go to `/plan`, select a race
- [ ] Click "Generate Plan", verify phases and workouts generate
- [ ] Click a workout, verify modify modal opens
- [ ] Scale down a workout, verify target distance updates
- [ ] Mark a workout complete, verify status changes

### AI Coach
- [ ] Navigate to `/coach`
- [ ] Type "How am I doing this week?", verify streaming response
- [ ] Type "Log a 5 mile easy run today", verify workout logs
- [ ] Type "Make tomorrow's workout easier", verify plan modification

### Analytics
- [ ] Navigate to `/analytics` with existing workouts
- [ ] Verify weekly mileage chart renders
- [ ] Verify fitness trend (CTL/ATL) displays
- [ ] Verify best efforts table populates

### Integrations
- [ ] Go to `/settings`, click Connect Strava
- [ ] Complete OAuth flow, verify redirect back
- [ ] Verify activities begin syncing
- [ ] For Intervals.icu: Enter athlete ID + API key, verify validation

### Demo Mode
- [ ] Visit `/?demo=true&sample=true`
- [ ] Verify sample data loads (Alex runner)
- [ ] Navigate through app, verify localStorage persistence
- [ ] Clear browser data, verify demo data resets

### PWA
- [ ] On mobile Safari/Chrome, verify "Add to Home Screen" prompt
- [ ] Install app, verify standalone mode
- [ ] Go offline, verify cached pages load

---

*Report generated by forensic codebase analysis. All claims backed by code references. For unclear items, further investigation recommended.*
