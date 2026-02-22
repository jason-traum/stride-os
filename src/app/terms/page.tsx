import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Dreamy',
  description: 'Dreamy terms of service.',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <h1 className="text-3xl font-bold text-primary">Terms of Service</h1>
      <p className="text-sm text-textSecondary">Last updated: February 18, 2026</p>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Service Scope</h2>
        <p>
          Dreamy provides running coaching, planning, logging, and analytics tools. Content is informational and not
          medical advice.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">User Responsibilities</h2>
        <p>
          You are responsible for your training decisions, account security, and ensuring any connected data sources are
          authorized by you.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Third-Party Services</h2>
        <p>
          Dreamy may integrate third-party services including Strava and AI providers. Use of those services is subject
          to their own terms and policies.
        </p>
        <p>
          Strava data is accessed only with your authorization and is used exclusively for display and analysis of your
          own activities within Dreamy. We do not sell, share, or use Strava data for purposes unrelated to providing
          your personalized coaching experience.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Termination</h2>
        <p>
          We may suspend access for abuse, misuse, or security reasons. You may stop using the service at any time and
          request account/profile data deletion at <a className="text-[#FC4C02] underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Contact</h2>
        <p>
          Terms questions: <a className="text-[#FC4C02] underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>
        </p>
      </section>
    </div>
  );
}
