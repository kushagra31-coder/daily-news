# Current Architecture (v1)

## Overview
The current v1 architecture is built on a heavy Python/Node stack designed for rapid prototyping, but relies heavily on databases and background compute that scale poorly for a free tier.

## Tech Stack
*   **Frontend:** Next.js 14 (App Router)
*   **Backend:** Python FastAPI (Uvicorn)
*   **Database:** MongoDB Atlas (NoSQL)
*   **Caching/Rate Limiting:** Upstash Redis
*   **News Ingestion:** NewsAPI + RSS Feeds (Feedparser)
*   **Verification:** OpenAI GPT-4o-mini (LLM)
*   **Automation:** GitHub Actions (hourly cron for fetching, 11:55PM cron for archiving)

## Core Dependencies
*   **MongoDB TTL:** The entire application state relies on MongoDB's Time-To-Live indexes to automatically delete documents 24 hours after their published_at timestamp.
*   **NewsAPI:** Heavy dependency on a third-party paid API for general news.
*   **Redis:** Used purely for FastAPI rate-limiting, adding unnecessary network hops.

## Data Flow
1. GitHub Actions hits /api/ingest hourly.
2. FastAPI fetches from NewsAPI and RSS.
3. FastAPI runs SimHash/SHA-256 deduplication and clustering.
4. FastAPI sends unverified claims to OpenAI.
5. Articles are inserted into MongoDB with a TTL index.
6. Next.js fetches from FastAPI /api/feed and displays to users.
