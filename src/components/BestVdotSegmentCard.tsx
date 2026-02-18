import type { ReactNode } from 'react';
import { Target, Shield, HeartPulse, Satellite } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import type { BestVdotSegmentResult } from '@/actions/segment-analysis';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function BestVdotSegmentCard({ result }: { result: BestVdotSegmentResult }) {
  if (!result.success || !result.bestSegment) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <h2 className="font-semibold text-textPrimary mb-1">Best VDOT Segment</h2>
        <p className="text-xs text-textTertiary mb-2">
          Deep segment mining uses raw stream data (&gt;= {(result.minDistanceMiles * 1609.34).toFixed(0)}m).
        </p>
        <p className="text-sm text-textSecondary">{result.message || 'No qualifying segment yet.'}</p>
      </div>
    );
  }

  const segment = result.bestSegment;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-textPrimary">Best VDOT Segment</h2>
          <p className="text-xs text-textTertiary">
            Best valid effort from stream data ({result.source === 'cached' ? 'cached' : 'fresh fetch'})
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-surface-2 text-textSecondary">
          {segment.confidence} confidence
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="VDOT Score" value={segment.vdot.toFixed(1)} icon={<Target className="w-3.5 h-3.5 text-accentTeal" />} />
        <Metric label="Distance" value={`${segment.distanceMiles.toFixed(2)} mi`} icon={<Satellite className="w-3.5 h-3.5 text-accentOrange" />} />
        <Metric label="Duration" value={formatDuration(segment.durationSeconds)} icon={<Shield className="w-3.5 h-3.5 text-accentPurple" />} />
        <Metric label="Pace" value={`${formatPace(segment.paceSecondsPerMile)}/mi`} icon={<HeartPulse className="w-3.5 h-3.5 text-accentPink" />} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-surface-2 text-textSecondary">
          GPS integrity {(segment.quality.gpsIntegrity * 100).toFixed(0)}%
        </span>
        <span className="px-2 py-1 rounded bg-surface-2 text-textSecondary">
          HR stability {(segment.quality.hrStability * 100).toFixed(0)}%
        </span>
        <span className="px-2 py-1 rounded bg-surface-2 text-textSecondary">
          GPS gaps {segment.gpsGapCount}
        </span>
        {segment.hrDriftPct != null && (
          <span className="px-2 py-1 rounded bg-surface-2 text-textSecondary">
            HR drift {segment.hrDriftPct > 0 ? '+' : ''}{segment.hrDriftPct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-borderSecondary p-2.5 bg-surface-1/40">
      <p className="text-[11px] text-textTertiary flex items-center gap-1 mb-1">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-textPrimary text-sm">{value}</p>
    </div>
  );
}
