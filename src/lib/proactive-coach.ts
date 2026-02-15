'use server';

import { db } from '@/lib/db';
import { workouts, profiles, userSettings, coachInteractions, races } from '@/lib/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface ProactivePrompt {
  id: string;
  type: 'post_workout' | 'check_in' | 'missing_info' | 'milestone' | 'concern';
  priority: 'high' | 'medium' | 'low';
  trigger: string;
  message: string;
  questions?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
  expiresAt?: Date;
}

/**
 * Get proactive prompts based on current context
 */
export async function getProactivePrompts(): Promise<ProactivePrompt[]> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return [];

    const prompts: ProactivePrompt[] = [];

    // Get profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) return [];

    // Check for recent workout
    const recentWorkout = await checkRecentWorkout(profileId);
    if (recentWorkout) {
      prompts.push(recentWorkout);
    }

    // Check for missing plan info
    const missingInfo = await checkMissingPlanInfo(profile);
    if (missingInfo.length > 0) {
      prompts.push(...missingInfo);
    }

    // Check for periodic check-ins
    const checkIn = await getPeriodicCheckIn(profileId);
    if (checkIn) {
      prompts.push(checkIn);
    }

    // Check for concerning patterns
    const concerns = await checkForConcerns(profileId);
    if (concerns.length > 0) {
      prompts.push(...concerns);
    }

    // Check for milestones
    const milestones = await checkMilestones(profileId);
    if (milestones.length > 0) {
      prompts.push(...milestones);
    }

    // Sort by priority
    return prompts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  } catch (error) {
    console.error('Error getting proactive prompts:', error);
    return [];
  }
}

/**
 * Check if user just completed a workout
 */
async function checkRecentWorkout(profileId: string): Promise<ProactivePrompt | null> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        gte(workouts.createdAt, tenMinutesAgo.toISOString())
      )
    )
    .orderBy(desc(workouts.createdAt))
    .limit(1);

  if (recentWorkouts.length === 0) return null;

  const workout = recentWorkouts[0];

  // Check if we already asked about this workout
  const existingInteraction = await db
    .select()
    .from(coachInteractions)
    .where(
      and(
        eq(coachInteractions.profileId, profileId),
        eq(coachInteractions.context, JSON.stringify({ workoutId: workout.id }))
      )
    )
    .limit(1);

  if (existingInteraction.length > 0) return null;

  // Generate context-aware questions based on workout
  const questions: string[] = [];

  if (workout.workoutType === 'interval' || workout.workoutType === 'tempo') {
    questions.push(
      "How did the workout feel? Were you able to hit your target paces?",
      "Any discomfort or unusual fatigue during the harder efforts?",
      "How would you rate your effort level on a scale of 1-10?"
    );
  } else if (workout.workoutType === 'long_run') {
    questions.push(
      "How did you feel during the long run? Any energy issues?",
      "Did you practice your race nutrition/hydration strategy?",
      "How are your legs feeling after the distance?"
    );
  } else if (workout.workoutType === 'recovery' || workout.workoutType === 'easy') {
    questions.push(
      "Did this feel truly easy? Were you able to have a conversation?",
      "Any lingering soreness or fatigue from previous workouts?",
      "How's your overall energy level today?"
    );
  }

  // Check for PRs or notable performances
  if (workout.assessment?.isPersonalRecord) {
    questions.unshift("Congrats on the PR! What do you think contributed to this breakthrough?");
  }

  // Check pace relative to usual
  const avgPaceSeconds = workout.avgPaceSeconds;
  if (avgPaceSeconds) {
    const similarWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          eq(workouts.workoutType, workout.workoutType)
        )
      )
      .orderBy(desc(workouts.date))
      .limit(10);

    const avgUsualPace = similarWorkouts
      .filter(w => w.avgPaceSeconds)
      .reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / similarWorkouts.length;

    if (avgPaceSeconds > avgUsualPace * 1.1) {
      questions.push("You ran a bit slower than usual today - was this intentional or are you feeling fatigued?");
    } else if (avgPaceSeconds < avgUsualPace * 0.95) {
      questions.push("Great pace today! Feeling strong or pushing too hard?");
    }
  }

  return {
    id: `workout-${workout.id}`,
    type: 'post_workout',
    priority: 'high',
    trigger: 'recent_workout',
    message: `I see you just completed your ${workout.workoutType?.replace('_', ' ') || 'run'}! ${workout.distanceMiles?.toFixed(1)} miles in ${workout.durationMinutes} minutes.`,
    questions,
    context: { workoutId: workout.id },
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Expires in 2 hours
  };
}

/**
 * Check for missing information needed for plan generation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkMissingPlanInfo(profile: any): Promise<ProactivePrompt[]> {
  const prompts: ProactivePrompt[] = [];
  const missingFields: string[] = [];

  // Get settings (where age, mileage live) and races (where goals live)
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.profileId, profile.id));

  const profileRaces = await db
    .select()
    .from(races)
    .where(eq(races.profileId, profile.id));

  // Critical fields for plan generation
  if (profileRaces.length === 0) missingFields.push('race goal');
  if (!settings?.currentWeeklyMileage && settings?.currentWeeklyMileage !== 0) missingFields.push('current weekly mileage');
  if (!settings?.age) missingFields.push('age');

  if (missingFields.length > 0) {
    prompts.push({
      id: 'missing-plan-info',
      type: 'missing_info',
      priority: 'high',
      trigger: 'missing_profile_data',
      message: `I'd love to create a personalized training plan for you, but I need a few more details first!`,
      questions: [
        `To build your plan, I need to know: ${missingFields.join(', ')}. Would you like to fill these in now?`,
        "What race are you training for? (5K, 10K, Half Marathon, Marathon, etc.)",
        "When is your target race date?",
        "How many miles per week are you currently running?",
      ],
      context: { missingFields },
    });
  }

  // Also check if they have a race but no plan
  const upcomingRaces = await db
    .select()
    .from(races)
    .where(
      and(
        eq(races.profileId, profile.id),
        gte(races.date, new Date().toISOString().split('T')[0])
      )
    );

  const hasUpcomingRace = upcomingRaces.length > 0;
  const hasTrainingPlan = upcomingRaces.some(r => r.trainingPlanGenerated);

  if (hasUpcomingRace && !hasTrainingPlan && missingFields.length === 0) {
    prompts.push({
      id: 'generate-plan-reminder',
      type: 'missing_info',
      priority: 'medium',
      trigger: 'race_without_plan',
      message: `I see you have a race coming up! Ready to create your personalized training plan?`,
      questions: [
        "Would you like me to generate a training plan for your upcoming race?",
        "Do you want to review your current fitness level first?",
        "Should we discuss your race goals before creating the plan?",
      ],
      context: { raceDate: upcomingRaces[0].date, raceName: upcomingRaces[0].name },
    });
  }

  // Additional helpful info
  const helpfulFields: string[] = [];
  if (!profile.vo2Max) helpfulFields.push('VO2 max');
  if (!profile.lactateThreshold) helpfulFields.push('lactate threshold');
  if (!profile.injury_history) helpfulFields.push('injury history');

  if (helpfulFields.length > 0 && missingFields.length === 0) {
    prompts.push({
      id: 'helpful-info',
      type: 'missing_info',
      priority: 'low',
      trigger: 'optional_profile_data',
      message: `Your training plan is ready, but I could make it even better with a bit more info.`,
      questions: [
        `If you know your ${helpfulFields.join(' or ')}, I can fine-tune your training zones. No worries if not!`,
        "Have you had any running injuries in the past year I should know about?",
      ],
      context: { helpfulFields },
    });
  }

  return prompts;
}

/**
 * Get periodic check-ins based on last interaction
 */
async function getPeriodicCheckIn(profileId: string): Promise<ProactivePrompt | null> {
  // Check last coach interaction
  const lastInteraction = await db
    .select()
    .from(coachInteractions)
    .where(eq(coachInteractions.profileId, profileId))
    .orderBy(desc(coachInteractions.createdAt))
    .limit(1);

  const daysSinceInteraction = lastInteraction.length > 0
    ? (Date.now() - new Date(lastInteraction[0].createdAt).getTime()) / (24 * 60 * 60 * 1000)
    : 7; // Default to 7 if no interactions

  // Only check in if it's been 3+ days
  if (daysSinceInteraction < 3) return null;

  // Get current training context
  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.profileId, profileId))
    .orderBy(desc(workouts.date))
    .limit(7);

  const weeklyMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  const checkInTypes = [
    {
      condition: weeklyMiles === 0,
      message: "Hey! I noticed you haven't logged any runs this week. Everything okay?",
      questions: [
        "Are you taking a planned rest week or dealing with something?",
        "Would you like me to adjust your training plan?",
        "Sometimes life gets busy - how can I help you get back on track?",
      ],
    },
    {
      condition: weeklyMiles > 0 && weeklyMiles < 10,
      message: "How's your week going? I see you're keeping active!",
      questions: [
        "How are you feeling with your current training load?",
        "Any aches, pains, or concerns I should know about?",
        "What's been your favorite run this week?",
      ],
    },
    {
      condition: weeklyMiles >= 10,
      message: "Great job staying consistent this week!",
      questions: [
        "How's your body handling the training volume?",
        "Are you getting enough sleep and recovery?",
        "Anything you'd like to work on or improve?",
      ],
    },
  ];

  const checkIn = checkInTypes.find(type => type.condition) || checkInTypes[1];

  return {
    id: `check-in-${new Date().toISOString().split('T')[0]}`,
    type: 'check_in',
    priority: 'medium',
    trigger: 'periodic_check_in',
    message: checkIn.message,
    questions: checkIn.questions,
    context: { daysSinceInteraction, weeklyMiles },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
  };
}

/**
 * Check for concerning patterns
 */
async function checkForConcerns(profileId: string): Promise<ProactivePrompt[]> {
  const prompts: ProactivePrompt[] = [];
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.profileId, profileId),
        gte(workouts.date, twoWeeksAgo.toISOString().split('T')[0])
      )
    )
    .orderBy(desc(workouts.date));

  // Check for sudden mileage increase
  const thisWeekMiles = recentWorkouts
    .filter(w => new Date(w.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  const lastWeekMiles = recentWorkouts
    .filter(w => {
      const date = new Date(w.date);
      return date > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
             date <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    })
    .reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  if (lastWeekMiles > 0 && thisWeekMiles > lastWeekMiles * 1.3) {
    prompts.push({
      id: 'mileage-jump',
      type: 'concern',
      priority: 'high',
      trigger: 'sudden_mileage_increase',
      message: `I noticed you've increased your mileage by ${Math.round((thisWeekMiles/lastWeekMiles - 1) * 100)}% this week.`,
      questions: [
        "That's a big jump! How are your legs feeling?",
        "Are you experiencing any unusual soreness or fatigue?",
        "Would you like me to suggest a recovery week to prevent injury?",
      ],
      context: { thisWeekMiles, lastWeekMiles },
    });
  }

  // Check for too many hard days in a row
  const lastFiveDays = recentWorkouts.slice(0, 5);
  const hardDaysInRow = lastFiveDays.filter(w =>
    w.workoutType === 'interval' ||
    w.workoutType === 'tempo' ||
    w.workoutType === 'threshold' ||
    w.workoutType === 'race'
  ).length;

  if (hardDaysInRow >= 3) {
    prompts.push({
      id: 'too-many-hard-days',
      type: 'concern',
      priority: 'high',
      trigger: 'excessive_intensity',
      message: `You've had ${hardDaysInRow} hard workouts in your last 5 runs. That's a lot of intensity!`,
      questions: [
        "How's your energy level? Any signs of overtraining?",
        "Are you getting quality sleep?",
        "Tomorrow would be perfect for an easy recovery run - sound good?",
      ],
      context: { hardDaysInRow },
    });
  }

  return prompts;
}

/**
 * Check for milestones to celebrate
 */
async function checkMilestones(profileId: string): Promise<ProactivePrompt[]> {
  const prompts: ProactivePrompt[] = [];

  // Get all workouts
  const allWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.profileId, profileId))
    .orderBy(desc(workouts.date));

  const totalMiles = allWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);

  // Milestone checks
  const milestones = [
    { miles: 100, message: "You've run over 100 miles with Dreamy!" },
    { miles: 500, message: "500 miles down! You're crushing it!" },
    { miles: 1000, message: "1,000 MILES! You're officially a mileage monster!" },
  ];

  for (const milestone of milestones) {
    if (totalMiles >= milestone.miles && totalMiles < milestone.miles + 20) {
      // Check if we celebrated this already
      const celebrated = await db
        .select()
        .from(coachInteractions)
        .where(
          and(
            eq(coachInteractions.profileId, profileId),
            eq(coachInteractions.context, JSON.stringify({ milestone: milestone.miles }))
          )
        )
        .limit(1);

      if (celebrated.length === 0) {
        prompts.push({
          id: `milestone-${milestone.miles}`,
          type: 'milestone',
          priority: 'medium',
          trigger: 'mileage_milestone',
          message: milestone.message,
          questions: [
            "How does it feel to hit this milestone?",
            "What's been your favorite moment so far?",
            "Ready to chase the next milestone?",
          ],
          context: { milestone: milestone.miles, totalMiles },
        });
      }
    }
  }

  // Streak milestones
  const dates = [...new Set(allWorkouts.map(w => w.date))].sort().reverse();
  let currentStreak = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < dates.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    if (dates[i] === expectedDate.toISOString().split('T')[0]) {
      currentStreak++;
    } else {
      break;
    }
  }

  if (currentStreak === 7 || currentStreak === 30 || currentStreak === 100) {
    prompts.push({
      id: `streak-${currentStreak}`,
      type: 'milestone',
      priority: 'medium',
      trigger: 'streak_milestone',
      message: `${currentStreak} days in a row! Your consistency is incredible!`,
      questions: [
        "What's keeping you motivated?",
        "How are you balancing consistency with recovery?",
        "Any tips for others trying to build a streak?",
      ],
      context: { streak: currentStreak },
    });
  }

  return prompts;
}

/**
 * Mark a prompt as addressed
 */
export async function markPromptAddressed(
  promptId: string,
  response?: string
): Promise<{ success: boolean }> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return { success: false };

    // Store the interaction if there was a response
    if (response) {
      await db.insert(coachInteractions).values({
        profileId,
        userMessage: response,
        coachResponse: '', // Will be filled by the coach
        context: { promptId },
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true };

  } catch (error) {
    console.error('Error marking prompt addressed:', error);
    return { success: false };
  }
}