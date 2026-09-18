// ─── Format countdown string ──────────────────────────────────────────────────

/**
 * Returns a human-readable countdown string.
 * Examples: "4h 22m", "45m", "< 1m", "Expired"
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  if (secs > 0) {
    return `< 1m`
  }
  return 'Expired'
}

// ─── Expiry percentage ────────────────────────────────────────────────────────

/**
 * Returns 0–100 where 100 = just published, 0 = expired.
 * Uses the article's published_at timestamp + configured TTL.
 */
export function getExpiryPercentage(
  publishedAt: string,
  ttlHours: number = 24
): number {
  const publishedMs = new Date(publishedAt).getTime()
  const expiresMs = publishedMs + ttlHours * 60 * 60 * 1000
  const nowMs = Date.now()

  if (nowMs >= expiresMs) return 0
  if (nowMs <= publishedMs) return 100

  const elapsed = nowMs - publishedMs
  const total = expiresMs - publishedMs
  return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100))
}

// ─── Expiry state helpers ─────────────────────────────────────────────────────

/**
 * True if less than `threshold` seconds remain (default 1 hour).
 */
export function isExpiringSoon(
  seconds: number,
  threshold: number = 3600
): boolean {
  return seconds > 0 && seconds < threshold
}

/**
 * True if less than `threshold` seconds remain (default 10 minutes).
 */
export function isCritical(
  seconds: number,
  threshold: number = 600
): boolean {
  return seconds > 0 && seconds < threshold
}

// ─── Bar color helper ─────────────────────────────────────────────────────────

/**
 * Returns a Tailwind background colour class based on remaining percentage.
 */
export function getBarColorClass(percentage: number): string {
  if (percentage > 50) return 'bg-emerald-500'
  if (percentage > 20) return 'bg-amber-400'
  if (percentage > 10) return 'bg-red-500'
  return 'bg-red-600'
}

/**
 * Returns a hex colour for inline styles (e.g. inline SVG).
 */
export function getBarHexColor(percentage: number): string {
  if (percentage > 50) return '#10b981'
  if (percentage > 20) return '#fbbf24'
  if (percentage > 10) return '#ef4444'
  return '#dc2626'
}
