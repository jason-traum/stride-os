import { NextRequest, NextResponse } from 'next/server';
import { db, userSettings, workouts } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

// Webhook event types from Strava
interface StravaWebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: {
    title?: string;
    type?: string;
    private?: boolean;
  };
}

// GET endpoint for webhook subscription verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');


  // Verify the subscription
  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge });
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 403 });
}

// POST endpoint for webhook events
export async function POST(request: NextRequest) {
  try {
    const event: StravaWebhookEvent = await request.json();

    // Handle different event types
    if (event.object_type === 'athlete') {
      // Handle athlete updates (like deauthorization)
      await handleAthleteEvent(event);
    } else if (event.object_type === 'activity') {
      // Handle activity events
      await handleActivityEvent(event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Strava Webhook] Error processing event:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

async function handleAthleteEvent(event: StravaWebhookEvent) {
  if (event.aspect_type === 'update') {
    // Check if this is a deauthorization
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.stravaAthleteId, event.owner_id)
    });

    if (settings) {

      // Clear Strava tokens
      await db.update(userSettings)
        .set({
          stravaAccessToken: null,
          stravaRefreshToken: null,
          stravaTokenExpiresAt: null,
          stravaAutoSync: false,
          updatedAt: new Date().toISOString()
        })
        .where(eq(userSettings.id, settings.id));
    }
  }
}

async function handleActivityEvent(event: StravaWebhookEvent) {
  // Find user by athlete ID
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.stravaAthleteId, event.owner_id)
  });

  if (!settings || !settings.stravaAutoSync) {
    return;
  }

  switch (event.aspect_type) {
    case 'create':
      // Queue activity for sync
      // TODO: Implement activity sync queue
      // For now, we'll rely on periodic sync
      break;

    case 'update':
      if (event.updates?.title) {
        // Update activity title if it exists
        await db.update(workouts)
          .set({
            notes: event.updates.title,
            updatedAt: new Date().toISOString()
          })
          .where(and(
            eq(workouts.stravaActivityId, event.object_id),
            eq(workouts.profileId, settings.profileId!)
          ));
      }
      break;

    case 'delete':
      // Mark activity as deleted (soft delete)
      await db.update(workouts)
        .set({
          source: 'deleted',
          updatedAt: new Date().toISOString()
        })
        .where(and(
          eq(workouts.stravaActivityId, event.object_id),
          eq(workouts.profileId, settings.profileId!)
        ));
      break;
  }
}