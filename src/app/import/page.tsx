'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/Toast';

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const { showToast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      // Parse different file formats
      const text = await file.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activities: any[] = [];

      if (file.name.endsWith('.json')) {
        // Strava bulk export format
        activities = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV (Garmin Connect export)
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        activities = lines.slice(1).map(line => {
          const values = line.split(',');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const activity: any = {};
          headers.forEach((header, index) => {
            activity[header] = values[index]?.trim();
          });
          return activity;
        }).filter(a => a.Distance);
      }

      // TODO: Process and save activities
      console.log(`Found ${activities.length} activities to import`);
      setImported(activities.length);
      showToast(`Imported ${activities.length} activities!`, 'success');

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
        <h1 className="text-2xl font-display font-semibold text-primary">Import Workouts</h1>
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

          <div className="border-2 border-dashed border-strong rounded-lg p-8 text-center hover:border-teal-500 transition-colors">
            {importing ? (
              <div className="animate-pulse">
                <FileText className="w-12 h-12 mx-auto text-tertiary mb-3" />
                <p className="text-textSecondary">Processing file...</p>
              </div>
            ) : imported > 0 ? (
              <div>
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <p className="text-primary font-medium">{imported} activities imported!</p>
                <p className="text-sm text-textTertiary mt-1">Upload another file to import more</p>
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