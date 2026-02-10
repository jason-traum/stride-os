import { db, userSettings } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import {
  refreshStravaToken,
  isTokenExpired,
} from '../src/lib/strava';

async function checkStrava() {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, 1),
  });

  if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
    console.error('Strava not connected');
    process.exit(1);
  }

  let token = settings.stravaAccessToken;
  if (isTokenExpired(settings.stravaTokenExpiresAt)) {
    console.log('Refreshing token...');
    const newTokens = await refreshStravaToken(settings.stravaRefreshToken);
    token = newTokens.accessToken;
    await db.update(userSettings)
      .set({
        stravaAccessToken: newTokens.accessToken,
        stravaRefreshToken: newTokens.refreshToken,
        stravaTokenExpiresAt: newTokens.expiresAt,
      })
      .where(eq(userSettings.id, settings.id));
  }

  // Get athlete info
  const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const athlete = await athleteRes.json();
  console.log('Athlete:', athlete.firstname, athlete.lastname);
  console.log('Athlete ID:', athlete.id);

  // Get athlete stats
  const statsRes = await fetch(`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const stats = await statsRes.json();
  console.log('\nStrava Account Stats:');
  console.log('  All-time runs:', stats.all_run_totals?.count);
  console.log('  All-time distance:', (stats.all_run_totals?.distance / 1609.34).toFixed(0), 'miles');
  console.log('  Recent runs (4 weeks):', stats.recent_run_totals?.count);
  console.log('  Recent distance:', (stats.recent_run_totals?.distance / 1609.34).toFixed(1), 'miles');
  console.log('  YTD runs:', stats.ytd_run_totals?.count);
  console.log('  YTD distance:', (stats.ytd_run_totals?.distance / 1609.34).toFixed(1), 'miles');

  // Fetch ALL pages of activities to get total count
  let page = 1;
  let totalActivities = 0;
  let latestDate = '';
  let earliestDate = '';

  console.log('\nFetching all activities...');
  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const activities = await res.json();

    if (!Array.isArray(activities) || activities.length === 0) break;

    if (page === 1) latestDate = activities[0].start_date_local?.split('T')[0];
    earliestDate = activities[activities.length - 1].start_date_local?.split('T')[0];

    const runCount = activities.filter((a: any) => a.type === 'Run').length;
    console.log(`  Page ${page}: ${activities.length} activities (${runCount} runs), dates: ${activities[0].start_date_local?.split('T')[0]} to ${activities[activities.length - 1].start_date_local?.split('T')[0]}`);

    totalActivities += activities.length;
    page++;

    if (activities.length < 200) break;

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal Strava activities: ${totalActivities}`);
  console.log(`Date range: ${earliestDate} to ${latestDate}`);

  process.exit(0);
}

checkStrava().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
