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
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-textSecondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tools</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">Pace Band Generator</h1>
        <p className="text-textSecondary mb-8">
          Create a customized pace band for your next race. Print it out or save it to your phone.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Configuration */}
          <div className="space-y-6">
            {/* Race Distance */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
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
                        ? 'border-teal-500 bg-surface-1 text-teal-700'
                        : 'border-default hover:border-teal-300 text-secondary'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Time */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
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
                    className="w-16 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">hrs</p>
                </div>
                <span className="text-2xl text-tertiary mt-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customTime.minutes}
                    onChange={(e) => setCustomTime({ ...customTime, minutes: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">min</p>
                </div>
                <span className="text-2xl text-tertiary mt-2">:</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customTime.seconds}
                    onChange={(e) => setCustomTime({ ...customTime, seconds: parseInt(e.target.value) || 0 })}
                    className="w-16 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                  />
                  <p className="text-xs text-textTertiary text-center mt-1">sec</p>
                </div>
              </div>
            </div>

            {/* Pacing Strategy */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
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
                        ? 'border-teal-500 bg-surface-1'
                        : 'border-default hover:border-teal-300'
                    )}
                  >
                    <p className={cn(
                      'font-medium',
                      config.strategy === option.value ? 'text-teal-700' : 'text-secondary'
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-textTertiary mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Split Interval */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
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
                        ? 'border-teal-500 bg-surface-1 text-teal-700'
                        : 'border-default hover:border-teal-300 text-secondary'
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
                className="mt-0.5 rounded border-strong text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="font-medium text-secondary">Include GPS fade zone</p>
                <p className="text-xs text-textTertiary">
                  Add 0.5% buffer for GPS being slightly long (recommended)
                </p>
              </div>
            </label>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="btn-primary w-full py-3 rounded-lg"
            >
              Generate Pace Band
            </button>
          </div>

          {/* Preview */}
          <div>
            {paceBand ? (
              <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-primary">Your Pace Band</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      className="p-2 hover:bg-surface-interactive-hover rounded-lg transition-colors"
                      title="Print"
                    >
                      <Printer className="w-5 h-5 text-textSecondary" />
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2 hover:bg-surface-interactive-hover rounded-lg transition-colors"
                      title="Download HTML"
                    >
                      <Download className="w-5 h-5 text-textSecondary" />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-surface-1 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-textTertiary">Target Time</p>
                      <p className="font-bold text-primary">{paceBand.targetTime}</p>
                    </div>
                    <div>
                      <p className="text-textTertiary">Average Pace</p>
                      <p className="font-bold text-primary">{paceBand.targetPace}/mi</p>
                    </div>
                  </div>
                </div>

                {/* Splits Table */}
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-default">
                        <th className="text-left py-2 font-medium text-secondary">Split</th>
                        <th className="text-left py-2 font-medium text-secondary">Time</th>
                        <th className="text-left py-2 font-medium text-secondary">Pace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {paceBand.splits.slice(0, 10).map((split, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <span className="font-medium">{split.distance}</span>
                            {split.notes && (
                              <p className="text-xs text-textTertiary italic">{split.notes}</p>
                            )}
                          </td>
                          <td className="py-2">{split.elapsedTime}</td>
                          <td className="py-2 font-medium">{split.pace}</td>
                        </tr>
                      ))}
                      {paceBand.splits.length > 10 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-textTertiary">
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
              <div className="bg-surface-1 rounded-xl border border-default p-8 shadow-sm text-center">
                <Info className="w-12 h-12 text-tertiary mx-auto mb-3" />
                <p className="text-textTertiary">
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