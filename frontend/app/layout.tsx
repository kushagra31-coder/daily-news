import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import EngagementTracker from '@/components/EngagementTracker'

// ─── Font ──────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: "Daily Vanish — Today's News. Gone Tomorrow.",
    template: "%s | Daily Vanish",
  },
  description:
    "An ephemeral news aggregator. Today's verified headlines from top sources — they disappear in 24 hours.",
  keywords: ['news', 'daily', 'ephemeral', 'headlines', 'india', 'world', 'tech'],
  authors: [{ name: 'Daily Vanish' }],
  openGraph: {
    title: "Daily Vanish — Today's News. Gone Tomorrow.",
    description: 'Verified headlines that disappear in 24 hours.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'Daily Vanish',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://daily-vanish.vercel.app'}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Daily Vanish News',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Daily Vanish — Today's News. Gone Tomorrow.",
    description: 'Verified headlines that disappear in 24 hours.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#ef4444',
  width: 'device-width',
  initialScale: 1,
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  })

  const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID

  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">

        {/* ── OneSignal ── */}
        {oneSignalAppId && (
          <>
            <Script
              src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
              strategy="lazyOnload"
            />
            <Script id="onesignal-init" strategy="lazyOnload">
              {`
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                OneSignalDeferred.push(async function(OneSignal) {
                  await OneSignal.init({
                    appId: "${oneSignalAppId}",
                    notifyButton: { enable: false },
                    promptOptions: { slidedown: { prompts: [] } }
                  });
                });
              `}
            </Script>
          </>
        )}

        {/* ── Engagement tracker (handles time-based push permission) ── */}
        <EngagementTracker />

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 w-full border-b border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-950/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 gap-4">
              {/* Wordmark */}
              <a
                href="/"
                className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
                aria-label="Daily Vanish — Home"
              >
                <span
                  className="w-7 h-7 rounded-lg bg-gradient-to-br from-vanish-from to-vanish-to flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  aria-hidden="true"
                >
                  DV
                </span>
                <div className="leading-none">
                  <div className="font-black text-[15px] text-gray-900 dark:text-white tracking-tight">
                    Daily Vanish
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
                    Today&apos;s news. Gone tomorrow.
                  </div>
                </div>
              </a>

              {/* Midnight countdown slot — populated from page via props drilling
                  kept here as a portal target for client components */}
              <div id="midnight-countdown-slot" className="ml-auto" />

              {/* Nav links */}
              <nav className="flex items-center gap-1" aria-label="Main navigation">
                <a
                  href="/"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Today
                </a>
                <a
                  href="/yesterday"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Yesterday
                </a>
                <a
                  href="/terms"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Terms
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="w-full border-t border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-950 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-500">
              <p>
                News disappears after 24 hours &middot; {today} &middot; Sources linked from originals
              </p>
              <div className="flex items-center gap-3">
                <a href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Terms of Use
                </a>
                <span aria-hidden="true">&middot;</span>
                <a href="/yesterday" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Yesterday&apos;s Edition
                </a>
                <span aria-hidden="true">&middot;</span>
                <span className="text-gray-400 dark:text-gray-600">
                  &copy; {new Date().getFullYear()} Daily Vanish
                </span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
