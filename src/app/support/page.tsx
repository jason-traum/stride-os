import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support | Dreamy',
  description: 'Support, account help, and data requests for Dreamy users.',
};

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold text-primary">Support</h1>
      <p className="text-textSecondary">
        For account help, Strava connection issues, privacy questions, or data/account deletion requests,
        contact <a className="text-dream-600 underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>.
      </p>

      <div className="rounded-xl border border-borderPrimary bg-bgSecondary p-4">
        <h2 className="text-lg font-semibold text-primary mb-2">Common Requests</h2>
        <ul className="list-disc list-inside text-sm text-textSecondary space-y-1">
          <li>Strava connection and sync troubleshooting</li>
          <li>Account and profile support</li>
          <li>Data export and deletion requests</li>
          <li>Bug reports and feature feedback</li>
        </ul>
      </div>

      <div className="text-sm text-textSecondary">
        <Link className="text-dream-600 underline mr-4" href="/privacy">Privacy Policy</Link>
        <Link className="text-dream-600 underline" href="/terms">Terms of Service</Link>
      </div>
    </div>
  );
}
