'use client';

import { cn, parseLocalDate } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WeeklyMileageRamp } from '@/actions/fitness';

interface MileageRampTableProps {
  weeks: WeeklyMileageRamp[];
}

const riskConfig = {
  green: {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-800',
    label: 'Safe',
  },
  yellow: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-800',
    label: 'Caution',
  },
  red: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-800',
    label: 'High Risk',
  },
};

export function MileageRampTable({ weeks }: MileageRampTableProps) {
  if (weeks.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <h3 className="font-semibold text-textPrimary mb-2 text-sm">Weekly Mileage Ramp</h3>
        <p className="text-xs text-textTertiary">Not enough weekly data to calculate ramp rates.</p>
      </div>
    );
  }

  // Find the latest ramp rate with data for the summary
  const latestWithRamp = [...weeks].reverse().find(w => w.rampPercent !== null);
  const hasWarning = weeks.some(w => w.risk === 'red' || w.risk === 'yellow');

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-textPrimary text-sm">Weekly Mileage Ramp</h3>
          <p className="text-[10px] text-textTertiary mt-0.5">
            Keep week-over-week increases under 10% to reduce injury risk
          </p>
        </div>
        {hasWarning && (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
      </div>

      {/* Summary badge */}
      {latestWithRamp && (
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-3',
          riskConfig[latestWithRamp.risk].bg,
          riskConfig[latestWithRamp.risk].text,
        )}>
          {latestWithRamp.rampPercent !== null && latestWithRamp.rampPercent > 0
            ? <TrendingUp className="w-3 h-3" />
            : latestWithRamp.rampPercent !== null && latestWithRamp.rampPercent < 0
            ? <TrendingDown className="w-3 h-3" />
            : <Minus className="w-3 h-3" />
          }
          This week: {latestWithRamp.rampPercent !== null ? (
            `${latestWithRamp.rampPercent > 0 ? '+' : ''}${latestWithRamp.rampPercent}%`
          ) : 'N/A'}
          {' '}&middot; {riskConfig[latestWithRamp.risk].label}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-textTertiary border-b border-borderPrimary">
              <th className="text-left py-1.5 font-medium">Week of</th>
              <th className="text-right py-1.5 font-medium">Miles</th>
              <th className="text-right py-1.5 font-medium">Change</th>
              <th className="text-right py-1.5 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const config = riskConfig[week.risk];
              const date = parseLocalDate(week.weekStart);
              const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <tr key={week.weekStart} className="border-b border-borderPrimary/50 last:border-0">
                  <td className="py-1.5 text-textSecondary">{label}</td>
                  <td className="py-1.5 text-right text-textPrimary font-medium">
                    {week.miles.toFixed(1)}
                  </td>
                  <td className="py-1.5 text-right">
                    {week.rampPercent !== null ? (
                      <span className={cn(
                        'font-medium',
                        week.rampPercent > 15 ? 'text-red-400' :
                        week.rampPercent > 10 ? 'text-amber-400' :
                        week.rampPercent > 0 ? 'text-green-400' :
                        week.rampPercent < -10 ? 'text-blue-400' :
                        'text-textSecondary'
                      )}>
                        {week.rampPercent > 0 ? '+' : ''}{week.rampPercent}%
                      </span>
                    ) : (
                      <span className="text-textTertiary">--</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    {week.rampPercent !== null ? (
                      <span className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                        config.bg,
                        config.text,
                      )}>
                        {config.label}
                      </span>
                    ) : (
                      <span className="text-textTertiary text-[10px]">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
