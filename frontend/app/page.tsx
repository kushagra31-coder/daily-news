import { Suspense } from 'react'
import { prefetchFeed, prefetchStats } from '@/lib/api'
import TodayFeed from '@/components/TodayFeed'

// â”€â”€â”€ Page metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const metadata = {
  title: "Today's Headlines | Daily Vanish",
}

// Force dynamic so ISR / edge freshness works (no stale SSR cache)
export const dynamic = 'force-dynamic'

// â”€â”€â”€ Loading fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FeedLoadingFallback() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
      {Array(12).fill(0).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-none-none overflow-hidden bg-white  ring-1 ring-gray-200/70 "
        >
          <div className="h-40 bg-gray-200 " />
          <div className="p-4 space-y-3">
            <div className="h-3 bg-gray-200  rounded-none w-1/4" />
            <div className="h-5 bg-gray-200  rounded-none w-full" />
            <div className="h-4 bg-gray-200  rounded-none w-3/4" />
            <div className="h-1.5 bg-gray-200  rounded-none-none w-full mt-4" />
          </div>
        </div>
      ))}
    </div>
  )
}

// â”€â”€â”€ Page (Server Component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default async function HomePage() {
  // SSR pre-fetch — runs on the server, used as SWR fallback
  const [initialFeed, initialStats] = await Promise.allSettled([
    prefetchFeed(),
    prefetchStats(),
  ])

  const feedData  = initialFeed.status  === 'fulfilled' ? initialFeed.value  : null
  const statsData = initialStats.status === 'fulfilled' ? initialStats.value : null

  return (
    <Suspense fallback={<FeedLoadingFallback />}>
      <TodayFeed initialFeed={feedData} initialStats={statsData} />
    </Suspense>
  )
}
