'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { importActivities } from '@/actions/import';

/**
 * Parse CSV text handling quoted fields (e.g., fields containing commas).
 * Returns an array of objects keyed by header names.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCSV(text: string): any[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = parseCsvLine(line);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] ?? '';
      });
      return obj;
    })
    .filter(a => a.Distance);
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const { showToast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activities: any[] = [];
      let source: 'strava' | 'garmin';

      if (file.name.endsWith('.json')) {
        // Strava bulk export format
        const parsed = JSON.parse(text);
        activities = Array.isArray(parsed) ? parsed : [];
        source = 'strava';
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV (Garmin Connect export) with quoted field support
        activities = parseCSV(text);
        source = 'garmin';
      } else {
        showToast('Unsupported file type. Use .json or .csv', 'error');
        setImporting(false);
        return;
      }

      if (activities.length === 0) {
        showToast('No activities found in file', 'error');
        setImporting(false);
        return;
      }

      // Call server action to save activities to database
      const importResult = await importActivities(activities, source);
      setResult(importResult);

      if (importResult.imported > 0) {
        showToast(`Imported ${importResult.imported} activities!`, 'success');
      } else if (importResult.skipped > 0) {
        showToast(`All ${importResult.skipped} activities were already imported or skipped`, 'info');
      }
    } catch (error) {
      showToast('Failed to import file', 'error');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-primary">Import Workouts</h1>
        <p className="text-textSecondary mt-1">Import your training data from Strava or Garmin</p>
      </div>

      <div className="bg-surface-1 rounded-lg border border-default p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">How to Export Your Data</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-primary mb-2">From Strava:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-textSecondary">
              <li>Go to Settings → My Account → Download Request</li>
              <li>Request your archive (takes ~30 minutes)</li>
              <li>Download and extract activities.json</li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-primary mb-2">From Garmin Connect:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-textSecondary">
              <li>Go to Activities → All Activities</li>
              <li>Use filters to select date range</li>
              <li>Click Export CSV</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-surface-1 rounded-lg border border-default p-8">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileUpload}
            disabled={importing}
            className="hidden"
          />

          <div className="border-2 border-dashed border-strong rounded-lg p-8 text-center hover:border-dream-500 transition-colors">
            {importing ? (
              <div className="animate-pulse">
                <FileText className="w-12 h-12 mx-auto text-tertiary mb-3" />
                <p className="text-textSecondary">Importing activities...</p>
              </div>
            ) : result ? (
              <div>
                {result.imported > 0 ? (
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                ) : (
                  <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                )}
                <p className="text-primary font-medium">
                  {result.imported} {result.imported === 1 ? 'activity' : 'activities'} imported
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-textTertiary mt-1">
                    {result.skipped} skipped (duplicates or non-running)
                  </p>
                )}
                <p className="text-sm text-textTertiary mt-2">Upload another file to import more</p>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 mx-auto text-tertiary mb-3" />
                <p className="text-primary font-medium">Drop file here or click to browse</p>
                <p className="text-sm text-textTertiary mt-1">Supports .json (Strava) or .csv (Garmin)</p>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
