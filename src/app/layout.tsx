import type { Metadata, Viewport } from "next";
import { Manrope, Inter, Syne, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar, MobileNav, MobileHeader } from "@/components/Navigation";
import { Providers } from "@/components/Providers";
import { FloatingChatWrapper } from "@/components/FloatingChatWrapper";
import { InstallBanner, OfflineBanner } from "@/components/InstallBanner";
import { PageWrapper } from "@/components/PageWrapper";
import { DemoBanner } from "@/components/DemoBanner";
import { cookies } from "next/headers";

// Display font for headings - geometric, modern
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

// Body font - clean, highly readable
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Brand font - geometric, bold
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

// Serif display font - elegant headings
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Dreamy - AI Running Coach",
  description: "Your personalized AI running coach that creates adaptive training plans and helps you achieve your running goals.",
  manifest: "/manifest.json",
  metadataBase: new URL('https://getdreamy.run'),

  // Open Graph for URL previews
  openGraph: {
    title: 'Dreamy - AI Running Coach',
    description: 'Train smarter with personalized AI coaching',
    url: 'https://getdreamy.run',
    siteName: 'Dreamy',
    images: [{
      url: 'https://getdreamy.run/og-image.png',
      width: 1200,
      height: 630,
    }],
    locale: 'en_US',
    type: 'website',
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    images: ['https://getdreamy.run/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dreamy",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c6cf0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const role = cookieStore.get('auth-role')?.value;
  const isReadOnlyRole = role === 'viewer' || role === 'coach';

  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${geistMono.variable} ${syne.variable} ${playfairDisplay.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-surface-0 text-textPrimary">
        <Providers>
          <OfflineBanner />
          <DemoBanner />
          <Sidebar role={role as 'admin' | 'user' | 'viewer' | 'coach' | null} />
          <MobileHeader role={role as 'admin' | 'user' | 'viewer' | 'coach' | null} />
          <MobileNav role={role as 'admin' | 'user' | 'viewer' | 'coach' | null} />
          <main className="pt-[calc(48px+env(safe-area-inset-top))] md:pt-0 md:pl-64 pb-20 md:pb-0 min-h-screen">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {isReadOnlyRole && (
                <div className="mb-4 rounded-xl border border-amber-700/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">
                  You are in read-only mode ({role}). Editing, syncing, and chat actions are disabled.
                </div>
              )}
              <PageWrapper>{children}</PageWrapper>
            </div>
          </main>
          {!isReadOnlyRole && <FloatingChatWrapper />}
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}
