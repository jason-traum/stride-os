# Strava Next Steps Checklist
Date: February 18, 2026

## Done
- OAuth connect now works in production.
- Token exchange/refresh credential handling fixed.
- Webhook verify token set in production.
- Webhook subscription created (`330845`).
- Admin dashboard shows Strava health and latest auth issue.

## Next
1. Security cleanup
- Rotate `STRAVA_CLIENT_SECRET` (it was shared during troubleshooting).
- Update Vercel env + local `.env.local`.
- Redeploy and run one reconnect test.

2. Final webhook validation
- Create a test Strava activity.
- Confirm new activity appears in Dreamy without manual sync.
- Rename/delete the activity in Strava and confirm update/delete behavior.

3. Submission evidence pack
- 1-2 minute OAuth + sync screen recording.
- Screenshots of:
  - Strava attribution usage
  - `/privacy`
  - `/terms`
  - `/admin` Strava health
  - `/strava-sync` success state

4. Full Strava access application
- Submit Developer Program form:
  - https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8
- Include current constraints and requested expansion:
  - currently at `1/1` athlete
  - request multi-athlete capacity for coach/runner model.
