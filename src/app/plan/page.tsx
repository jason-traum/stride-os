'use client';

import { useState, useEffect, useTransition } from 'react';
import { WeekView } from '@/components/plan/WeekView';
import { WorkoutModifyModal } from '@/components/plan/WorkoutModifyModal';
import {
  getTrainingPlan,
  getCurrentWeekPlan,
  updatePlannedWorkoutStatus,
  generatePlanForRace,
  scaleDownPlannedWorkout,
  swapPlannedWorkout,
  movePlannedWorkout,
  deletePlannedWorkout,
  getWorkoutAlternatives,
} from '@/actions/training-plan';
import { getUpcomingRaces } from '@/actions/races';
import { getDaysUntilRace } from '@/lib/race-utils';
import { getDistanceLabel } from '@/lib/training';
import {
  Calendar,
  Flag,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface PlannedWorkout {
  id: number;
  date: string;
  name: string;
  description: string;
  workoutType: string;
  targetDistanceMiles: number | null;
  targetDurationMinutes: number | null;
  targetPaceSecondsPerMile: number | null;
  rationale: string | null;
  isKeyWorkout: boolean | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'modified' | null;
  structure: string | null;
  alternatives: string | null;
}

interface TrainingBlock {
  id: number;
  weekNumber: number;
  phase: string;
  startDate: string;
  endDate: string;
  targetMileage: number | null;
  focus: string | null;
}

interface Race {
  id: number;
  name: string;
  date: string;
  distanceLabel: string;
  trainingPlanGenerated: boolean | null;
}

export default function PlanPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<TrainingBlock[]>([]);
  const [workoutsByBlock, setWorkoutsByBlock] = useState<Record<number, PlannedWorkout[]>>({});
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [, startTransition] = useTransition();

  // Modify modal state
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);
  const [workoutAlternatives, setWorkoutAlternatives] = useState<Array<{ id: string; name: string; description: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadPlan(selectedRaceId);
    }
  }, [selectedRaceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [upcomingRaces, weekPlan] = await Promise.all([
        getUpcomingRaces(),
        getCurrentWeekPlan(),
      ]);

      setRaces(upcomingRaces);
      setCurrentWeekStart(weekPlan.weekStart);

      // Auto-select first race with a plan, or first race
      const raceWithPlan = upcomingRaces.find(r => r.trainingPlanGenerated);
      if (raceWithPlan) {
        setSelectedRaceId(raceWithPlan.id);
      } else if (upcomingRaces.length > 0) {
        setSelectedRaceId(upcomingRaces[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlan = async (raceId: number) => {
    try {
      const plan = await getTrainingPlan(raceId);
      if (plan) {
        setBlocks(plan.blocks);
        setWorkoutsByBlock(plan.workoutsByBlock);
      } else {
        setBlocks([]);
        setWorkoutsByBlock({});
      }
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedRaceId) return;

    setGenerating(true);
    try {
      await generatePlanForRace(selectedRaceId);
      await loadPlan(selectedRaceId);
      // Refresh races to update trainingPlanGenerated flag
      const updatedRaces = await getUpcomingRaces();
      setRaces(updatedRaces);
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Error generating plan. Please make sure you have completed onboarding with your training details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleWorkoutStatusChange = (workoutId: number, status: 'completed' | 'skipped') => {
    startTransition(async () => {
      await updatePlannedWorkoutStatus(workoutId, status);
      if (selectedRaceId) {
        await loadPlan(selectedRaceId);
      }
    });
  };

  const handleOpenModifyModal = async (workout: PlannedWorkout) => {
    setSelectedWorkout(workout);
    setModifyModalOpen(true);

    // Load alternatives
    try {
      const result = await getWorkoutAlternatives(workout.id);
      setWorkoutAlternatives(
        result.alternatives
          .filter((alt): alt is NonNullable<typeof alt> => alt !== undefined)
          .map(alt => ({
            id: alt.id,
            name: alt.name,
            description: alt.description,
          }))
      );
    } catch (error) {
      console.error('Error loading alternatives:', error);
      setWorkoutAlternatives([]);
    }
  };

  const handleCloseModifyModal = () => {
    setModifyModalOpen(false);
    setSelectedWorkout(null);
    setWorkoutAlternatives([]);
  };

  const handleScaleDown = async (factor: number) => {
    if (!selectedWorkout) return;
    await scaleDownPlannedWorkout(selectedWorkout.id, factor);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleSwap = async (alternativeId: string) => {
    if (!selectedWorkout) return;
    await swapPlannedWorkout(selectedWorkout.id, alternativeId);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleMove = async (newDate: string) => {
    if (!selectedWorkout) return;
    await movePlannedWorkout(selectedWorkout.id, newDate);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleDelete = async () => {
    if (!selectedWorkout) return;
    await deletePlannedWorkout(selectedWorkout.id);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedWorkout) return;
    await updatePlannedWorkoutStatus(selectedWorkout.id, 'completed');
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleSkip = async () => {
    if (!selectedWorkout) return;
    await updatePlannedWorkoutStatus(selectedWorkout.id, 'skipped');
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const selectedRace = races.find(r => r.id === selectedRaceId);
  const hasPlan = blocks.length > 0;

  // Group blocks into weeks with their workouts
  const weeks = blocks.map(block => ({
    weekNumber: block.weekNumber,
    startDate: block.startDate,
    endDate: block.endDate,
    phase: block.phase,
    targetMileage: block.targetMileage || 0,
    focus: block.focus || '',
    isDownWeek: false, // Could be calculated from mileage comparison
    workouts: workoutsByBlock[block.id] || [],
    isCurrentWeek: block.startDate <= currentWeekStart && block.endDate >= currentWeekStart,
  }));

  // Calculate summary stats
  const totalMiles = weeks.reduce((sum, w) => sum + w.targetMileage, 0);
  const completedMiles = weeks.reduce(
    (sum, w) => sum + w.workouts.filter(wo => wo.status === 'completed').reduce((s, wo) => s + (wo.targetDistanceMiles || 0), 0),
    0
  );
  const peakWeek = weeks.reduce((max, w) => (w.targetMileage > max.targetMileage ? w : max), weeks[0]);

  // Calculate adherence stats
  const today = new Date().toISOString().split('T')[0];
  const pastWorkouts = weeks.flatMap(w => w.workouts.filter(wo => wo.date <= today));
  const completedWorkouts = pastWorkouts.filter(wo => wo.status === 'completed');
  const skippedWorkouts = pastWorkouts.filter(wo => wo.status === 'skipped');
  const adherenceRate = pastWorkouts.length > 0
    ? Math.round((completedWorkouts.length / pastWorkouts.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-display font-semibold text-slate-900">Training Plan</h1>
        </div>

        {/* Race selector */}
        {races.length > 0 && (
          <select
            value={selectedRaceId || ''}
            onChange={(e) => setSelectedRaceId(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {races.map(race => (
              <option key={race.id} value={race.id}>
                {race.name} - {getDistanceLabel(race.distanceLabel)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No races */}
      {races.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Flag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No upcoming races</h3>
          <p className="text-slate-500 mb-4">Add a race to generate a training plan.</p>
          <a
            href="/races"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Race
          </a>
        </div>
      )}

      {/* Selected race info */}
      {selectedRace && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-slate-900">{selectedRace.name}</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {getDistanceLabel(selectedRace.distanceLabel)} • {getDaysUntilRace(selectedRace.date)} days away
              </p>
            </div>

            {!hasPlan && (
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan summary */}
      {hasPlan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Total Weeks</div>
            <div className="text-2xl font-semibold text-slate-900">{weeks.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Total Miles</div>
            <div className="text-2xl font-semibold text-slate-900">
              {completedMiles > 0 && <span className="text-green-600">{completedMiles}/</span>}
              {totalMiles}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Peak Week</div>
            <div className="text-2xl font-semibold text-slate-900">
              {peakWeek?.targetMileage || 0} mi
            </div>
            <div className="text-xs text-slate-400">Week {peakWeek?.weekNumber}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Current Phase</div>
            <div className="text-2xl font-semibold text-slate-900 capitalize">
              {weeks.find(w => w.isCurrentWeek)?.phase || '-'}
            </div>
          </div>
        </div>
      )}

      {/* Adherence Tracking */}
      {hasPlan && pastWorkouts.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-700">Plan Adherence</h3>
            <span className={`text-2xl font-semibold ${
              adherenceRate >= 80 ? 'text-green-600' :
              adherenceRate >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {adherenceRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all ${
                adherenceRate >= 80 ? 'bg-green-500' :
                adherenceRate >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${adherenceRate}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>{completedWorkouts.length} completed</span>
            <span>{skippedWorkouts.length} skipped</span>
            <span>{pastWorkouts.length - completedWorkouts.length - skippedWorkouts.length} pending</span>
          </div>
        </div>
      )}

      {/* No plan yet */}
      {selectedRace && !hasPlan && !generating && (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No training plan yet</h3>
          <p className="text-slate-500 mb-4">
            Generate a personalized training plan for this race.
          </p>
        </div>
      )}

      {/* Week list */}
      {hasPlan && (
        <div className="space-y-4">
          <h3 className="font-medium text-slate-700">Training Schedule</h3>
          {weeks.map(week => (
            <WeekView
              key={week.weekNumber}
              weekNumber={week.weekNumber}
              startDate={week.startDate}
              endDate={week.endDate}
              phase={week.phase}
              targetMileage={week.targetMileage}
              focus={week.focus}
              isDownWeek={week.isDownWeek}
              workouts={week.workouts}
              isCurrentWeek={week.isCurrentWeek}
              onWorkoutStatusChange={handleWorkoutStatusChange}
              onWorkoutModify={handleOpenModifyModal}
            />
          ))}
        </div>
      )}

      {/* Workout Modify Modal */}
      {selectedWorkout && (
        <WorkoutModifyModal
          workout={selectedWorkout}
          isOpen={modifyModalOpen}
          onClose={handleCloseModifyModal}
          onScaleDown={handleScaleDown}
          onSwap={handleSwap}
          onMove={handleMove}
          onDelete={handleDelete}
          onMarkComplete={handleMarkComplete}
          onSkip={handleSkip}
          alternatives={workoutAlternatives}
        />
      )}
    </div>
  );
}
