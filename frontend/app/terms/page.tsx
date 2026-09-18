import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Terms of Use | Daily Vanish',
  description: 'Terms of use, copyright policy, and DMCA information for Daily Vanish News.',
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline mb-8 transition-colors"
        aria-label="Back to today'\''s news"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Today&apos;s News
      </Link>

      <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Terms of Use</h1>
      <p className="text-sm text-gray-500 dark:text-gray-500 mb-10">
        Last updated: September 2026
      </p>

      <div className="prose space-y-8">
        <section>
          <h2>What We Do</h2>
          <p>
            Daily Vanish News aggregates headlines and brief summaries from public news sources. We
            do not host or reproduce full articles. Every article card links directly to the
            original publisher, ensuring proper attribution and traffic to the source.
          </p>
        </section>

        <section>
          <h2>Copyright &amp; Content</h2>
          <p>
            All article headlines and summaries link back to their original publishers. We store
            only: the headline, a brief 1–2 sentence summary (written in our own words or derived
            from the OpenGraph metadata provided by the publisher), source attribution, and
            thumbnail images provided by RSS feeds or OpenGraph metadata.
          </p>
          <p>
            Our use of brief summaries constitutes fair use / fair dealing under applicable law. We
            do not reproduce the full body text of any article.
          </p>
        </section>

        <section>
          <h2>Ephemeral Content</h2>
          <p>
            All content automatically expires after 24 hours. Yesterday&apos;s edition is available
            for a limited catch-up window, after which content is permanently deleted from our
            systems. This design minimises copyright exposure and encourages readers to engage with
            current news.
          </p>
        </section>

        <section>
          <h2>Verification &amp; Accuracy</h2>
          <p>
            We apply automated verification checks (source reputation, cross-referencing, and AI
            fact-checking) to articles. These checks are probabilistic and not a guarantee of
            accuracy. Always verify important news at the original source.
          </p>
          <p>
            Verification badges (Verified, Multi-source, AI-checked) reflect our confidence level
            at time of aggregation. They do not constitute editorial endorsement.
          </p>
        </section>

        <section>
          <h2>Reporting Misinformation</h2>
          <p>
            Use the Report button on any article to flag potential misinformation, misleading
            content, or inappropriate material. Our moderation team reviews all reports. Articles
            under review may have their verification badge updated or be removed before the 24-hour
            expiry.
          </p>
        </section>

        <section>
          <h2>DMCA Notices</h2>
          <p>
            If you are a rights holder and believe we have aggregated content in violation of your
            copyright, please contact us. We will process valid DMCA takedown notices within 24
            hours. Note that all content expires automatically anyway, minimising the window of any
            potential infringement.
          </p>
        </section>

        <section>
          <h2>Push Notifications</h2>
          <p>
            We request push notification permission only after you&apos;ve shown engagement with the
            site (typically after 3 article clicks or 30 seconds on page). You may withdraw
            permission at any time via your browser settings.
          </p>
        </section>

        <section>
          <h2>Limitation of Liability</h2>
          <p>
            Daily Vanish is an aggregation service provided &ldquo;as-is.&rdquo; We make no warranties
            about the accuracy, completeness, or timeliness of aggregated content. We are not
            liable for any decisions made based on content displayed on this platform.
          </p>
        </section>
      </div>

      {/* Footer links */}
      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-4 text-sm">
        <Link href="/" className="text-blue-500 hover:underline">← Today&apos;s News</Link>
        <Link href="/yesterday" className="text-blue-500 hover:underline">Yesterday&apos;s Edition</Link>
      </div>
    </main>
  )
}
