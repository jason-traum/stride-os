'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/Skeleton';

const RouteMap = dynamic(() => import('@/components/RouteMap').then(mod => ({ default: mod.RouteMap })), {
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
  ssr: false,
});

export { RouteMap as LazyRouteMap };
