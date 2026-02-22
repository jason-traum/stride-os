import type { Metadata } from 'next';
import { TrainingReportClient } from './TrainingReportClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Training Report | Dreamy',
  description: 'Generate printable weekly and monthly training reports.',
};

export default function ReportPage() {
  return <TrainingReportClient />;
}
