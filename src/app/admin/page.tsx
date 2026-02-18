import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, profiles, workouts, coachInteractions, apiUsageLogs, userSettings } from '@/lib/db';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { getUserModelCostBreakdown } from '@/actions/api-usage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Dreamy',
  description: 'Admin view for account and activity monitoring.',
};

function formatWhen(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default async function AdminPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('auth-role')?.value;
  const authUser = cookieStore.get('auth-user')?.value || 'unknown';

  if (role !== 'admin') {
    redirect('/today');
  }

  const [profileRows, workoutRows, interactionRows, usageRows, settingsRows, latestStravaAuthIssue, cost30d, cost7d] = await Promise.all([
    db.select().from(profiles),
    db.select().from(workouts).orderBy(desc(workouts.createdAt)).limit(100),
    db.select().from(coachInteractions).orderBy(desc(coachInteractions.createdAt)).limit(100),
    db.select().from(apiUsageLogs).orderBy(desc(apiUsageLogs.createdAt)).limit(120),
    db.select().from(userSettings),
    db.query.apiUsageLogs.findFirst({
      where: and(
        eq(apiUsageLogs.service, 'strava'),
        inArray(apiUsageLogs.endpoint, ['oauth.token.exchange', 'oauth.token.refresh']),
        or(
          eq(apiUsageLogs.statusCode, 400),
          eq(apiUsageLogs.statusCode, 401),
          eq(apiUsageLogs.statusCode, 403),
          eq(apiUsageLogs.statusCode, 429),
          eq(apiUsageLogs.statusCode, 500)
        )
      ),
      orderBy: [desc(apiUsageLogs.createdAt)],
    }),
    getUserModelCostBreakdown(30),
    getUserModelCostBreakdown(7),
  ]);

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const stravaConnectedCount = settingsRows.filter((s) => !!s.stravaAccessToken).length;
  const stravaAutoSyncOnCount = settingsRows.filter((s) => !!s.stravaAccessToken && (s.stravaAutoSync ?? true)).length;
  const stravaExpiredCount = settingsRows.filter((s) =>
    !!s.stravaAccessToken &&
    typeof s.stravaTokenExpiresAt === 'number' &&
    s.stravaTokenExpiresAt <= nowEpochSeconds
  ).length;

  const profileNameById = new Map<number, string>();
  for (const p of profileRows) {
    profileNameById.set(p.id, p.name);
  }

  const profileSummaries = profileRows.map((p) => {
    const pWorkouts = workoutRows.filter((w) => w.profileId === p.id);
    const pChats = interactionRows.filter((c) => c.profileId === p.id);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      workoutCount: pWorkouts.length,
      lastWorkoutDate: pWorkouts[0]?.date || null,
      chatCount: pChats.length,
      lastChatAt: pChats[0]?.createdAt || null,
      createdAt: p.createdAt,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
        <p className="text-sm text-textSecondary mt-1">Signed in as <strong>{authUser}</strong> ({role})</p>
      </div>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">Strava Sync Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-surface-1 px-3 py-2">
            <div className="text-textTertiary">Profiles Connected</div>
            <div className="text-primary font-semibold">{stravaConnectedCount}</div>
          </div>
          <div className="rounded-lg bg-surface-1 px-3 py-2">
            <div className="text-textTertiary">Auto-Sync Enabled</div>
            <div className="text-primary font-semibold">{stravaAutoSyncOnCount}</div>
          </div>
          <div className="rounded-lg bg-surface-1 px-3 py-2">
            <div className="text-textTertiary">Expired Tokens</div>
            <div className="text-primary font-semibold">{stravaExpiredCount}</div>
          </div>
        </div>
        <p className="text-xs text-textTertiary mt-3">
          Env check: {process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ? 'client id set' : 'client id missing'} ·{' '}
          {process.env.STRAVA_CLIENT_SECRET ? 'client secret set' : 'client secret missing'} ·{' '}
          {process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'webhook token set' : 'webhook token missing'}
        </p>
        <div className="mt-3 rounded-lg bg-surface-1 p-3 text-xs">
          <div className="font-medium text-primary mb-1">Latest Strava Auth Issue</div>
          {latestStravaAuthIssue ? (
            <div className="text-textSecondary">
              <div>{formatWhen(latestStravaAuthIssue.createdAt)} · {latestStravaAuthIssue.endpoint} · status {latestStravaAuthIssue.statusCode ?? 'N/A'}</div>
              <div className="truncate">{latestStravaAuthIssue.errorMessage || 'No error message recorded'}</div>
            </div>
          ) : (
            <div className="text-textTertiary">No recent Strava exchange/refresh errors recorded.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">Profile Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-textTertiary border-b border-borderPrimary">
                <th className="py-2 pr-4">Profile</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Recent Workouts</th>
                <th className="py-2 pr-4">Last Workout</th>
                <th className="py-2 pr-4">Coach Chats</th>
                <th className="py-2 pr-4">Last Chat</th>
              </tr>
            </thead>
            <tbody>
              {profileSummaries.map((p) => (
                <tr key={p.id} className="border-b border-borderPrimary/50">
                  <td className="py-2 pr-4 font-medium text-primary">{p.name} <span className="text-textTertiary">(#{p.id})</span></td>
                  <td className="py-2 pr-4 text-textSecondary">{p.type}</td>
                  <td className="py-2 pr-4 text-textSecondary">{p.workoutCount}</td>
                  <td className="py-2 pr-4 text-textSecondary">{p.lastWorkoutDate || 'N/A'}</td>
                  <td className="py-2 pr-4 text-textSecondary">{p.chatCount}</td>
                  <td className="py-2 pr-4 text-textSecondary">{formatWhen(p.lastChatAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">AI Cost by User and Model</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-surface-1 px-3 py-2 text-sm">
            <div className="text-textTertiary">Last 7 Days</div>
            <div className="text-primary font-semibold">${cost7d.totals.cost.toFixed(4)}</div>
            <div className="text-textSecondary">{cost7d.totals.requests} requests · {cost7d.totals.tokens.toLocaleString()} tokens</div>
          </div>
          <div className="rounded-lg bg-surface-1 px-3 py-2 text-sm">
            <div className="text-textTertiary">Last 30 Days</div>
            <div className="text-primary font-semibold">${cost30d.totals.cost.toFixed(4)}</div>
            <div className="text-textSecondary">{cost30d.totals.requests} requests · {cost30d.totals.tokens.toLocaleString()} tokens</div>
          </div>
        </div>
        <div className="space-y-3">
          {cost30d.byProfile.map((p) => (
            <div key={p.profileId ?? p.profileName} className="rounded-lg bg-surface-1 p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="font-medium text-primary">{p.profileName}</div>
                <div className="text-textSecondary">${p.cost.toFixed(4)} · {p.requests} req · {p.tokens.toLocaleString()} tok</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-textTertiary border-b border-borderPrimary/50">
                      <th className="py-1 pr-3">Model</th>
                      <th className="py-1 pr-3">Cost</th>
                      <th className="py-1 pr-3">Requests</th>
                      <th className="py-1 pr-3">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.byModel.map((m) => (
                      <tr key={`${p.profileName}-${m.model}`} className="border-b border-borderPrimary/30">
                        <td className="py-1 pr-3 text-textSecondary">{m.model}</td>
                        <td className="py-1 pr-3 text-textSecondary">${m.cost.toFixed(4)}</td>
                        <td className="py-1 pr-3 text-textSecondary">{m.requests}</td>
                        <td className="py-1 pr-3 text-textSecondary">{m.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {cost30d.byProfile.length === 0 && (
            <p className="text-sm text-textTertiary">No AI usage logs found for this period.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">Recent Workout Activity</h2>
        <div className="space-y-2 text-sm">
          {workoutRows.slice(0, 30).map((w) => (
            <div key={w.id} className="rounded-lg bg-surface-1 px-3 py-2 text-textSecondary">
              <span className="font-medium text-primary">{profileNameById.get(w.profileId || -1) || `Profile ${w.profileId ?? 'N/A'}`}</span>
              {' · '}{w.date}{' · '}{w.workoutType}{' · '}{w.distanceMiles ?? 0} mi{' · source: '}{w.source}
            </div>
          ))}
          {workoutRows.length === 0 && <p className="text-textTertiary">No workouts found.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">Recent Coach Messages</h2>
        <div className="space-y-2 text-sm">
          {interactionRows.slice(0, 20).map((row) => (
            <div key={row.id} className="rounded-lg bg-surface-1 px-3 py-2 text-textSecondary">
              <div className="font-medium text-primary">
                {profileNameById.get(row.profileId || -1) || `Profile ${row.profileId ?? 'N/A'}`} · {formatWhen(row.createdAt)}
              </div>
              <div className="truncate">User: {row.userMessage}</div>
            </div>
          ))}
          {interactionRows.length === 0 && <p className="text-textTertiary">No coach interactions found.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-3">Recent API Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-textTertiary border-b border-borderPrimary">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Endpoint</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Latency</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.slice(0, 40).map((u) => (
                <tr key={u.id} className="border-b border-borderPrimary/50">
                  <td className="py-2 pr-4 text-textSecondary">{formatWhen(u.createdAt)}</td>
                  <td className="py-2 pr-4 text-textSecondary">{u.service}</td>
                  <td className="py-2 pr-4 text-textSecondary">{u.endpoint}</td>
                  <td className="py-2 pr-4 text-textSecondary">{u.statusCode ?? 'N/A'}</td>
                  <td className="py-2 pr-4 text-textSecondary">{u.responseTimeMs ?? 'N/A'} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          {usageRows.length === 0 && <p className="text-textTertiary mt-2">No API usage records found.</p>}
        </div>
      </section>
    </div>
  );
}
