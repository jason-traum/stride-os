# Strava API Application Form Responses

## Copy/paste these into the form:

### Basic Information
- **First name**: Jason
- **Last name**: Traum
- **Email Address**: jason@getdreamy.run
- **Company Name**: Dreamy

### Application Details
- **API Application Name**: Dreamy
- **Strava Client ID**: 199902
- **Additional Apps**: (leave empty - no staging/dev apps)
- **Number of Currently Authenticated Users**: 1
- **Number of Intended Users**: 500-1000

### Application Description
```
Dreamy is an AI-powered running coach that helps runners train smarter through personalized training plans and real-time coaching insights based on their Strava data.

Key features using Strava API:
1. Automatic activity sync - Imports runs with distance, duration, pace, HR, elevation
2. Training load analysis - Calculates CTL/ATL/TSB for fitness tracking
3. AI coaching - Generates and adapts training plans based on completed workouts
4. Performance tracking - Monitors PRs, trends, and workout execution

Implementation highlights:
- Webhooks implemented for real-time sync and deauthorization handling
- OAuth flow with automatic token refresh (6-hour expiry)
- Rate limit compliance with exponential backoff
- Strava attribution following brand guidelines
- Profile-scoped data isolation (no cross-user data access)
- Encrypted token storage (AES-256-GCM)
- Webhook signature verification (HMAC-SHA256)
- Data deletion support via deauthorization webhook and user request
```

### Support URL
```
https://www.getdreamy.run/support
```

### Checkboxes
- ✅ **TOS Compliance**: Check after reviewing https://www.strava.com/legal/api
- ✅ **Brand Guidelines Review**: Check after reviewing brand guidelines

### Required Screenshots

You need to take screenshots of EVERY place Strava data appears:

1. **Settings Page - Strava Connection**
   - Show the "Connect with Strava" button
   - Show connected state with athlete info
   - Show "Powered by Strava" attribution

2. **Workout List/History Page**
   - Show synced Strava activities
   - Show Strava activity badges/links

3. **Individual Workout View**
   - Show detailed workout data from Strava
   - Show "View on Strava" link

4. **Training Analysis/Charts**
   - Show CTL/ATL/TSB charts using Strava data
   - Show performance trends

5. **Coach Chat Interface**
   - Show AI coach referencing Strava workouts
   - Show workout recommendations

6. **Import Page (if showing Strava option)**
   - Show Strava as a data source

## Before Submitting:

### 1. Review API Agreement
Go to https://www.strava.com/legal/api and ensure compliance with:
- ✅ No scraping or excessive API calls
- ✅ No selling or sharing user data
- ✅ Proper attribution
- ✅ Webhook implementation
- ✅ Respect rate limits

### 2. Deploy Latest Code
Make sure webhook endpoint is live:
```bash
git add -A
git commit -m "Strava API compliance ready"
git push origin main
npx vercel --prod
```

### 3. Setup Webhook (IMPORTANT!)
After deployment, run:
```bash
npx tsx scripts/setup-strava-webhook.ts
```

This will register your webhook with Strava and show the subscription ID.

### 4. Take All Screenshots
Use your live app at https://www.getdreamy.run to take screenshots.
Make sure Strava attribution is visible where relevant.

### 5. Support Page
Support page is live at https://www.getdreamy.run/support

## Pro Tips:
1. In the description, emphasize webhook implementation first
2. Mention rate limit compliance explicitly
3. Show clear Strava branding in screenshots
4. Submit during business hours for faster review
5. After submitting, email developers@strava.com to confirm webhook compliance

## Expected Timeline:
- Official: 5-7 business days
- Reality: 24 hours to 2 months (varies widely)
- Webhook implementation typically speeds approval
