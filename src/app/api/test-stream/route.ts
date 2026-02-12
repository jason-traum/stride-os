export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      console.log('[Test Stream] Starting');

      // Send a few test messages
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'Hello ' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'from ' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'streaming!' })}\n\n`));
      await new Promise(resolve => setTimeout(resolve, 500));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      console.log('[Test Stream] Done');

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