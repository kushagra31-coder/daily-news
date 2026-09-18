// ─── Article (matches backend Pydantic model) ────────────────────────────────

export interface Article {
  id: string
  title: string
  summary: string
  source_url: string
  source_name: string
  source_favicon: string
  author?: string
  image_url?: string
  category: string
  published_at: string         // ISO 8601 string
  expires_in_seconds?: number
  expires_at: string
  forced_visible_until?: string
  cluster_id?: string

  // Verification
  verified: boolean
  verification_score: number   // 0.0 – 1.0
  verification_tier: string    // "source_rep" | "corroboration" | "llm"

  // Source metadata
  source_count: number
  source_trust_score?: number  // 0.0 – 1.0, used in tooltip

  // Moderation
  moderation_status: string
  user_reports: number

  // Engagement
  engagement_score: number
  click_count: number

  // Flags
  is_breaking: boolean

  // Localisation (enhancement #3)
  language: string             // "en" | "hi" | ...
  country: string              // "IN" | "US" | "GB" | ...

  // SEO / Open Graph
  og_description?: string
  canonical_url: string

  // Notification state
  expiry_warning_sent: boolean
}

// ─── Feed Response ────────────────────────────────────────────────────────────

export interface FeedResponse {
  articles: Article[]
  total: number
  page: number
  has_more: boolean
  next_reset_in_seconds: number
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface StatsResponse {
  total_articles: number
  verified_articles: number
  expiring_soon: number
  categories: Record<string, number>
  last_fetch: string           // ISO 8601 string
}

// ─── Report Request ───────────────────────────────────────────────────────────

export interface ReportRequest {
  article_id: string
  reason: string
  description?: string
}

export interface ReportResponse {
  success: boolean
  message: string
}

// ─── Category Type ────────────────────────────────────────────────────────────

export type Category =
  | 'all'
  | 'world'
  | 'tech'
  | 'india'
  | 'finance'
  | 'sports'
  | 'health'
  | 'science'

export const CATEGORIES: { label: string; value: Category }[] = [
  { label: 'All',     value: 'all' },
  { label: '🌍 World',   value: 'world' },
  { label: '💻 Tech',    value: 'tech' },
  { label: '🇮🇳 India',  value: 'india' },
  { label: '💰 Finance', value: 'finance' },
  { label: '⚽ Sports',  value: 'sports' },
  { label: '🏥 Health',  value: 'health' },
  { label: '🔬 Science', value: 'science' },
]

// ─── Engagement Tracking ──────────────────────────────────────────────────────

export interface EngagementData {
  clicks: number
  timeSpent: number  // seconds
}
