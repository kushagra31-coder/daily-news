'use client'

import { useEffect } from 'react'
import { trackEngagement } from '@/lib/notifications'

/**
 * Invisible client component that runs the time-based engagement tracker.
 * Calls trackEngagement('time') every 10 seconds.
 * Mounted once in the root layout — no UI output.
 */
export default function EngagementTracker() {
  useEffect(() => {
    const id = setInterval(() => {
      trackEngagement('time')
    }, 10_000)

    return () => clearInterval(id)
  }, [])

  return null
}
