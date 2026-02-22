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
  scale?: number;
}

function WorkoutShareCard({ distance, duration, pace, date, workoutType, verdict, scale = 1 }: WorkoutShareCardProps) {
  const verdictStyle = verdict ? getVerdictStyle(verdict) : null;

  const s = scale;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
        padding: `${40 * s}px`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Date */}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: `${24 * s}px`,
          marginBottom: `${8 * s}px`,
        }}
      >
        {date}
      </div>

      {/* Main distance */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: `${16 * s}px`,
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: `${96 * s}px`,
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          {distance.toFixed(1)}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: `${36 * s}px`,
            marginLeft: `${8 * s}px`,
          }}
        >
          miles
        </span>
      </div>

      {/* Pace and duration */}
      <div
        style={{
          display: 'flex',
          gap: `${32 * s}px`,
          fontSize: `${32 * s}px`,
          color: 'white',
          marginBottom: `${24 * s}px`,
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
            padding: `${12 * s}px ${24 * s}px`,
            width: 'fit-content',
            marginBottom: `${24 * s}px`,
          }}
        >
          <span style={{ fontSize: `${28 * s}px`, marginRight: `${8 * s}px` }}>{verdictStyle.emoji}</span>
          <span style={{ color: 'white', fontSize: `${24 * s}px`, textTransform: 'capitalize' }}>
            {verdict === 'great' ? 'Great run!' : verdict === 'good' ? 'Good run' : verdict === 'fine' ? 'Got it done' : verdict === 'rough' ? 'Tough one' : 'Run logged'}
          </span>
        </div>
      )}

      {/* Workout type */}
      {workoutType && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: `${20 * s}px`,
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
          paddingTop: `${24 * s}px`,
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: `${20 * s}px`,
        }}
      >
        getdreamy.run
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
  scale?: number;
}

function WeeklyShareCard({ week, totalMiles, totalRuns, avgPace, adherencePercent, highlight, scale = 1 }: WeeklyShareCardProps) {
  const s = scale;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: `${40 * s}px`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Week label */}
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: `${24 * s}px`,
          marginBottom: `${8 * s}px`,
        }}
      >
        Week of {week}
      </div>

      {/* Main stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: `${16 * s}px`,
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: `${96 * s}px`,
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          {totalMiles}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: `${36 * s}px`,
            marginLeft: `${8 * s}px`,
          }}
        >
          miles
        </span>
      </div>

      {/* Secondary stats */}
      <div
        style={{
          display: 'flex',
          gap: `${32 * s}px`,
          fontSize: `${28 * s}px`,
          color: 'white',
          marginBottom: `${24 * s}px`,
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
            padding: `${12 * s}px ${24 * s}px`,
            width: 'fit-content',
            marginBottom: `${24 * s}px`,
          }}
        >
          <span style={{ fontSize: `${24 * s}px`, marginRight: `${8 * s}px` }}></span>
          <span style={{ color: 'white', fontSize: `${24 * s}px` }}>
            {adherencePercent}% plan adherence
          </span>
        </div>
      )}

      {/* Highlight */}
      {highlight && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: `${22 * s}px`,
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
          paddingTop: `${24 * s}px`,
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: `${20 * s}px`,
        }}
      >
        getdreamy.run
      </div>
    </div>
  );
}

/**
 * Image format dimensions:
 * - default:  600x400  (OG / link preview)
 * - story:    1080x1920 (Instagram Story / 9:16)
 * - square:   1080x1080 (Instagram Post)
 *
 * Use ?format=story or ?format=square query param.
 */
function getImageDimensions(format: string | null): { width: number; height: number } {
  switch (format) {
    case 'story':
      return { width: 1080, height: 1920 };
    case 'square':
      return { width: 1080, height: 1080 };
    default:
      return { width: 600, height: 400 };
  }
}

function getScaleFactor(format: string | null): number {
  // Scale up font sizes for larger canvases
  switch (format) {
    case 'story':
      return 2.4;
    case 'square':
      return 1.8;
    default:
      return 1;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    const format = request.nextUrl.searchParams.get('format');
    const dimensions = getImageDimensions(format);
    const scale = getScaleFactor(format);

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
            scale={scale}
          />
        ),
        dimensions
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
            scale={scale}
          />
        ),
        dimensions
      );
    }

    return new Response('Invalid share type', { status: 400 });
  } catch (error) {
    console.error('Share card generation error:', error);
    return new Response('Failed to generate share card', { status: 500 });
  }
}
