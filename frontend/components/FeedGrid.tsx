'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { forwardRef } from 'react'
import type { Article } from '@/lib/types'
import NewsCard from '@/components/NewsCard'

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-none border border-gray-200 overflow-hidden bg-white dark:bg-gray-900 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
      <div className="h-40 bg-gray-200 dark:bg-gray-700" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full w-full mt-4" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-14" />
        </div>
      </div>
    </div>
  )
}

const EmptyState = forwardRef<HTMLDivElement>((props, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4"
    >
      <span className="text-6xl" aria-hidden="true">📰</span>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
        No news in this category yet
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-500 max-w-sm">
        Stories appear here as our engine detects and clusters breaking events.
        New headlines land every hour — check back soon.
      </p>
    </motion.div>
  )
})

EmptyState.displayName = 'EmptyState'

interface FeedGridProps {
  articles: Article[]
  loading: boolean
  showCountdown?: boolean
}

export default function FeedGrid({
  articles,
  loading,
  showCountdown = true,
}: FeedGridProps) {
  return (
    <section
      aria-label="News feed"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      <AnimatePresence mode="popLayout">
        {loading ? (
          Array(12).fill(0).map((_, i) => (
            <motion.div
              key={`skeleton-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <SkeletonCard />
            </motion.div>
          ))
        ) : articles.length === 0 ? (
          <EmptyState key="empty" />
        ) : (
          articles.map((article, i) => (
            <NewsCard
              key={article.id || article.canonical_url || `news-${i}`}
              article={article}
              index={i}
              showCountdown={showCountdown}
            />
          ))
        )}
      </AnimatePresence>
    </section>
  )
}
