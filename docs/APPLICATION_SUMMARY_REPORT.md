# Stride OS (Dreamy) Application Summary Report
Date: February 18, 2026
Repository: `/Users/jasontraum/stride-os`

## 1. Executive Summary
Stride OS (branded as Dreamy) is a production-oriented AI running coach platform built on Next.js 14 + React 18. It combines training plan generation, workout logging, analytics, race planning, weather-aware recommendations, and conversational coaching in one system. The app is designed as an athlete operating system rather than a single-purpose tracker, with integrated data capture (workouts, assessments, shoes, races, routes), adaptive planning, and AI-assisted decision support.

Current implementation breadth is large: 58 app pages, 20 API routes, 49 server action modules, 158 UI components, 108 library modules, and 24 core database tables. The codebase includes both user-facing and operator-facing surfaces (debug routes, sync tooling, migration scripts, feature tracking docs), indicating an active build-and-iterate product stage.

In short: this is a comprehensive, feature-rich training platform with strong architecture foundations, meaningful AI depth, and known integration/UX debt concentrated in a handful of high-leverage areas.

## 2. Product Scope and User Experience
### Core user journeys
- Onboarding and profile setup: guided multi-step intake for training context.
- Daily execution: `/today` provides planned workout, readiness context, weather, and proactive prompts.
- Planning: `/plan` and related planning tools manage scheduled workouts, phases, and plan edits.
- Logging and history: manual logs (`/log`) plus imported activity history (`/history`, workout detail pages).
- AI coaching: `/coach` plus floating chat support provides conversational recommendations and tool-driven actions.
- Performance and analytics: pages for readiness, pace bands/decay, injury risk, race prediction, best efforts, and trends.
- Equipment and conditions: shoe rotation, wardrobe recommendations, and weather preferences.

### Notable UX/system patterns
- Multi-profile model is present (personal/demo profiles).
- PWA support exists (`manifest`, service worker, install/offline banners).
- Demo mode is deeply integrated for product demos and synthetic data flows.
- A consistent app shell includes desktop sidebar, mobile header/nav, floating chat, and banners.

## 3. Technical Architecture
### Frontend
- Framework: Next.js 14 App Router.
- UI: React 18, Tailwind CSS, motion/charts/maps via Framer Motion, Recharts, Leaflet/React-Leaflet.
- Structure: route-based pages in `src/app`, reusable components in `src/components`, server actions in `src/actions`.

### Backend and data
- Data access: Drizzle ORM.
- Database strategy:
  - Local development defaults to SQLite (`better-sqlite3`, file in `data/stride.db`).
  - Production uses Postgres via Neon (`DATABASE_URL` switch in `src/lib/db.ts`).
- API style: mix of Next API routes (`src/app/api/**`) and direct server actions.

### AI layer
- Primary conversational pipeline in `src/app/api/chat/route.ts`.
- Tool calling via `coach-tools.ts` (large tool surface for workouts/plans/races/readiness/etc.).
- Multi-provider support exists (Anthropic + OpenAI) with model routing abstractions.
- Additional intelligence modules include coaching memory/context, proactive prompts, compression, and specialized training engines.

## 4. Functional Module Coverage
### Training intelligence and planning
- Plan generation and modification primitives are implemented (reschedule, swap, skip, convert, down-week behavior).
- Training libraries include VDOT calculations, plan rules, workout processors, run classification, execution scoring, and quality checks.
- Race support includes race management, prediction, and race-result linked data.

### Workout lifecycle
- Ingestion sources include manual entry and external sync (Strava, Intervals references).
- Workout records include pace/duration/distance plus richer metadata (HR, elevation, route fingerprinting, polyline, training load fields).
- Post-run assessments capture perceived effort and recovery context.

### Analytics and readiness
- Readiness scoring and factor breakdowns are available.
- Trend/volume/distribution cards and charts are implemented.
- Alerts and proactive coaching flows are integrated into daily experience.

### Integrations
- Strava OAuth + sync stack is implemented with callback/webhook routes and token refresh paths.
- Weather integration supports context-aware pace/outfit guidance.
- Deployment documentation targets Vercel + cloud Postgres.

## 5. Data Model Summary
The core schema is substantial (24 SQLite table definitions in `src/lib/schema.ts`). Key entities:
- Identity/context: `profiles`, `user_settings`, `coach_settings`, `coach_context`, `coaching_insights`.
- Training data: `workouts`, `assessments`, `planned_workouts`, `training_blocks`, `workout_segments`, `workout_fitness_signals`.
- Performance/racing: `races`, `race_results`, `vdot_history`, `master_plans`.
- Equipment/environment: `shoes`, `clothing_items`, `canonical_routes`, `soreness_entries`.
- AI/system telemetry: `chat_messages`, `coach_interactions`, `coach_actions`, `api_usage_logs`, templates.

This schema design supports longitudinal athlete modeling, adaptive recommendations, and post hoc analysis without needing major conceptual redesign.

## 6. Operational and Delivery Posture
### Deployment and environments
- Production deployment is documented for Vercel (`stride-os.vercel.app`, custom domain `getdreamy.run`).
- Environment management includes required AI, DB, and Strava credentials.
- Project includes migration and seed scripts for SQLite/Postgres and demo datasets.

### Observability and maintenance assets
- The repo includes multiple operator docs: deployment, known issues, runbooks, overnight reports, and feature trackers.
- Feature tracking is explicit, with completed items, TODOs, and sprint planning artifacts.

## 7. Current Risk and Gap Snapshot
Based on tracker/runbook state in the repository, highest-impact open areas are:
- Strava OAuth reliability in production (callback-domain and end-to-end verification still emphasized as fragile).
- Remaining coach/chat quality items (certain post-run flow/UX expectations and specific tool improvements still open).
- A few persistent UI/chart quality issues called out in known issues/feature tracker docs.
- Documentation drift risk: some capability docs and trackers differ in totals/status, which can confuse prioritization if not normalized to one source of truth.

## 8. Overall Assessment
Stride OS is beyond MVP: it is a broad, integrated platform with serious product depth across planning, coaching, and analytics. The architecture can support continued scale in features because major primitives are already in place (multi-profile context, robust schema, server actions, modular AI/tooling). Most remaining work appears to be quality hardening and integration reliability rather than missing foundational architecture.

From an application portfolio perspective, this codebase already contains the core components of an "AI coach operating system" for runners. The next stage should prioritize reliability, consistency, and polish on top of the existing breadth.

## 9. Recommended Next Priorities (Pragmatic)
1. Stabilize external integration reliability first: close Strava OAuth/sync edge cases and validate full production auth loop.
2. Reduce user-facing friction in daily coaching: finalize post-run questioning flow and remaining high-severity coach UX bugs.
3. Consolidate product truth docs: align capabilities tracker, feature tracker, and known issues into one canonical status view.
4. Add confidence checks around critical workflows: lightweight regression checks for sync, plan generation, and chat tool execution.
5. Continue incremental UX cleanup in analytics/workout detail where users flagged clarity and charting issues.

