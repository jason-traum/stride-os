import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getShoeDetail } from '@/actions/shoes';
import { ShoeDetailClient } from './ShoeDetailClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shoe Detail | Dreamy',
  description: 'View shoe details, mileage, and associated runs.',
};

export default async function ShoeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shoeId = parseInt(id, 10);
  if (isNaN(shoeId)) notFound();

  const data = await getShoeDetail(shoeId);
  if (!data) notFound();

  return (
    <div>
      <Link
        href="/shoes"
        className="inline-flex items-center gap-1 text-sm text-textTertiary hover:text-textSecondary transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Shoes
      </Link>

      <ShoeDetailClient shoe={data.shoe} workouts={data.workouts} />
    </div>
  );
}
