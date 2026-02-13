'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface PlanRequirement {
  field: string;
  label: string;
  required: boolean;
  currentValue?: any;
  isMissing: boolean;
  description: string;
}

/**
 * Check if user has all required information for plan generation
 */
export async function checkPlanRequirements(): Promise<{
  canGeneratePlan: boolean;
  missingRequirements: PlanRequirement[];
  allRequirements: PlanRequirement[];
}> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return {
        canGeneratePlan: false,
        missingRequirements: [],
        allRequirements: []
      };
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) {
      return {
        canGeneratePlan: false,
        missingRequirements: [],
        allRequirements: []
      };
    }

    // Define all requirements
    const requirements: PlanRequirement[] = [
      {
        field: 'raceGoal',
        label: 'Race Goal',
        required: true,
        currentValue: profile.raceGoal,
        isMissing: !profile.raceGoal,
        description: 'Your target race distance (5K, 10K, Half Marathon, Marathon, etc.)'
      },
      {
        field: 'raceDate',
        label: 'Race Date',
        required: true,
        currentValue: profile.raceDate,
        isMissing: !profile.raceDate,
        description: 'When is your target race? This determines your training timeline.'
      },
      {
        field: 'weeklyMileage',
        label: 'Current Weekly Mileage',
        required: true,
        currentValue: profile.weeklyMileage,
        isMissing: profile.weeklyMileage === null || profile.weeklyMileage === undefined,
        description: 'How many miles you currently run per week (can be 0 if just starting)'
      },
      {
        field: 'age',
        label: 'Age',
        required: true,
        currentValue: profile.age,
        isMissing: !profile.age,
        description: 'Your age helps determine appropriate training intensities'
      },
      {
        field: 'restingHR',
        label: 'Resting Heart Rate',
        required: false,
        currentValue: profile.restingHR,
        isMissing: !profile.restingHR,
        description: 'Morning resting heart rate for accurate zone calculations'
      },
      {
        field: 'maxHR',
        label: 'Max Heart Rate',
        required: false,
        currentValue: profile.maxHR,
        isMissing: !profile.maxHR,
        description: 'Your maximum heart rate for precise training zones'
      },
      {
        field: 'vo2Max',
        label: 'VO2 Max',
        required: false,
        currentValue: profile.vo2Max,
        isMissing: !profile.vo2Max,
        description: 'Aerobic fitness measure for advanced planning'
      },
      {
        field: 'injury_history',
        label: 'Injury History',
        required: false,
        currentValue: profile.injury_history,
        isMissing: !profile.injury_history,
        description: 'Past injuries to consider in training load'
      }
    ];

    const missingRequirements = requirements.filter(req => req.required && req.isMissing);
    const canGeneratePlan = missingRequirements.length === 0;

    return {
      canGeneratePlan,
      missingRequirements,
      allRequirements: requirements
    };

  } catch (error) {
    console.error('Error checking plan requirements:', error);
    return {
      canGeneratePlan: false,
      missingRequirements: [],
      allRequirements: []
    };
  }
}