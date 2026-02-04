import Link from 'next/link';
import { MapPin, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-8 h-8 text-stone-400" />
        </div>

        <h1 className="text-6xl font-bold text-stone-200 mb-2">404</h1>

        <h2 className="text-xl font-semibold text-stone-900 mb-2">
          Page Not Found
        </h2>

        <p className="text-stone-500 mb-6">
          Looks like you took a wrong turn on the trail. Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>

          <Link
            href="/today"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Today&apos;s Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
