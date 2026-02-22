'use server';

// Re-export all public APIs from focused modules.
// This file preserves backward compatibility — callers can continue importing from './races'.

// CRUD operations for races and race results
export {
  getRaces,
  getUpcomingRaces,
  getRace,
  createRace,
  updateRace,
  deleteRace,
  getRaceResults,
  getRaceResult,
  createRaceResult,
  updateRaceResult,
  deleteRaceResult,
  getWorkoutsForRaceLinking,
} from './races-crud';

// Analysis, normalization, linking, VDOT
export {
  getRaceResultsWithContext,
  autoMatchRaceToResult,
  getUserPaceZones,
  backfillRaceLinks,
} from './races-analysis';
export type {
  RaceResultNormalization,
  RaceResultWithContext,
} from './races-analysis';
