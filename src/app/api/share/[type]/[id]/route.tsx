import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { formatPace } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * Format duration from minutes to h:mm or mm:ss
 */
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
  }
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get verdict emoji and color
 */
function getVerdictStyle(verdict: string): { emoji: string; color: string } {
  switch (verdict) {
    case 'great':
      return { emoji: '', color: '#22c55e' };
    case 'good':
      return { emoji: '', color: '#3b82f6' };
    case 'fine':
      return { emoji: '', color: '#64748b' };
    case 'rough':
      return { emoji: '', color: '#f59e0b' };
    case 'awful':
      return { emoji: '', color: '#ef4444' };
    default:
      return { emoji: '', color: '#64748b' };
  }
}

interface WorkoutShareCardProps {
  distance: number;
  duration: number;
  pace: string;
  date: string;
  workoutType?: string;
  verdict?: string;
}

function WorkoutShareCard({ distance, duration, pace, date, workoutType, verdict }: WorkoutShareCardProps) {
  const verdictStyle = verdict ? getVerdictStyle(verdict) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
        padding: '40px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Date */}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '24px',
          marginBottom: '8px',
        }}
      >
        {date}
      </div>

      {/* Main distance */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '96px',
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          {distance.toFixed(1)}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '36px',
            marginLeft: '8px',
          }}
        >
          miles
        </span>
      </div>

      {/* Pace and duration */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          fontSize: '32px',
          color: 'white',
          marginBottom: '24px',
        }}
      >
        <span>{pace}/mi</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>•</span>
        <span>{formatDuration(duration)}</span>
      </div>

      {/* Verdict badge */}
      {verdictStyle && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '12px 24px',
            width: 'fit-content',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '28px', marginRight: '8px' }}>{verdictStyle.emoji}</span>
          <span style={{ color: 'white', fontSize: '24px', textTransform: 'capitalize' }}>
            {verdict === 'great' ? 'Great run!' : verdict === 'good' ? 'Good run' : verdict === 'fine' ? 'Got it done' : verdict === 'rough' ? 'Tough one' : 'Run logged'}
          </span>
        </div>
      )}

      {/* Workout type */}
      {workoutType && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '20px',
            textTransform: 'capitalize',
          }}
        >
          {workoutType.replace(/_/g, ' ')}
        </div>
      )}

      {/* Branding */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '20px',
        }}
      >
        stride.os
      </div>
    </div>
  );
}

interface WeeklyShareCardProps {
  week: string;
  totalMiles: number;
  totalRuns: number;
  avgPace: string;
  adherencePercent?: number;
  highlight?: string;
}

function WeeklyShareCard({ week, totalMiles, totalRuns, avgPace, adherencePercent, highlight }: WeeklyShareCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: '40px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Week label */}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '24px',
          marginBottom: '8px',
        }}
      >
        Week of {week}
      </div>

      {/* Main stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '96px',
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          {totalMiles}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '36px',
            marginLeft: '8px',
          }}
        >
          miles
        </span>
      </div>

      {/* Secondary stats */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          fontSize: '28px',
          color: 'white',
          marginBottom: '24px',
        }}
      >
        <span>{totalRuns} runs</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>•</span>
        <span>{avgPace}/mi avg</span>
      </div>

      {/* Adherence badge */}
      {adherencePercent !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '12px 24px',
            width: 'fit-content',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '24px', marginRight: '8px' }}></span>
          <span style={{ color: 'white', fontSize: '24px' }}>
            {adherencePercent}% plan adherence
          </span>
        </div>
      )}

      {/* Highlight */}
      {highlight && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '22px',
            fontStyle: 'italic',
          }}
        >
          {highlight}
        </div>
      )}

      {/* Branding */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '20px',
        }}
      >
        stride.os
      </div>
    </div>
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;

    if (type === 'workout') {
      // Fetch workout data
      const workoutResults = await db
        .select()
        .from(workouts)
        .where(eq(workouts.id, parseInt(id, 10)))
        .limit(1);

      const workout = workoutResults[0];

      if (!workout) {
        return new Response('Workout not found', { status: 404 });
      }

      const pace = workout.avgPaceSeconds
        ? formatPace(workout.avgPaceSeconds)
        : '--:--';

      return new ImageResponse(
        (
          <WorkoutShareCard
            distance={workout.distanceMiles || 0}
            duration={workout.durationMinutes || 0}
            pace={pace}
            date={formatDate(workout.date)}
            workoutType={workout.workoutType || undefined}
            verdict={(workout as { verdict?: string }).verdict}
          />
        ),
        {
          width: 600,
          height: 400,
        }
      );
    }

    if (type === 'weekly') {
      // Parse weekly data from query params (for flexibility)
      const searchParams = request.nextUrl.searchParams;
      const week = searchParams.get('week') || 'This Week';
      const totalMiles = parseFloat(searchParams.get('miles') || '0');
      const totalRuns = parseInt(searchParams.get('runs') || '0', 10);
      const avgPace = searchParams.get('pace') || '--:--';
      const adherencePercent = searchParams.get('adherence')
        ? parseInt(searchParams.get('adherence')!, 10)
        : undefined;
      const highlight = searchParams.get('highlight') || undefined;

      return new ImageResponse(
        (
          <WeeklyShareCard
            week={week}
            totalMiles={totalMiles}
            totalRuns={totalRuns}
            avgPace={avgPace}
            adherencePercent={adherencePercent}
            highlight={highlight}
          />
        ),
        {
          width: 600,
          height: 400,
        }
      );
    }

    return new Response('Invalid share type', { status: 400 });
  } catch (error) {
    console.error('Share card generation error:', error);
    return new Response('Failed to generate share card', { status: 500 });
  }
}
