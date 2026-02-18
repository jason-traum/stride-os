import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Dreamy',
  description: 'Dreamy privacy policy and data handling practices.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <h1 className="text-3xl font-bold text-primary">Privacy Policy</h1>
      <p className="text-sm text-textSecondary">Last updated: February 18, 2026</p>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">What We Collect</h2>
        <p>
          Dreamy collects account/profile settings, workout data, and related running metadata to provide coaching,
          planning, analytics, and sync features.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Strava Data</h2>
        <p>
          If you connect Strava, we access your authorized data using Strava OAuth scopes and store activity metadata
          needed for import, display, and training analysis.
        </p>
        <p>
          We do not ask for your Strava password. You can disconnect Strava at any time from Settings.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">How Data Is Used</h2>
        <p>
          Data is used to generate plans, coaching insights, readiness metrics, workout analysis, and user-facing
          dashboards. Data may be processed by infrastructure and AI providers used to operate Dreamy.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Data Deletion and Revocation</h2>
        <p>
          You can disconnect Strava in-app to revoke future access. You may request deletion of Dreamy account/profile
          data by contacting <a className="text-[#FC4C02] underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2 text-sm text-textSecondary">
        <h2 className="text-lg font-semibold text-primary">Contact</h2>
        <p>
          Privacy questions: <a className="text-[#FC4C02] underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>
        </p>
      </section>
    </div>
  );
}
