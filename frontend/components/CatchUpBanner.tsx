import Link from 'next/link'

// ─── Component ────────────────────────────────────────────────────────────────

export default function CatchUpBanner() {
  return (
    <div className="w-full mt-8">
      <Link
        href="/yesterday"
        className="
          group flex items-center justify-between gap-4 w-full
          px-5 py-4 rounded-2xl
          bg-gradient-to-r from-gray-50 to-blue-50/50
          dark:from-gray-900/80 dark:to-blue-950/20
          border border-gray-200/70 dark:border-gray-700/50
          hover:border-blue-300/70 dark:hover:border-blue-700/50
          hover:from-blue-50 hover:to-blue-100/50
          dark:hover:from-blue-950/30 dark:hover:to-blue-950/20
          transition-all duration-200 shadow-sm hover:shadow-md
        "
      >
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">📅</span>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Missed something?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              View Yesterday&apos;s Edition — archived headlines, no longer live
            </p>
          </div>
        </div>

        <span
          className="
            flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400
            group-hover:translate-x-1 transition-transform duration-200
          "
          aria-hidden="true"
        >
          View archive →
        </span>
      </Link>
    </div>
  )
}
