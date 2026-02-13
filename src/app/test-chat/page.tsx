'use client';

import { useState } from 'react';

export default function TestChatPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState('');

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input;
    setInput('');
    setMessages(prev => [...prev, `User: ${userInput}`]);
    setIsLoading(true);
    setStreamingContent('');
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: m.replace(/^(User|Assistant): /, '')
          })),
          newMessage: userInput,
          isDemo: true // Use demo mode for testing
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'text') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                setMessages(prev => [...prev, `Assistant: ${fullContent}`]);
                setStreamingContent('');
                setIsLoading(false);
              } else if (data.type === 'error') {
                setError(data.content || 'Unknown error');
                setIsLoading(false);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Chat Test Page</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      <div className="bg-surface-2 p-4 rounded mb-4 h-96 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-2 ${msg.startsWith('User:') ? 'text-blue-600' : 'text-green-600'}`}>
            {msg}
          </div>
        ))}
        {streamingContent && (
          <div className="text-green-600 animate-pulse">
            Assistant: {streamingContent}
          </div>
        )}
        {isLoading && !streamingContent && (
          <div className="text-tertiary">Assistant is thinking...</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}