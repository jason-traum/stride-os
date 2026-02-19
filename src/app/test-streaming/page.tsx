import { notFound } from 'next/navigation';
import { ChatDebug } from '@/components/ChatDebug';

export default function TestStreamingPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test Streaming</h1>
      <ChatDebug />
    </div>
  );
}