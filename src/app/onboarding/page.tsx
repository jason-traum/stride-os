'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveOnboardingData, type OnboardingData } from '@/actions/onboarding';
import { RACE_DISTANCES, getDistanceLabel, formatTime } from '@/lib/training/types';
import type { RunnerPersona } from '@/lib/schema';
import { Footprints, ChevronRight, ChevronLeft, Trophy, Target, Calendar, Settings2, CheckCircle2, Edit2 } from 'lucide-react';

const PERSONA_OPTIONS: { value: RunnerPersona; label: string; description: string }[] = [
  { value: 'newer_runner', label: 'The Newer Runner', description: "I'm building the habit. Tell me what to do and explain why." },
  { value: 'busy_runner', label: 'The Busy Runner', description: "I have goals but life comes first. I need flexibility." },
  { value: 'self_coached', label: 'The Self-Coached Athlete', description: "I know what I'm doing. I want a smart training partner, not a boss." },
  { value: 'coach_guided', label: 'The Coach-Guided Runner', description: "I work with a human coach. I need a tracking and communication tool." },
  { value: 'type_a_planner', label: 'The Type-A Planner', description: "I love structure. Give me the plan and I'll follow it to the letter." },
  { value: 'data_optimizer', label: 'The Data Optimizer', description: "I want all the metrics. Show me the numbers and let me analyze." },
  { value: 'other', label: 'Other / Mix', description: "I'll tell you more about my preferences." },
];

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const AGGRESSIVENESS_OPTIONS = [
  { value: 'conservative', label: 'Conservative', description: 'Slower mileage build-up, more recovery time' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced approach for most runners' },
  { value: 'aggressive', label: 'Aggressive', description: 'Faster progression for experienced runners' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [runnerPersona, setRunnerPersona] = useState<RunnerPersona | ''>('');
  const [runnerPersonaNotes, setRunnerPersonaNotes] = useState('');
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState<number>(20);
  const [runsPerWeekCurrent, setRunsPerWeekCurrent] = useState<number>(4);
  const [currentLongRunMax, setCurrentLongRunMax] = useState<number>(8);

  // Step 2: Training Goals
  const [peakWeeklyMileageTarget, setPeakWeeklyMileageTarget] = useState<number>(40);
  const [preferredLongRunDay, setPreferredLongRunDay] = useState('sunday');
  const [requiredRestDays, setRequiredRestDays] = useState<string[]>(['friday']);
  const [planAggressiveness, setPlanAggressiveness] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [qualitySessionsPerWeek, setQualitySessionsPerWeek] = useState<number>(2);

  // Step 3: Recent Race (Recommended)
  const [hasRecentRace, setHasRecentRace] = useState(false);
  const [raceDistance, setRaceDistance] = useState('5K');
  const [raceTimeMinutes, setRaceTimeMinutes] = useState<number>(25);
  const [raceTimeSeconds, setRaceTimeSeconds] = useState<number>(0);
  const [raceDate, setRaceDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 4: Goal Race (Required)
  const [goalRaceName, setGoalRaceName] = useState('');
  const [goalRaceDate, setGoalRaceDate] = useState('');
  const [goalRaceDistance, setGoalRaceDistance] = useState('half_marathon');
  const [hasTargetTime, setHasTargetTime] = useState(false);
  const [targetTimeHours, setTargetTimeHours] = useState<number>(1);
  const [targetTimeMinutes, setTargetTimeMinutes] = useState<number>(45);
  const [targetTimeSeconds, setTargetTimeSeconds] = useState<number>(0);

  const toggleRestDay = (day: string) => {
    if (requiredRestDays.includes(day)) {
      setRequiredRestDays(requiredRestDays.filter(d => d !== day));
    } else {
      setRequiredRestDays([...requiredRestDays, day]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && runnerPersona !== '';
      case 2:
        return peakWeeklyMileageTarget >= currentWeeklyMileage && requiredRestDays.length <= 3;
      case 3:
        return true; // Optional step
      case 4:
        return goalRaceName.trim().length > 0 && goalRaceDate.length > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    const data: OnboardingData = {
      name,
      runnerPersona: runnerPersona || undefined,
      runnerPersonaNotes: runnerPersonaNotes || undefined,
      currentWeeklyMileage,
      runsPerWeekCurrent,
      currentLongRunMax,
      peakWeeklyMileageTarget,
      preferredLongRunDay,
      requiredRestDays,
      planAggressiveness,
      qualitySessionsPerWeek,
      goalRace: {
        name: goalRaceName,
        date: goalRaceDate,
        distanceLabel: goalRaceDistance,
        priority: 'A',
        targetTimeSeconds: hasTargetTime
          ? targetTimeHours * 3600 + targetTimeMinutes * 60 + targetTimeSeconds
          : undefined,
      },
    };

    if (hasRecentRace) {
      data.recentRace = {
        distanceLabel: raceDistance,
        finishTimeSeconds: raceTimeMinutes * 60 + raceTimeSeconds,
        date: raceDate,
      };
    }

    try {
      await saveOnboardingData(data);
      router.push('/coach?onboarding=true');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const weeksUntilRace = goalRaceDate
    ? Math.ceil((new Date(goalRaceDate).getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Footprints className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to Dreamy</h1>
          <p className="text-slate-400 mt-2">Your AI-powered running coach</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  s === step ? 'bg-blue-500' : s < step ? 'bg-blue-400' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white">Tell us about yourself</h2>
                <p className="text-slate-400 text-sm mt-1">We&apos;ll use this to personalize your training</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  What&apos;s your name?
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Which best describes how you like to train?
                </label>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {PERSONA_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRunnerPersona(option.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        runnerPersona === option.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className={`text-xs mt-0.5 ${runnerPersona === option.value ? 'text-blue-200' : 'text-slate-400'}`}>
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
                {runnerPersona === 'other' && (
                  <div className="mt-3">
                    <textarea
                      value={runnerPersonaNotes}
                      onChange={(e) => setRunnerPersonaNotes(e.target.value)}
                      placeholder="Tell us more about how you like to train..."
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current weekly mileage
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentWeeklyMileage}
                    onChange={(e) => setCurrentWeeklyMileage(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-20 text-right text-white font-medium">{currentWeeklyMileage} mi</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Runs per week
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="2"
                    max="7"
                    value={runsPerWeekCurrent}
                    onChange={(e) => setRunsPerWeekCurrent(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-20 text-right text-white font-medium">{runsPerWeekCurrent} days</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Comfortable long run distance
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="3"
                    max="26"
                    value={currentLongRunMax}
                    onChange={(e) => setCurrentLongRunMax(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-20 text-right text-white font-medium">{currentLongRunMax} mi</span>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceed()}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                <span>Continue</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Training Goals */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 mb-3">
                  <Settings2 className="w-6 h-6 text-purple-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Training Preferences</h2>
                <p className="text-slate-400 text-sm mt-1">Customize how your plan is built</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Peak weekly mileage target
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min={currentWeeklyMileage}
                    max="100"
                    value={peakWeeklyMileageTarget}
                    onChange={(e) => setPeakWeeklyMileageTarget(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-20 text-right text-white font-medium">{peakWeeklyMileageTarget} mi</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {peakWeeklyMileageTarget > currentWeeklyMileage * 1.5
                    ? 'Ambitious goal - plan will build you up gradually'
                    : 'Manageable increase from your current mileage'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Preferred long run day
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => setPreferredLongRunDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        preferredLongRunDay === day.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Required rest days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleRestDay(day.value)}
                      disabled={day.value === preferredLongRunDay}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        requiredRestDays.includes(day.value)
                          ? 'bg-orange-600 text-white'
                          : day.value === preferredLongRunDay
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">Select days when you cannot run</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quality sessions per week
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={qualitySessionsPerWeek}
                    onChange={(e) => setQualitySessionsPerWeek(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-20 text-right text-white font-medium">{qualitySessionsPerWeek}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Hard workouts like tempo runs, intervals, etc.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Plan aggressiveness
                </label>
                <div className="space-y-2">
                  {AGGRESSIVENESS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPlanAggressiveness(option.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        planAggressiveness === option.value
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-slate-400">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Recent Race (Recommended) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 mb-3">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Recent Race Result</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Highly recommended for accurate pace zones
                </p>
              </div>

              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRecentRace}
                    onChange={(e) => setHasRecentRace(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-300">
                    I have a recent race to share
                  </span>
                </label>
              </div>

              {!hasRecentRace && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-amber-300 text-sm">
                    Without a recent race, we&apos;ll estimate your paces based on your mileage. Adding a race result gives much more accurate training zones.
                  </p>
                </div>
              )}

              {hasRecentRace && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Race Distance
                    </label>
                    <select
                      value={raceDistance}
                      onChange={(e) => setRaceDistance(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                        <option key={key} value={key}>
                          {dist.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Finish Time
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="599"
                        value={raceTimeMinutes}
                        onChange={(e) => setRaceTimeMinutes(Number(e.target.value))}
                        className="w-24 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="min"
                      />
                      <span className="text-slate-400 text-xl">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={raceTimeSeconds}
                        onChange={(e) => setRaceTimeSeconds(Math.min(59, Number(e.target.value)))}
                        className="w-24 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="sec"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Race Date
                    </label>
                    <input
                      type="date"
                      value={raceDate}
                      onChange={(e) => setRaceDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Goal Race (Required) */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                  <Target className="w-6 h-6 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Your Goal Race</h2>
                <p className="text-slate-400 text-sm mt-1">
                  We&apos;ll build your training plan around this
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Race Name *
                </label>
                <input
                  type="text"
                  value={goalRaceName}
                  onChange={(e) => setGoalRaceName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., NYC Half Marathon"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Race Distance *
                </label>
                <select
                  value={goalRaceDistance}
                  onChange={(e) => setGoalRaceDistance(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                    <option key={key} value={key}>
                      {dist.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Race Date *
                </label>
                <input
                  type="date"
                  value={goalRaceDate}
                  onChange={(e) => setGoalRaceDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {goalRaceDate && weeksUntilRace > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {weeksUntilRace} weeks until race day
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasTargetTime}
                    onChange={(e) => setHasTargetTime(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-300">
                    I have a target finish time
                  </span>
                </label>
              </div>

              {hasTargetTime && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Target Time
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={targetTimeHours}
                      onChange={(e) => setTargetTimeHours(Number(e.target.value))}
                      className="w-20 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="hr"
                    />
                    <span className="text-slate-400 text-xl">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={targetTimeMinutes}
                      onChange={(e) => setTargetTimeMinutes(Math.min(59, Number(e.target.value)))}
                      className="w-20 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="min"
                    />
                    <span className="text-slate-400 text-xl">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={targetTimeSeconds}
                      onChange={(e) => setTargetTimeSeconds(Math.min(59, Number(e.target.value)))}
                      className="w-20 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="sec"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep(5)}
                  disabled={!canProceed()}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <span>Review</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Confirm */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Review Your Setup</h2>
                <p className="text-slate-400 text-sm mt-1">Make sure everything looks right</p>
              </div>

              {/* Summary sections */}
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-300">Basic Info</h3>
                    <button
                      onClick={() => setStep(1)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500">Name:</span>
                      <span className="text-white ml-2">{name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Weekly miles:</span>
                      <span className="text-white ml-2">{currentWeeklyMileage}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Runs/week:</span>
                      <span className="text-white ml-2">{runsPerWeekCurrent}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Long run:</span>
                      <span className="text-white ml-2">{currentLongRunMax} mi</span>
                    </div>
                  </div>
                </div>

                {/* Training Preferences */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-300">Training Preferences</h3>
                    <button
                      onClick={() => setStep(2)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500">Peak mileage:</span>
                      <span className="text-white ml-2">{peakWeeklyMileageTarget} mi</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Long run day:</span>
                      <span className="text-white ml-2 capitalize">{preferredLongRunDay}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Rest days:</span>
                      <span className="text-white ml-2 capitalize">
                        {requiredRestDays.length > 0 ? requiredRestDays.map(d => d.slice(0, 3)).join(', ') : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Approach:</span>
                      <span className="text-white ml-2 capitalize">{planAggressiveness}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Race */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-300">Recent Race</h3>
                    <button
                      onClick={() => setStep(3)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                  {hasRecentRace ? (
                    <div className="text-sm">
                      <span className="text-white">{getDistanceLabel(raceDistance)}</span>
                      <span className="text-slate-400 mx-2">in</span>
                      <span className="text-white">
                        {raceTimeMinutes}:{raceTimeSeconds.toString().padStart(2, '0')}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-400">No race provided - paces will be estimated</p>
                  )}
                </div>

                {/* Goal Race */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-300">Goal Race</h3>
                    <button
                      onClick={() => setStep(4)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-white font-medium">{goalRaceName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{getDistanceLabel(goalRaceDistance)}</span>
                      <span className="text-slate-500 mx-2">on</span>
                      <span className="text-slate-400">{new Date(goalRaceDate).toLocaleDateString()}</span>
                    </div>
                    {hasTargetTime && (
                      <div>
                        <span className="text-slate-500">Target:</span>
                        <span className="text-green-400 ml-2">
                          {formatTime(targetTimeHours * 3600 + targetTimeMinutes * 60 + targetTimeSeconds)}
                        </span>
                      </div>
                    )}
                    <div className="text-blue-400">
                      {weeksUntilRace} weeks to train
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {loading ? (
                    <span>Setting up...</span>
                  ) : (
                    <>
                      <span>Start Training</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skip option */}
        {step === 1 && (
          <p className="text-center text-slate-500 text-sm mt-4">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/today')}
              className="text-blue-400 hover:text-blue-300"
            >
              Skip setup
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
