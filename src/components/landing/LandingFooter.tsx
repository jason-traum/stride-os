import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-[#16151D] px-6 sm:px-8 py-8" aria-label="Footer">
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span
          className="text-[#F0EDE6] text-sm font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          dreamy
        </span>

        <div className="flex items-center gap-5 text-[#5A5768] text-xs" style={{ fontFamily: 'var(--font-manrope)' }}>
          <Link href="/privacy" className="hover:text-[#8A8694] transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-[#8A8694] transition-colors">Terms</Link>
        </div>

        <p className="text-[#5A5768] text-xs" style={{ fontFamily: 'var(--font-manrope)' }}>
          Made for runners, by a runner. &copy; 2026
        </p>
      </div>
    </footer>
  );
}
