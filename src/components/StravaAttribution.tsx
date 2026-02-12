import Image from 'next/image';

export function StravaAttribution({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-stone-500">Powered by</span>
      <a
        href="https://www.strava.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        <Image
          src="/Strava_Logo.svg.png"
          alt="Strava"
          width={80}
          height={20}
          className="h-5 w-auto"
        />
      </a>
    </div>
  );
}

export function StravaConnectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-6 py-3 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] transition-colors font-medium"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="currentColor"
      >
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>
      Connect with Strava
    </button>
  );
}

export function StravaActivityBadge({ activityId }: { activityId: number | string }) {
  return (
    <a
      href={`https://www.strava.com/activities/${activityId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 bg-[#FC4C02]/10 text-[#FC4C02] rounded text-xs font-medium hover:bg-[#FC4C02]/20 transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-3 h-3"
        fill="currentColor"
      >
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>
      View on Strava
    </a>
  );
}