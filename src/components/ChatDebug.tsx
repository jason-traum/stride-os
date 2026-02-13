'use client';

import { useState } from 'react';

export function ChatDebug() {
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState('');

  const testChat = async () => {
    setMessages([]);
    setStreaming('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        newMessage: 'Hi coach!',
      }),
    });

    if (!response.ok) {
      setMessages(['Error: ' + response.statusText]);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            setMessages(prev => [...prev, `${data.type}: ${data.content || data.tool || ''}`]);

            if (data.type === 'text') {
              setStreaming(prev => prev + data.content);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Chat Debug</h3>
      <button
        onClick={testChat}
        className="bg-blue-50 dark:bg-blue-9500 text-white px-4 py-2 rounded mb-4"
      >
        Test Streaming
      </button>

      <div className="mb-4">
        <h4 className="font-bold">Streaming Content:</h4>
        <div className="bg-surface-2 p-2 rounded min-h-[100px] whitespace-pre-wrap">
          {streaming || 'No content yet...'}
        </div>
      </div>

      <div>
        <h4 className="font-bold">All Messages:</h4>
        <div className="bg-surface-2 p-2 rounded max-h-[300px] overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className="text-xs">{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
}