'use client';

import { useState } from 'react';
import { generatePaceBand, generatePaceBandHTML, type PaceBandConfig } from '@/lib/pace-bands';
import { Download, Printer, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function PaceBandsPage() {
  const [config, setConfig] = useState<PaceBandConfig>({
    raceDistance: 'marathon',
    targetTimeSeconds: 3 * 3600 + 30 * 60, // 3:30:00 default
    strategy: 'even',
    splitInterval: '1mi',
    includeFadeZone: true,
  });

  const [customTime, setCustomTime] = useState({ hours: 3, minutes: 30, seconds: 0 });
  const [showBand, setShowBand] = useState(false);

  const paceBand = showBand ? generatePaceBand(config) : null;

  const updateTargetTime = () => {
    const seconds = customTime.hours * 3600 + customTime.minutes * 60 + customTime.seconds;
    setConfig({ ...config, targetTimeSeconds: seconds });
  };

  const handleGenerate = () => {
    updateTargetTime();
    setShowBand(true);
  };

  const handlePrint = () => {
    if (!paceBand) return;

    const html = generatePaceBandHTML(paceBand);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (!paceBand) return;

    const html = generatePaceBandHTML(paceBand);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pace-band-${config.raceDistance}-${paceBand.targetTime.replace(/:/g, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tools</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-stone-900 mb-2">Pace Band Generator</h1>
        <p className="text-stone-600 mb-8">
          Create a customized pace band for your next race. Print it out or save it to your phone.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Configuration */}
          <div className="space-y-6">
            {/* Race Distance */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Race Distance
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'marathon', label: 'Marathon' },
                  { value: 'half', label: 'Half Marathon' },
                  { value: '10k', label: '10K' },
                  { value: '5k', label: '5K' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setConfig({ ...config, raceDistance: option.value as any })}
                    className={cn(
                      'py-2 px-4 rounded-lg border-2 font-medium transition-all',
                      config.raceDistance === option.value
                        ? 'border-teal-500 bg-slate-50 text-teal-700'
                        : 'border-stone-200 hover:border-teal-300 text-stone-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Time */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Target Time
              </label>
              <div className="flex gap-2">
                <div>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={customTime.hours}
                    onChange={(e) => setCustomTime({ ...customTime, hours: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-stone-500 text-center mt-1">hrs</p>
                </div>
                <span className="text-2xl text-stone-400 mt-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customTime.minutes}
                    onChange={(e) => setCustomTime({ ...customTime, minutes: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-stone-500 text-center mt-1">min</p>
                </div>
                <span className="text-2xl text-stone-400 mt-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customTime.seconds}
                    onChange={(e) => setCustomTime({ ...customTime, seconds: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-stone-500 text-center mt-1">sec</p>
                </div>
              </div>
            </div>

            {/* Pacing Strategy */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Pacing Strategy
              </label>
              <div className="space-y-2">
                {[
                  { value: 'even', label: 'Even Split', description: 'Maintain consistent pace throughout' },
                  { value: 'negative', label: 'Negative Split', description: 'Start conservative, finish strong' },
                  { value: 'positive', label: 'Positive Split', description: 'Start fast, expect to slow (not recommended)' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setConfig({ ...config, strategy: option.value as any })}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border-2 transition-all',
                      config.strategy === option.value
                        ? 'border-teal-500 bg-slate-50'
                        : 'border-stone-200 hover:border-teal-300'
                    )}
                  >
                    <p className={cn(
                      'font-medium',
                      config.strategy === option.value ? 'text-teal-700' : 'text-stone-700'
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Split Interval */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Split Interval
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '1mi', label: 'Every Mile' },
                  { value: '5k', label: 'Every 5K' },
                  { value: '1k', label: 'Every KM' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setConfig({ ...config, splitInterval: option.value as any })}
                    className={cn(
                      'py-2 px-3 rounded-lg border-2 font-medium transition-all text-sm',
                      config.splitInterval === option.value
                        ? 'border-teal-500 bg-slate-50 text-teal-700'
                        : 'border-stone-200 hover:border-teal-300 text-stone-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Fade Zone */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={config.includeFadeZone}
                onChange={(e) => setConfig({ ...config, includeFadeZone: e.target.checked })}
                className="mt-0.5 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="font-medium text-stone-700">Include GPS fade zone</p>
                <p className="text-xs text-stone-500">
                  Add 0.5% buffer for GPS being slightly long (recommended)
                </p>
              </div>
            </label>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              Generate Pace Band
            </button>
          </div>

          {/* Preview */}
          <div>
            {paceBand ? (
              <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-stone-900">Your Pace Band</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Print"
                    >
                      <Printer className="w-5 h-5 text-stone-600" />
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Download HTML"
                    >
                      <Download className="w-5 h-5 text-stone-600" />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-stone-500">Target Time</p>
                      <p className="font-bold text-stone-900">{paceBand.targetTime}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Average Pace</p>
                      <p className="font-bold text-stone-900">{paceBand.targetPace}/mi</p>
                    </div>
                  </div>
                </div>

                {/* Splits Table */}
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left py-2 font-medium text-stone-700">Split</th>
                        <th className="text-left py-2 font-medium text-stone-700">Time</th>
                        <th className="text-left py-2 font-medium text-stone-700">Pace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {paceBand.splits.slice(0, 10).map((split, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <span className="font-medium">{split.distance}</span>
                            {split.notes && (
                              <p className="text-xs text-stone-500 italic">{split.notes}</p>
                            )}
                          </td>
                          <td className="py-2">{split.elapsedTime}</td>
                          <td className="py-2 font-medium">{split.pace}</td>
                        </tr>
                      ))}
                      {paceBand.splits.length > 10 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-stone-500">
                            ... and {paceBand.splits.length - 10} more splits
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Split Analysis */}
                <div className="mt-4 p-3 bg-teal-50 rounded-lg text-sm">
                  <p className="text-teal-800">
                    <strong>Split Analysis:</strong> {paceBand.summary.negativeSplitSeconds > 0
                      ? `Negative split by ${Math.round(paceBand.summary.negativeSplitSeconds)} seconds ✓`
                      : paceBand.summary.negativeSplitSeconds < 0
                      ? `Positive split by ${Math.round(Math.abs(paceBand.summary.negativeSplitSeconds))} seconds`
                      : 'Even split'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-8 shadow-sm text-center">
                <Info className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">
                  Configure your race and click "Generate Pace Band" to see your splits
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}