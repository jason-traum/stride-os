'use server';

import { db, coachActions, plannedWorkouts } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createProfileAction } from '@/lib/action-utils';
import type { CoachAction } from '@/lib/schema';

// ==================== Types ====================

export interface CreateCoachActionInput {
  actionType: string; // plan_modification, workout_adjustment, schedule_change, mode_activation, recommendation
  description: string;
  dataSnapshot?: Record<string, unknown>; // Before/after state for display
}

export type PendingCoachAction = CoachAction;

// ==================== Server Actions ====================

/**
 * Create a new coach action (proposed plan change awaiting approval).
 */
export const createCoachAction = createProfileAction(
  async (profileId: number, input: CreateCoachActionInput) => {
    const now = new Date().toISOString();

    const [action] = await db.insert(coachActions).values({
      profileId,
      timestamp: now,
      actionType: input.actionType,
      description: input.description,
      dataSnapshot: input.dataSnapshot ? JSON.stringify(input.dataSnapshot) : null,
      approved: null, // pending
      appliedAt: null,
      notes: null,
      createdAt: now,
    }).returning();

    return action;
  },
  'createCoachAction'
);

/**
 * Get all pending (unapproved) coach actions for the active profile.
 */
export const getPendingActions = createProfileAction(
  async (profileId: number) => {
    const actions = await db
      .select()
      .from(coachActions)
      .where(
        and(
          eq(coachActions.profileId, profileId),
          isNull(coachActions.approved)
        )
      )
      .orderBy(coachActions.timestamp);

    // Parse dataSnapshot for each action
    return actions.map((a: CoachAction) => ({
      ...a,
      parsedSnapshot: a.dataSnapshot ? JSON.parse(a.dataSnapshot) : null,
    }));
  },
  'getPendingActions'
);

/**
 * Approve a coach action and apply the associated plan change.
 */
export const approveCoachAction = createProfileAction(
  async (profileId: number, actionId: number) => {
    // Fetch the action
    const action = await db
      .select()
      .from(coachActions)
      .where(
        and(
          eq(coachActions.id, actionId),
          eq(coachActions.profileId, profileId)
        )
      )
      .limit(1);

    if (!action[0]) {
      throw new Error('Coach action not found');
    }

    if (action[0].approved !== null) {
      throw new Error('Coach action already resolved');
    }

    const now = new Date().toISOString();

    // Apply the change based on dataSnapshot
    const snapshot = action[0].dataSnapshot ? JSON.parse(action[0].dataSnapshot) : null;

    if (snapshot?.workoutId && snapshot?.changes) {
      // This is a workout modification — apply changes to the planned workout
      const updates: Record<string, unknown> = { updatedAt: now, status: 'modified' };

      for (const change of snapshot.changes) {
        switch (change.field) {
          case 'name':
            updates.name = change.to;
            break;
          case 'description':
            updates.description = change.to;
            break;
          case 'distance':
          case 'target_distance_miles':
            updates.targetDistanceMiles = change.to;
            break;
          case 'duration':
          case 'target_duration_minutes':
            updates.targetDurationMinutes = change.to;
            break;
          case 'type':
          case 'workout_type':
            updates.workoutType = change.to;
            break;
          case 'pace':
          case 'target_pace_seconds_per_mile':
            updates.targetPaceSecondsPerMile = change.to;
            break;
        }
      }

      if (snapshot.rationale) {
        updates.rationale = snapshot.rationale;
      }

      await db.update(plannedWorkouts)
        .set(updates)
        .where(eq(plannedWorkouts.id, snapshot.workoutId));
    } else if (snapshot?.action === 'skip' && snapshot?.workoutId) {
      // Skip the workout
      await db.update(plannedWorkouts)
        .set({ status: 'skipped', updatedAt: now })
        .where(eq(plannedWorkouts.id, snapshot.workoutId));
    } else if (snapshot?.action === 'scale_down' && snapshot?.workoutId) {
      // Scale down workout
      const updates: Record<string, unknown> = { updatedAt: now, status: 'modified' };
      if (snapshot.proposedDistance != null) updates.targetDistanceMiles = snapshot.proposedDistance;
      if (snapshot.proposedDuration != null) updates.targetDurationMinutes = snapshot.proposedDuration;
      if (snapshot.rationale) updates.rationale = snapshot.rationale;

      await db.update(plannedWorkouts)
        .set(updates)
        .where(eq(plannedWorkouts.id, snapshot.workoutId));
    }

    // Mark action as approved
    await db.update(coachActions)
      .set({ approved: true, appliedAt: now })
      .where(eq(coachActions.id, actionId));

    revalidatePath('/today');
    revalidatePath('/plan');

    return { success: true, actionId };
  },
  'approveCoachAction'
);

/**
 * Reject a coach action with optional feedback.
 */
export const rejectCoachAction = createProfileAction(
  async (profileId: number, actionId: number, feedback?: string) => {
    // Fetch the action
    const action = await db
      .select()
      .from(coachActions)
      .where(
        and(
          eq(coachActions.id, actionId),
          eq(coachActions.profileId, profileId)
        )
      )
      .limit(1);

    if (!action[0]) {
      throw new Error('Coach action not found');
    }

    if (action[0].approved !== null) {
      throw new Error('Coach action already resolved');
    }

    const now = new Date().toISOString();

    // Mark action as rejected
    await db.update(coachActions)
      .set({
        approved: false,
        notes: feedback || 'Dismissed by user',
      })
      .where(eq(coachActions.id, actionId));

    revalidatePath('/today');

    return { success: true, actionId };
  },
  'rejectCoachAction'
);
