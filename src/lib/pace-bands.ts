/**
 * Pace Band Generator
 * Creates printable pace bands for races with split times
 */

import { formatPace } from '@/lib/utils';

export interface PaceBandConfig {
  raceDistance: 'marathon' | 'half' | '10k' | '5k' | 'custom';
  customDistanceMiles?: number;
  targetTimeSeconds: number;
  strategy: 'even' | 'negative' | 'positive' | 'custom';
  customSplits?: number[]; // Percentage of goal pace for each segment
  splitInterval: '1mi' | '5k' | '1k';
  includeFadeZone?: boolean; // Account for GPS/timing mat differences
}

export interface PaceBandSplit {
  distance: string;
  distanceMiles: number;
  elapsedTime: string;
  elapsedSeconds: number;
  splitTime: string;
  splitSeconds: number;
  pace: string;
  paceSeconds: number;
  notes?: string;
}

export interface PaceBand {
  config: PaceBandConfig;
  targetTime: string;
  targetPace: string;
  averagePaceSeconds: number;
  splits: PaceBandSplit[];
  summary: {
    firstHalfTime: string;
    secondHalfTime: string;
    negativeSplitSeconds: number;
  };
}

const RACE_DISTANCES = {
  marathon: 26.2188,
  half: 13.1094,
  '10k': 6.21371,
  '5k': 3.10686,
};

function formatTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSplitDistances(totalMiles: number, interval: string): number[] {
  const distances: number[] = [];

  if (interval === '1mi') {
    for (let i = 1; i <= Math.floor(totalMiles); i++) {
      distances.push(i);
    }
    if (totalMiles % 1 > 0.1) {
      distances.push(totalMiles);
    }
  } else if (interval === '5k') {
    const kmTotal = totalMiles * 1.60934;
    for (let km = 5; km <= kmTotal; km += 5) {
      distances.push(km / 1.60934);
    }
    if (distances[distances.length - 1] < totalMiles - 0.1) {
      distances.push(totalMiles);
    }
  } else if (interval === '1k') {
    const kmTotal = totalMiles * 1.60934;
    for (let km = 1; km <= kmTotal; km++) {
      distances.push(km / 1.60934);
    }
    if (distances[distances.length - 1] < totalMiles - 0.05) {
      distances.push(totalMiles);
    }
  }

  return distances;
}

function getPaceMultipliers(
  strategy: PaceBandConfig['strategy'],
  numSplits: number,
  customSplits?: number[]
): number[] {
  if (strategy === 'custom' && customSplits) {
    return customSplits.map(pct => pct / 100);
  }

  const multipliers: number[] = [];

  switch (strategy) {
    case 'even':
      return new Array(numSplits).fill(1.0);

    case 'negative':
      // Start 2-3% slower, end 2-3% faster
      for (let i = 0; i < numSplits; i++) {
        const progress = i / (numSplits - 1);
        const multiplier = 1.03 - (0.06 * progress); // 103% to 97%
        multipliers.push(multiplier);
      }
      return multipliers;

    case 'positive':
      // Start 2-3% faster, end 2-3% slower (usually not recommended)
      for (let i = 0; i < numSplits; i++) {
        const progress = i / (numSplits - 1);
        const multiplier = 0.97 + (0.06 * progress); // 97% to 103%
        multipliers.push(multiplier);
      }
      return multipliers;

    default:
      return new Array(numSplits).fill(1.0);
  }
}

function addRaceSpecificNotes(
  splits: PaceBandSplit[],
  raceDistance: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  totalMiles: number
): void {
  // Add notes for key race milestones
  if (raceDistance === 'marathon') {
    const mile10 = splits.find(s => Math.abs(s.distanceMiles - 10) < 0.1);
    if (mile10) mile10.notes = 'Settle in, should feel easy';

    const halfwayMile = splits.find(s => Math.abs(s.distanceMiles - 13.1) < 0.2);
    if (halfwayMile) halfwayMile.notes = 'Halfway! Check nutrition';

    const mile18 = splits.find(s => Math.abs(s.distanceMiles - 18) < 0.1);
    if (mile18) mile18.notes = 'Stay focused, tough miles ahead';

    const mile20 = splits.find(s => Math.abs(s.distanceMiles - 20) < 0.1);
    if (mile20) mile20.notes = 'The real race starts now';

    const mile24 = splits.find(s => Math.abs(s.distanceMiles - 24) < 0.1);
    if (mile24) mile24.notes = 'Dig deep, almost there!';
  } else if (raceDistance === 'half') {
    const mile5 = splits.find(s => Math.abs(s.distanceMiles - 5) < 0.1);
    if (mile5) mile5.notes = 'Rhythm locked in?';

    const mile8 = splits.find(s => Math.abs(s.distanceMiles - 8) < 0.1);
    if (mile8) mile8.notes = 'Push through the middle';

    const mile10 = splits.find(s => Math.abs(s.distanceMiles - 10) < 0.1);
    if (mile10) mile10.notes = 'Final 5K - time to work';

    const mile12 = splits.find(s => Math.abs(s.distanceMiles - 12) < 0.1);
    if (mile12) mile12.notes = 'Empty the tank!';
  }
}

export function generatePaceBand(config: PaceBandConfig): PaceBand {
  // Determine total distance
  const totalMiles = config.raceDistance === 'custom' && config.customDistanceMiles
    ? config.customDistanceMiles
    : RACE_DISTANCES[config.raceDistance as keyof typeof RACE_DISTANCES];

  if (!totalMiles) {
    throw new Error('Invalid race distance configuration');
  }

  // Calculate average pace
  const averagePaceSeconds = config.targetTimeSeconds / totalMiles;

  // Get split points
  const splitDistances = getSplitDistances(totalMiles, config.splitInterval);

  // Get pace multipliers for the strategy
  const paceMultipliers = getPaceMultipliers(
    config.strategy,
    splitDistances.length,
    config.customSplits
  );

  // Generate splits
  const splits: PaceBandSplit[] = [];
  let cumulativeSeconds = 0;
  let previousDistance = 0;

  splitDistances.forEach((distance, idx) => {
    const segmentDistance = distance - previousDistance;
    const paceMultiplier = paceMultipliers[Math.min(idx, paceMultipliers.length - 1)];
    const segmentPaceSeconds = averagePaceSeconds * paceMultiplier;
    const segmentTimeSeconds = segmentDistance * segmentPaceSeconds;

    cumulativeSeconds += segmentTimeSeconds;

    // Format distance label
    let distanceLabel: string;
    if (config.splitInterval === '1k') {
      const km = Math.round(distance * 1.60934);
      distanceLabel = `${km}k`;
    } else if (config.splitInterval === '5k') {
      const km = Math.round(distance * 1.60934);
      distanceLabel = `${km}k`;
    } else {
      // Handle fractional miles nicely
      if (distance % 1 === 0) {
        distanceLabel = `Mile ${distance}`;
      } else {
        distanceLabel = `${distance.toFixed(1)} mi`;
      }
    }

    splits.push({
      distance: distanceLabel,
      distanceMiles: distance,
      elapsedTime: formatTime(cumulativeSeconds),
      elapsedSeconds: cumulativeSeconds,
      splitTime: formatTime(segmentTimeSeconds),
      splitSeconds: segmentTimeSeconds,
      pace: formatPace(segmentPaceSeconds),
      paceSeconds: segmentPaceSeconds,
    });

    previousDistance = distance;
  });

  // Add race-specific notes
  addRaceSpecificNotes(splits, config.raceDistance, totalMiles);

  // Add fade zone if requested (account for GPS being slightly long)
  if (config.includeFadeZone && splits.length > 0) {
    const lastSplit = splits[splits.length - 1];
    const fadeSeconds = totalMiles * 0.005 * averagePaceSeconds; // 0.5% extra distance

    splits.push({
      distance: 'Finish (GPS)',
      distanceMiles: totalMiles * 1.005,
      elapsedTime: formatTime(lastSplit.elapsedSeconds + fadeSeconds),
      elapsedSeconds: lastSplit.elapsedSeconds + fadeSeconds,
      splitTime: formatTime(fadeSeconds),
      splitSeconds: fadeSeconds,
      pace: formatPace(averagePaceSeconds),
      paceSeconds: averagePaceSeconds,
      notes: 'GPS fade allowance',
    });
  }

  // Calculate summary stats
  const halfwayIdx = Math.floor(splits.length / 2);
  const firstHalfTime = splits[halfwayIdx - 1]?.elapsedSeconds || 0;
  const secondHalfTime = config.targetTimeSeconds - firstHalfTime;

  return {
    config,
    targetTime: formatTime(config.targetTimeSeconds),
    targetPace: formatPace(averagePaceSeconds),
    averagePaceSeconds,
    splits,
    summary: {
      firstHalfTime: formatTime(firstHalfTime),
      secondHalfTime: formatTime(secondHalfTime),
      negativeSplitSeconds: firstHalfTime - secondHalfTime,
    },
  };
}

// Export function to create a printable HTML version
export function generatePaceBandHTML(band: PaceBand, userName?: string): string {
  const date = new Date().toLocaleDateString();

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Pace Band - ${band.config.raceDistance.toUpperCase()} - ${band.targetTime}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 20px;
      font-size: 14px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .pace { font-weight: 600; }
    .notes { font-size: 12px; color: #666; font-style: italic; }
    .summary {
      background-color: #f0f9ff;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    @media print {
      body { margin: 10px; }
      .no-print { display: none; }
    }
    .cut-line {
      border: 1px dashed #999;
      margin: 30px -20px;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="cut-line">
    <div class="header">
      <h1>${band.config.raceDistance.toUpperCase()} Pace Band</h1>
      <p><strong>Target:</strong> ${band.targetTime} (${band.targetPace}/mi avg)</p>
      <p><strong>Strategy:</strong> ${band.config.strategy} split</p>
      ${userName ? `<p><strong>Runner:</strong> ${userName}</p>` : ''}
      <p><strong>Date:</strong> ${date}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Split</th>
          <th>Time</th>
          <th>Pace</th>
          ${band.splits.some(s => s.notes) ? '<th>Notes</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${band.splits.map(split => `
          <tr>
            <td><strong>${split.distance}</strong></td>
            <td>${split.elapsedTime}</td>
            <td class="pace">${split.pace}</td>
            ${band.splits.some(s => s.notes) ? `<td class="notes">${split.notes || ''}</td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <strong>Split Analysis:</strong><br>
      First Half: ${band.summary.firstHalfTime}<br>
      Second Half: ${band.summary.secondHalfTime}<br>
      ${band.summary.negativeSplitSeconds > 0
        ? `Negative split by ${Math.round(Math.abs(band.summary.negativeSplitSeconds))} seconds ✓`
        : band.summary.negativeSplitSeconds < 0
        ? `Positive split by ${Math.round(Math.abs(band.summary.negativeSplitSeconds))} seconds`
        : 'Even split'}
    </div>
  </div>
</body>
</html>
  `;
}