'use server';

import { getInjuryRiskAssessment } from '@/lib/injury-risk';
import { InjuryRiskCard } from '@/components/InjuryRiskCard';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

export default async function InjuryRiskPage() {
  const injuryData = await getInjuryRiskAssessment();

  return (
    <div className="min-h-screen bg-bgTertiary py-6">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-textSecondary hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Injury Risk Assessment</h1>
          <p className="text-textSecondary">
            Monitor your training patterns to identify and prevent potential injury risks.
          </p>
        </div>

        {/* Main Risk Card */}
        <div className="mb-6">
          <InjuryRiskCard data={injuryData} />
        </div>

        {/* Educational Content */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            Understanding Injury Risk
          </h2>

          <div className="space-y-4 text-textSecondary">
            <section>
              <h3 className="font-medium text-primary mb-2">Risk Factors We Monitor</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Training Load Changes:</strong> Sudden increases in mileage or intensity</li>
                <li>• <strong>Recovery Balance:</strong> Rest days, sleep quality, and readiness scores</li>
                <li>• <strong>Mileage Buildup:</strong> Following safe progression rates (10% rule)</li>
                <li>• <strong>Intensity Distribution:</strong> Balance of easy, moderate, and hard efforts</li>
                <li>• <strong>Workout Variety:</strong> Mix of different training types</li>
                <li>• <strong>Historical Injuries:</strong> Previous injury patterns and recovery</li>
              </ul>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Risk Levels Explained</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-medium">Low (0-30%):</span>
                  <span>Training patterns are safe and sustainable. Keep up the good work!</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 font-medium">Moderate (31-50%):</span>
                  <span>Some risk factors present. Pay attention to recovery and progression.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-600 font-medium">High (51-75%):</span>
                  <span>Multiple risk factors detected. Consider reducing training load.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-600 font-medium">Critical (76-100%):</span>
                  <span>High injury risk. Immediate rest or significant load reduction recommended.</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Prevention Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• Follow the 10% rule for weekly mileage increases</li>
                <li>• Take at least one full rest day per week</li>
                <li>• Listen to your body - fatigue, soreness, and mood are important signals</li>
                <li>• Maintain variety in your training (surfaces, paces, distances)</li>
                <li>• Don&apos;t skip warm-ups and cool-downs</li>
                <li>• Address minor issues before they become injuries</li>
              </ul>
            </section>

            <section className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-indigo-800">
                <strong>Remember:</strong> This assessment is based on training patterns and should not replace
                professional medical advice. If you experience pain or discomfort, consult a healthcare provider.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}