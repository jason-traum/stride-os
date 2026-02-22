// Chart wrapper system
export {
  ChartWrapper,
  ChartSkeleton,
  ChartEmptyState,
  ChartLegend,
  ChartStatRow,
  CHART_TIME_RANGES,
} from './ChartWrapper';
export type {
  ChartWrapperProps,
  ChartTimeRange,
  ChartLegendItem,
  ChartStat,
} from './ChartWrapper';

// Chart color palette
export {
  CHART_SERIES_COLORS,
  CHART_SEMANTIC_COLORS,
  CHART_GRADIENTS,
  RECHARTS_THEME,
  getSeriesColor,
  getSeriesColors,
} from './chart-colors';

// Existing chart components
export { WeeklyMileageChart, SkeletonChart } from './WeeklyMileageChart';
export { FitnessTrendChart } from './FitnessTrendChart';
export { TrainingLoadBar } from './TrainingLoadBar';
export { PaceTrendChart } from './PaceTrendChart';
export { ActivityHeatmap } from './ActivityHeatmap';
export { TrainingFocusChart } from './TrainingFocusChart';
