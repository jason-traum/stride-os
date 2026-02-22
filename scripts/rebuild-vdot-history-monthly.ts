/**
 * Rebuild VDOT history into monthly snapshots, back to Jan 2023.
 *
 * Usage:
 *   npx tsx scripts/rebuild-vdot-history-monthly.ts
 *   npx tsx scripts/rebuild-vdot-history-monthly.ts 1
 */

import { db } from '../src/lib/db';
import { userSettings } from '../src/lib/schema';
import { rebuildMonthlyVdotHistory } from '../src/actions/vdot-history';
import { MONTHLY_VDOT_START_DATE } from '../src/lib/vdot-history-config';

async function resolveProfileIds(argProfileId?: string): Promise<number[]> {
  if (argProfileId) {
    const parsed = Number(argProfileId);
    if (Number.isFinite(parsed) && parsed > 0) return [parsed];
    throw new Error(`Invalid profile ID: ${argProfileId}`);
  }

  const rows: { profileId: number | null }[] = await db.select({ profileId: userSettings.profileId }).from(userSettings);
  const ids = Array.from(new Set(rows.map((row: { profileId: number | null }) => row.profileId).filter((id: number | null): id is number => typeof id === 'number' && id > 0)));
  return ids.length > 0 ? ids : [1];
}

async function main() {
  const argProfileId = process.argv[2];
  const profileIds = await resolveProfileIds(argProfileId);

  console.log(`Rebuilding monthly VDOT history from ${MONTHLY_VDOT_START_DATE}`);
  console.log(`Profiles: ${profileIds.join(', ')}`);

  for (const profileId of profileIds) {
    const result = await rebuildMonthlyVdotHistory({
      profileId,
      startDate: MONTHLY_VDOT_START_DATE,
    });

    console.log(
      [
        `profile=${result.profileId}`,
        `range=${result.startDate}..${result.endDate}`,
        `old=${result.previousEntries}`,
        `new=${result.rebuiltEntries}`,
      ].join(' | ')
    );
  }
}

main().catch((error) => {
  console.error('Failed to rebuild monthly VDOT history:', error);
  process.exit(1);
});
