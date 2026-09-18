'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { formatCountdown, isExpiringSoon } from '@/lib/countdown'

interface MidnightCountdownProps {
  nextResetInSeconds: number
}

function getLocalMidnightSeconds(): number {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000)
}

export default function MidnightCountdown({
  nextResetInSeconds,
}: MidnightCountdownProps) {
  // Always use user-local time for the daily reset.
  const [seconds, setSeconds] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setSeconds(getLocalMidnightSeconds())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || seconds <= 0) return

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(id)
  }, [mounted])

  if (!mounted || seconds <= 0) return null

  const nearExpiry = isExpiringSoon(seconds, 3600)
  const label = formatCountdown(seconds)

  return (
    <motion.div suppressHydrationWarning
      animate={nearExpiry ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
      transition={nearExpiry ? { duration: 1.5, repeat: Infinity } : {}}
      className={`
        flex items-center gap-1.5 text-xs font-semibold tabular-nums
        px-3 py-1.5 rounded-full border
        ${nearExpiry
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400'
        }
      `}
      aria-label={`Next edition resets in ${label}`}
      role="timer"
    >
      <span aria-hidden="true">{nearExpiry ? "⏳" : "⌛"}</span>
      <span className="hidden sm:inline">Next edition resets in </span>
      <span className="sm:hidden">Resets in </span>
      <span className="font-black text-gray-900 dark:text-gray-100">{label}</span>
    </motion.div>
  )
}
