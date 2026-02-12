'use client';

import { useState } from 'react';

export default function TestStreamPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const testStream = async () => {
    setMessages([]);
    setStreaming('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/test-stream');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log('[Test] Received chunk:', chunk);

        const lines = buffer.split('\n');
        if (buffer.endsWith('\n')) {
          buffer = '';
        } else {
          buffer = lines.pop() || '';
        }

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            console.log('[Test] Parsed data:', data);

            if (data.type === 'text') {
              setStreaming(prev => prev + data.content);
            } else if (data.type === 'done') {
              const fullContent = streaming + data.content;
              setMessages(prev => [...prev, fullContent || streaming]);
              setStreaming('');
              setIsLoading(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Test] Error:', error);
      setMessages(['Error: ' + (error as Error).message]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Stream Test</h1>

      <button
        onClick={testStream}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Test Stream
      </button>

      <div className="mt-4">
        <h2 className="font-bold">Streaming:</h2>
        <div className="bg-gray-100 p-4 min-h-[50px]">{streaming || '(empty)'}</div>
      </div>

      <div className="mt-4">
        <h2 className="font-bold">Messages ({messages.length}):</h2>
        {messages.map((msg, i) => (
          <div key={i} className="bg-blue-100 p-4 mt-2">
            {msg}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h2 className="font-bold">State Debug:</h2>
        <pre className="bg-gray-100 p-2 text-xs">
          {JSON.stringify({ isLoading, streamingLength: streaming.length, messageCount: messages.length }, null, 2)}
        </pre>
      </div>
    </div>
  );
}