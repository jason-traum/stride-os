import { NextResponse } from 'next/server';

// Test endpoint that simulates API responses without calling Anthropic
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const { messages, newMessage } = await request.json();


  // Simulate response based on the message
  if (newMessage.toLowerCase().includes('tomorrow')) {
    return NextResponse.json({
      response: {
        content: "I'll help you with tomorrow's workout. Let me check your planned workouts...",
        tools_called: ['get_planned_workout_by_date'],
        tool_results: [{
          tool: 'get_planned_workout_by_date',
          result: {
            found: false,
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            message: 'No planned workout for tomorrow',
            suggestion: 'Would you like me to prescribe a workout for tomorrow?'
          }
        }]
      }
    });
  }

  return NextResponse.json({
    response: {
      content: "This is test mode - no API credits used! Your message was: " + newMessage
    }
  });
}