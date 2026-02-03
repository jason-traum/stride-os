'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface ActivityData {
  date: string;
  miles: number;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
  months?: number; // How many months to show (default 12)
}

// Get color intensity based on miles
function getActivityColor(miles: number, maxMiles: number): string {
  if (miles === 0) return 'bg-slate-100';

  const intensity = miles / maxMiles;

  if (intensity < 0.25) return 'bg-blue-200';
  if (intensity < 0.5) return 'bg-blue-400';
  if (intensity < 0.75) return 'bg-blue-500';
  return 'bg-blue-600';
}

// Get day of week (0 = Sunday, 6 = Saturday)
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

// Format date for tooltip
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ActivityHeatmap({ data, months = 12 }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; miles: number; x: number; y: number } | null>(null);

  // Build the heatmap grid
  const { grid, weeks, maxMiles, totalMiles, activeDays, monthLabels } = useMemo(() => {
    // Create a map of date -> miles
    const dataMap = new Map<string, number>();
    for (const d of data) {
      const existing = dataMap.get(d.date) || 0;
      dataMap.set(d.date, existing + d.miles);
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    // Go back to the previous Sunday
    startDate.setDate(startDate.getDate() - getDayOfWeek(startDate));

    // Build grid (columns = weeks, rows = days of week)
    const weekList: Array<Array<{ date: string; miles: number } | null>> = [];
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let currentDate = new Date(startDate);
    let maxMilesVal = 0;
    let totalMilesVal = 0;
    let activeDaysCount = 0;
    let lastMonth = -1;
    let weekIndex = 0;

    while (currentDate <= endDate) {
      const week: Array<{ date: string; miles: number } | null> = [];

      // Track month changes for labels
      const currentMonth = currentDate.getMonth();
      if (currentMonth !== lastMonth) {
        labels.push({
          month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex,
        });
        lastMonth = currentMonth;
      }

      for (let day = 0; day < 7; day++) {
        const dayOfWeek = getDayOfWeek(currentDate);

        if (dayOfWeek === day && currentDate <= endDate && currentDate >= startDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const miles = dataMap.get(dateStr) || 0;

          week.push({ date: dateStr, miles });

          if (miles > 0) {
            activeDaysCount++;
            totalMilesVal += miles;
            maxMilesVal = Math.max(maxMilesVal, miles);
          }

          currentDate.setDate(currentDate.getDate() + 1);
        } else {
          week.push(null);
        }
      }

      weekList.push(week);
      weekIndex++;
    }

    return {
      grid: weekList,
      weeks: weekList.length,
      maxMiles: maxMilesVal || 10,
      totalMiles: Math.round(totalMilesVal * 10) / 10,
      activeDays: activeDaysCount,
      monthLabels: labels,
    };
  }, [data, months]);

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Activity Heatmap</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalMiles} miles over {activeDays} days
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-slate-100" />
          <div className="w-3 h-3 rounded-sm bg-blue-200" />
          <div className="w-3 h-3 rounded-sm bg-blue-400" />
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <div className="w-3 h-3 rounded-sm bg-blue-600" />
          <span>More</span>
        </div>
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-8">
        {monthLabels.map((label, i) => {
          // Calculate position based on week index
          const cellWidth = 10; // Approximate width per cell in pixels
          const left = label.weekIndex * cellWidth;
          return (
            <span
              key={i}
              className="text-[10px] text-slate-400 absolute"
              style={{
                marginLeft: `${(label.weekIndex / weeks) * 100}%`,
              }}
            >
              {label.month}
            </span>
          );
        })}
      </div>

      {/* Grid container */}
      <div className="flex overflow-x-auto">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-[10px] text-[9px] text-slate-400 leading-[10px]">
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div
          className="flex gap-[2px] relative"
          onMouseLeave={() => setHoveredDay(null)}
        >
          {grid.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[2px]">
              {week.map((day, dayIdx) => (
                <div
                  key={dayIdx}
                  className={cn(
                    'w-[10px] h-[10px] rounded-[2px] transition-all duration-150',
                    day ? getActivityColor(day.miles, maxMiles) : 'bg-transparent',
                    day ? 'cursor-pointer hover:ring-1 hover:ring-slate-400 hover:ring-offset-1' : ''
                  )}
                  onMouseEnter={(e) => {
                    if (day) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        date: day.date,
                        miles: day.miles,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }
                  }}
                />
              ))}
            </div>
          ))}

          {/* Tooltip */}
          {hoveredDay && (
            <div
              className="fixed bg-slate-900 text-white text-xs rounded-lg px-2 py-1.5 shadow-lg pointer-events-none z-50 whitespace-nowrap"
              style={{
                left: hoveredDay.x,
                top: hoveredDay.y - 35,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-medium">{formatDate(hoveredDay.date)}</div>
              <div>
                {hoveredDay.miles > 0
                  ? `${hoveredDay.miles.toFixed(1)} miles`
                  : 'No activity'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
