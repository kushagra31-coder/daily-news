import useSWR from 'swr'
import type { FeedResponse, StatsResponse, ReportResponse } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// ─── Base Fetcher ─────────────────────────────────────────────────────────────

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 },   // always fresh on SSR; SWR handles client cache
  })

  if (!res.ok) {
    const error = new Error(`API error ${res.status}: ${res.statusText}`) as Error & {
      status: number
      info: unknown
    }
    error.status = res.status
    try {
      error.info = await res.json()
    } catch {
      error.info = null
    }
    throw error
  }

  return res.json() as Promise<T>
}

// ─── Feed Hook ────────────────────────────────────────────────────────────────

export function useFeed(category?: string, page: number = 1) {
  const params = new URLSearchParams()
  if (category && category !== 'all') params.set('category', category)
  params.set('page', String(page))

  const key = `/api/feed?${params.toString()}`

  const { data, error, isLoading, mutate } = useSWR<FeedResponse>(key, fetcher, {
    refreshInterval: 5 * 60 * 1000,   // auto-refresh every 5 minutes
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  })

  return {
    feed: data,
    articles: data?.articles ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
    nextResetInSeconds: data?.next_reset_in_seconds ?? 0,
  }
}

// ─── Yesterday Hook ───────────────────────────────────────────────────────────

export function useYesterday() {
  const { data, error, isLoading } = useSWR<FeedResponse>(
    '/api/yesterday',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  return {
    articles: data?.articles ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
  }
}

// ─── Stats Hook ───────────────────────────────────────────────────────────────

export function useStats() {
  const { data, error, isLoading } = useSWR<StatsResponse>(
    '/api/stats',
    fetcher,
    {
      refreshInterval: 60 * 1000,   // refresh every 60 seconds
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  )

  return {
    stats: data,
    isLoading,
    isError: !!error,
    error,
  }
}

// ─── Report Article ───────────────────────────────────────────────────────────

export async function reportArticle(
  id: string,
  reason: string,
  description?: string
): Promise<ReportResponse> {
  const res = await fetch(`/api/report/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: id, reason, description }),
  })

  if (!res.ok) {
    throw new Error(`Report failed: ${res.statusText}`)
  }

  return res.json() as Promise<ReportResponse>
}

// ─── Click Tracking ───────────────────────────────────────────────────────────

/**
 * Fire-and-forget: records a click event for analytics.
 * Never throws — silently fails on network error.
 */
export function trackClick(id: string): void {
  fetch(`/api/click/${id}`, { method: 'POST' }).catch(() => {
    // intentionally silent
  })
}

// ─── Server-side prefetch (for SSR in page.tsx) ───────────────────────────────

export async function prefetchFeed(
  category?: string,
  page: number = 1
): Promise<FeedResponse | null> {
  try {
    const params = new URLSearchParams()
    if (category && category !== 'all') params.set('category', category)
    params.set('page', String(page))

    const url = `${BACKEND_URL}/api/feed?${params.toString()}`
    return await fetcher<FeedResponse>(url)
  } catch {
    return null
  }
}

export async function prefetchStats(): Promise<StatsResponse | null> {
  try {
    return await fetcher<StatsResponse>(`${BACKEND_URL}/api/stats`)
  } catch {
    return null
  }
}
