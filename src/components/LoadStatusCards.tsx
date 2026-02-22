'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, Activity, Heart, Zap, Gauge, Target } from 'lucide-react';
import type { RampRateRisk } from '@/lib/training/fitness-calculations';

interface LoadStatusCardsProps {
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  status: {
    status: 'fresh' | 'optimal' | 'tired' | 'overreached';
    label: string;
    color: string;
  };
  ctlChange: number | null;
  rampRate: number | null;
  rampRateRisk: RampRateRisk;
  weeklyLoad: number;
  optimalRange: { min: number; max: number };
}

function getCtlLabel(ctl: number): string {
  if (ctl < 20) return 'Low Base';
  if (ctl < 40) return 'Building';
  if (ctl < 60) return 'Moderate';
  if (ctl < 80) return 'Strong';
  return 'Peak';
}

function getAtlLabel(atl: number, ctl: number): string {
  const ratio = ctl > 0 ? atl / ctl : 1;
  if (ratio > 1.3) return 'Heavy';
  if (ratio > 1.1) return 'Elevated';
  if (ratio > 0.8) return 'Moderate';
  return 'Light';
}

function getTsbLabel(tsb: number): string {
  if (tsb > 20) return 'Well Rested';
  if (tsb > 5) return 'Fresh';
  if (tsb > -5) return 'Balanced';
  if (tsb > -15) return 'Slightly Fatigued';
  if (tsb > -25) return 'Fatigued';
  return 'Overreached';
}

function getTsbColor(tsb: number): string {
  if (tsb > 20) return 'text-amber-500';
  if (tsb > 5) return 'text-green-500';
  if (tsb > -5) return 'text-emerald-500';
  if (tsb > -15) return 'text-blue-400';
  if (tsb > -25) return 'text-amber-500';
  return 'text-red-500';
}

export function LoadStatusCards({
  currentCtl,
  currentAtl,
  currentTsb,
  status,
  ctlChange,
  rampRate,
  rampRateRisk,
  weeklyLoad,
  optimalRange,
}: LoadStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Fitness (CTL) */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <Heart className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Fitness</span>
        </div>
        <p className="text-2xl font-bold text-emerald-400">{currentCtl.toFixed(0)}</p>
        <p className="text-[10px] text-textTertiary mt-0.5">{getCtlLabel(currentCtl)}</p>
        {ctlChange !== null && (
          <p className={cn('text-[10px] mt-0.5', ctlChange >= 0 ? 'text-dream-400' : 'text-rose-400')}>
            {ctlChange >= 0 ? '+' : ''}{ctlChange.toFixed(1)} / 4wk
          </p>
        )}
      </div>

      {/* Fatigue (ATL) */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <Activity className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Fatigue</span>
        </div>
        <p className="text-2xl font-bold text-stone-400">{currentAtl.toFixed(0)}</p>
        <p className="text-[10px] text-textTertiary mt-0.5">{getAtlLabel(currentAtl, currentCtl)}</p>
      </div>

      {/* Form (TSB) */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <Zap className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Form</span>
        </div>
        <p className={cn('text-2xl font-bold', getTsbColor(currentTsb))}>{currentTsb.toFixed(0)}</p>
        <p className="text-[10px] text-textTertiary mt-0.5">{getTsbLabel(currentTsb)}</p>
      </div>

      {/* Status */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <Gauge className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Status</span>
        </div>
        <p className={cn('text-lg font-semibold', status.color)}>{status.label}</p>
      </div>

      {/* CTL Ramp Rate */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Ramp Rate</span>
        </div>
        {rampRate !== null ? (
          <>
            <p className={cn('text-2xl font-bold', rampRateRisk.color)}>
              {rampRate > 0 ? '+' : ''}{rampRate.toFixed(1)}
            </p>
            <p className={cn('text-[10px] mt-0.5', rampRateRisk.color)}>{rampRateRisk.label}</p>
          </>
        ) : (
          <p className="text-2xl font-bold text-textTertiary">--</p>
        )}
      </div>

      {/* Weekly Load */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-textTertiary mb-1">
          <Target className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium uppercase tracking-wide">7-Day Load</span>
        </div>
        <p className="text-2xl font-bold text-textPrimary">{weeklyLoad}</p>
        <p className="text-[10px] text-textTertiary mt-0.5">
          Target: {optimalRange.min}&#8211;{optimalRange.max}
        </p>
      </div>
    </div>
  );
}
