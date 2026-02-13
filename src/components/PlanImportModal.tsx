'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { importTrainingPlan, previewImport, type ImportedWorkout, type ImportResult } from '@/actions/plan-import';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';

interface PlanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  raceId?: number;
  onSuccess?: (result: ImportResult) => void;
}

export function PlanImportModal({ isOpen, onClose, raceId, onSuccess }: PlanImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportedWorkout[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [clearExisting, setClearExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent body scrolling when modal is open
  useModalBodyLock(isOpen);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);

    try {
      const text = await selectedFile.text();
      setContent(text);

      // Preview the import
      const { workouts, errors: parseErrors } = await previewImport(text, 'auto');
      setPreview(workouts);
      setErrors(parseErrors);

      if (workouts.length > 0) {
        setStep('preview');
      }
    } catch (e) {
      setErrors([`Failed to read file: ${e}`]);
    }
  };

  const handleImport = async () => {
    setStep('importing');

    try {
      const importResult = await importTrainingPlan(content, 'auto', {
        raceId,
        clearExisting,
      });

      setResult(importResult);
      setStep('done');

      if (importResult.success && onSuccess) {
        onSuccess(importResult);
      }
    } catch (e) {
      setErrors([`Import failed: ${e}`]);
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setContent('');
    setPreview([]);
    setResult(null);
    setErrors([]);
    setClearExisting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Import Training Plan</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Import a training plan from TrainingPeaks, Final Surge, or any CSV/ICS file.
              </p>

              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                  'hover:border-teal-400 hover:bg-slate-50/50',
                  file ? 'border-green-400 bg-green-50' : 'border-stone-300'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ics,.ical"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center">
                    <Check className="w-10 h-10 text-green-500 mb-2" />
                    <p className="font-medium text-stone-900">{file.name}</p>
                    <p className="text-sm text-stone-500 mt-1">Click to choose a different file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-10 h-10 text-stone-400 mb-2" />
                    <p className="font-medium text-stone-900">Drop your file here</p>
                    <p className="text-sm text-stone-500 mt-1">or click to browse</p>
                    <p className="text-xs text-stone-400 mt-3">Supports CSV and ICS formats</p>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                  {errors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              )}

              <div className="text-xs text-stone-500 space-y-1">
                <p><strong>TrainingPeaks:</strong> Export your plan as CSV from the Calendar</p>
                <p><strong>Final Surge:</strong> Export as iCal or CSV from your plan</p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">{preview.length} workouts found</span>
              </div>

              {/* Preview list */}
              <div className="border border-stone-200 rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-stone-600">Date</th>
                      <th className="text-left py-2 px-3 font-medium text-stone-600">Workout</th>
                      <th className="text-left py-2 px-3 font-medium text-stone-600">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {preview.slice(0, 20).map((w, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-stone-600">{w.date}</td>
                        <td className="py-2 px-3 text-stone-900">{w.name}</td>
                        <td className="py-2 px-3 text-stone-600 capitalize">{w.workoutType.replace(/_/g, ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <p className="text-xs text-stone-500 text-center py-2">
                    + {preview.length - 20} more workouts
                  </p>
                )}
              </div>

              {raceId && (
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  Clear existing planned workouts for this race
                </label>
              )}

              {errors.length > 0 && (
                <div className="bg-slate-50 text-teal-700 rounded-lg p-3 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    {errors.map((error, i) => (
                      <p key={i}>{error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4" />
              <p className="text-stone-600">Importing your training plan...</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-50 text-green-700 rounded-lg p-4 flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Import successful!</p>
                    <p className="text-sm mt-1">
                      Imported {result.imported} workouts
                      {result.skipped > 0 && ` (${result.skipped} skipped)`}
                    </p>
                    {result.startDate && result.endDate && (
                      <p className="text-sm mt-1">
                        Plan spans {result.startDate} to {result.endDate}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 text-red-700 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Import failed</p>
                    {result.errors.map((error, i) => (
                      <p key={i} className="text-sm mt-1">{error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-200">
          {step === 'upload' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
              >
                Import {preview.length} Workouts
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
