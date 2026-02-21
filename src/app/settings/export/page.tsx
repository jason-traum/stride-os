'use client';

import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { DataExport } from '@/components/DataExport';

export default function ExportPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 -ml-2 rounded-lg hover:bg-bgTertiary transition-colors">
          <ArrowLeft className="w-5 h-5 text-textSecondary" />
        </Link>
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-500" />
          <h1 className="text-2xl font-display font-semibold text-primary">Data Export</h1>
        </div>
      </div>

      <p className="text-sm text-textSecondary mb-6">
        Download your training data. CSV files open in Excel, Google Sheets, or any spreadsheet app.
        JSON exports include all structured data for backup or analysis.
      </p>

      <DataExport />
    </div>
  );
}
