import type { Metadata } from 'next'
import Link from 'next/link'
import { format, subDays } from 'date-fns'
import { BACKEND_URL, fetcher } from '@/lib/api'
import type { FeedResponse } from '@/lib/types'
import YesterdayFeed from '@/components/YesterdayFeed'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Yesterday's Edition | Daily Vanish",
  description: "Catch up on yesterday's expired headlines — archived for 24 hours.",
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// ─── Server Component ─────────────────────────────────────────────────────────

export default async function YesterdayPage() {
  const yesterdayDate = format(subDays(new Date(), 1), 'EEEE, d MMMM yyyy')

  // SSR pre-fetch yesterday'\''s articles
  let initialFeed: FeedResponse | null = null
  try {
    initialFeed = await fetcher<FeedResponse>(`${BACKEND_URL}/api/yesterday`)
  } catch {
    // Network or API error — render empty state gracefully
  }

  return (
    <div className="space-y-6">
      {/* ── Back nav ── */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
        aria-label="Back to today'\''s news"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Today&apos;s Headlines
      </Link>

      {/* ── Page heading ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">
          📅 Yesterday&apos;s Edition
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {yesterdayDate} &middot; Archived
        </p>
      </div>

      {/* ── Expiry warning banner ── */}
      <div
        role="alert"
        className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
      >
        <span className="text-xl flex-shrink-0" aria-hidden="true">⚠️</span>
        <div className="text-sm leading-relaxed">
          <strong>Archived content.</strong> This content has expired and is shown for catch-up
          only. These articles are no longer live and links may no longer be active.
          Content will be permanently removed at the next daily reset.
        </div>
      </div>

      {/* ── Feed (client component with SWR, no countdown timers) ── */}
      <YesterdayFeed initialFeed={initialFeed} />
    </div>
  )
}
