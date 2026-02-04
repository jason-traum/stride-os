'use client';

import { useState, useEffect } from 'react';

interface DynamicGreetingProps {
  name?: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DynamicGreeting({ name }: DynamicGreetingProps) {
  const [greeting, setGreeting] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
    setMounted(true);

    // Update greeting every minute in case user has page open across time boundaries
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return <span className="inline-block min-w-[140px]">&nbsp;</span>;
  }

  return (
    <>
      {greeting}{name ? `, ${name}` : ''}!
    </>
  );
}
