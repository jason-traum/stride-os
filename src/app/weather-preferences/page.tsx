'use server';

import { analyzeWeatherPreferences } from '@/lib/weather-preferences';
import { WeatherPreferencesCard } from '@/components/WeatherPreferencesCard';
import Link from 'next/link';
import { ArrowLeft, Cloud, Info } from 'lucide-react';

export default async function WeatherPreferencesPage() {
  const weatherData = await analyzeWeatherPreferences();

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
          <h1 className="text-3xl font-bold text-primary mb-2">Weather Performance Analysis</h1>
          <p className="text-textSecondary">
            Discover how weather conditions affect your running performance and find your optimal conditions.
          </p>
        </div>

        {/* Main Analysis Card */}
        <div className="mb-6">
          <WeatherPreferencesCard data={weatherData} />
        </div>

        {/* Educational Content */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            Understanding Weather Impact
          </h2>

          <div className="space-y-4 text-textSecondary">
            <section>
              <h3 className="font-medium text-primary mb-2">How Weather Affects Performance</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Temperature:</strong> Every 10°F above 55°F can slow pace by 1.5-3%</li>
                <li>• <strong>Humidity:</strong> High humidity reduces sweat evaporation, increasing perceived effort</li>
                <li>• <strong>Dew Point:</strong> Above 60°F becomes uncomfortable, above 70°F is oppressive</li>
                <li>• <strong>Wind:</strong> Headwind can increase energy cost by 2-10% depending on speed</li>
                <li>• <strong>Altitude:</strong> Above 5000ft reduces oxygen availability by ~20%</li>
              </ul>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Adapting to Conditions</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Heat Adaptation:</span>
                  <p className="text-textTertiary mt-1">
                    Takes 10-14 days of consistent exposure. Start with shorter, easier runs and gradually increase.
                  </p>
                </div>
                <div>
                  <span className="font-medium">Cold Weather:</span>
                  <p className="text-textTertiary mt-1">
                    Warm up indoors, layer appropriately, and protect extremities. Performance often improves in 40-60°F.
                  </p>
                </div>
                <div>
                  <span className="font-medium">High Humidity:</span>
                  <p className="text-textTertiary mt-1">
                    Adjust pace expectations, hydrate well before/during/after, and consider electrolyte replacement.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Race Day Strategy</h3>
              <ul className="space-y-1 text-sm">
                <li>• Check weather forecast 3-5 days out to adjust hydration strategy</li>
                <li>• For hot races, pre-cool with cold towels or ice vests</li>
                <li>• Adjust goal pace based on conditions (use our pace calculator)</li>
                <li>• Plan fluid intake - increase by 50-100% in hot/humid conditions</li>
                <li>• Consider salt tabs or electrolyte drinks for races over 90 minutes in heat</li>
              </ul>
            </section>

            <section className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-indigo-800">
                <strong>Pro tip:</strong> Track weather conditions for all your runs to build a personal
                database. After 20-30 runs in varied conditions, you\'ll have reliable data on how
                weather affects your performance.
              </p>
            </section>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="mt-6 bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h3 className="font-medium text-primary mb-3">Weather Adjustment Guide</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-secondary mb-2">Temperature Adjustments</h4>
              <div className="space-y-1 text-textSecondary">
                <div>50-60°F: Ideal, no adjustment</div>
                <div>60-70°F: +1-2% to goal pace</div>
                <div>70-80°F: +3-5% to goal pace</div>
                <div>80-90°F: +7-10% to goal pace</div>
                <div>&gt;90°F: +12-15% or postpone</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-secondary mb-2">Humidity Adjustments</h4>
              <div className="space-y-1 text-textSecondary">
                <div>&lt;40%: Ideal conditions</div>
                <div>40-60%: Minimal impact</div>
                <div>60-80%: +1-3% to pace</div>
                <div>80-90%: +3-5% to pace</div>
                <div>&gt;90%: +5-8% to pace</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}