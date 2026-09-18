'use client'

import { useStats } from '@/lib/api'
import { formatDistanceToNow, parseISO } from 'date-fns'

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatsBarProps {
  /** Optional server-side pre-fetched initial stats */
  initialStats?: {
    total_articles: number
    verified_articles: number
    expiring_soon: number
    categories: Record<string, number>
    last_fetch: string
  } | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatsBar({ initialStats }: StatsBarProps) {
  const { stats, isLoading } = useStats()

  // Prefer live SWR data, fall back to SSR props
  const data = stats ?? initialStats

  if (isLoading && !data) {
    return (
      <div className="w-full animate-pulse flex gap-6 px-4 py-2 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const verifiedPct =
    data.total_articles > 0
      ? Math.round((data.verified_articles / data.total_articles) * 100)
      : 0

  const lastFetchLabel = (() => {
    try {
      return formatDistanceToNow(parseISO(data.last_fetch), { addSuffix: true })
    } catch {
      return 'recently'
    }
  })()

  return (
    <div
      role="status"
      aria-label="Feed statistics"
      className="
        w-full flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5
        bg-gray-50 dark:bg-gray-900/60
        border border-gray-200/70 dark:border-gray-700/70
        rounded-xl text-xs text-gray-600 dark:text-gray-400
        shadow-sm
      "
    >
      {/* Total articles */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
          {data.total_articles}
        </span>
        <span>articles today</span>
      </div>

      <span className="text-gray-300 dark:text-gray-700 hidden sm:block" aria-hidden="true">|</span>

      {/* Verified % */}
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true" />
        <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
          {verifiedPct}%
        </span>
        <span>verified</span>
      </div>

      <span className="text-gray-300 dark:text-gray-700 hidden sm:block" aria-hidden="true">|</span>

      {/* Expiring soon */}
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden="true" />
        <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
          {data.expiring_soon}
        </span>
        <span>expiring soon</span>
      </div>

      <span className="text-gray-300 dark:text-gray-700 hidden sm:block" aria-hidden="true">|</span>

      {/* Last fetch */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" aria-hidden="true" />
        <span>Updated {lastFetchLabel}</span>
      </div>
    </div>
  )
}
