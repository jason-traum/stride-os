'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  FileArchive,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { importFromStravaCSV } from '@/actions/bulk-import';
import {
  summarizeActivityTypes,
  parseStravaRunsFromCsv,
} from '@/lib/strava-csv-parser';
import type { ActivityTypeSummary, ParsedStravaActivity } from '@/lib/strava-csv-parser';
import type { BulkImportResult } from '@/actions/bulk-import';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState = 'instructions' | 'preview' | 'importing' | 'done';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SetupImportPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [state, setState] = useState<PageState>('instructions');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Preview state
  const [activitySummary, setActivitySummary] = useState<ActivityTypeSummary[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [parsedRuns, setParsedRuns] = useState<ParsedStravaActivity[]>([]);

  // Import state
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  // ── File handling ──────────────────────────────────────────────────────

  const processFile = useCallback(async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      showToast('Please upload an activities.csv file from your Strava export', 'error');
      return;
    }

    setFile(selectedFile);

    try {
      const text = await selectedFile.text();

      // Summarize activity types for preview
      const { summary, totalRows: rows, totalRuns: runs } = summarizeActivityTypes(text);
      setActivitySummary(summary);
      setTotalRows(rows);
      setTotalRuns(runs);

      // Parse run activities
      const runs_ = parseStravaRunsFromCsv(text);
      setParsedRuns(runs_);

      setState('preview');
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      showToast('Failed to parse the CSV file. Make sure it is the activities.csv from a Strava export.', 'error');
    }
  }, [showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) processFile(droppedFile);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const resetState = () => {
    setState('instructions');
    setFile(null);
    setActivitySummary([]);
    setTotalRows(0);
    setTotalRuns(0);
    setParsedRuns([]);
    setProgress(0);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Import handler ─────────────────────────────────────────────────────

  const handleImport = async () => {
    if (parsedRuns.length === 0) return;

    setState('importing');
    setProgress(0);

    // Send activities in batches of 50 to show progress
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(parsedRuns.length / BATCH_SIZE);
    let totalImported = 0;
    let totalSkipped = 0;
    let totalMatched = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = parsedRuns.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const batchResult = await importFromStravaCSV(batch);

        totalImported += batchResult.imported;
        totalSkipped += batchResult.skipped;
        totalMatched += batchResult.matched;
        totalErrors += batchResult.errors;

        setProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      setResult({
        imported: totalImported,
        skipped: totalSkipped,
        matched: totalMatched,
        errors: totalErrors,
        total: parsedRuns.length,
      });
      setState('done');

      if (totalImported > 0) {
        showToast(`Imported ${totalImported} run${totalImported !== 1 ? 's' : ''}!`, 'success');
      }
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Import failed. Please try again.', 'error');
      setState('preview');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-textPrimary">
          Import from Strava
        </h1>
        <p className="text-textSecondary mt-1">
          Upload your Strava data export to import your running history
        </p>
      </div>

      {/* Instructions Section */}
      {(state === 'instructions' || state === 'preview') && (
        <div className="bg-surface-1 rounded-lg border border-default p-6">
          <h2 className="text-lg font-semibold text-textPrimary mb-4">
            How to get your Strava data
          </h2>
          <ol className="space-y-3">
            {[
              {
                step: '1',
                text: (
                  <>
                    Go to{' '}
                    <a
                      href="https://www.strava.com/account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dream-400 hover:text-dream-300 inline-flex items-center gap-1"
                    >
                      strava.com/account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                ),
              },
              {
                step: '2',
                text: 'Click "Download or Delete Your Account"',
              },
              {
                step: '3',
                text: 'Click "Request Your Archive"',
              },
              {
                step: '4',
                text: 'Wait for the email from Strava (usually ~5 minutes)',
              },
              {
                step: '5',
                text: (
                  <>
                    Download the ZIP, extract it, and upload the{' '}
                    <code className="px-1.5 py-0.5 bg-surface-2 rounded text-dream-400 text-xs font-mono">
                      activities.csv
                    </code>{' '}
                    file below
                  </>
                ),
              },
            ].map(({ step, text }) => (
              <li key={step} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-dream-500/20 text-dream-400 text-xs font-semibold flex items-center justify-center">
                  {step}
                </span>
                <span className="text-sm text-textSecondary leading-relaxed pt-0.5">
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Upload Area */}
      {state === 'instructions' && (
        <div className="bg-surface-1 rounded-lg border border-default p-2">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
              transition-all duration-200
              ${dragActive
                ? 'border-dream-500 bg-dream-500/5'
                : 'border-strong hover:border-dream-500/50 hover:bg-surface-2/30'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center">
              <div className={`p-3 rounded-xl mb-4 transition-colors ${
                dragActive ? 'bg-dream-500/20' : 'bg-surface-2'
              }`}>
                <FileArchive className={`w-8 h-8 ${
                  dragActive ? 'text-dream-400' : 'text-textTertiary'
                }`} />
              </div>
              <p className="text-textPrimary font-medium mb-1">
                {dragActive ? 'Drop your file here' : 'Drop activities.csv here'}
              </p>
              <p className="text-sm text-textTertiary mb-4">
                or click to browse files
              </p>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dream-500/10 text-dream-400 text-sm font-medium hover:bg-dream-500/20 transition-colors">
                <Upload className="w-4 h-4" />
                Browse Files
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {state === 'preview' && file && (
        <div className="space-y-4">
          {/* Selected File */}
          <div className="bg-surface-1 rounded-lg border border-default p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dream-500/10">
                  <FileText className="w-5 h-5 text-dream-400" />
                </div>
                <div>
                  <p className="text-textPrimary font-medium text-sm">{file.name}</p>
                  <p className="text-textTertiary text-xs">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={resetState}
                className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-textTertiary hover:text-textSecondary"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-surface-1 rounded-lg border border-default p-5">
            <h3 className="text-sm font-semibold text-textPrimary mb-3">
              Found in your export
            </h3>

            <div className="space-y-2">
              {activitySummary.map(({ type, label, count, isRun }) => (
                <div
                  key={type}
                  className={`flex items-center justify-between py-1.5 px-3 rounded-lg ${
                    isRun ? 'bg-dream-500/5' : ''
                  }`}
                >
                  <span className={`text-sm ${
                    isRun ? 'text-dream-400 font-medium' : 'text-textSecondary'
                  }`}>
                    {count.toLocaleString()} {label}
                  </span>
                  {isRun && (
                    <span className="text-xs text-dream-400/80 font-medium">
                      will import
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Summary line */}
            <div className="mt-4 pt-3 border-t border-default">
              <p className="text-sm text-textSecondary">
                <span className="text-textPrimary font-semibold">{totalRuns.toLocaleString()}</span>{' '}
                runs out of{' '}
                <span className="text-textPrimary font-semibold">{totalRows.toLocaleString()}</span>{' '}
                total activities will be imported.
                {totalRows - totalRuns > 0 && (
                  <span className="text-textTertiary">
                    {' '}Non-running activities ({(totalRows - totalRuns).toLocaleString()}) will be skipped.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={parsedRuns.length === 0}
            className="w-full btn-primary py-3 text-center font-medium flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import {parsedRuns.length.toLocaleString()} Run{parsedRuns.length !== 1 ? 's' : ''}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Importing Progress */}
      {state === 'importing' && (
        <div className="bg-surface-1 rounded-lg border border-default p-8">
          <div className="text-center mb-6">
            <Loader2 className="w-10 h-10 mx-auto text-dream-500 animate-spin mb-4" />
            <p className="text-textPrimary font-medium">
              Importing your runs...
            </p>
            <p className="text-textTertiary text-sm mt-1">
              This may take a moment for large exports
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-2 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-dream-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-textTertiary text-xs text-center mt-2">
            {progress}% complete
          </p>
        </div>
      )}

      {/* Done / Results */}
      {state === 'done' && result && (
        <div className="space-y-4">
          <div className="bg-surface-1 rounded-lg border border-default p-6">
            <div className="text-center mb-5">
              {result.imported > 0 ? (
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              ) : (
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-3" />
              )}
              <h3 className="text-lg font-semibold text-textPrimary">
                {result.imported > 0 ? 'Import Complete' : 'No New Runs Imported'}
              </h3>
            </div>

            {/* Result Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {result.imported > 0 && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-green-400">
                    {result.imported.toLocaleString()}
                  </p>
                  <p className="text-xs text-textTertiary">new runs imported</p>
                </div>
              )}

              {result.skipped > 0 && (
                <div className="bg-surface-2 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-textSecondary">
                    {result.skipped.toLocaleString()}
                  </p>
                  <p className="text-xs text-textTertiary">already existed</p>
                </div>
              )}

              {result.matched > 0 && (
                <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-sky-400">
                    {result.matched.toLocaleString()}
                  </p>
                  <p className="text-xs text-textTertiary">matched & updated</p>
                </div>
              )}

              {result.errors > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-red-400">
                    {result.errors.toLocaleString()}
                  </p>
                  <p className="text-xs text-textTertiary">errors</p>
                </div>
              )}
            </div>

            {/* Next steps hint */}
            {result.imported > 0 && (
              <div className="mt-5 pt-4 border-t border-default">
                <p className="text-sm text-textSecondary">
                  Your runs have been imported as &quot;easy&quot; by default.
                  They&apos;ll be automatically classified with proper workout types when you view your history.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={resetState}
              className="flex-1 py-3 rounded-lg border border-default text-textSecondary font-medium
                         hover:bg-surface-2 transition-colors text-center text-sm"
            >
              Import Another File
            </button>
            <a
              href="/setup/cleanup"
              className="flex-1 btn-primary py-3 text-center font-medium flex items-center justify-center gap-2 text-sm"
            >
              Continue to Data Cleanup
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
