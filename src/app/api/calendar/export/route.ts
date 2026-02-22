import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { plannedWorkouts } from '@/lib/schema';
import { gte, lte, and } from 'drizzle-orm';
import { formatPace } from '@/lib/utils';

export const runtime = 'nodejs';

interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  location?: string;
}

/**
 * Format date as ICS date-time string (YYYYMMDDTHHMMSS)
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/**
 * Generate ICS calendar content
 */
function generateICS(events: CalendarEvent[], calendarName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stride OS//Training Plan//EN',
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${event.dtstart}`);
    lines.push(`DTEND:${event.dtend}`);
    lines.push(`SUMMARY:${escapeICS(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const weeksAhead = parseInt(searchParams.get('weeks') || '12', 10);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Calculate date range
    const startDate = new Date();
    if (includeCompleted) {
      startDate.setDate(startDate.getDate() - 7); // Include past week if showing completed
    }
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeksAhead * 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch planned workouts from database
    const workoutsList: import('@/lib/schema').PlannedWorkout[] = await db
      .select()
      .from(plannedWorkouts)
      .where(
        and(
          gte(plannedWorkouts.date, startDateStr),
          lte(plannedWorkouts.date, endDateStr)
        )
      );

    // Convert to calendar events
    const events: CalendarEvent[] = workoutsList.map((workout) => {
      // Parse the workout date and set default time (7:00 AM)
      const workoutDate = new Date(workout.date + 'T07:00:00');
      const endTime = new Date(workoutDate);

      // Estimate duration based on workout type and distance
      let durationMinutes = 60; // Default 1 hour
      if (workout.targetDurationMinutes) {
        durationMinutes = workout.targetDurationMinutes;
      } else if (workout.targetDistanceMiles && workout.targetPaceSecondsPerMile) {
        durationMinutes = Math.round((workout.targetDistanceMiles * workout.targetPaceSecondsPerMile) / 60);
      } else if (workout.targetDistanceMiles) {
        // Estimate ~9 min/mile average
        durationMinutes = Math.round(workout.targetDistanceMiles * 9);
      }

      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // Build description
      const descParts: string[] = [];
      if (workout.targetDistanceMiles) {
        descParts.push(`Distance: ${workout.targetDistanceMiles} miles`);
      }
      if (workout.targetPaceSecondsPerMile) {
        descParts.push(`Target Pace: ${formatPace(workout.targetPaceSecondsPerMile)}/mi`);
      }
      if (workout.description) {
        descParts.push(`Notes: ${workout.description}`);
      }
      if (workout.isKeyWorkout) {
        descParts.push('KEY WORKOUT');
      }

      // Build summary with workout type emoji
      const typeLabel: Record<string, string> = {
        easy: 'Easy',
        recovery: 'Recovery',
        long_run: 'Long Run',
        long: 'Long Run',
        tempo: 'Tempo',
        threshold: 'Threshold',
        interval: 'Intervals',
        intervals: 'Intervals',
        race: 'Race',
        rest: 'Rest',
      };
      const label = workout.workoutType ? typeLabel[workout.workoutType] || '' : '';
      const summary = label ? `[${label}] ${workout.name || workout.workoutType || 'Run'}` : (workout.name || workout.workoutType || 'Run');

      return {
        uid: `workout-${workout.id}@stride.os`,
        summary,
        description: descParts.join('\n'),
        dtstart: formatICSDate(workoutDate),
        dtend: formatICSDate(endTime),
      };
    });

    // Generate ICS content
    const icsContent = generateICS(events, 'Stride OS Training Plan');

    // Return as downloadable file
    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="stride-training-plan.ics"',
      },
    });
  } catch (error) {
    console.error('Calendar export error:', error);
    return NextResponse.json(
      { error: 'Failed to export calendar' },
      { status: 500 }
    );
  }
}
