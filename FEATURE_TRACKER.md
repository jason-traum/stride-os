# Stride OS Feature & Bug Tracker

## 🚨 Critical Bugs

### AI Coach Issues (HIGH SEVERITY)
1. **Fix prescribeWorkout function**
   - Status: DONE - 2026-02-12 (commit 07e8728)
   - Priority: CRITICAL
   - Details: Fixed! Now uses actual pace zones, CTL/ATL/TSB calculations, and adjusts based on fatigue levels
   - Location: coach-tools.ts:11140+

2. **Fix getRaceDayPlan function**
   - Status: DONE - 2026-02-12 (commit d1b60cd)
   - Priority: CRITICAL
   - Details: Fixed! Added race readiness (CTL/ATL/TSB), analyzes recent race-pace workouts, personalized tips with data
   - Location: coach-tools.ts:11640+

3. **Fix context persistence**
   - Status: ALREADY IMPLEMENTED
   - Priority: CRITICAL
   - Details: coachContext table exists and is used. rememberContext/recallContext use database storage, not Map()
   - Location: coach-tools.ts:12079+

4. **Add explain_workout_difficulty tool**
   - Status: TODO
   - Priority: HIGH
   - Details: No tool exists for analyzing why workouts felt hard. Should analyze TSB, sleep, weather, etc.

5. **Fix silent profile ID failures**
   - Status: TODO
   - Priority: HIGH
   - Details: Functions using getActiveProfileId() need null checks and helpful error messages

6. **Fix greeting bug**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Shows "Good morning, Coach" instead of user's name. Fixed to use DynamicGreeting component.
   - Location: app/coach/page.tsx:21

### Coach Chat Issues (CRITICAL)
1. **Post-Run Questions Show as User Messages**
   - Status: DONE - 2026-02-13
   - Priority: CRITICAL
   - Details: When coach asks questions after run sync, they appear as if user sent them (should be white/bot messages)
   - User quote: "it kind of prompts me to respond but then sends the question it meant for me as if its coming from me"
   - Implementation: Fixed in Chat.tsx to handle assistant-type pending prompts

2. **Need Standard Post-Run Questions Flow**
   - Status: DONE - 2026-02-20
   - Priority: CRITICAL
   - Details: Implemented as lightweight PostRunReflectionCard on Today page (RPE → contextual Q → energy/pain → save). Surfaces for unreflected workouts from last 3 days.
   - User quote: "after a run syncs... it should ask some standard questions like i see you ran xxx anything else you want to share before i start analyzing?"

3. **Loading Indicator Not Visible**
   - Status: DONE - 2026-02-13
   - Priority: CRITICAL
   - Details: User couldn't tell chat was thinking/loading, message appeared after a minute
   - User quote: "i couldn't tell it was loading! thats really important to fix! make it clear that chat is still thinking and loading!"
   - Implementation: Enhanced loading indicator in Chat.tsx with better visibility

4. **Missing Cheaper Model Usage Tips**
   - Status: TODO
   - Priority: HIGH
   - Details: Pop-up tips for cheaper model usage disappeared
   - User quote: "i don't see the little pop up on the bottom anymore with tips for the cheaper model usage"

### UI/UX Issues
1. **Modal Scrolling Issue**
   - Status: DONE - 2026-02-12
   - Priority: HIGH
   - Details: Fixed! Added useModalBodyLock hook and applied to all modals in the system

2. **Alerts Persistence**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: Alerts now stay dismissed when clicked off
   - User quote: "we need to make sure there is permanance... once you click off an alert.. it should be done and you don't see it again"
   - Implementation: ProfileCompletion component uses localStorage to remember dismissal state

### Workout Detail Page Issues
1. **HR Zone Calculation Wrong**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: HR of 169 showing as Z5 when it should be lower
   - User quote: "on average hr it says z5... a hr of 169 is not z5"
   - Fix: Updated estimateHRZone function to use actual user age (34) instead of default 185 max HR

2. **Elevation Profile Only Additive**
   - Status: TODO
   - Priority: HIGH
   - Details: Shows cumulative gain only, not actual elevation changes with ups and downs
   - User quote: "the elevation profile is also wrong... its only additive and doesn't show the elevation gain and decline which isn't helpful. there is a diff between gain and net gain!"

3. **Effort Distribution Distance Wrong**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: Shows full interval duration instead of per-mile splits
   - User quote: "it says warmup 1 mile (47:12)... thats not a mile, thats the full length of the interval, not one mile!"
   - Fix: Changed display format to "1.0mi @ 8:30/mi" to avoid confusion

4. **Z3 Color is White (Invisible)**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: Z3 heart rate zone color is white on white background
   - User quote: "i think there is a bug and the color of z3 for the hr zone part is white so i can't see it!"
   - Implementation: Changed Z3 from bg-fuchsia-400 to bg-orange-500 and Z4 to bg-rose-500 for better visibility

### Analytics Page Issues
1. **Goal Calculator Broken**
   - Status: TODO
   - Priority: LOW
   - Details: Goal calculator is "totally messed up"
   - User quote: "the goal calculator is totally messed up"

2. **Runs by Day Chart - Invisible Color**
   - Status: TODO
   - Priority: LOW (quick fix)
   - Details: One of the chart colors appears to be white on a white background, making data invisible
   - User quote: "i think it might have one of the colors on the chart as white on a white background so i cant see it"

### Critical Strava Sync Issue
1. **Strava Activities Not Showing in History**
   - Status: DONE - 2026-02-13
   - Priority: CRITICAL
   - Details: Activities exist in database but not displaying on history page
   - Debug info: Profile ID 1 has workouts from Feb 2, Feb 1, etc. in DB but user only sees Feb 10 manual entry
   - Root Cause: Decimal heart rate values from Strava API causing database type errors
   - Fix: Added Math.round() to avgHeartRate in strava.ts

## ✅ Recently Completed Features (2026-02-12)

1. **Readiness Explanation**
   - Status: DONE - commit 11972bf
   - Priority: HIGH
   - Details: Shows breakdown of readiness score with actual values (TSB, sleep hours, etc)
   - Features:
     - Detailed breakdown showing Sleep, Training, Physical, Life factors
     - Shows actual values like "5.2 hrs sleep", "TSB: -15 (fatigued)"
     - Prominent limiting factor display
     - Trend indicators (up/down arrows)
     - Added to Today page with link to full details

## 🎯 Feature Requests

### Dark Mode
1. **Professional Dark Mode System**
   - Status: DONE - 2026-02-13
   - Priority: CRITICAL
   - Details: **Comprehensive, accessible dark mode following Material Design 3 & WCAG AA**
   - Implementation:
     - ✅ **Layered Elevation System**: 4 levels (0%, 4%, 8%, 12%) for visual hierarchy
     - ✅ **Rich Desaturated Backgrounds**: #121218 (not pure black) - comfortable on OLED
     - ✅ **Desaturated Accent Colors**: 15-20% reduction prevents color vibration
     - ✅ **Off-white Text**: #e8e8ed (not pure white) - reduces harsh contrast
     - ✅ **WCAG AA Compliant**: 4.5:1 minimum contrast for body text
     - ✅ **Smooth Transitions**: 200ms transitions on all color properties
     - ✅ **System Preference Detection**: Auto-detects `prefers-color-scheme`
     - ✅ **Semantic Token System**: Full color token architecture
     - ✅ **Smart Shadows**: Glows and borders in dark mode (shadows don't work on dark)
     - ✅ **Focus Rings**: Visible 2px teal outlines for accessibility
   - Documentation: See `/DARK_MODE_GUIDE.md` for complete usage guide
   - Color Palette:
     - Surface-0: #121218 (base)
     - Surface-1: #1a1a24 (cards)
     - Surface-2: #24242f (elevated)
     - Surface-3: #2d2d3a (modals)
     - Text: #e8e8ed / #b4b4c0 / #84848f (primary/secondary/tertiary)
     - Accents: Teal #4aded4, Pink #f5a6c4, Purple #b794f6, Orange #f8b968
   - Migration Stats:
     - **908 of 955 hardcoded colors fixed (95% complete)** ✅
     - Remaining 47 instances are intentional (code blocks, toggle switches, opacity variants)
     - All critical UI elements now use semantic color tokens
     - Full documentation in `/DARK_MODE_GUIDE.md`

### Strava Integration
1. **Manual API Key Entry Option**
   - Status: DONE - commit db45c70
   - Priority: HIGH
   - Details: Added toggle between OAuth and manual API key entry

2. **Fix OAuth Flow**
   - Status: TODO
   - Priority: MEDIUM
   - Details: OAuth authorization works but token exchange fails. Missing STRAVA_CLIENT_SECRET was found, but still issues

### API Key Management
1. **Anthropic & OpenAI API Key Storage**
   - Status: PARTIALLY DONE - UI added but DB migration needed
   - Priority: HIGH
   - Details: Need to add anthropicApiKey and openaiApiKey fields to userSettings table

### Onboarding & Profile Completion
1. **Progressive Context Collection**
   - Status: IN_PROGRESS - Profile Completion Component Added 2026-02-13
   - Priority: HIGH
   - Details:
     - Show % profile completion ✓
     - Adaptive context requests based on user needs (TODO)
     - Each field added increases AI coach accuracy ✓
     - Visual indicator showing how complete the profile is ✓
     - Smart prompts for missing information when needed (TODO)
     - "first SaaS to nail this will crush it"
   - Implementation:
     - Added ProfileCompletion component at top of Today page
     - Shows progress bar and completion percentage
     - Lists missing fields by category (basic, running, preferences)
     - Dismissible with localStorage persistence
     - Dark mode support

### Manual Run Entry UX
1. **Replace Input Fields with Sliders**
   - Status: TODO
   - Priority: MEDIUM
   - Details:
     - Distance slider (default: 5 miles)
     - Duration slider (default: 45 mins)
     - Better mobile experience
     - More intuitive for quick entries
     - "Sliders way more user friendly with default value at what you expect to be the median"

### Images & Branding
1. **Logo Integration**
   - Status: DONE
   - Priority: COMPLETED
   - Details: Added unnamed.png (big logo) and gemini_generated (horizontal), renamed to proper filenames

### General UX Improvements
1. **Zero State Improvements**
   - Status: TODO
   - Priority: MEDIUM
   - Details: Better empty states throughout the app

2. **Autofill Improvements**
   - Status: TODO
   - Priority: MEDIUM
   - Details: Smart defaults and autofill where possible

3. **Better Color Differentiation Across Pages**
   - Status: TODO
   - Priority: HIGH
   - Details: Establish consistent color identity per section (like settings hub cards). Apply to Today page and other pages for better visual hierarchy and feel.
   - User quote: "the way that you have different colors on those different tabs on the settings page... we need more of that to establish a better feel on the today page and other pages"

4. **Fix Workout Segment Type Bar on History Cards**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: History mini lap bars now use full effort classification system (same as workout detail page EnhancedSplits). Each mile colored by category (easy=teal, tempo=rose, interval=fuchsia, etc.) instead of simple faster/slower relative coloring.
   - User quote: "can u fix the workout segment type bar that used to be there?"

5. **Unified Color System Audit**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Full color audit across all pages. Fixed inconsistencies: Today (tempo was orange→rose), Analytics (long was teal→indigo), TwoWeekPlan (completely wrong palette→matched centralized system). All pages now consistent with workout-colors.ts.

5. **Fix EnhancedSplits Issues**
   - Status: TODO
   - Priority: HIGH
   - Details: Three fixes needed:
     1. Rename "Mile Splits" to "Workout Splits" (they're lap splits not always miles)
     2. Round pace in effort distribution (shows 8:3.2762 instead of 8:03)
     3. These are watch laps, not always mile splits
   - User quote: "also we should change this box from 'mile splits' to 'workout splits'... they aren't miles they are whenever i lapped my watch typically"

5. **Enhanced Runner Profile with Rich Descriptions**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Added DescriptiveChipSelector/DescriptiveMultiChipSelector components with rich descriptions for all training philosophy options, "Not sure" added to all selectors, multi-select training philosophies (stored as JSON), new fields: workoutComplexity, coachingDetailLevel, speedworkExperience, mlrPreference, progressiveLongRunsOk

6. **Move API Usage, Shoes, Memory to Settings Hub**
   - Status: DONE - 2026-02-14
   - Priority: MEDIUM
   - Details: Removed from sidebar/mobile nav, added as colored cards on settings hub page
   - User quote: "describe what training coaches philosophies are how they differ... also have questions about how advanced or complicated you want the workouts to be"

### History Page Enhancements
1. **Show Strava Activity Names**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Display Strava activity names on history page (filters generic "Morning Run", "Afternoon Run" etc). Added stravaName column to schema.
   - User quote: "I want to add my strava names somewhere on the history page.. also yea we need to reorder or reorganize the sidebar... also i dont want to show 'morning run' as a name but if there is a different name, that's a good add!"

2. **Add Maps to Activities**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Route maps on workout detail pages using Leaflet + CartoDB dark tiles. Polyline stored in DB, decoded from Strava's encoded polyline format. Start/end markers, teal route line, auto-fit bounds.
   - User quote: "i also def want to add a map"

### Navigation & Organization
1. **Full Navigation & IA Redesign**
   - Status: TODO
   - Priority: HIGH
   - Details: Comprehensive review of sidebar, page hierarchy, and information architecture
   - Goals:
     - Audit every sidebar item and determine if it deserves top-level nav or should be nested
     - Remove low-value pages from sidebar (e.g., Pace Calc Adjuster doesn't need to be top-level)
     - Consider a proper Home page that acts as a dashboard/hub
     - Redesign Today page to be the daily command center: next workout, trending data, recovery status, suggested workout with alternatives the user can pick between
     - Group related pages logically (training, analysis, gear, settings)
     - Make the most important things (today's workout, coach, history) immediately accessible
   - User quote: "i want to review everything on my sidebar and reorder or reprioritize or figure out some better ui to ensure users easily find what they are looking for"

2. **Smart Workout Alternatives (No-LLM Audibles)**
   - Status: TODO
   - Priority: HIGH
   - Details: Build common "excuse" logic and workout audible suggestions that don't require calling the LLM. Pre-built decision trees for scenarios like:
     - "I'm tired" → suggest easy run or rest day
     - "Short on time" → shorter version of planned workout
     - "Legs are heavy" → recovery run or cross-train
     - "Weather is bad" → treadmill alternative or indoor workout
     - "Feeling great" → option to upgrade workout intensity
   - Should be fast, local logic that saves API calls for real coaching conversations
   - User quote: "i should def build in some of the most common types of excuses and logic on how to audible that will help avoid needing to call the llm"

### Data Quality & Scoring
1. **Handle Missing Data in Scores**
   - Status: TODO
   - Priority: HIGH
   - Details: Use null values when data is missing, don't assume defaults. Adjust models to work with limited information, show lower confidence
   - User quote: "i should be careful to assume default values, if there is no value just use a null and come up with a different model for best fit or best you can do with limited information given, but it just might be lower confidence on that value or prediction"

### Workout Analysis Features
1. **Proper Elevation Profile with Ups and Downs**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Altitude stream from Strava API now shows real terrain profile in ActivityStreamChart. Old ElevationChart hidden for Strava workouts.
   - Current: Shows real elevation with climbs and descents for Strava workouts

2. **HR Zone Distribution Chart**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: Show time/distance spent in each HR zone during the run
   - User quote: "we should have a hr zone, and a pace zone chart that shows my distribution in each zone over the run"
   - Implementation: Added ZoneDistributionChart component with horizontal stacked bar visualization

3. **Pace Zone Distribution Chart**
   - Status: DONE - 2026-02-13
   - Priority: HIGH
   - Details: Show time/distance spent in each pace zone during the run
   - Implementation: Included in same ZoneDistributionChart component

3. **Smart Interval Analysis**
   - Status: TODO
   - Priority: HIGH
   - Details: Recognize interval patterns (e.g., 8x800) and analyze consistency
   - User quote: "if this was an interval workout, it could recognize it was 8x800 and then assess how steady the 800's trended"

4. **Best VDOT Segment Scoring (Garmin-style deep segment mining)**
   - Status: TODO
   - Priority: HIGH
   - Details: Build a per-run "best VDOT segment score" engine that finds strongest quality segments automatically (even without manual laps), with quality gates:
     - minimum segment length (e.g., >= 800m)
     - no GPS gaps/anomalies
     - HR behavior appropriate for pace and workout context
     - confidence score per candidate segment
   - Must surface an adjusted explanation in UI (example: strongest valid segment and why it passed/failed quality checks).
   - **Scope dependency:** today we persist lap/segment summaries (`workout_segments`) but do **not** persist raw per-second streams in DB. Current stream use is on-demand from Strava API (`getWorkoutStreams`) only. If deep segment mining should be durable/replayable across providers and historical data, first add stream storage pipeline at import/sync time.

4. **Easy Run Deletion**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Delete button available on both workout detail page and history page workout cards
   - User quote: "i also need a way to easily delete runs?"

5. **Map Sync/Display**
   - Status: DONE - 2026-02-14
   - Priority: HIGH
   - Details: Polyline data saved during Strava sync, displayed via RouteMap component on workout detail pages. Backfill function for existing workouts.
   - User quote: "i also want to add a map sync"

### Feature Parity Goal
1. **Match All Strava/Intervals.icu Features**
   - Status: TODO
   - Priority: ONGOING
   - Details: Implement all features from Strava, Intervals.icu, and other popular running apps
   - User quote: "basically any other feature that is in strava or intervals icu or another cool website... i should have it! i need to have all the best features and more in one place!"
   - Key features to add:
     - Segments and segment leaderboards
     - Power analysis
     - Advanced interval detection
     - Heart rate zones and analysis
     - Training load balance
     - Fitness/freshness/form charts
     - Route planning and creation
     - Gear tracking beyond shoes
     - Weather data integration
     - Photo uploads to activities

## 🔧 Technical Debt
1. **Database Migration for API Keys**
   - Status: TODO
   - Priority: HIGH
   - Details: Need to run migration to add anthropicApiKey and openaiApiKey columns

2. **Environment Variable Documentation**
   - Status: TODO
   - Priority: MEDIUM
   - Details: Update .env.example with all required variables including STRAVA_CLIENT_SECRET

## 🚀 Missing Core Features (Based on Codebase Analysis)

### Social & Community
1. **Activity Feed / Social Timeline**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Share runs, kudos, comments, follow other runners

2. **Running Groups/Clubs**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Join clubs, group challenges, leaderboards

3. **Challenges & Virtual Races**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Monthly challenges, virtual races, badges

### Health & Recovery
1. **Sleep Tracking Integration**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Import from Apple Health, Garmin, Whoop, affect on readiness

2. **HRV Monitoring**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Track heart rate variability for recovery insights

3. **Injury Prevention Protocols**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Prehab routines, form drills, strength exercises

4. **Recovery Routines**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Stretching guides, foam rolling, mobility work

### Nutrition & Fueling
1. **Race Fueling Calculator**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Calculate carbs/fluids needed based on pace and duration

2. **Daily Nutrition Tracking**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Basic meal logging, hydration tracking

### Advanced Training
1. **Custom Training Plan Builder**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Create custom plans beyond the AI suggestions

2. **Periodization View**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Macro/meso/micro cycle visualization

3. **Cross-Training Support**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Log cycling, swimming, strength training

4. **Running Form Analysis**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Cadence, ground contact time, vertical oscillation

### Live Features
1. **Live Activity Tracking**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Real-time location sharing for safety

2. **Audio Coaching During Runs**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Voice prompts for pace, intervals, encouragement

3. **Music Integration**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Spotify/Apple Music playlists based on workout type

### Data & Export
1. **Full Data Export (Roadmap 5.10)**
   - Status: DONE - 2026-02-20
   - Priority: COMPLETED
   - Details: CSV/JSON export of all workouts, race results, and training data via `/api/export` route + UI at `/settings/export`. Exports include weather, VDOT signals, fitness metrics. Auth via cookie or x-admin-secret header.

2. **Training Report Generation**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Weekly/monthly PDF reports

3. **API for Third-Party Apps**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Let other apps read/write data

### Gamification
1. **Comprehensive Achievement System**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Badges for milestones, PRs, consistency

2. **Level/XP System**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Gain experience points, unlock features

3. **Wordle Easter Egg**
   - Status: DONE - 2026-02-15
   - Priority: LOW (fun)
   - Details: Daily Wordle game with running-themed words. Same word for all users each day. Triggered by typing "wordle" in chat. Stats tracking (played, win %, streak), share results as emoji grid, persists progress in localStorage.
   - Location: src/components/WordleGame.tsx, triggered from Chat.tsx

### Notifications & Reminders
1. **Push Notifications**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Workout reminders, achievement alerts, coach messages

2. **Email Summaries**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Weekly training summary emails

### Premium Features
1. **Advanced Analytics**
   - Status: NOT STARTED
   - Priority: MEDIUM
   - Details: Running power, efficiency metrics, advanced trends

2. **Personal Coach Marketplace**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Connect with human coaches

3. **Training Camp Planning**
   - Status: NOT STARTED
   - Priority: LOW
   - Details: Plan altitude training, training camps

## 📝 Notes
- Update this file whenever new features or bugs are reported
- Mark items as IN_PROGRESS when starting work
- Mark as DONE when completed with the commit hash
- Use this as the single source of truth for development priorities
- **IMPORTANT**: This is a living document - not all features will be built!

## ✅ Completed — 2026-02-17 Session

### Predictions Dashboard Overhaul
1. **Resilient Data Fetching** — DONE
   - Switched `getPredictionDashboardData` from `Promise.all` to `Promise.allSettled`
   - Individual query failures no longer kill the entire dashboard
   - Errors surfaced to client via `PredictionDashboardResult` type with `{ data, error }`
   - Location: `src/actions/prediction-dashboard.ts`

2. **VO2max Timeline Chart Enhancements** — DONE
   - Time range selectors: 3M / 6M / 1Y / 2Y
   - IQR-based outlier removal + HR < 90 bpm sanity filter
   - Workout type color-coded dots with legend (moved to bottom)
   - Extended data fetch from 180 → 730 days for historical views
   - Label clarified to "Effective VO2max (from HR)"
   - Location: `src/app/predictions/page.tsx` (Vo2maxTimeline component)

3. **Efficiency Factor Trend Chart Enhancements** — DONE
   - Time range selectors: 3M / 6M / 1Y / 2Y
   - Theil-Sen robust regression (deterministic, all pairwise slopes) replacing simple OLS
   - IQR-based outlier removal + HR < 90 bpm filter
   - Workout type color-coded dots with legend (moved to bottom)
   - Location: `src/app/predictions/page.tsx` (EfTrendChart component)

4. **Race Prediction Trends Chart** — DONE (NEW)
   - Replaced old `PredictionTimeline` with multi-mode chart
   - Pace mode: overlay multiple distances (5K, 10K, Half, Marathon) with multi-select colored toggles
   - Time mode: single distance selector with improvement badge
   - Time range selectors: 3M / 6M / 1Y / 2Y
   - Location: `src/app/predictions/page.tsx` (RacePredictionTrends component)

5. **Pace vs HR Scatter Plot** — DONE (NEW)
   - Uses best adjusted pace (elevation > weather > raw) vs avg HR
   - Fixed bounds: 6:00–10:00/mi, 130–190 bpm (auto-expands if needed)
   - Workout type toggles and time range selector
   - Theil-Sen regression with R² and slope (bpm/min) display
   - IQR outlier removal on both pace and HR dimensions
   - Location: `src/app/predictions/page.tsx` (PaceHrScatter component)

### Race-to-Result Linking + Race History Timeline (2.1 + 2.2) — DONE (2026-02-20)
- **Race-Result Linking**: `raceId` FK on `raceResults` → `races`, `status` column on `races` (upcoming/completed/dns/dnf)
- **Auto-Match**: `autoMatchRaceToResult()` links race results to planned races by distance (±5%) and date (±7 days)
- **Integrated**: Into `createRaceResult()` and Strava sync auto-race-result creation
- **Race History Timeline**: Replaces the old collapsible results section with a vertical timeline showing PR badges, VDOT deltas, distance filter chips, linked race info with target time comparison
- **RaceCard completion**: Shows green "Completed" badge instead of countdown for completed races
- **Backfill**: `/api/admin/backfill-race-links` endpoint to link existing unlinked results
- **Migration**: `migrations/0010_race_linking.sql`
- **Files**: `src/actions/races.ts`, `src/actions/strava.ts`, `src/components/RaceHistoryTimeline.tsx`, `src/app/races/page.tsx`, `src/lib/schema.ts`, `src/lib/schema.pg.ts`, `src/lib/schema-enums.ts`
- **TODO**: Run `npm run db:push:pg` or apply migration SQL to production Postgres

### Edit Races + Link Race Results to Workouts
6. **Edit Race Modal** — DONE
   - Pencil icon on race cards opens edit modal pre-filled with existing data
   - Fields: name, date, distance, priority, goal time, location
   - Location: `src/app/races/page.tsx` (EditRaceModal)

7. **Edit Race Result Modal** — DONE
   - Pencil icon on result cards opens edit modal
   - Fields: race name, date, distance, finish time, effort level
   - VDOT recalculates on save
   - Location: `src/app/races/page.tsx` (EditRaceResultModal)

8. **workoutId FK on raceResults** — DONE
   - Schema: added `workoutId` to `raceResults` in both SQLite and Postgres schemas
   - Migration: `013_race_result_workout_link.sql` (ran on production)
   - Location: `src/lib/schema.ts`, `src/lib/schema.pg.ts`

### Page & UI Changes
9. **Renamed "Races" → "Racing"** — DONE
   - Updated sidebar, mobile nav, page title

10. **Chat Page Simplification** — DONE
    - Removed CoachHeader component and model tips banner
    - Cleaner chat interface

### Production Database
11. **Missing Tables Created** — DONE
    - `vdot_history`, `soreness_entries`, `coach_settings` tables created on production
    - Migration: `014_missing_tables.sql`

12. **VDOT History Backfill** — DONE
    - 34 VDOT history entries backfilled for profile 1 (June 2023 → Feb 2026)
    - Includes 3 race result entries
    - Scaled estimate entries by 0.95 to match multi-signal blended VDOT

---

## 🏗️ Training Plan Architecture (2026-02-14)
- **Macro Plan + Rolling Window** — DONE (commit 0fa398f + ef588f0)
  - All weeks generate as a macro roadmap (targets only)
  - First 3 weeks get detailed daily workouts
  - Future weeks auto-generate as athlete approaches them
  - Plan adapts based on actual-vs-planned training deltas
  - Step-loading mileage (3-up-1-down staircase, not linear)
  - Independent long run progression from currentLongRunMax
  - Fuzzy race name matching for LLM tool
  - Settings are primary (nullish coalescing), fitness assessment supplementary
- **Long Run % Cap** — DONE (commit ef588f0)
  - Long runs capped at 33% of weekly mileage to prevent lopsided weeks
- **MLR (Medium-Long Run) Support** — DONE (commit ef588f0)
  - When mlrPreference enabled, converts one mid-week easy run to MLR (~65% of long run distance, min 8mi)

---

## 3.18 Training Partner Effect (2026-02-20)
- **Status**: DONE
- Server action `src/actions/training-partner.ts`: Queries workouts with `stravaAthleteCount`, splits solo (1) vs group (2+), calculates avg pace/distance/HR/RPE/mood for each, pace differential, per-workout-type breakdown
- Component `src/components/TrainingPartnerEffect.tsx`: Side-by-side solo vs group comparison cards, prominent pace differential headline, per-type breakdown with pace arrows, handles edge cases (not enough group data, no data)
- Integrated into analytics page Performance Analysis section alongside Fatigue Resistance

## 2.6 Post-Run Guided Reflection (2026-02-20)
- **Status**: DONE
- Schema: `post_run_reflections` table (workoutId, rpe, shoeComfort, painReport, painLocation, energyLevel, contextualAnswer, quickNote)
- Server action `src/actions/reflections.ts`: `getUnreflectedWorkouts(limit)` finds recent workouts missing both reflection and assessment; `saveReflection(data)` persists
- Component `src/components/PostRunReflectionCard.tsx`: Multi-step inline card (RPE pills → contextual question → energy/pain → save), auto-collapses on save with "Full Assessment" link
- Contextual questions adapt to workout type: intervals→splits, tempo→pace hold, long→fueling, easy→truly easy?, race→result
- Integrated into Today page between Last Run and Next Workout cards

## 2.9 Smart Training Cues (2026-02-20)
- **Status**: DONE
- Server action `src/actions/training-cues.ts`: `getSmartTrainingCue()` returns TSB-based workout suggestion with modifiers
- Rule engine: TSB ranges → base suggestion (rest/easy/moderate/quality/push); modifiers for hard day count, readiness score, weekend preference, weekly mileage cap, consecutive rest days
- Plan alignment: compares suggestion vs tomorrow's planned workout (agrees/suggests_easier/suggests_harder)
- Component `src/components/SmartTrainingCue.tsx`: "Tomorrow's Suggestion" card with workout type badge, distance range, reasoning, factor pills (color-coded by impact), plan alignment note
- Integrated into Today page between Next Workout and Week Ahead strip

## 3.14 Running Economy Tracking (2026-02-20)
- **Status**: DONE
- **Server action** `src/actions/running-economy.ts`: Queries workouts with both `avgPaceSeconds` AND `avgHr`, filters to easy/steady/recovery/long runs only (tempo+ confounds the metric). Calculates cardiac cost (avgHR * avgPaceSeconds, lower = better), normalizes all runs to a reference HR (150bpm default, or 65% HRR + restingHR if available) to produce "pace at Xbpm" equivalent. Returns time series of `{ date, cardiacCost, avgPace, avgHR, normalizedPace, workoutType, distanceMiles }[]` with linear regression trend on cardiac cost.
- **Component** `src/components/RunningEconomy.tsx`: Client component with Recharts ComposedChart showing normalized pace scatter over time, dashed trend line (green=improving, red=declining), workout type colored dots, custom tooltip showing actual pace/HR/normalized pace. Summary text: "Your running economy has improved X% over the last Y. You now run Z/mi at Wbpm vs..." Time range selector (1M/3M/6M/1Y), stats row with runs analyzed/ref HR/trend %. Uses `createProfileAction` pattern, `AnimatedSection`, shared `TimeRangeSelector`.
- Integrated into analytics page Performance Analysis section alongside Split Tendency

## 3.17 Time of Day Analysis (2026-02-20)
- **Status**: DONE
- **Schema**: Added `startTimeLocal` (text, "HH:MM") to workouts table. Captured from Strava `start_date_local` during sync/webhook/repull.
- **Migration**: `migrations/0012_add_start_time_local.sql`
- **Backfill**: `/api/admin/backfill-start-times` endpoint re-pulls start time from Strava API for existing workouts
- **Server action** `src/actions/time-of-day.ts`: Queries workouts with `startTimeLocal`, groups into 7 time buckets (Early Morning 5-7, Morning 7-9, Mid-Morning 9-11, Midday 11-1, Afternoon 1-4, Evening 4-7, Night 7-10). Per-bucket: count, avg pace, avg HR, avg fatigue resistance (from segments), most common workout type, type breakdown. Per-type time distributions (e.g. "80% of tempos in morning"). Peak performance window detection.
- **Component** `src/components/TimeOfDayAnalysis.tsx`: Stacked bar chart (Recharts ComposedChart) colored by workout type with avg pace line overlay, peak window badge, bucket detail table with mini bars, per-type timing distribution, time range selector (3M/6M/1Y/2Y/3Y), summary insights
- **Forward capture**: Strava sync (manual + webhook), strava-repull, and backfill-strava all capture `startTimeLocal`
- Integrated into analytics page Performance Analysis section (full-width, after Fatigue Resistance + Training Partner Effect)

Last Updated: 2026-02-20
