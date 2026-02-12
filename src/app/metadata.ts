import { Metadata } from 'next';

export const siteMetadata: Metadata = {
  title: 'Dreamy - AI Running Coach',
  description: 'Your personalized AI running coach that creates adaptive training plans, analyzes your workouts, and helps you achieve your running goals.',

  // Open Graph for social sharing
  openGraph: {
    title: 'Dreamy - AI Running Coach',
    description: 'Train smarter with personalized AI coaching',
    url: 'https://getdreamy.run',
    siteName: 'Dreamy',
    images: [
      {
        url: 'https://getdreamy.run/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Dreamy - AI Running Coach',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Dreamy - AI Running Coach',
    description: 'Train smarter with personalized AI coaching',
    images: ['https://getdreamy.run/og-image.png'],
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },

  // Other metadata
  metadataBase: new URL('https://getdreamy.run'),
  keywords: ['running', 'AI coach', 'training plans', 'marathon', 'fitness', 'Strava'],
  authors: [{ name: 'Dreamy' }],
  creator: 'Dreamy',
  publisher: 'Dreamy',

  // App specific
  applicationName: 'Dreamy',
  manifest: '/manifest.json',

  // Theme color
  themeColor: '#14b8a6', // Teal color to match your app
};