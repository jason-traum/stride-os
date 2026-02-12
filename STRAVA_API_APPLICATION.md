# Strava API Application Documentation

## Application Overview

**Stride OS** is a personalized AI running coach that helps runners train smarter through intelligent plan generation, workout analysis, and adaptive coaching based on their Strava data.

## Key Features Using Strava Data

### 1. **Automatic Workout Sync**
- Imports running activities including distance, duration, pace, heart rate, and elevation
- Preserves activity titles and descriptions
- Links to original Strava activities

### 2. **Training Load Analysis**
- Calculates CTL/ATL/TSB (fitness/fatigue/form) from historical data
- Identifies training patterns and recovery needs
- Provides insights on training progression

### 3. **AI-Powered Coaching**
- Generates personalized training plans based on race goals
- Adjusts plans based on completed workouts from Strava
- Provides daily workout recommendations

### 4. **Performance Tracking**
- Tracks PRs and performance trends
- Analyzes workout execution vs. planned targets
- Identifies strengths and areas for improvement

## Technical Implementation

### Webhook Integration ✅
- **Endpoint**: `https://stride-os.vercel.app/api/strava/webhook`
- **Events handled**:
  - `athlete.update` - Detects deauthorization and clears tokens
  - `activity.create` - Queues new activities for sync
  - `activity.update` - Updates activity details
  - `activity.delete` - Soft deletes activities

### OAuth Flow ✅
- **Authorization**: `https://www.strava.com/oauth/authorize`
- **Callback**: `https://stride-os.vercel.app/api/strava/callback`
- **Token refresh**: Automatic refresh when tokens expire (6-hour expiry)

### Rate Limit Handling ✅
- Implements exponential backoff on 429 responses
- Tracks API usage and respects 15-minute windows
- Efficient batch syncing to minimize API calls

### Data Privacy & Security
- Tokens stored encrypted in database
- No sharing of user data between accounts
- Users can disconnect at any time (data preserved)
- Webhook immediately processes deauthorization

### Strava Attribution ✅
- "Connect with Strava" button follows brand guidelines
- "Powered by Strava" attribution on relevant pages
- Links to view activities on Strava

## Expected Usage

- **Initial sync**: ~100-200 API calls (fetching recent activities)
- **Ongoing sync**: 1-5 calls per new activity
- **Expected athletes**: 50-100 in first 6 months, growing to 500-1000
- **API efficiency**: Webhooks eliminate need for polling

## Screenshots

1. **Connect Flow**: Settings page with Strava connection
2. **Workout List**: Showing synced Strava activities
3. **Training Analysis**: CTL/ATL/TSB charts from Strava data
4. **AI Coach Chat**: Personalized recommendations based on training

## Compliance

- ✅ Implements required webhooks
- ✅ Follows Strava Brand Guidelines
- ✅ Respects API rate limits
- ✅ Handles token refresh properly
- ✅ Processes deauthorization immediately

## Contact

- **Developer**: Jason Traum
- **Email**: jasontraum8@gmail.com
- **Website**: https://stride-os.vercel.app
- **GitHub**: https://github.com/jason-traum/stride-os