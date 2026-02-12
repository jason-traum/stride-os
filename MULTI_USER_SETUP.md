# Multi-User Setup Guide

## Option 1: Self-Hosted (Each User Deploys)

### For Non-Technical Users:
1. Fork this repository
2. Deploy to Vercel with one click:
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jason-traum/stride-os)
3. Add their own API keys

### Required API Keys:
- **Anthropic** (Required): Get at https://console.anthropic.com
- **Strava** (Optional): Create app at https://www.strava.com/settings/api
- **Weather** (Optional): Get at https://openweathermap.org/api

## Option 2: Shared Instance with Import

Users can use your deployed instance and import data:

1. **From Strava:**
   - Settings → My Account → Download Request
   - Wait for email (~30 min)
   - Upload activities.json at `/import`

2. **From Garmin:**
   - Activities → All Activities → Export CSV
   - Upload at `/import`

3. **From Apple Watch/Others:**
   - Export to Strava first (RunGap app)
   - Then export from Strava

## Option 3: Build Public OAuth App

To support "Login with Strava" for everyone:

1. **Strava API Application:**
   - Apply at https://developers.strava.com
   - Wait for approval (2-4 weeks)
   - Rate limit: 100 requests/15 min
   - Need to handle multiple users' tokens

2. **Database Changes Needed:**
   ```sql
   -- Add user authentication
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email TEXT UNIQUE,
     created_at TIMESTAMP
   );

   -- Link profiles to users
   ALTER TABLE profiles
   ADD COLUMN user_id INTEGER REFERENCES users(id);
   ```

3. **Add Auth Provider:**
   - NextAuth.js or Clerk
   - Handle user sessions
   - Scope tokens per user

## Option 4: Intervals.icu Integration

Since Intervals.icu already aggregates from multiple sources:

1. Users connect their devices to Intervals.icu
2. Use Intervals.icu API to fetch data
3. Single API key per user needed

Benefits:
- Users already have accounts
- Handles all device types
- Good API documentation
- Free tier available

## Recommended Approach

**For Personal Use:** Option 1 (self-hosted)
**For Small Group:** Option 2 (import)
**For Public App:** Option 4 (Intervals.icu)

The import feature works today and requires no API setup!