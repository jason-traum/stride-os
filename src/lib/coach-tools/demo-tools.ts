// Demo mode tool implementations
// Auto-generated from coach-tools.ts split

import { parsePaceToSeconds } from '../conditions';
import { RACE_DISTANCES } from '../training/types';
import type { DemoContext, DemoAction } from './types';
import { buildProfileUpdates } from './shared';

function executeDemoTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: DemoContext
): unknown | null {
  const formatPace = (seconds: number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };

  switch (toolName) {
    // ========== READ TOOLS ==========
    case 'get_recent_workouts': {
      const count = Math.min((input.count as number) || 5, 20);
      const workoutType = input.workout_type as string | undefined;

      let results = [...ctx.workouts].sort((a, b) => b.date.localeCompare(a.date));

      if (workoutType) {
        results = results.filter(w => w.workoutType === workoutType);
      }

      return results.slice(0, count).map(w => ({
        id: w.id,
        date: w.date,
        distance_miles: w.distanceMiles,
        duration_minutes: w.durationMinutes,
        pace_per_mile: formatPace(w.avgPaceSeconds),
        workout_type: w.workoutType,
        notes: w.notes || null,
        assessment: w.assessment ? {
          verdict: w.assessment.verdict,
          rpe: w.assessment.rpe,
          legs_feel: w.assessment.legsFeel,
          sleep_quality: w.assessment.sleepQuality,
          stress: w.assessment.stress,
          note: w.assessment.note,
        } : null,
      }));
    }

    case 'get_user_settings':
      return {
        name: ctx.settings?.name || 'Demo Runner',
        vdot: ctx.settings?.vdot || 45,
        easy_pace: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
        tempo_pace: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
        threshold_pace: ctx.settings?.thresholdPaceSeconds ? formatPace(ctx.settings.thresholdPaceSeconds) : '7:00/mi',
        interval_pace: ctx.settings?.intervalPaceSeconds ? formatPace(ctx.settings.intervalPaceSeconds) : '6:15/mi',
        weekly_mileage: ctx.settings?.currentWeeklyMileage || 35,
        plan_aggressiveness: ctx.settings?.planAggressiveness || 'moderate',
      };

    case 'get_shoes': {
      const includeRetired = input.include_retired as boolean || false;
      return ctx.shoes.filter(s => includeRetired || s.totalMiles < 500).map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        model: s.model,
        total_miles: s.totalMiles,
      }));
    }

    case 'get_races': {
      const includeCompleted = input.include_completed as boolean || false;
      const today = new Date().toISOString().split('T')[0];
      return ctx.races
        .filter(r => includeCompleted || r.date >= today)
        .map(r => ({
          id: r.id,
          name: r.name,
          date: r.date,
          distance: r.distanceLabel,
          priority: r.priority,
          target_time_seconds: r.targetTimeSeconds,
          has_training_plan: r.trainingPlanGenerated,
        }));
    }

    case 'get_pace_zones':
      return {
        vdot: ctx.settings?.vdot || 45,
        easy: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
        marathon: ctx.settings?.marathonPaceSeconds ? formatPace(ctx.settings.marathonPaceSeconds) : '8:00/mi',
        half_marathon: ctx.settings?.halfMarathonPaceSeconds ? formatPace(ctx.settings.halfMarathonPaceSeconds) : '7:30/mi',
        threshold: ctx.settings?.thresholdPaceSeconds ? formatPace(ctx.settings.thresholdPaceSeconds) : '7:00/mi',
        interval: ctx.settings?.intervalPaceSeconds ? formatPace(ctx.settings.intervalPaceSeconds) : '6:15/mi',
        tempo: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
      };

    case 'get_todays_planned_workout':
    case 'get_todays_workout': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (!todaysWorkout) {
        return { message: 'No workout planned for today (rest day)' };
      }
      return {
        id: todaysWorkout.id,
        name: todaysWorkout.name,
        type: todaysWorkout.workoutType,
        distance_miles: todaysWorkout.targetDistanceMiles,
        target_pace: todaysWorkout.targetPaceSecondsPerMile ? formatPace(todaysWorkout.targetPaceSecondsPerMile) : null,
        description: todaysWorkout.description,
        rationale: todaysWorkout.rationale,
        is_key_workout: todaysWorkout.isKeyWorkout,
        phase: todaysWorkout.phase,
        status: todaysWorkout.status,
      };
    }

    case 'get_planned_workout_by_date': {
      let dateStr = input.date as string;

      // Handle "tomorrow" conversion
      if (dateStr === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      }

      const workout = ctx.plannedWorkouts.find(w => w.date === dateStr);
      if (!workout) {
        return {
          found: false,
          date: dateStr,
          message: `No workout planned for ${dateStr} (rest day or no plan)`,
          suggestion: 'Use suggest_next_workout or prescribe_workout to get a workout recommendation.'
        };
      }
      return {
        found: true,
        date: dateStr,
        workout: {
          id: workout.id,
          name: workout.name,
          type: workout.workoutType,
          distance_miles: workout.targetDistanceMiles,
          target_pace: workout.targetPaceSecondsPerMile ? formatPace(workout.targetPaceSecondsPerMile) : null,
          description: workout.description,
          rationale: workout.rationale,
          is_key_workout: workout.isKeyWorkout,
          phase: workout.phase,
          status: workout.status,
        },
        message: `${workout.name} planned for ${dateStr}`,
      };
    }

    case 'get_week_workouts':
    case 'get_weekly_plan': {
      const weekOffset = (input.week_offset as number) || 0;
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];

      const weekWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= startStr && w.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        week_start: startStr,
        week_end: endStr,
        workouts: weekWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
          name: w.name,
          type: w.workoutType,
          distance_miles: w.targetDistanceMiles,
          target_pace: w.targetPaceSecondsPerMile ? formatPace(w.targetPaceSecondsPerMile) : null,
          is_key_workout: w.isKeyWorkout,
          status: w.status,
          phase: w.phase,
        })),
        total_miles: weekWorkouts.reduce((sum, w) => sum + w.targetDistanceMiles, 0),
      };
    }

    case 'get_context_summary': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      const upcomingRaces = ctx.races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      const nextRace = upcomingRaces[0];

      // Calculate this week's mileage
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startStr = startOfWeek.toISOString().split('T')[0];
      const weekWorkouts = ctx.workouts.filter(w => w.date >= startStr);
      const weekMileage = weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);

      return {
        athlete_name: ctx.settings?.name || 'Runner',
        vdot: ctx.settings?.vdot || 45,
        current_weekly_mileage: ctx.settings?.currentWeeklyMileage || 35,
        this_week_actual_miles: weekMileage.toFixed(1),
        todays_workout: todaysWorkout ? todaysWorkout.name : 'Rest day',
        next_race: nextRace ? {
          name: nextRace.name,
          date: nextRace.date,
          distance: nextRace.distanceLabel,
          days_until: Math.ceil((new Date(nextRace.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        recent_workouts_count: ctx.workouts.length,
        phase: todaysWorkout?.phase || 'base',
      };
    }

    // ========== WRITE TOOLS - Return demo actions ==========
    case 'add_race': {
      const name = input.name as string;
      const date = input.date as string;
      const distanceLabel = input.distance as string || 'half_marathon';
      const priority = (input.priority as 'A' | 'B' | 'C') || 'A';
      const targetTimeSeconds = input.target_time_seconds as number | undefined;

      const distanceInfo = RACE_DISTANCES[distanceLabel];
      const newRace = {
        id: Date.now(),
        name,
        date,
        distanceMeters: distanceInfo?.meters || 21097,
        distanceLabel,
        priority,
        targetTimeSeconds: targetTimeSeconds || null,
        trainingPlanGenerated: false,
      };

      return {
        demoAction: 'add_race',
        data: newRace,
        message: `Added ${name} (${distanceLabel}) on ${date} as ${priority}-priority race. The race has been added to your calendar. Would you like me to generate a training plan for this race?`,
      } as DemoAction;
    }

    case 'log_workout': {
      const date = (input.date as string) || new Date().toISOString().split('T')[0];
      const distanceMiles = input.distance_miles as number;
      const durationMinutes = input.duration_minutes as number;
      const paceStr = input.pace_per_mile as string;
      const workoutType = (input.workout_type as string) || 'easy';

      // Calculate missing values
      let finalDistance = distanceMiles;
      let finalDuration = durationMinutes;
      let finalPaceSeconds = paceStr ? parsePaceToSeconds(paceStr) : 0;

      if (finalDistance && finalDuration && !finalPaceSeconds) {
        finalPaceSeconds = Math.round((finalDuration * 60) / finalDistance);
      } else if (finalDistance && finalPaceSeconds && !finalDuration) {
        finalDuration = Math.round((finalDistance * finalPaceSeconds) / 60);
      } else if (finalDuration && finalPaceSeconds && !finalDistance) {
        finalDistance = (finalDuration * 60) / finalPaceSeconds;
      }

      const newWorkout = {
        id: Date.now(),
        date,
        distanceMiles: finalDistance || 0,
        durationMinutes: finalDuration || 0,
        avgPaceSeconds: finalPaceSeconds || 0,
        workoutType,
        notes: input.notes as string | undefined,
      };

      return {
        demoAction: 'add_workout',
        data: newWorkout,
        message: `Logged ${finalDistance?.toFixed(1) || 0} mile ${workoutType} run on ${date}${finalPaceSeconds ? ` at ${formatPace(finalPaceSeconds)}` : ''}. Great work!`,
      } as DemoAction;
    }

    case 'update_workout': {
      const workoutId = input.workout_id as number;
      const workout = ctx.workouts.find(w => w.id === workoutId);

      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const changes: string[] = [];
      const updateData: Partial<typeof workout> = {};

      if (input.workout_type !== undefined) {
        updateData.workoutType = input.workout_type as string;
        changes.push(`type → ${input.workout_type}`);
      }
      if (input.distance_miles !== undefined) {
        updateData.distanceMiles = input.distance_miles as number;
        changes.push(`distance → ${input.distance_miles} mi`);
      }
      if (input.duration_minutes !== undefined) {
        updateData.durationMinutes = input.duration_minutes as number;
        changes.push(`duration → ${input.duration_minutes} min`);
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes as string;
        changes.push(`notes updated`);
      }

      return {
        demoAction: 'update_workout',
        data: { workoutId, ...updateData },
        message: `Updated workout from ${workout.date}: ${changes.join(', ') || 'no changes'}`,
      } as DemoAction;
    }

    case 'reschedule_workout': {
      const workoutId = input.workout_id as number;
      const newDate = input.new_date as string;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'reschedule_workout',
        data: { workoutId, newDate, reason },
        message: `Rescheduled "${workout.name}" from ${workout.date} to ${newDate}. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'skip_workout': {
      const workoutId = input.workout_id as number;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'skip_workout',
        data: { workoutId, reason },
        message: `Marked "${workout.name}" as skipped. ${workout.isKeyWorkout ? 'Note: This was a key workout - we may want to reschedule or substitute.' : ''} Reason: ${reason}`,
      } as DemoAction;
    }

    case 'convert_to_easy': {
      const workoutId = input.workout_id as number;
      const reason = input.reason as string;
      const keepDistance = (input.keep_distance as boolean) ?? false;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const newDistance = keepDistance ? workout.targetDistanceMiles : Math.round(workout.targetDistanceMiles * 0.8 * 10) / 10;

      return {
        demoAction: 'convert_to_easy',
        data: {
          workoutId,
          newDistance,
          newPace: ctx.settings?.easyPaceSeconds || 540,
          reason,
        },
        message: `Converted "${workout.name}" to an easy ${newDistance} mile run${keepDistance ? '' : ' (reduced from ' + workout.targetDistanceMiles + ' mi)'}. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'adjust_workout_distance': {
      const workoutId = input.workout_id as number;
      const newDistance = input.new_distance_miles as number;
      const reason = input.reason as string;

      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      return {
        demoAction: 'adjust_distance',
        data: { workoutId, newDistance, reason },
        message: `Adjusted "${workout.name}" distance from ${workout.targetDistanceMiles} to ${newDistance} miles. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'swap_workouts': {
      const workout1Id = input.workout_id_1 as number;
      const workout2Id = input.workout_id_2 as number;
      const reason = input.reason as string;

      const workout1 = ctx.plannedWorkouts.find(w => w.id === workout1Id);
      const workout2 = ctx.plannedWorkouts.find(w => w.id === workout2Id);

      if (!workout1 || !workout2) {
        return { error: 'One or both workouts not found', demoAction: 'none' };
      }

      return {
        demoAction: 'swap_workouts',
        data: { workout1Id, workout2Id, reason },
        message: `Swapped "${workout1.name}" (${workout1.date}) with "${workout2.name}" (${workout2.date}). Reason: ${reason}`,
      } as DemoAction;
    }

    case 'make_down_week': {
      const weekStartDate = input.week_start_date as string;
      const reductionPercent = (input.reduction_percent as number) || 30;
      const reason = input.reason as string;

      // Find workouts in that week
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const weekWorkouts = ctx.plannedWorkouts.filter(
        w => w.date >= weekStartDate && w.date <= weekEndStr
      );

      return {
        demoAction: 'make_down_week',
        data: {
          weekStartDate,
          reductionPercent,
          reason,
          affectedWorkoutIds: weekWorkouts.map(w => w.id),
        },
        message: `Made week of ${weekStartDate} a down week with ${reductionPercent}% volume reduction. ${weekWorkouts.length} workouts will be modified. Reason: ${reason}`,
      } as DemoAction;
    }

    case 'insert_rest_day': {
      const date = input.date as string;
      const pushSubsequent = (input.push_subsequent as boolean) || false;
      const reason = input.reason as string;

      const existingWorkout = ctx.plannedWorkouts.find(w => w.date === date);

      return {
        demoAction: 'insert_rest_day',
        data: {
          date,
          pushSubsequent,
          reason,
          removedWorkoutId: existingWorkout?.id,
        },
        message: `Inserted rest day on ${date}.${existingWorkout ? ` "${existingWorkout.name}" will be ${pushSubsequent ? 'pushed to the next day' : 'skipped'}.` : ''} Reason: ${reason}`,
      } as DemoAction;
    }

    case 'update_race': {
      const raceId = input.race_id as number;
      const updates: Record<string, unknown> = {};

      if (input.name) updates.name = input.name;
      if (input.date) updates.date = input.date;
      if (input.target_time_seconds) updates.targetTimeSeconds = input.target_time_seconds;
      if (input.priority) updates.priority = input.priority;

      const race = ctx.races.find(r => r.id === raceId);
      if (!race) {
        return { error: 'Race not found', demoAction: 'none' };
      }

      return {
        demoAction: 'update_race',
        data: { raceId, updates },
        message: `Updated ${race.name}: ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    case 'delete_race': {
      const raceId = input.race_id as number;
      const race = ctx.races.find(r => r.id === raceId);

      if (!race) {
        return { error: 'Race not found', demoAction: 'none' };
      }

      return {
        demoAction: 'delete_race',
        data: { raceId },
        message: `Deleted race "${race.name}" from your calendar.`,
      } as DemoAction;
    }

    case 'update_planned_workout': {
      const workoutId = input.workout_id as number;
      const workout = ctx.plannedWorkouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found', demoAction: 'none' };
      }

      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.workout_type) updates.workoutType = input.workout_type;
      if (input.target_distance_miles) updates.targetDistanceMiles = input.target_distance_miles;
      if (input.target_pace) updates.targetPaceSecondsPerMile = parsePaceToSeconds(input.target_pace as string);
      if (input.description) updates.description = input.description;
      if (input.status) updates.status = input.status;

      return {
        demoAction: 'update_planned_workout',
        data: { workoutId, updates },
        message: `Updated "${workout.name}": ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    case 'modify_todays_workout': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (!todaysWorkout) {
        return { error: 'No workout planned for today', demoAction: 'none' };
      }

      const updates: Record<string, unknown> = {};
      if (input.new_distance_miles) updates.targetDistanceMiles = input.new_distance_miles;
      if (input.new_workout_type) updates.workoutType = input.new_workout_type;
      if (input.add_strides) updates.name = `${todaysWorkout.name} + Strides`;
      if (input.reduce_intensity) {
        updates.workoutType = 'easy';
        updates.name = 'Easy Run';
      }

      return {
        demoAction: 'update_planned_workout',
        data: { workoutId: todaysWorkout.id, updates },
        message: `Modified today's workout: ${Object.keys(updates).join(', ')} changed.`,
      } as DemoAction;
    }

    // For other tools, return helpful information without requiring database
    case 'get_current_weather':
      return {
        message: 'Weather data not available in demo mode. Check your local weather app for current conditions.',
        temperature: 55,
        feels_like: 55,
        humidity: 50,
        wind_speed: 5,
        conditions: 'partly cloudy',
      };

    case 'get_workout_detail': {
      const workoutId = input.workout_id as number;
      const workout = ctx.workouts.find(w => w.id === workoutId);
      if (!workout) {
        return { error: 'Workout not found' };
      }
      return {
        id: workout.id,
        date: workout.date,
        distance_miles: workout.distanceMiles,
        duration_minutes: workout.durationMinutes,
        pace_per_mile: formatPace(workout.avgPaceSeconds),
        workout_type: workout.workoutType,
        notes: workout.notes || null,
        shoe: null,
        assessment: workout.assessment ? {
          verdict: workout.assessment.verdict,
          rpe: workout.assessment.rpe,
          legs_feel: workout.assessment.legsFeel,
          sleep_quality: workout.assessment.sleepQuality,
          stress: workout.assessment.stress,
          soreness: workout.assessment.soreness,
          note: workout.assessment.note,
        } : null,
      };
    }

    case 'get_user_profile': {
      const s = ctx.settings;
      return {
        has_profile: true,
        onboarding_completed: true,
        name: s?.name || 'Demo Runner',
        age: s?.age || null,
        years_running: s?.yearsRunning || null,
        athletic_background: s?.athleticBackground || null,
        resting_hr: s?.restingHr || null,
        current_weekly_mileage: s?.currentWeeklyMileage || 35,
        runs_per_week: s?.runsPerWeekCurrent || 5,
        current_long_run_max: s?.currentLongRunMax || null,
        peak_weekly_mileage_target: s?.peakWeeklyMileageTarget || 50,
        quality_sessions_per_week: s?.qualitySessionsPerWeek || 2,
        preferred_long_run_day: s?.preferredLongRunDay || 'saturday',
        preferred_quality_days: s?.preferredQualityDays ? JSON.parse(s.preferredQualityDays as string) : null,
        plan_aggressiveness: s?.planAggressiveness || 'moderate',
        training_philosophy: s?.trainingPhilosophy || null,
        training_philosophies: s?.trainingPhilosophies ? JSON.parse(s.trainingPhilosophies as string) : s?.trainingPhilosophy ? [s.trainingPhilosophy] : null,
        down_week_frequency: s?.downWeekFrequency || null,
        long_run_style: s?.longRunMaxStyle || null,
        fatigue_management_style: s?.fatigueManagementStyle || null,
        workout_variety_pref: s?.workoutVarietyPref || null,
        mlr_preference: s?.mlrPreference ?? null,
        progressive_long_runs_ok: s?.progressiveLongRunsOk ?? null,
        vdot: s?.vdot || 45,
        comfort_vo2max: s?.comfortVO2max ?? null,
        comfort_tempo: s?.comfortTempo ?? null,
        comfort_hills: s?.comfortHills ?? null,
        comfort_long_runs: s?.comfortLongRuns ?? null,
        comfort_track_work: s?.comfortTrackWork ?? null,
        open_to_doubles: s?.openToDoubles ?? null,
        train_by: s?.trainBy || null,
        speedwork_experience: s?.speedworkExperience || null,
        workout_complexity: s?.workoutComplexity || null,
        coaching_detail_level: s?.coachingDetailLevel || null,
        typical_sleep_hours: s?.typicalSleepHours ?? null,
        sleep_quality: s?.sleepQuality || null,
        stress_level: s?.stressLevel || null,
        needs_extra_rest: s?.needsExtraRest ?? null,
        common_injuries: s?.commonInjuries ? JSON.parse(s.commonInjuries as string) : null,
        current_injuries: s?.currentInjuries || null,
        injury_history: s?.injuryHistory || null,
        preferred_run_time: s?.preferredRunTime || null,
        surface_preference: s?.surfacePreference || null,
        group_vs_solo: s?.groupVsSolo || null,
        heat_sensitivity: s?.heatSensitivity ?? null,
        cold_sensitivity: s?.coldSensitivity ?? null,
        heat_acclimatization_score: s?.heatAcclimatizationScore ?? null,
        marathon_pr: s?.marathonPR ?? null,
        half_marathon_pr: s?.halfMarathonPR ?? null,
        ten_k_pr: s?.tenKPR ?? null,
        five_k_pr: s?.fiveKPR ?? null,
        coach_context: s?.coachContext || null,
      };
    }

    case 'update_user_profile': {
      const updates = buildProfileUpdates(input);
      return {
        demoAction: 'update_user_profile',
        data: { updates },
        message: `Updated profile: ${Object.keys(updates).join(', ')}`,
      } as DemoAction;
    }

    case 'get_training_summary': {
      const days = (input.days as number) || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const recentWorkouts = ctx.workouts.filter(w => w.date >= cutoffStr);
      const totalMiles = recentWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const totalMinutes = recentWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);

      const workoutsByType: Record<string, number> = {};
      recentWorkouts.forEach(w => {
        workoutsByType[w.workoutType] = (workoutsByType[w.workoutType] || 0) + 1;
      });

      return {
        period_days: days,
        total_workouts: recentWorkouts.length,
        total_miles: Math.round(totalMiles * 10) / 10,
        total_time_minutes: totalMinutes,
        avg_miles_per_run: recentWorkouts.length > 0 ? Math.round((totalMiles / recentWorkouts.length) * 10) / 10 : 0,
        workouts_by_type: workoutsByType,
        avg_pace: recentWorkouts.length > 0
          ? formatPace(Math.round(recentWorkouts.reduce((sum, w) => sum + w.avgPaceSeconds, 0) / recentWorkouts.length))
          : null,
      };
    }

    case 'search_workouts': {
      const query = (input.query as string)?.toLowerCase();
      const dateFrom = input.date_from as string;
      const dateTo = input.date_to as string;

      let results = [...ctx.workouts];

      if (query) {
        results = results.filter(w =>
          w.notes?.toLowerCase().includes(query) ||
          w.workoutType.toLowerCase().includes(query)
        );
      }
      if (dateFrom) {
        results = results.filter(w => w.date >= dateFrom);
      }
      if (dateTo) {
        results = results.filter(w => w.date <= dateTo);
      }

      return results.slice(0, 10).map(w => ({
        id: w.id,
        date: w.date,
        distance_miles: w.distanceMiles,
        workout_type: w.workoutType,
        pace_per_mile: formatPace(w.avgPaceSeconds),
        notes: w.notes || null,
      }));
    }

    case 'get_training_load': {
      // Calculate actual training load from demo workouts
      const today = new Date();
      const acute7 = new Date(today);
      acute7.setDate(acute7.getDate() - 7);
      const chronic28 = new Date(today);
      chronic28.setDate(chronic28.getDate() - 28);

      const acuteStr = acute7.toISOString().split('T')[0];
      const chronicStr = chronic28.toISOString().split('T')[0];

      const acuteWorkouts = ctx.workouts.filter(w => w.date >= acuteStr);
      const chronicWorkouts = ctx.workouts.filter(w => w.date >= chronicStr);

      const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const chronicLoad = chronicWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0) / 4; // Weekly average

      const acuteChronicRatio = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 1;

      return {
        acute_load_miles: Math.round(acuteLoad * 10) / 10,
        chronic_load_miles_per_week: Math.round(chronicLoad * 10) / 10,
        acute_chronic_ratio: acuteChronicRatio,
        interpretation: acuteChronicRatio > 1.5 ? 'High risk - significantly increased load' :
                        acuteChronicRatio > 1.3 ? 'Moderate risk - building load' :
                        acuteChronicRatio < 0.8 ? 'Under-training - consider increasing' :
                        'Optimal training zone',
        recommendation: acuteChronicRatio > 1.5 ? 'Consider a recovery day or reduced volume' :
                        acuteChronicRatio < 0.8 ? 'Good time to add a bit more training stimulus' :
                        'Continue with your current plan',
      };
    }

    case 'get_fitness_trend': {
      const weeksBack = (input.weeks_back as number) || 8;
      const workoutType = input.workout_type as string;

      // Group workouts by week and calculate trends
      const weeks: Array<{ weekStart: string; avgPace: number; totalMiles: number; count: number }> = [];

      for (let i = 0; i < weeksBack; i++) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        let weekWorkouts = ctx.workouts.filter(w => w.date >= weekStartStr && w.date <= weekEndStr);
        if (workoutType) {
          weekWorkouts = weekWorkouts.filter(w => w.workoutType === workoutType);
        }

        if (weekWorkouts.length > 0) {
          weeks.push({
            weekStart: weekStartStr,
            avgPace: Math.round(weekWorkouts.reduce((sum, w) => sum + w.avgPaceSeconds, 0) / weekWorkouts.length),
            totalMiles: Math.round(weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0) * 10) / 10,
            count: weekWorkouts.length,
          });
        }
      }

      const trend = weeks.length >= 2
        ? weeks[0].avgPace < weeks[weeks.length - 1].avgPace ? 'improving' : 'stable'
        : 'insufficient_data';

      return {
        weeks_analyzed: weeksBack,
        workout_type_filter: workoutType || 'all',
        weekly_data: weeks.reverse(),
        trend,
        interpretation: trend === 'improving' ? 'Your pace is getting faster at similar efforts - great progress!' :
                        trend === 'stable' ? 'Pace is consistent - solid base building' :
                        'Need more data to determine trend',
      };
    }

    case 'get_fatigue_indicators':
    case 'analyze_recovery_pattern': {
      // Analyze recent workout patterns for fatigue signals
      const recent7 = ctx.workouts.slice(0, 7);
      const hardWorkouts = recent7.filter(w => ['tempo', 'interval', 'long'].includes(w.workoutType));
      const easyWorkouts = recent7.filter(w => w.workoutType === 'easy' || w.workoutType === 'recovery');

      const hardToEasyRatio = easyWorkouts.length > 0 ? hardWorkouts.length / easyWorkouts.length : hardWorkouts.length;

      return {
        recent_workout_count: recent7.length,
        hard_workout_count: hardWorkouts.length,
        easy_workout_count: easyWorkouts.length,
        hard_to_easy_ratio: Math.round(hardToEasyRatio * 100) / 100,
        fatigue_risk: hardToEasyRatio > 0.6 ? 'elevated' : hardToEasyRatio > 0.4 ? 'moderate' : 'low',
        recommendation: hardToEasyRatio > 0.6
          ? 'Consider adding more easy days between hard efforts'
          : 'Good balance of hard and easy training',
      };
    }

    case 'get_plan_adherence': {
      const weeksBack = (input.weeks_back as number) || 4;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (weeksBack * 7));
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const plannedInPeriod = ctx.plannedWorkouts.filter(w => w.date >= cutoffStr && w.date < today);
      const completed = plannedInPeriod.filter(w => w.status === 'completed');
      const skipped = plannedInPeriod.filter(w => w.status === 'skipped');

      const adherenceRate = plannedInPeriod.length > 0
        ? Math.round((completed.length / plannedInPeriod.length) * 100)
        : 100;

      return {
        weeks_analyzed: weeksBack,
        planned_workouts: plannedInPeriod.length,
        completed: completed.length,
        skipped: skipped.length,
        adherence_rate: adherenceRate,
        interpretation: adherenceRate >= 85 ? 'Excellent adherence!' :
                        adherenceRate >= 70 ? 'Good adherence - minor adjustments may help' :
                        'Adherence could improve - consider adjusting plan difficulty',
      };
    }

    case 'get_readiness_score': {
      // Calculate readiness based on recent training patterns
      const recent3 = ctx.workouts.slice(0, 3);
      const avgRecentMiles = recent3.length > 0
        ? recent3.reduce((sum, w) => sum + w.distanceMiles, 0) / recent3.length
        : 0;

      const hadHardWorkoutYesterday = recent3.length > 0 &&
        ['tempo', 'interval', 'long'].includes(recent3[0].workoutType);

      let readinessScore = 75; // Base score
      if (hadHardWorkoutYesterday) readinessScore -= 15;
      if (avgRecentMiles > 8) readinessScore -= 5;

      return {
        readiness_score: readinessScore,
        factors: {
          recent_training_load: avgRecentMiles > 6 ? 'moderate_to_high' : 'manageable',
          recent_hard_effort: hadHardWorkoutYesterday,
        },
        recommendation: readinessScore >= 70
          ? 'Good to go for any workout'
          : readinessScore >= 50
          ? 'Consider an easier effort today'
          : 'Rest day recommended',
      };
    }

    case 'get_proactive_alerts': {
      const alerts: Array<{ type: string; severity: string; message: string }> = [];
      const today = new Date().toISOString().split('T')[0];

      // Check for upcoming race
      const upcomingRace = ctx.races.find(r => r.date >= today);
      if (upcomingRace) {
        const daysUntil = Math.ceil((new Date(upcomingRace.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7) {
          alerts.push({
            type: 'race_week',
            severity: 'info',
            message: `${upcomingRace.name} is in ${daysUntil} days! Time to taper and stay fresh.`,
          });
        } else if (daysUntil <= 14) {
          alerts.push({
            type: 'race_approaching',
            severity: 'info',
            message: `${upcomingRace.name} is in ${daysUntil} days. Peak training then taper.`,
          });
        }
      }

      // Check training load
      const recent7Miles = ctx.workouts
        .filter(w => {
          const wDate = new Date(w.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return wDate >= weekAgo;
        })
        .reduce((sum, w) => sum + w.distanceMiles, 0);

      const targetWeekly = ctx.settings?.currentWeeklyMileage || 35;
      if (recent7Miles > targetWeekly * 1.2) {
        alerts.push({
          type: 'high_volume',
          severity: 'warning',
          message: `This week's mileage (${Math.round(recent7Miles)}mi) is above your typical ${targetWeekly}mi. Consider recovery.`,
        });
      }

      // Check for today's workout
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);
      if (todaysWorkout) {
        alerts.push({
          type: 'todays_workout',
          severity: 'info',
          message: `Today's workout: ${todaysWorkout.name} (${todaysWorkout.targetDistanceMiles}mi)`,
        });
      }

      return {
        alert_count: alerts.length,
        alerts,
        checked_at: new Date().toISOString(),
      };
    }

    case 'get_pre_run_briefing': {
      const today = new Date().toISOString().split('T')[0];
      const todaysWorkout = ctx.plannedWorkouts.find(w => w.date === today);

      return {
        date: today,
        planned_workout: todaysWorkout ? {
          name: todaysWorkout.name,
          type: todaysWorkout.workoutType,
          distance_miles: todaysWorkout.targetDistanceMiles,
          target_pace: todaysWorkout.targetPaceSecondsPerMile ? formatPace(todaysWorkout.targetPaceSecondsPerMile) : null,
          description: todaysWorkout.description,
          is_key_workout: todaysWorkout.isKeyWorkout,
        } : null,
        weather: {
          temperature: 55,
          feels_like: 55,
          conditions: 'partly cloudy',
          note: 'Check your local weather for accurate conditions',
        },
        pace_zones: {
          easy: ctx.settings?.easyPaceSeconds ? formatPace(ctx.settings.easyPaceSeconds) : '9:00/mi',
          tempo: ctx.settings?.tempoPaceSeconds ? formatPace(ctx.settings.tempoPaceSeconds) : '7:30/mi',
        },
        ready_to_run: true,
      };
    }

    case 'get_weekly_review': {
      const weekOffset = (input.week_offset as number) ?? -1;
      const today = new Date();
      const reviewWeekEnd = new Date(today);
      reviewWeekEnd.setDate(reviewWeekEnd.getDate() + (weekOffset * 7));
      const reviewWeekStart = new Date(reviewWeekEnd);
      reviewWeekStart.setDate(reviewWeekStart.getDate() - 6);

      const startStr = reviewWeekStart.toISOString().split('T')[0];
      const endStr = reviewWeekEnd.toISOString().split('T')[0];

      const weekWorkouts = ctx.workouts.filter(w => w.date >= startStr && w.date <= endStr);
      const plannedWorkouts = ctx.plannedWorkouts.filter(w => w.date >= startStr && w.date <= endStr);

      const totalMiles = weekWorkouts.reduce((sum, w) => sum + w.distanceMiles, 0);
      const totalTime = weekWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0);

      return {
        week_start: startStr,
        week_end: endStr,
        workouts_completed: weekWorkouts.length,
        workouts_planned: plannedWorkouts.length,
        total_miles: Math.round(totalMiles * 10) / 10,
        total_time_minutes: totalTime,
        workout_types: weekWorkouts.reduce((acc, w) => {
          acc[w.workoutType] = (acc[w.workoutType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        highlights: weekWorkouts.length > 0
          ? `Completed ${weekWorkouts.length} runs for ${Math.round(totalMiles)} miles`
          : 'No workouts logged this week',
      };
    }

    case 'get_upcoming_week_preview': {
      const today = new Date();
      const weekStart = new Date(today);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const upcomingWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= startStr && w.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      const keyWorkouts = upcomingWorkouts.filter(w => w.isKeyWorkout);
      const totalPlannedMiles = upcomingWorkouts.reduce((sum, w) => sum + w.targetDistanceMiles, 0);

      return {
        week_start: startStr,
        week_end: endStr,
        planned_workouts: upcomingWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          day: new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
          name: w.name,
          type: w.workoutType,
          distance_miles: w.targetDistanceMiles,
          is_key: w.isKeyWorkout,
        })),
        total_miles: Math.round(totalPlannedMiles * 10) / 10,
        key_workout_count: keyWorkouts.length,
        phase: upcomingWorkouts[0]?.phase || 'training',
      };
    }

    case 'predict_race_time': {
      const distance = input.distance as string;
      const conditions = input.conditions as string || 'ideal';
      const vdot = ctx.settings?.vdot || 45;

      // VDOT-based predictions
      const predictions: Record<string, number> = {
        '5K': Math.round((12.5 + (60 - vdot) * 0.5) * 60),
        '10K': Math.round((26 + (60 - vdot) * 1.1) * 60),
        '15K': Math.round((40 + (60 - vdot) * 1.7) * 60),
        '10_mile': Math.round((44 + (60 - vdot) * 1.85) * 60),
        'half_marathon': Math.round((58 + (60 - vdot) * 2.4) * 60),
        'marathon': Math.round((125 + (60 - vdot) * 5.2) * 60),
      };

      let predictedSeconds = predictions[distance] || predictions['half_marathon'];

      // Adjust for conditions
      const conditionAdjustments: Record<string, number> = {
        ideal: 1.0,
        warm: 1.03,
        hot: 1.08,
        cold: 1.01,
        hilly: 1.05,
      };
      predictedSeconds = Math.round(predictedSeconds * (conditionAdjustments[conditions] || 1.0));

      const hours = Math.floor(predictedSeconds / 3600);
      const mins = Math.floor((predictedSeconds % 3600) / 60);
      const secs = predictedSeconds % 60;
      const timeStr = hours > 0
        ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

      return {
        distance,
        conditions,
        predicted_time: timeStr,
        predicted_seconds: predictedSeconds,
        vdot_used: vdot,
        note: 'Prediction based on current VDOT. Actual performance depends on training, pacing, and race-day factors.',
      };
    }

    case 'get_training_philosophy': {
      const topic = input.topic as string;

      const philosophies: Record<string, { title: string; explanation: string; application: string }> = {
        periodization: {
          title: 'Periodization',
          explanation: 'Training is divided into phases (base, build, peak, taper) each with specific goals. Base builds aerobic capacity, build adds race-specific work, peak is highest intensity/volume, taper reduces load before race.',
          application: 'Your current phase determines workout focus. In base phase, most runs are easy. In build/peak, quality sessions become more important.',
        },
        polarized_training: {
          title: 'Polarized Training (80/20 Rule)',
          explanation: 'About 80% of training should be easy (conversational pace), and 20% hard (tempo, intervals). The easy days truly easy allows you to go hard on hard days.',
          application: 'If you feel tired on easy days, slow down. Save your energy for quality sessions.',
        },
        workout_types: {
          title: 'Workout Types',
          explanation: 'Easy runs build aerobic base. Tempo runs improve lactate threshold. Intervals develop VO2max. Long runs build endurance and mental toughness.',
          application: 'Each workout type serves a purpose. Trust the process even when easy runs feel too slow.',
        },
        recovery: {
          title: 'Recovery',
          explanation: 'Adaptation happens during rest, not during training. Sleep, nutrition, and easy days are when your body gets stronger.',
          application: 'Never skip recovery days or turn them into hard efforts. Quality sleep is as important as quality workouts.',
        },
        tapering: {
          title: 'Tapering',
          explanation: 'Reducing training load 2-3 weeks before a goal race allows your body to fully recover while maintaining fitness. You may feel sluggish - this is normal.',
          application: 'Trust the taper. Resist the urge to do more. You cannot gain fitness in the final weeks, but you can lose freshness.',
        },
        base_building: {
          title: 'Base Building',
          explanation: 'Establishing aerobic fitness through consistent easy running before adding intensity. A strong base supports all other training.',
          application: 'Be patient with base building. The aerobic gains compound over time and make harder training more effective.',
        },
        speed_development: {
          title: 'Speed Development',
          explanation: 'Faster running develops neuromuscular coordination, running economy, and VO2max. Introduced gradually after establishing base.',
          application: 'Speed work is the spice, not the main course. A little goes a long way when built on solid aerobic base.',
        },
        long_runs: {
          title: 'Long Runs',
          explanation: 'The cornerstone of distance training. Builds endurance, teaches body to burn fat, and develops mental resilience. Should be done at easy, conversational pace.',
          application: 'Long runs should leave you tired but not destroyed. If you need days to recover, you went too hard.',
        },
        race_pacing: {
          title: 'Race Pacing',
          explanation: 'Starting conservatively and running even or negative splits typically produces best results. Going out too fast leads to painful fade.',
          application: 'First miles should feel easy, almost too slow. Save your energy for when it counts in the second half.',
        },
      };

      const topicInfo = philosophies[topic] || philosophies['polarized_training'];

      return {
        topic: topic || 'polarized_training',
        title: topicInfo.title,
        explanation: topicInfo.explanation,
        application: topicInfo.application,
      };
    }

    case 'log_assessment': {
      const workoutId = input.workout_id as number;
      const verdict = input.verdict as string;
      const rpe = input.rpe as number;

      return {
        demoAction: 'log_assessment',
        data: {
          workoutId,
          verdict,
          rpe,
          legsFeel: input.legs_feel,
          sleepQuality: input.sleep_quality,
          sleepHours: input.sleep_hours,
          stress: input.stress,
          soreness: input.soreness,
          note: input.note,
        },
        message: `Logged assessment for workout: ${verdict} (RPE ${rpe})`,
      } as DemoAction;
    }

    case 'add_race_result': {
      const distance = input.distance as string;
      const finishTime = input.finish_time as string;
      const date = input.date as string;

      // Parse finish time to seconds
      const timeParts = finishTime.split(':').map(Number);
      let finishTimeSeconds = 0;
      if (timeParts.length === 3) {
        finishTimeSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      } else if (timeParts.length === 2) {
        finishTimeSeconds = timeParts[0] * 60 + timeParts[1];
      }

      return {
        demoAction: 'add_race_result',
        data: {
          date,
          distance,
          finishTimeSeconds,
          raceName: input.race_name,
          effortLevel: input.effort_level,
          conditions: input.conditions,
          notes: input.notes,
        },
        message: `Logged race result: ${distance} in ${finishTime}. This will update your pace zones!`,
      } as DemoAction;
    }

    case 'generate_training_plan': {
      const raceId = input.race_id as number;
      const race = ctx.races.find(r => r.id === raceId);

      if (!race) {
        return { error: 'Race not found. Please add a race first.' };
      }

      if (race.trainingPlanGenerated) {
        return { message: 'A training plan already exists for this race. Would you like me to regenerate it?' };
      }

      return {
        demoAction: 'generate_training_plan',
        data: { raceId },
        message: `I'll generate a training plan for ${race.name} (${race.distanceLabel}) on ${race.date}. This will create a periodized plan with appropriate phases leading up to your race.`,
      } as DemoAction;
    }

    case 'suggest_workout_modification':
    case 'suggest_next_workout':
    case 'suggest_plan_adjustment': {
      // Return the context so the AI can make suggestions based on the plan data
      const todayStr = new Date().toISOString().split('T')[0];
      const upcomingWorkouts = ctx.plannedWorkouts
        .filter(w => w.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 7);
      return {
        suggestion_context: {
          upcoming_workouts: upcomingWorkouts.map(w => ({
            id: w.id,
            date: w.date,
            name: w.name,
            type: w.workoutType,
            distance: w.targetDistanceMiles,
          })),
          current_phase: upcomingWorkouts[0]?.phase || 'base',
          athlete_vdot: ctx.settings?.vdot || 45,
        },
        message: 'Based on your upcoming schedule, I can help you make adjustments. What would you like to modify?',
      };
    }

    // Injury tracking demo handlers
    case 'log_injury': {
      const bodyPart = input.body_part as string;
      const severity = (input.severity as string) || 'minor';
      const side = input.side as string | undefined;
      const restrictions = (input.restrictions as string[]) || [];

      return {
        demoAction: 'log_injury',
        data: {
          bodyPart,
          severity,
          side,
          restrictions,
          description: input.description,
        },
        message: `Logged ${severity} ${bodyPart}${side ? ` (${side})` : ''} injury. I'll adjust your training recommendations accordingly.`,
        success: true,
        recommendations: [
          severity === 'severe' ? 'Consider seeing a medical professional before running again.' : null,
          'Take extra rest days as needed.',
          severity !== 'severe' ? 'Easy runs only until this heals.' : 'No running until cleared.',
        ].filter(Boolean),
      };
    }

    case 'clear_injury': {
      const bodyPart = input.body_part as string;
      return {
        demoAction: 'clear_injury',
        data: { bodyPart },
        message: `Great that your ${bodyPart} is feeling better! Returning to normal training gradually.`,
        success: true,
        recommendations: [
          'Ease back into intensity over 1-2 weeks.',
          'Listen to your body if any discomfort returns.',
        ],
      };
    }

    case 'get_injury_status': {
      return {
        has_injuries: false,
        active_injuries: [],
        has_restrictions: false,
        restrictions: [],
        message: 'No active injuries on record. Stay healthy!',
      };
    }

    // Wardrobe demo handlers
    case 'get_wardrobe': {
      return {
        items: [
          { id: 1, category: 'shorts', name: 'Running Shorts', tempRange: '55-95°F' },
          { id: 2, category: 'tights', name: 'Running Tights', tempRange: '20-50°F' },
          { id: 3, category: 'base_layer', name: 'Tech T-Shirt', tempRange: '50-95°F' },
          { id: 4, category: 'base_layer', name: 'Long Sleeve Base', tempRange: '30-55°F' },
          { id: 5, category: 'outer_layer', name: 'Rain Jacket', tempRange: '40-65°F' },
          { id: 6, category: 'hat', name: 'Running Cap', tempRange: '55-100°F' },
          { id: 7, category: 'hat', name: 'Beanie', tempRange: '10-40°F' },
          { id: 8, category: 'gloves', name: 'Running Gloves', tempRange: '20-45°F' },
        ],
        categories: ['base_layer', 'mid_layer', 'outer_layer', 'shorts', 'tights', 'socks', 'hat', 'gloves'],
        total_items: 8,
      };
    }

    case 'add_clothing_item': {
      return {
        demoAction: 'add_clothing_item',
        data: {
          category: input.category,
          name: input.name,
          brand: input.brand,
          tempRangeMin: input.temp_range_min,
          tempRangeMax: input.temp_range_max,
          weatherSuitability: input.weather_suitability,
        },
        message: `Added ${input.name} to your wardrobe!`,
        success: true,
      };
    }

    case 'log_outfit_feedback': {
      const rating = input.rating as string;
      return {
        demoAction: 'log_outfit_feedback',
        data: {
          rating,
          temperature: input.temperature,
          items: input.items,
          notes: input.notes,
        },
        message: `Logged outfit feedback: ${rating}. I'll use this to improve future recommendations.`,
        success: true,
      };
    }

    case 'get_outfit_recommendation': {
      // Provide a generic outfit recommendation for demo
      const temp = (input.temperature as number) || 55;
      let recommendation;
      if (temp > 70) {
        recommendation = {
          layers: ['Running shorts', 'Tech T-Shirt'],
          accessories: ['Running Cap (sun protection)'],
          note: 'Light and breathable for warm conditions.',
        };
      } else if (temp > 50) {
        recommendation = {
          layers: ['Running shorts', 'Long Sleeve Base'],
          accessories: [],
          note: 'Perfect running weather. Light layers.',
        };
      } else if (temp > 35) {
        recommendation = {
          layers: ['Running Tights', 'Long Sleeve Base', 'Running Vest'],
          accessories: ['Gloves'],
          note: 'Layer up for cool conditions.',
        };
      } else {
        recommendation = {
          layers: ['Running Tights', 'Long Sleeve Base', 'Mid Layer', 'Outer Layer'],
          accessories: ['Beanie', 'Gloves'],
          note: 'Full winter gear. Stay warm!',
        };
      }
      return {
        temperature: temp,
        recommendation,
        vibes_temp: temp - 10, // Running makes it feel warmer
      };
    }

    case 'set_travel_status': {
      return {
        demoAction: 'set_travel_status',
        data: {
          traveling: input.traveling,
          altitude: input.altitude,
          tempDelta: input.temp_delta,
          returnDate: input.return_date,
        },
        message: input.traveling
          ? `Travel mode activated. I'll adjust recommendations for your trip.`
          : `Welcome back! Adjusting back to normal training.`,
        success: true,
      };
    }

    // For tools that don't need special demo handling, return null to fall through
    default:
      return null;
  }
}

export { executeDemoTool };
