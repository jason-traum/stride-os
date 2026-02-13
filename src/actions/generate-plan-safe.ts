'use server';

import { generatePlanForRace } from './training-plan';
import { ensureUserSettings } from './ensure-settings';
import { checkPlanRequirements } from '@/lib/plan-requirements';
import { getActiveProfileId } from '@/lib/profile-server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export interface PlanGenerationResult {
  success: boolean;
  error?: string;
  missingFields?: string[];
  plan?: any;
}

/**
 * Safely generate a training plan, ensuring all requirements are met
 */
export async function generatePlanSafely(raceId: number): Promise<PlanGenerationResult> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return {
        success: false,
        error: 'No active profile found. Please log in.',
      };
    }

    // Check plan requirements
    const requirements = await checkPlanRequirements();
    if (!requirements.canGeneratePlan) {
      const missingFields = requirements.missingRequirements.map(r => r.label);
      return {
        success: false,
        error: 'Missing required information for plan generation.',
        missingFields,
      };
    }

    // Ensure user settings exist (create from profile if needed)
    await ensureUserSettings(profileId);

    // Get profile to check for additional requirements
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
    });

    if (!profile) {
      return {
        success: false,
        error: 'Profile not found.',
      };
    }

    // Generate the plan
    const plan = await generatePlanForRace(raceId);

    return {
      success: true,
      plan,
    };
  } catch (error) {
    console.error('Error generating plan:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('settings not found')) {
        return {
          success: false,
          error: 'Unable to create training settings. Please complete your profile first.',
          missingFields: ['Current Weekly Mileage', 'Age', 'Race Goal', 'Race Date'],
        };
      }
      if (error.message.includes('No training history')) {
        return {
          success: false,
          error: 'Please log some recent runs or set your current weekly mileage in your profile.',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred while generating your plan.',
    };
  }
}