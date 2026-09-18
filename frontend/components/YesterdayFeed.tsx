'use client'

import { useYesterday } from '@/lib/api'
import type { FeedResponse } from '@/lib/types'
import FeedGrid from '@/components/FeedGrid'

// ─── Props ────────────────────────────────────────────────────────────────────

interface YesterdayFeedProps {
  initialFeed: FeedResponse | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function YesterdayFeed({ initialFeed }: YesterdayFeedProps) {
  const { articles: liveArticles, isLoading } = useYesterday()

  // Use live SWR data; fall back to SSR pre-fetched data
  const articles =
    liveArticles.length > 0
      ? liveArticles
      : (initialFeed?.articles ?? [])

  return (
    <FeedGrid
      articles={articles}
      loading={isLoading && articles.length === 0}
      showCountdown={false}   // No countdown on expired content
    />
  )
}
