'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  formatCountdown,
  getExpiryPercentage,
  isCritical,
  isExpiringSoon,
  getBarHexColor,
} from '@/lib/countdown'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpiryBarProps {
  expiresAt: string
  publishedAt: string
  /** When false, bar is hidden (e.g. on Yesterday page) */
  showCountdown?: boolean
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpiryBar({
  expiresAt,
  publishedAt,
  showCountdown = true,
  className = '',
}: ExpiryBarProps) {
  const calc = () => {
    const expiresMs = new Date(expiresAt).getTime()
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000))
  }
  const [remainingSeconds, setRemainingSeconds] = useState<number>(calc())

  useEffect(() => {
    setRemainingSeconds(calc())
    const interval = setInterval(() => {
      setRemainingSeconds(calc())
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (!showCountdown) return null

  const percentage = getExpiryPercentage(publishedAt)
  const critical = isCritical(remainingSeconds)
  const expiringSoon = isExpiringSoon(remainingSeconds)
  const expired = remainingSeconds <= 0

  const barColor = getBarHexColor(percentage)
  const label = formatCountdown(remainingSeconds)

  // ── Pulse wrapper (only for critical / near-expiry) ──
  const PulseWrapper = critical
    ? ({ children }: { children: React.ReactNode }) => (
        <motion.div
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>

  return (
    <div className={`w-full select-none ${className}`} aria-label={`Expires in ${label}`}>
      {/* ── Track ── */}
      <div className="relative h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'linear' }}
        />
      </div>

      {/* ── Label ── */}
      <PulseWrapper>
        <div
          className={`mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums
            ${expired
              ? 'text-gray-400 dark:text-gray-600'
              : critical
                ? 'text-red-500 dark:text-red-400'
                : expiringSoon
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}
        >
          {/* Dot indicator */}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: expired ? '#9ca3af' : barColor }}
          />
          <span>
            {expired
              ? 'Expired'
              : critical
                ? `⚡ Vanishes in ${label}`
                : expiringSoon
                  ? `⏳ ${label} left`
                  : `⌛ ${label} left`
            }
          </span>
        </div>
      </PulseWrapper>
    </div>
  )
}
