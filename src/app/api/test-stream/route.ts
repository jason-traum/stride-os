export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {

      // Send a few test messages
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'Hello ' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'from ' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'streaming!' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}