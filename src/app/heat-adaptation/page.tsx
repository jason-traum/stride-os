import { getHeatAdaptationAnalysis } from '@/lib/heat-adaptation';
import { HeatAdaptationCard } from '@/components/HeatAdaptationCard';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function HeatAdaptationPage() {
  const heatData = await getHeatAdaptationAnalysis();

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="inline-flex items-center text-sm text-textSecondary hover:text-teal-600 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Tools
          </Link>
          <h1 className="text-3xl font-bold text-primary mb-2">Heat Adaptation Tracker</h1>
          <p className="text-textSecondary">
            Monitor your body's adaptation to running in hot weather conditions
          </p>
        </div>

        {/* Heat Adaptation Card */}
        <HeatAdaptationCard data={heatData} />

        {/* Educational Content */}
        <div className="mt-8 space-y-6">
          {/* How It Works */}
          <div className="bg-surface-1 rounded-xl border border-default p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Understanding Heat Adaptation</h2>

            <div className="space-y-4 text-sm text-textSecondary">
              <div>
                <p className="font-medium text-secondary mb-1">What is heat adaptation?</p>
                <p>
                  Your body's ability to maintain performance in hot conditions improves with repeated exposure.
                  This process typically takes 10-14 days of consistent heat training.
                </p>
              </div>

              <div>
                <p className="font-medium text-secondary mb-1">Key adaptations include:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Earlier onset of sweating</li>
                  <li>Increased sweat rate and better electrolyte retention</li>
                  <li>Lower core temperature at same effort</li>
                  <li>Improved cardiovascular efficiency</li>
                  <li>Better perceived exertion in heat</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-secondary mb-1">How we calculate your score:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Frequency of heat exposure (2-3x per week ideal)</li>
                  <li>Recency of heat training (adaptation fades without exposure)</li>
                  <li>Duration and intensity of heat runs</li>
                  <li>Temperature and humidity conditions</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Safety Tips */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <h3 className="text-lg font-semibold text-amber-900 mb-3">Heat Safety Tips</h3>
            <div className="space-y-2 text-sm text-amber-800">
              <p>• Start conservatively - reduce pace by 30-60 seconds per mile initially</p>
              <p>• Hydrate well before, during, and after runs</p>
              <p>• Run during cooler parts of the day when adapting</p>
              <p>• Watch for signs of heat illness: dizziness, nausea, confusion</p>
              <p>• Consider electrolyte replacement for runs over 60 minutes</p>
              <p>• Wear light-colored, moisture-wicking clothing</p>
              <p>• If you feel unwell, stop immediately and seek shade/cooling</p>
            </div>
          </div>

          {/* Training Guidelines */}
          <div className="bg-teal-50 rounded-xl border border-teal-200 p-6">
            <h3 className="text-lg font-semibold text-teal-900 mb-3">Heat Training Guidelines</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-teal-800">
              <div>
                <p className="font-medium mb-1">Week 1-2: Acclimation</p>
                <p>20-30 minute easy runs in mild heat (70-75°F). Focus on hydration.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Week 3-4: Building</p>
                <p>Increase duration to 45-60 minutes. Add one moderate effort session.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Week 5-6: Adaptation</p>
                <p>Include tempo runs in heat. Practice race-day nutrition strategies.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Maintenance</p>
                <p>1-2 heat sessions per week to maintain adaptation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}