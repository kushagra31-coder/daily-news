'use client'

import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { useFeed } from '@/lib/api'
import { isISTPeakHour } from '@/lib/notifications'
import type { Category, Article, FeedResponse, StatsResponse } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import FeedGrid from '@/components/FeedGrid'
import StatsBar from '@/components/StatsBar'
import CatchUpBanner from '@/components/CatchUpBanner'
import MidnightCountdown from '@/components/MidnightCountdown'

// ─── Props (server pre-fetched data flows in as props) ────────────────────────

interface TodayFeedProps {
  initialFeed: FeedResponse | null
  initialStats: StatsResponse | null
}

// ─── Client feed with category filter ────────────────────────────────────────

export default function TodayFeed({ initialFeed, initialStats }: TodayFeedProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [isPeakHour, setIsPeakHour] = useState(false)

  const { articles, isLoading, nextResetInSeconds, feed } = useFeed()

  // Use live SWR data; fall back to SSR pre-fetched data on first render
  const allArticles: Article[] = articles.length > 0
    ? articles
    : (initialFeed?.articles ?? [])

  const resetSeconds =
    nextResetInSeconds > 0
      ? nextResetInSeconds
      : (initialFeed?.next_reset_in_seconds ?? 0)

  // Client-side category filter
  const filteredArticles = useMemo(() => {
    if (activeCategory === 'all') return allArticles
    return allArticles.filter(
      (a) => a.category.toLowerCase() === activeCategory
    )
  }, [allArticles, activeCategory])

  // IST peak hour detection (enhancement #8)
  useEffect(() => {
    setIsPeakHour(isISTPeakHour())
    const id = setInterval(() => setIsPeakHour(isISTPeakHour()), 60_000)
    return () => clearInterval(id)
  }, [])

  const dateLabel = format(new Date(), "EEEE, d MMMM yyyy")
  const minutesAgo = feed?.articles.length
    ? '' // could compute from last_fetch; placeholder
    : ''

  return (
    <div className="space-y-6">
      {/* ── Page title row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">
            Today&apos;s Headlines
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5" suppressHydrationWarning>{dateLabel}</p>
        </div>

        {/* Midnight countdown */}
        <MidnightCountdown nextResetInSeconds={resetSeconds} />
      </div>

      {/* ── IST Peak-hour live badge (enhancement #8) ── */}
      {isPeakHour && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
          role="status"
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          📡 Live — High traffic period. Feed refreshes automatically every 5 minutes.
        </motion.div>
      )}

      {/* ── Stats bar ── */}
      <StatsBar initialStats={initialStats} />

      {/* ── Category filter tabs ── */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
        role="tablist"
        aria-label="Filter by category"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            role="tab"
            aria-selected={activeCategory === cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`
              flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold
              transition-all duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
              ${activeCategory === cat.value
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Feed grid ── */}
      <FeedGrid
        articles={filteredArticles}
        loading={isLoading && allArticles.length === 0}
        showCountdown
      />

      {/* ── Catch-up banner ── */}
      <CatchUpBanner />
    </div>
  )
}
