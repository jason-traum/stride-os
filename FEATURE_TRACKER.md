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

## 📝 Notes
- Update this file whenever new features or bugs are reported
- Mark items as IN_PROGRESS when starting work
- Mark as DONE when completed with the commit hash
- Use this as the single source of truth for development priorities

Last Updated: 2024-02-10