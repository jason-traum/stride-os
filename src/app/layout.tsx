import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Navigation";
import { Providers } from "@/components/Providers";
import { FloatingChatWrapper } from "@/components/FloatingChatWrapper";
import { InstallBanner, OfflineBanner } from "@/components/InstallBanner";
import { PageWrapper } from "@/components/PageWrapper";
import { DemoBanner } from "@/components/DemoBanner";

// Display font for headings - playful, geometric, modern
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

// Body font - friendly, readable, professional
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
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
  themeColor: "#6366f1",
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
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-stone-50 text-stone-800">
        <Providers>
          <OfflineBanner />
          <DemoBanner />
          <Sidebar />
          <MobileNav />
          <main className="md:pl-64 pb-20 md:pb-0 min-h-screen">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <PageWrapper>{children}</PageWrapper>
            </div>
          </main>
          <FloatingChatWrapper />
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}
