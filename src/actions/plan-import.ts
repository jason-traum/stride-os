'use server';

import { db, plannedWorkouts, races } from '@/lib/db';
import { getActiveProfileId } from '@/lib/profile-server';
import { eq } from 'drizzle-orm';

export interface ImportedWorkout {
  date: string;
  name: string;
  description?: string;
  workoutType: string;
  targetDistanceMiles?: number;
  targetDurationMinutes?: number;
  targetPaceSecondsPerMile?: number;
  isKeyWorkout?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  startDate: string | null;
  endDate: string | null;
}

/**
 * Parse workout type from various naming conventions
 */
function parseWorkoutType(name: string, description?: string): string {
  const text = `${name} ${description || ''}`.toLowerCase();

  if (text.includes('rest') || text.includes('off')) return 'rest';
  if (text.includes('race') || text.includes('goal race')) return 'race';
  if (text.includes('interval') || text.includes('repeat') || text.includes('track')) return 'interval';
  if (text.includes('tempo')) return 'tempo';
  if (text.includes('threshold') || text.includes('lt run')) return 'threshold';
  if (text.includes('long run') || text.includes('long ')) return 'long';
  if (text.includes('recovery')) return 'recovery';
  if (text.includes('fartlek')) return 'fartlek';
  if (text.includes('progression')) return 'progression';
  if (text.includes('hill')) return 'hill_repeats';
  if (text.includes('easy') || text.includes('base')) return 'easy';
  if (text.includes('shakeout')) return 'shakeout';
  if (text.includes('cross') || text.includes('xt') || text.includes('strength')) return 'cross_train';

  return 'easy'; // Default
}

/**
 * Parse distance from text (e.g., "5 miles", "10k", "8mi")
 */
function parseDistance(text: string): number | undefined {
  // Try to find distance patterns
  const milesMatch = text.match(/(\d+(?:\.\d+)?)\s*(mi(?:les?)?|m\b)/i);
  if (milesMatch) {
    return parseFloat(milesMatch[1]);
  }

  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*k(?:m)?(?:\s|$)/i);
  if (kmMatch) {
    return parseFloat(kmMatch[1]) * 0.621371;
  }

  // Just a number might be miles
  const numberMatch = text.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }

  return undefined;
}

/**
 * Parse duration from text (e.g., "45 min", "1:30:00", "90 minutes")
 */
function parseDuration(text: string): number | undefined {
  // HH:MM:SS or MM:SS format
  const timeMatch = text.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = timeMatch[3] ? parseInt(timeMatch[1]) : 0;
    const minutes = timeMatch[3] ? parseInt(timeMatch[2]) : parseInt(timeMatch[1]);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : parseInt(timeMatch[2]);
    return hours * 60 + minutes + seconds / 60;
  }

  // "X min" or "X minutes"
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?|mins?)/i);
  if (minMatch) {
    return parseFloat(minMatch[1]);
  }

  // "X hours" or "X hr"
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  if (hourMatch) {
    return parseFloat(hourMatch[1]) * 60;
  }

  return undefined;
}

/**
 * Parse CSV content (TrainingPeaks, Final Surge, generic format)
 */
function parseCSV(content: string): ImportedWorkout[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const nameIdx = headers.findIndex(h => h.includes('title') || h.includes('name') || h.includes('workout'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('notes') || h.includes('details'));
  const distIdx = headers.findIndex(h => h.includes('distance') || h.includes('miles') || h.includes('km'));
  const durationIdx = headers.findIndex(h => h.includes('duration') || h.includes('time') || h.includes('length'));
  const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('category'));

  if (dateIdx === -1) {
    return [];
  }

  const workouts: ImportedWorkout[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic cases, not escaped commas in quotes)
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

    const dateStr = values[dateIdx];
    if (!dateStr) continue;

    // Parse date - support various formats
    let parsedDate: Date | null = null;
    try {
      // Try ISO format first
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        parsedDate = new Date(dateStr);
      }
      // MM/DD/YYYY
      else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const [month, day, year] = dateStr.split('/').map(Number);
        parsedDate = new Date(year, month - 1, day);
      }
      // DD/MM/YYYY (European)
      else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const [day, month, year] = dateStr.split('/').map(Number);
        parsedDate = new Date(2000 + year, month - 1, day);
      }
    } catch {
      continue;
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) continue;

    const name = nameIdx >= 0 ? values[nameIdx] : '';
    const description = descIdx >= 0 ? values[descIdx] : '';
    const distanceText = distIdx >= 0 ? values[distIdx] : '';
    const durationText = durationIdx >= 0 ? values[durationIdx] : '';
    const typeText = typeIdx >= 0 ? values[typeIdx] : '';

    // Skip rest days with no content
    if (!name && !distanceText && !durationText) continue;

    const workoutType = typeText
      ? parseWorkoutType(typeText, description)
      : parseWorkoutType(name, description);

    const workout: ImportedWorkout = {
      date: parsedDate.toISOString().split('T')[0],
      name: name || workoutType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: description || undefined,
      workoutType,
      targetDistanceMiles: parseDistance(distanceText) || parseDistance(name),
      targetDurationMinutes: parseDuration(durationText) || parseDuration(name),
      isKeyWorkout: ['interval', 'tempo', 'threshold', 'race', 'long'].includes(workoutType),
    };

    workouts.push(workout);
  }

  return workouts;
}

/**
 * Parse ICS (iCalendar) format
 */
function parseICS(content: string): ImportedWorkout[] {
  const workouts: ImportedWorkout[] = [];
  const events = content.split('BEGIN:VEVENT');

  for (const event of events.slice(1)) {
    const lines = event.split('\n');

    let date = '';
    let name = '';
    let description = '';

    for (const line of lines) {
      if (line.startsWith('DTSTART')) {
        const dateMatch = line.match(/(\d{8})/);
        if (dateMatch) {
          const d = dateMatch[1];
          date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        }
      } else if (line.startsWith('SUMMARY:')) {
        name = line.replace('SUMMARY:', '').trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        description = line.replace('DESCRIPTION:', '').trim().replace(/\\n/g, ' ');
      }
    }

    if (!date || !name) continue;

    const workoutType = parseWorkoutType(name, description);

    workouts.push({
      date,
      name,
      description: description || undefined,
      workoutType,
      targetDistanceMiles: parseDistance(name) || parseDistance(description),
      targetDurationMinutes: parseDuration(name) || parseDuration(description),
      isKeyWorkout: ['interval', 'tempo', 'threshold', 'race', 'long'].includes(workoutType),
    });
  }

  return workouts;
}

/**
 * Import a training plan from file content
 */
export async function importTrainingPlan(
  content: string,
  format: 'csv' | 'ics' | 'auto',
  options: {
    raceId?: number;
    clearExisting?: boolean;
  } = {}
): Promise<ImportResult> {
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: ['No active profile. Please complete onboarding first.'],
      startDate: null,
      endDate: null,
    };
  }

  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
    startDate: null,
    endDate: null,
  };

  try {
    // Detect format if auto
    let detectedFormat = format;
    if (format === 'auto') {
      if (content.includes('BEGIN:VCALENDAR')) {
        detectedFormat = 'ics';
      } else {
        detectedFormat = 'csv';
      }
    }

    // Parse content
    const workouts = detectedFormat === 'ics'
      ? parseICS(content)
      : parseCSV(content);

    if (workouts.length === 0) {
      result.errors.push('No valid workouts found in the file');
      return result;
    }

    // Sort by date
    workouts.sort((a, b) => a.date.localeCompare(b.date));

    result.startDate = workouts[0].date;
    result.endDate = workouts[workouts.length - 1].date;

    // Clear existing if requested
    if (options.clearExisting && options.raceId) {
      await db.delete(plannedWorkouts)
        .where(eq(plannedWorkouts.raceId, options.raceId));
    }

    // Get the race if specified
    let race = null;
    if (options.raceId) {
      race = await db.query.races.findFirst({
        where: eq(races.id, options.raceId),
      });
    }

    // Insert workouts
    for (const workout of workouts) {
      try {
        // Skip if it's after the race date
        if (race && workout.date > race.date) {
          result.skipped++;
          continue;
        }

        await db.insert(plannedWorkouts).values({
          raceId: options.raceId || null,
          profileId: profileId,
          date: workout.date,
          name: workout.name,
          description: workout.description || null,
          workoutType: workout.workoutType as any,
          targetDistanceMiles: workout.targetDistanceMiles || null,
          targetDurationMinutes: workout.targetDurationMinutes || null,
          targetPaceSecondsPerMile: workout.targetPaceSecondsPerMile || null,
          isKeyWorkout: workout.isKeyWorkout || false,
          status: 'pending',
          source: 'import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        result.imported++;
      } catch (e) {
        result.skipped++;
        result.errors.push(`Failed to import workout on ${workout.date}: ${e}`);
      }
    }

    result.success = result.imported > 0;

  } catch (e) {
    result.errors.push(`Import failed: ${e}`);
  }

  return result;
}

/**
 * Preview what would be imported (without saving)
 */
export async function previewImport(
  content: string,
  format: 'csv' | 'ics' | 'auto'
): Promise<{ workouts: ImportedWorkout[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    let detectedFormat = format;
    if (format === 'auto') {
      if (content.includes('BEGIN:VCALENDAR')) {
        detectedFormat = 'ics';
      } else {
        detectedFormat = 'csv';
      }
    }

    const workouts = detectedFormat === 'ics'
      ? parseICS(content)
      : parseCSV(content);

    if (workouts.length === 0) {
      errors.push('No valid workouts found in the file');
    }

    return { workouts, errors };
  } catch (e) {
    errors.push(`Parse failed: ${e}`);
    return { workouts: [], errors };
  }
}
