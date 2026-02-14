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
   - Status: TODO
   - Priority: CRITICAL
   - Details: After run syncs: 1) Ask standard questions, 2) User answers, 3) Analyze with that info, 4) Ask tailored questions
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
   - Status: TODO
   - Priority: HIGH
   - Details: Add a mini version of the "Mile Splits" colored bar (from EnhancedSplits) to history workout cards. Shows interval types by color on each card.
   - Note: MiniLapChart (pace variation) and MiniHRZoneBar (HR zones) are on cards but user wanted the segment TYPE bar specifically.
   - User quote: "can u fix the workout segment type bar that used to be there?"

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
1. **Reorder/Reorganize Sidebar**
   - Status: TODO
   - Priority: HIGH
   - Details: Better organization of navigation items in sidebar
   - Consider grouping by function (training, analysis, settings)

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
1. **Full Data Export**
   - Status: NOT STARTED
   - Priority: HIGH
   - Details: Export all data in standard formats (GPX, TCX, CSV)

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

Last Updated: 2026-02-14