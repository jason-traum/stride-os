'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveOnboardingData, type OnboardingData } from '@/actions/onboarding';
import { RACE_DISTANCES } from '@/lib/training/types';
import { Footprints, ChevronRight, Trophy, Target, Calendar } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState<number>(20);
  const [runsPerWeekCurrent, setRunsPerWeekCurrent] = useState<number>(4);
  const [currentLongRunMax, setCurrentLongRunMax] = useState<number>(8);
  const [preferredLongRunDay, setPreferredLongRunDay] = useState('sunday');

  // Optional race result
  const [hasRecentRace, setHasRecentRace] = useState(false);
  const [raceDistance, setRaceDistance] = useState('5K');
  const [raceTimeMinutes, setRaceTimeMinutes] = useState<number>(25);
  const [raceTimeSeconds, setRaceTimeSeconds] = useState<number>(0);
  const [raceDate, setRaceDate] = useState(new Date().toISOString().split('T')[0]);

  // Optional goal race
  const [hasGoalRace, setHasGoalRace] = useState(false);
  const [goalRaceName, setGoalRaceName] = useState('');
  const [goalRaceDate, setGoalRaceDate] = useState('');
  const [goalRaceDistance, setGoalRaceDistance] = useState('half_marathon');

  const handleSubmit = async () => {
    setLoading(true);

    const data: OnboardingData = {
      name,
      currentWeeklyMileage,
      runsPerWeekCurrent,
      currentLongRunMax,
      preferredLongRunDay,
    };

    if (hasRecentRace) {
      data.recentRace = {
        distanceLabel: raceDistance,
        finishTimeSeconds: raceTimeMinutes * 60 + raceTimeSeconds,
        date: raceDate,
      };
    }

    if (hasGoalRace && goalRaceName && goalRaceDate) {
      data.goalRace = {
        name: goalRaceName,
        date: goalRaceDate,
        distanceLabel: goalRaceDistance,
        priority: 'A',
      };
    }

    try {
      await saveOnboardingData(data);
      // Redirect to coach for further conversation
      router.push('/coach?onboarding=true');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Footprints className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to Stride OS</h1>
          <p className="text-slate-400 mt-2">Your intelligent running companion</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((s) => (
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
                <p className="text-slate-400 text-sm mt-1">We&apos;ll use this to personalize your experience</p>
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
                    min="1"
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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Preferred long run day
                </label>
                <select
                  value={preferredLongRunDay}
                  onChange={(e) => setPreferredLongRunDay(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                <span>Continue</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Recent Race (Optional) */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 mb-3">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Recent Race Result</h2>
                <p className="text-slate-400 text-sm mt-1">
                  This helps us calculate your training paces (optional)
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
                      <span className="text-slate-400">:</span>
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
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Goal Race (Optional) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                  <Target className="w-6 h-6 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">Goal Race</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Training for something specific? (optional)
                </p>
              </div>

              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasGoalRace}
                    onChange={(e) => setHasGoalRace(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-300">
                    I have a goal race
                  </span>
                </label>
              </div>

              {hasGoalRace && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Race Name
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
                      Race Distance
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
                      Race Date
                    </label>
                    <input
                      type="date"
                      value={goalRaceDate}
                      onChange={(e) => setGoalRaceDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Back
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
