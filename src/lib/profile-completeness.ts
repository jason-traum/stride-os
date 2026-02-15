'use server';

import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface ProfileCompleteness {
  percentage: number;
  completedFields: string[];
  missingFields: {
    field: string;
    label: string;
    importance: 'high' | 'medium' | 'low';
    description: string;
  }[];
  suggestions: string[];
}

const PROFILE_FIELDS = [
  // High importance
  { field: 'age', label: 'Age', importance: 'high' as const, description: 'Essential for training recommendations and heart rate zones' },
  { field: 'restingHR', label: 'Resting Heart Rate', importance: 'high' as const, description: 'Critical for determining training zones and recovery' },
  { field: 'maxHR', label: 'Max Heart Rate', importance: 'high' as const, description: 'Needed for accurate heart rate zone calculations' },
  { field: 'raceGoal', label: 'Race Goal', importance: 'high' as const, description: 'Helps tailor training plans to your specific goals' },
  { field: 'raceDate', label: 'Race Date', importance: 'high' as const, description: 'Required for periodized training plan' },
  { field: 'weeklyMileage', label: 'Weekly Mileage', importance: 'high' as const, description: 'Baseline for building safe progression' },

  // Medium importance
  { field: 'vo2Max', label: 'VO2 Max', importance: 'medium' as const, description: 'Helps predict race times and track fitness' },
  { field: 'lactateThreshold', label: 'Lactate Threshold', importance: 'medium' as const, description: 'Optimizes tempo and threshold workouts' },
  { field: 'thresholdPace', label: 'Threshold Pace', importance: 'medium' as const, description: 'Sets appropriate training paces' },
  { field: 'trainingPhilosophy', label: 'Training Philosophy', importance: 'medium' as const, description: 'Aligns recommendations with your preferences' },
  { field: 'injury_history', label: 'Injury History', importance: 'medium' as const, description: 'Helps prevent re-injury with smart programming' },

  // Low importance (nice to have)
  { field: 'height', label: 'Height', importance: 'low' as const, description: 'Useful for stride and biomechanics insights' },
  { field: 'weight', label: 'Weight', importance: 'low' as const, description: 'Helps with nutrition and race weight planning' },
  { field: 'runningYears', label: 'Years Running', importance: 'low' as const, description: 'Informs training progression rates' },
  { field: 'favoriteBrands', label: 'Favorite Brands', importance: 'low' as const, description: 'Personalizes gear recommendations' },
  { field: 'favoriteRoutes', label: 'Favorite Routes', importance: 'low' as const, description: 'Suggests similar routes and terrain' },
];

export async function getProfileCompleteness(profileId: string): Promise<ProfileCompleteness> {
  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Check which fields are completed
    const completedFields: string[] = [];
    const missingFields: ProfileCompleteness['missingFields'] = [];

    for (const fieldDef of PROFILE_FIELDS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (profile as any)[fieldDef.field];

      // Check if field has meaningful value
      const isCompleted = value !== null && value !== undefined && value !== '' && value !== 0;

      if (isCompleted) {
        completedFields.push(fieldDef.label);
      } else {
        missingFields.push({
          field: fieldDef.field,
          label: fieldDef.label,
          importance: fieldDef.importance,
          description: fieldDef.description,
        });
      }
    }

    // Calculate percentage
    const percentage = Math.round((completedFields.length / PROFILE_FIELDS.length) * 100);

    // Generate suggestions based on missing fields
    const suggestions: string[] = [];

    // Prioritize high importance fields
    const missingHighImportance = missingFields.filter(f => f.importance === 'high');
    if (missingHighImportance.length > 0) {
      suggestions.push(`Complete high-priority fields: ${missingHighImportance.slice(0, 3).map(f => f.label).join(', ')}`);
    }

    // Add specific suggestions based on what's missing
    if (missingFields.find(f => f.field === 'restingHR')) {
      suggestions.push('Take your resting heart rate first thing in the morning for 3-5 days');
    }
    if (missingFields.find(f => f.field === 'maxHR')) {
      suggestions.push('Perform a max HR test or use 220-age as an estimate');
    }
    if (missingFields.find(f => f.field === 'raceGoal') || missingFields.find(f => f.field === 'raceDate')) {
      suggestions.push('Set a race goal to get personalized training plans');
    }
    if (missingFields.find(f => f.field === 'vo2Max')) {
      suggestions.push('Get VO2 max from your running watch or recent race performance');
    }

    // Add encouragement based on completion level
    if (percentage >= 80) {
      suggestions.push('Almost there! Complete the remaining fields for optimal coaching');
    } else if (percentage >= 60) {
      suggestions.push('Good progress! Each additional field improves recommendation accuracy');
    } else if (percentage >= 40) {
      suggestions.push('Keep going! The more we know, the better we can help');
    } else {
      suggestions.push('Start with the high-priority fields for immediate improvements');
    }

    return {
      percentage,
      completedFields,
      missingFields,
      suggestions,
    };

  } catch (error) {
    console.error('Error calculating profile completeness:', error);
    return {
      percentage: 0,
      completedFields: [],
      missingFields: [],
      suggestions: ['Unable to calculate profile completeness'],
    };
  }
}