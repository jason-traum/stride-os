'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getPredictionDashboardData } from '@/actions/prediction-dashboard';
import type { PredictionDashboardData } from '@/actions/prediction-dashboard';
import { Vo2maxTimelineChart, EfficiencyFactorChart, PaceHrScatterChart } from '@/components/charts';

export function PerformanceCharts() {
  const [data, setData] = useState<PredictionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const result = await getPredictionDashboardData();
      if (result.success && result.data.data) {
        setData(result.data.data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
      </div>
    );
  }

  if (!data || data.signalTimeline.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Vo2maxTimelineChart
        signalTimeline={data.signalTimeline}
        blendedVdot={data.prediction.vdot}
      />
      <EfficiencyFactorChart signalTimeline={data.signalTimeline} />
      <PaceHrScatterChart signalTimeline={data.signalTimeline} />
    </div>
  );
}
