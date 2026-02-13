'use client';

import { useState } from 'react';
import { TwoWeekPlan } from '@/components/TwoWeekPlan';
import type { WorkoutTemplate } from '@/lib/plan-builder';

export default function PlanPreviewPage() {
  const [phase, setPhase] = useState('build');
  const [weeklyMileage, setWeeklyMileage] = useState(40);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutTemplate | null>(null);

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">2-Week Training Plan Preview</h1>
        <p className="text-secondary">
          Rough workout templates that adapt based on your current state
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Training Phase</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="base">Base Building</option>
            <option value="build">Build</option>
            <option value="peak">Peak</option>
            <option value="taper">Taper</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Weekly Mileage</label>
          <input
            type="number"
            value={weeklyMileage}
            onChange={(e) => setWeeklyMileage(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg w-24"
            min="10"
            max="100"
          />
        </div>
      </div>

      <TwoWeekPlan
        phase={phase}
        weeklyMileage={weeklyMileage}
        onWorkoutClick={setSelectedWorkout}
      />

      {selectedWorkout && (
        <div className="mt-8 p-6 bg-teal-50 rounded-lg">
          <h3 className="font-bold mb-4">How this workout will be refined:</h3>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="font-medium text-teal-700">7+ days out:</span>
              <span>General template based on training phase</span>
            </div>
            <div className="flex gap-3">
              <span className="font-medium text-teal-700">3-7 days out:</span>
              <span>Refined based on recent workout execution and fatigue trends</span>
            </div>
            <div className="flex gap-3">
              <span className="font-medium text-teal-700">1-3 days out:</span>
              <span>Final adjustments based on vibe check, sleep, stress, and weather</span>
            </div>
            <div className="flex gap-3">
              <span className="font-medium text-teal-700">Day of:</span>
              <span>Pre-run briefing with option to adapt based on how you feel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}