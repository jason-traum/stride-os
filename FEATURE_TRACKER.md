# Stride OS Feature & Bug Tracker

## 🚨 Critical Bugs

### AI Coach Issues (HIGH SEVERITY)
1. **Fix prescribeWorkout function**
   - Status: TODO
   - Priority: CRITICAL
   - Details: Currently returns generic prescriptions. Needs to pull actual pace zones, use CTL/ATL/TSB, consider recent history
   - Location: coach-tools.ts:10321-10477

2. **Fix getRaceDayPlan function**
   - Status: TODO
   - Priority: CRITICAL
   - Details: Returns same generic plan for all races. Needs race-specific pacing, weather, splits, warmup, fueling
   - Location: coach-tools.ts:10480-10618

3. **Fix context persistence**
   - Status: TODO
   - Priority: CRITICAL
   - Details: Uses in-memory Map() that resets. Needs database table: coach_context
   - Location: coach-tools.ts:10621-10682

4. **Add explain_workout_difficulty tool**
   - Status: TODO
   - Priority: HIGH
   - Details: No tool exists for analyzing why workouts felt hard. Should analyze TSB, sleep, weather, etc.

5. **Fix silent profile ID failures**
   - Status: TODO
   - Priority: HIGH
   - Details: Functions using getActiveProfileId() need null checks and helpful error messages

6. **Fix greeting bug**
   - Status: TODO
   - Priority: HIGH
   - Details: Shows "Good morning, Coach" instead of user's name
   - Location: app/coach/page.tsx:21

### UI/UX Issues
1. **Modal Scrolling Issue**
   - Status: TODO
   - Priority: HIGH
   - Details: Page scrolls behind modals (bad UX) - "Messed up modals is the tell of vibe coding"

## 🎯 Feature Requests

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
   - Status: TODO
   - Priority: HIGH
   - Details:
     - Show % profile completion
     - Adaptive context requests based on user needs
     - Each field added increases AI coach accuracy
     - Visual indicator showing how complete the profile is
     - Smart prompts for missing information when needed
     - "first SaaS to nail this will crush it"

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

Last Updated: 2024-02-10