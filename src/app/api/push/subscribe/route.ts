import { NextResponse } from 'next/server';
import { db, pushSubscriptions } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/push/subscribe
 * Save a new push subscription (endpoint + keys + preferences)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, endpoint, p256dh, auth, preferences } = body;

    if (!profileId || !endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Missing required fields: profileId, endpoint, p256dh, auth' },
        { status: 400 }
      );
    }

    // Check if this endpoint already exists for this profile
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.profileId, profileId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      )
      .limit(1);

    const now = new Date().toISOString();

    if (existing[0]) {
      // Update existing subscription (keys may have rotated)
      await db
        .update(pushSubscriptions)
        .set({
          p256dh,
          auth,
          workoutReminders: preferences?.workoutReminders ?? existing[0].workoutReminders,
          achievementAlerts: preferences?.achievementAlerts ?? existing[0].achievementAlerts,
          coachMessages: preferences?.coachMessages ?? existing[0].coachMessages,
          weeklySummary: preferences?.weeklySummary ?? existing[0].weeklySummary,
        })
        .where(eq(pushSubscriptions.id, existing[0].id));

      return NextResponse.json({ ok: true, updated: true });
    }

    // Create new subscription
    await db.insert(pushSubscriptions).values({
      profileId,
      endpoint,
      p256dh,
      auth,
      workoutReminders: preferences?.workoutReminders ?? true,
      achievementAlerts: preferences?.achievementAlerts ?? true,
      coachMessages: preferences?.coachMessages ?? true,
      weeklySummary: preferences?.weeklySummary ?? true,
      createdAt: now,
    });

    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/push/subscribe
 * Update notification preferences for an existing subscription
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, preferences } = body;

    if (!endpoint || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, preferences' },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const updateData: Record<string, boolean> = {};
    if (preferences.workoutReminders !== undefined) updateData.workoutReminders = preferences.workoutReminders;
    if (preferences.achievementAlerts !== undefined) updateData.achievementAlerts = preferences.achievementAlerts;
    if (preferences.coachMessages !== undefined) updateData.coachMessages = preferences.coachMessages;
    if (preferences.weeklySummary !== undefined) updateData.weeklySummary = preferences.weeklySummary;

    await db
      .update(pushSubscriptions)
      .set(updateData)
      .where(eq(pushSubscriptions.id, existing[0].id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Push] Preference update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription by endpoint
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing required field: endpoint' }, { status: 400 });
    }

    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Push] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
