'use client'

import { AnimatePresence, motion } from 'framer-motion'


// ─── Props ────────────────────────────────────────────────────────────────────

interface BreakingBannerProps {
  isBreaking: boolean
  publishedAt: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BreakingBanner({
  isBreaking,
  publishedAt,
}: BreakingBannerProps) {
  if (!isBreaking) return null



  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        role="alert"
        aria-label="Breaking news"
        className="w-full"
      >
        <motion.div
          animate={{ backgroundColor: ['#dc2626', '#ef4444', '#dc2626'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center gap-2 px-3 py-1 rounded-t-xl"
        >
          {/* Blinking dot */}
          <motion.span
            className="inline-block h-2 w-2 rounded-full bg-white flex-shrink-0"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            aria-hidden="true"
          />
          <span className="text-white font-black tracking-widest uppercase text-[11px] select-none">
            🔴 BREAKING
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
