/**
 * Activity File Parser
 *
 * Parses GPX and FIT(.gz) activity files from a Strava bulk export to extract
 * GPS coordinates, heart rate, cadence, elevation, and timing data.
 *
 * Produces stream data in the same format used by the workoutStreams table,
 * plus encoded polylines for route maps.
 *
 * GPX parsing is done with a lightweight regex/string parser (no XML library needed).
 * FIT parsing requires the `fit-file-parser` npm package; if unavailable, FIT files
 * are skipped with a warning.
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackPoint {
  lat: number;
  lon: number;
  elevation: number; // meters
  time: Date;
  heartRate?: number;
  cadence?: number;
}

export interface ParsedActivity {
  /** Source file path */
  filePath: string;
  /** File format */
  format: 'gpx' | 'fit';
  /** Parsed trackpoints */
  trackpoints: TrackPoint[];
  /** Activity name from the file (if available) */
  name?: string;
  /** Activity type from the file (if available) */
  type?: string;
}

export interface ActivityStreams {
  /** Seconds from start */
  time: number[];
  /** Cumulative distance in miles */
  distanceMiles: number[];
  /** Heart rate in BPM */
  heartrate: number[];
  /** Pace in seconds per mile */
  paceSecondsPerMile: number[];
  /** Altitude in feet */
  altitudeFeet: number[];
  /** Lat/lon pairs */
  latlng: [number, number][];
  /** Max HR observed */
  maxHr: number;
  /** Total distance in miles */
  totalDistanceMiles: number;
  /** Total elevation gain in feet */
  elevationGainFeet: number;
  /** Total elevation loss in feet */
  elevationLossFeet: number;
  /** Total duration in seconds */
  totalDurationSeconds: number;
  /** Average pace in seconds per mile (overall) */
  avgPaceSecondsPerMile: number;
  /** Encoded polyline string for route maps */
  polyline: string;
  /** Sample count */
  sampleCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
const EARTH_RADIUS_METERS = 6371000;

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// ---------------------------------------------------------------------------
// Google Encoded Polyline Algorithm
// ---------------------------------------------------------------------------

function encodePolylineValue(value: number): string {
  // Round to 5 decimal places then multiply by 1e5
  let v = Math.round(value * 1e5);
  // Two's complement for negatives
  if (v < 0) {
    v = ~v + 1;
    v = (v << 1) - 1;
  } else {
    v = v << 1;
  }
  // Break into 5-bit chunks and add 63
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

/**
 * Encode an array of [lat, lon] pairs into a Google encoded polyline string.
 * Downsamples if there are too many points (keeps the string reasonable).
 */
export function encodePolyline(
  points: [number, number][],
  maxPoints: number = 2000,
): string {
  if (points.length === 0) return '';

  // Downsample if needed
  let sampled = points;
  if (points.length > maxPoints) {
    const step = points.length / maxPoints;
    sampled = [];
    for (let i = 0; i < maxPoints; i++) {
      sampled.push(points[Math.floor(i * step)]);
    }
    // Always include last point
    sampled.push(points[points.length - 1]);
  }

  let encoded = '';
  let prevLat = 0;
  let prevLon = 0;

  for (const [lat, lon] of sampled) {
    encoded += encodePolylineValue(lat - prevLat);
    encoded += encodePolylineValue(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }

  return encoded;
}

// ---------------------------------------------------------------------------
// GPX Parser (regex-based, no XML library needed)
// ---------------------------------------------------------------------------

/**
 * Parse a GPX XML string into trackpoints.
 *
 * Strava GPX format:
 *   <trkpt lat="40.7322960" lon="-74.0102840">
 *     <ele>3.0</ele>
 *     <time>2023-05-08T22:30:42Z</time>
 *     <extensions>
 *       <gpxtpx:TrackPointExtension>
 *         <gpxtpx:hr>143</gpxtpx:hr>
 *         <gpxtpx:cad>85</gpxtpx:cad>
 *       </gpxtpx:TrackPointExtension>
 *     </extensions>
 *   </trkpt>
 */
export function parseGpxContent(xml: string): ParsedActivity {
  const trackpoints: TrackPoint[] = [];

  // Extract activity name
  const nameMatch = xml.match(/<trk>\s*<name>([^<]*)<\/name>/);
  const name = nameMatch ? nameMatch[1] : undefined;

  // Extract activity type
  const typeMatch = xml.match(/<type>([^<]*)<\/type>/);
  const type = typeMatch ? typeMatch[1] : undefined;

  // Match all trackpoints
  const trkptRegex =
    /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)">([\s\S]*?)<\/trkpt>/g;

  let match;
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const body = match[3];

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    // Elevation
    const eleMatch = body.match(/<ele>([^<]+)<\/ele>/);
    const elevation = eleMatch ? parseFloat(eleMatch[1]) : 0;

    // Time
    const timeMatch = body.match(/<time>([^<]+)<\/time>/);
    if (!timeMatch) continue;
    const time = new Date(timeMatch[1]);
    if (isNaN(time.getTime())) continue;

    // Heart rate (in extensions)
    const hrMatch = body.match(/<gpxtpx:hr>([^<]+)<\/gpxtpx:hr>/);
    const heartRate = hrMatch ? parseInt(hrMatch[1], 10) : undefined;

    // Cadence (in extensions, less common in Strava GPX)
    const cadMatch = body.match(/<gpxtpx:cad>([^<]+)<\/gpxtpx:cad>/);
    const cadence = cadMatch ? parseInt(cadMatch[1], 10) : undefined;

    trackpoints.push({
      lat,
      lon,
      elevation: Number.isFinite(elevation) ? elevation : 0,
      time,
      heartRate:
        heartRate !== undefined && Number.isFinite(heartRate)
          ? heartRate
          : undefined,
      cadence:
        cadence !== undefined && Number.isFinite(cadence)
          ? cadence
          : undefined,
    });
  }

  return {
    filePath: '',
    format: 'gpx',
    trackpoints,
    name,
    type,
  };
}

// ---------------------------------------------------------------------------
// FIT Parser
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fitParserModule: any = undefined; // undefined = not yet tried

function tryLoadFitParser(): boolean {
  if (fitParserModule !== undefined) return fitParserModule !== null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fitParserModule = require('fit-file-parser');
    return true;
  } catch {
    fitParserModule = null;
    return false;
  }
}

interface FitRecord {
  timestamp?: Date | string;
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  heart_rate?: number;
  cadence?: number;
  distance?: number;
}

interface FitSession {
  sport?: string;
}

/**
 * Parse a FIT file buffer into trackpoints.
 */
export function parseFitBuffer(buffer: Buffer): Promise<ParsedActivity> {
  return new Promise((resolve, reject) => {
    if (!tryLoadFitParser()) {
      reject(
        new Error(
          'fit-file-parser package not installed. Install with: npm install fit-file-parser',
        ),
      );
      return;
    }

    const FitParser = fitParserModule.default || fitParserModule;
    const parser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'km',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list',
    });

    parser.parse(buffer, (err: Error | undefined, data: { records?: FitRecord[]; sessions?: FitSession[] }) => {
      if (err) {
        reject(err);
        return;
      }

      const trackpoints: TrackPoint[] = [];
      let activityType: string | undefined;

      // Extract activity type from sessions
      if (data.sessions && data.sessions.length > 0) {
        activityType = data.sessions[0].sport;
      }

      // Extract records
      if (data.records) {
        for (const rec of data.records) {
          if (
            rec.position_lat === undefined ||
            rec.position_long === undefined
          ) {
            continue;
          }

          const lat = rec.position_lat;
          const lon = rec.position_long;

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat === 0 ||
            lon === 0
          ) {
            continue;
          }

          const elevation =
            rec.enhanced_altitude ?? rec.altitude ?? 0;
          const time =
            rec.timestamp instanceof Date
              ? rec.timestamp
              : new Date(rec.timestamp || 0);

          if (isNaN(time.getTime())) continue;

          trackpoints.push({
            lat,
            lon,
            elevation: Number.isFinite(elevation) ? elevation : 0,
            time,
            heartRate:
              rec.heart_rate !== undefined &&
              Number.isFinite(rec.heart_rate)
                ? rec.heart_rate
                : undefined,
            cadence:
              rec.cadence !== undefined && Number.isFinite(rec.cadence)
                ? rec.cadence
                : undefined,
          });
        }
      }

      resolve({
        filePath: '',
        format: 'fit',
        trackpoints,
        type: activityType,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// File Loading
// ---------------------------------------------------------------------------

/**
 * Read and decompress a file. Handles .gpx, .fit, and .fit.gz extensions.
 */
export function readActivityFileBuffer(filePath: string): Buffer {
  const ext = filePath.toLowerCase();

  if (ext.endsWith('.gz')) {
    const compressed = fs.readFileSync(filePath);
    return zlib.gunzipSync(compressed);
  }

  return fs.readFileSync(filePath);
}

/**
 * Detect file format from extension.
 */
export function detectFormat(
  filePath: string,
): 'gpx' | 'fit' | 'unknown' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.gpx') || lower.endsWith('.gpx.gz')) return 'gpx';
  if (lower.endsWith('.fit') || lower.endsWith('.fit.gz')) return 'fit';
  return 'unknown';
}

/**
 * Parse an activity file (GPX or FIT/FIT.gz) from disk.
 */
export async function parseActivityFile(
  filePath: string,
): Promise<ParsedActivity> {
  const format = detectFormat(filePath);

  if (format === 'unknown') {
    throw new Error(`Unknown file format: ${filePath}`);
  }

  const buffer = readActivityFileBuffer(filePath);

  if (format === 'gpx') {
    const result = parseGpxContent(buffer.toString('utf-8'));
    result.filePath = filePath;
    return result;
  }

  // FIT format
  const result = await parseFitBuffer(buffer);
  result.filePath = filePath;
  return result;
}

// ---------------------------------------------------------------------------
// Stream Builder
// ---------------------------------------------------------------------------

/**
 * Convert parsed trackpoints into stream arrays matching the workoutStreams
 * table format, plus compute summary metrics and generate a polyline.
 */
export function buildStreams(trackpoints: TrackPoint[]): ActivityStreams | null {
  if (trackpoints.length < 2) return null;

  const startTime = trackpoints[0].time.getTime();

  const time: number[] = [];
  const distanceMiles: number[] = [];
  const heartrate: number[] = [];
  const paceSecondsPerMile: number[] = [];
  const altitudeFeet: number[] = [];
  const latlng: [number, number][] = [];

  let cumulativeDistanceMeters = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let maxHr = 0;

  // Smoothing window for pace calculation (avoid spikes from GPS jitter)
  const PACE_WINDOW = 5; // seconds minimum between pace samples

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    const elapsedSeconds = (tp.time.getTime() - startTime) / 1000;

    // Skip negative or duplicate timestamps
    if (i > 0 && elapsedSeconds <= time[time.length - 1]) continue;

    time.push(elapsedSeconds);

    // Distance
    if (i > 0) {
      const prev = trackpoints[i - 1];
      const segmentMeters = haversineMeters(
        prev.lat,
        prev.lon,
        tp.lat,
        tp.lon,
      );
      // Filter out GPS jumps (> 100m in 1 second is unrealistic for running)
      const dt = elapsedSeconds - time[time.length - 2];
      if (dt > 0 && segmentMeters / dt > 100) {
        // GPS spike -- use previous distance
        distanceMiles.push(cumulativeDistanceMeters / METERS_PER_MILE);
      } else {
        cumulativeDistanceMeters += segmentMeters;
        distanceMiles.push(cumulativeDistanceMeters / METERS_PER_MILE);
      }
    } else {
      distanceMiles.push(0);
    }

    // Heart rate
    if (tp.heartRate !== undefined) {
      heartrate.push(tp.heartRate);
      if (tp.heartRate > maxHr) maxHr = tp.heartRate;
    } else {
      heartrate.push(0);
    }

    // Altitude
    altitudeFeet.push(tp.elevation / METERS_PER_FOOT);

    // Elevation gain/loss
    if (i > 0) {
      const elevDiff = tp.elevation - trackpoints[i - 1].elevation;
      // Use a small threshold to filter noise (0.5m)
      if (elevDiff > 0.5) {
        elevationGainMeters += elevDiff;
      } else if (elevDiff < -0.5) {
        elevationLossMeters += Math.abs(elevDiff);
      }
    }

    // Pace (seconds per mile) -- use a lookback window for smoothing
    if (i > 0 && distanceMiles.length >= 2) {
      // Find the point PACE_WINDOW seconds ago
      let lookbackIdx = distanceMiles.length - 2;
      const currentTime = elapsedSeconds;
      while (
        lookbackIdx > 0 &&
        currentTime - time[lookbackIdx] < PACE_WINDOW
      ) {
        lookbackIdx--;
      }

      const distDelta =
        distanceMiles[distanceMiles.length - 1] -
        distanceMiles[lookbackIdx];
      const timeDelta = currentTime - time[lookbackIdx];

      if (distDelta > 0.0001 && timeDelta > 0) {
        // seconds per mile = timeDelta / distDelta
        const pace = timeDelta / distDelta;
        // Clamp to reasonable range (3:00/mi to 30:00/mi)
        paceSecondsPerMile.push(
          Math.min(Math.max(pace, 180), 1800),
        );
      } else {
        paceSecondsPerMile.push(0);
      }
    } else {
      paceSecondsPerMile.push(0);
    }

    // Lat/lon
    latlng.push([tp.lat, tp.lon]);
  }

  // Filter out placeholder zeros from heartrate if no HR data at all
  const hasAnyHr = heartrate.some((h) => h > 0);
  const finalHr = hasAnyHr ? heartrate : [];

  // Overall stats
  const totalDistanceMiles =
    cumulativeDistanceMeters / METERS_PER_MILE;
  const totalDurationSeconds = time[time.length - 1];
  const avgPaceSecondsPerMile =
    totalDistanceMiles > 0
      ? totalDurationSeconds / totalDistanceMiles
      : 0;

  // Generate polyline
  const polyline = encodePolyline(latlng);

  return {
    time,
    distanceMiles,
    heartrate: finalHr,
    paceSecondsPerMile,
    altitudeFeet,
    latlng,
    maxHr,
    totalDistanceMiles,
    elevationGainFeet: elevationGainMeters / METERS_PER_FOOT,
    elevationLossFeet: elevationLossMeters / METERS_PER_FOOT,
    totalDurationSeconds,
    avgPaceSecondsPerMile,
    polyline,
    sampleCount: time.length,
  };
}

// ---------------------------------------------------------------------------
// High-level convenience
// ---------------------------------------------------------------------------

/**
 * Parse an activity file and return ready-to-store streams.
 */
export async function parseActivityFileToStreams(
  filePath: string,
): Promise<{
  parsed: ParsedActivity;
  streams: ActivityStreams | null;
}> {
  const parsed = await parseActivityFile(filePath);
  const streams = buildStreams(parsed.trackpoints);
  return { parsed, streams };
}

/**
 * Check if the FIT parser is available.
 */
export function isFitParserAvailable(): boolean {
  return tryLoadFitParser();
}

/**
 * List supported file types from a directory.
 */
export function listActivityFiles(dirPath: string): {
  gpx: string[];
  fit: string[];
  fitGz: string[];
  unknown: string[];
} {
  const files = fs.readdirSync(dirPath);
  const result = {
    gpx: [] as string[],
    fit: [] as string[],
    fitGz: [] as string[],
    unknown: [] as string[],
  };

  for (const file of files) {
    const lower = file.toLowerCase();
    const fullPath = path.join(dirPath, file);

    if (lower.endsWith('.gpx')) {
      result.gpx.push(fullPath);
    } else if (lower.endsWith('.fit.gz')) {
      result.fitGz.push(fullPath);
    } else if (lower.endsWith('.fit')) {
      result.fit.push(fullPath);
    } else if (lower.endsWith('.gpx.gz')) {
      result.gpx.push(fullPath);
    } else {
      result.unknown.push(fullPath);
    }
  }

  return result;
}
