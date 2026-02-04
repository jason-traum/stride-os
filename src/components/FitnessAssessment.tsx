'use client';

import { useState, useEffect } from 'react';
import { Award, Heart, TrendingUp, Target, CheckCircle, AlertCircle, Loader2, Sparkles, Medal } from 'lucide-react';
import {
  getFitnessAssessment,
  getFitnessAge,
  getMilestoneProgress,
  type FitnessAssessment,
  type FitnessAge,
} from '@/actions/fitness-assessment';

/**
 * Fitness Assessment Card - Overall fitness grade
 */
export function FitnessAssessmentCard() {
  const [assessment, setAssessment] = useState<FitnessAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFitnessAssessment().then(data => {
      setAssessment(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Fitness Assessment
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Fitness Assessment
        </h2>
        <p className="text-sm text-stone-500">
          Complete at least 3 workouts to get your fitness assessment.
        </p>
      </div>
    );
  }

  const gradeColors: Record<string, string> = {
    'A+': 'from-emerald-300 to-emerald-500',
    'A': 'from-emerald-300 to-emerald-500',
    'A-': 'from-emerald-300 to-teal-500',
    'B+': 'from-teal-300 to-cyan-500',
    'B': 'from-teal-300 to-cyan-500',
    'B-': 'from-teal-300 to-sky-500',
    'C+': 'from-slate-300 to-teal-400',
    'C': 'from-slate-300 to-teal-400',
    'C-': 'from-slate-300 to-rose-300',
    'D': 'from-rose-300 to-fuchsia-400',
    'F': 'from-fuchsia-400 to-fuchsia-500',
  };

  const statusIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
    excellent: { icon: CheckCircle, color: 'text-green-500' },
    good: { icon: CheckCircle, color: 'text-teal-500' },
    fair: { icon: AlertCircle, color: 'text-slate-600' },
    needs_work: { icon: AlertCircle, color: 'text-rose-500' },
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Award className="w-5 h-5 text-purple-500" />
        Fitness Assessment
        <span className="text-xs font-normal text-stone-400 ml-auto">Last 30 days</span>
      </h2>

      {/* Grade Display */}
      <div className="flex items-center gap-6 mb-6">
        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradeColors[assessment.grade] || gradeColors.C} flex items-center justify-center shadow-lg`}>
          <span className="text-3xl font-bold text-white">{assessment.grade}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-stone-900">{assessment.overallScore}/100</p>
          <p className="text-sm text-stone-500">{assessment.level} Runner</p>
        </div>
      </div>

      {/* Component Scores */}
      <div className="space-y-3 mb-6">
        {assessment.components.map((comp) => {
          const statusConfig = statusIcons[comp.status];
          const StatusIcon = statusConfig.icon;

          return (
            <div key={comp.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                  <span className="text-sm font-medium text-stone-700">{comp.name}</span>
                </div>
                <span className="text-sm text-stone-500">{comp.description}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${gradeColors[assessment.grade]} rounded-full transition-all duration-500`}
                  style={{ width: `${comp.score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {assessment.recommendations.length > 0 && (
        <div className="bg-stone-50 rounded-lg p-4">
          <p className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-slate-600" />
            Recommendations
          </p>
          <ul className="space-y-1">
            {assessment.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-stone-600 flex items-start gap-2">
                <span className="text-stone-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Fitness Age Card
 */
export function FitnessAgeCard() {
  const [fitnessAge, setFitnessAge] = useState<FitnessAge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFitnessAge().then(data => {
      setFitnessAge(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Fitness Age
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!fitnessAge) {
    return null;
  }

  const ageColor = fitnessAge.fitnessAgeDiff !== null
    ? fitnessAge.fitnessAgeDiff < -5 ? 'text-cyan-600' :
      fitnessAge.fitnessAgeDiff <= 5 ? 'text-teal-600' : 'text-rose-600'
    : 'text-stone-700';

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-500" />
        Fitness Age
      </h2>

      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className={`text-4xl font-bold ${ageColor}`}>{fitnessAge.fitnessAge}</p>
          <p className="text-xs text-stone-500">Fitness Age</p>
        </div>

        {fitnessAge.chronologicalAge && (
          <>
            <div className="text-2xl text-stone-300">vs</div>
            <div className="text-center">
              <p className="text-4xl font-bold text-stone-400">{fitnessAge.chronologicalAge}</p>
              <p className="text-xs text-stone-500">Actual Age</p>
            </div>
          </>
        )}
      </div>

      {fitnessAge.fitnessAgeDiff !== null && (
        <div className={`text-center mb-4 px-4 py-2 rounded-lg ${
          fitnessAge.fitnessAgeDiff < -5 ? 'bg-cyan-50 text-cyan-700' :
          fitnessAge.fitnessAgeDiff <= 5 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {fitnessAge.fitnessAgeDiff < 0
            ? `${Math.abs(fitnessAge.fitnessAgeDiff)} years younger than your age!`
            : fitnessAge.fitnessAgeDiff === 0
            ? 'Right at your age level'
            : `${fitnessAge.fitnessAgeDiff} years above your age`
          }
        </div>
      )}

      <p className="text-sm text-stone-600">{fitnessAge.explanation}</p>
    </div>
  );
}

/**
 * Milestone Progress Card
 */
export function MilestoneProgressCard() {
  const [milestones, setMilestones] = useState<{
    name: string;
    description: string;
    current: number;
    target: number;
    percentComplete: number;
    achieved: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMilestoneProgress().then(data => {
      setMilestones(data.milestones);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Medal className="w-5 h-5 text-slate-600" />
          Milestones
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  // Show closest to completion (not achieved) and recent achievements
  const inProgress = milestones
    .filter(m => !m.achieved)
    .sort((a, b) => b.percentComplete - a.percentComplete)
    .slice(0, 3);

  const achieved = milestones
    .filter(m => m.achieved)
    .slice(0, 3);

  if (inProgress.length === 0 && achieved.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Medal className="w-5 h-5 text-slate-600" />
        Milestones
      </h2>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">In Progress</p>
          {inProgress.map((m) => (
            <div key={m.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-stone-700">{m.name}</span>
                <span className="text-xs text-stone-500">
                  {m.current} / {m.target}
                </span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-slate-300 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${m.percentComplete}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Achieved */}
      {achieved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Achieved</p>
          <div className="flex flex-wrap gap-2">
            {achieved.map((m) => (
              <span
                key={m.name}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium"
              >
                <CheckCircle className="w-3 h-3" />
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
