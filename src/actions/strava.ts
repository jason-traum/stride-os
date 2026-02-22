// Re-export all public APIs from focused modules.
// This file preserves backward compatibility — callers can continue importing from './strava'.
// Note: No 'use server' here — each sub-module has its own directive.

// Auth & connection management
export {
  getStravaStatus,
  connectStrava,
  disconnectStrava,
  setStravaAutoSync,
} from './strava-auth';
export type { StravaConnectionStatus } from './strava-auth';

// Activity import & sync
export { syncStravaActivities } from './strava-import';

// Backfill & resync operations
export {
  syncStravaLaps,
  syncStravaWorkoutStreams,
  resyncWorkoutLaps,
  getLapSyncHealth,
  backfillPolylines,
} from './strava-backfill';

// Stream & HR zone data retrieval
export {
  getWorkoutHRZones,
  getWorkoutStreams,
} from './strava-streams';
