'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { forwardRef } from 'react'
import type { Article } from '@/lib/types'
import { trackClick } from '@/lib/api'
import { trackEngagement } from '@/lib/notifications'
import ExpiryBar from '@/components/ExpiryBar'
import VerifyBadge from '@/components/VerifyBadge'
import BreakingBanner from '@/components/BreakingBanner'

const CATEGORY_GRADIENTS: Record<string, string> = {
  tech:    'from-blue-500 to-purple-600',
  world:   'from-emerald-500 to-teal-600',
  india:   'from-orange-400 to-amber-500',
  finance: 'from-green-500 to-yellow-500',
  sports:  'from-amber-400 to-red-500',
  health:  'from-pink-400 to-orange-500',
  science: 'from-indigo-500 to-cyan-400',
  default: 'from-gray-500 to-gray-700',
}

interface NewsCardProps {
  article: Article
  index?: number
  showCountdown?: boolean
}

const NewsCard = forwardRef<HTMLElement, NewsCardProps>(({ article, index = 0, showCountdown = true }, ref) => {
  const gradient =
    CATEGORY_GRADIENTS[article.category.toLowerCase()] ??
    CATEGORY_GRADIENTS.default

  function handleClick() {
    trackClick(article.id)
    trackEngagement('click')
  }

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
      className={`
        group relative flex flex-col rounded-none border border-gray-200 overflow-hidden
        bg-white dark:bg-gray-900
        shadow-sm hover:
        ring-1 ring-gray-200/70 dark:ring-gray-700/70
        transition-shadow duration-300
        ${article.is_breaking ? 'shadow-card-breaking ring-red-400/40 dark:ring-red-600/40' : ''}
      `}
    >
      <BreakingBanner
        isBreaking={article.is_breaking}
        publishedAt={article.published_at}
      />

      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block relative w-full aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0"
        aria-label={`Read full article: ${article.title}`}
        tabIndex={0}
      >
        {article.image_url ? (
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            aria-hidden="true"
          >
            <span className="text-4xl opacity-70 select-none">
              dY'
            </span>
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider text-white bg-black/50 backdrop-blur-sm">
          {article.category}
        </span>
      </a>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {article.source_favicon && (
              <img
                src={article.source_favicon}
                alt={`${article.source_name} favicon`}
                width={14}
                height={14}
                className="rounded-sm flex-shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">
              {article.source_name}
            </span>

            {article.language === 'hi' && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 flex-shrink-0"
                title="Hindi language article"
              >
                हिंदी समाचार
              </span>
            )}
          </div>

          <VerifyBadge
            verified={article.verified}
            score={article.verification_score}
            tier={article.verification_tier}
            sourceCount={article.source_count}
            sourceName={article.source_name}
            sourceTrustScore={article.source_trust_score}
          />
        </div>

        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="
            text-[15px] font-bold leading-snug text-gray-900 dark:text-gray-50
            line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400
            transition-colors duration-150
          "
        >
          {article.title}
        </a>

        {article.summary && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-1">
            {article.summary}
          </p>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

        {showCountdown && (
          <ExpiryBar
            expiresAt={article.expires_at}
            publishedAt={article.published_at}
          />
        )}

        <div className="flex items-center justify-between gap-1 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          <div className="flex items-center gap-2 min-w-0">
            {article.author && (
              <span className="truncate max-w-[100px]">{article.author}</span>
            )}
            {article.author && <span>•</span>}
            <span className="capitalize">{article.category}</span>
          </div>

          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="
              flex items-center gap-1 px-2.5 py-1 rounded-none font-semibold text-[11px]
              bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300
              hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400
              transition-colors duration-150 flex-shrink-0
            "
            aria-label={`Read full article at ${article.source_name}`}
          >
            Read
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 7L7 17M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>
    </motion.article>
  )
})

NewsCard.displayName = 'NewsCard'

export default NewsCard
