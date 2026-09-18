# Target Architecture (Serverless / Edge)

## Overview
The goal is to move to a severely optimized, edge-first architecture that can run entirely on free tiers, eliminating heavy containerized backends and expensive NoSQL database queries in favor of Edge Workers and SQLite.

## Target Stack
*   **Frontend:** Next.js (Deployed to Cloudflare Pages)
*   **Backend:** Cloudflare Workers API
*   **Database:** Turso (Edge SQLite) via Drizzle ORM
*   **Caching:** Cloudflare Edge Caching (replacing Redis)
*   **News Ingestion:** Direct RSS / GDELT (replacing NewsAPI)
*   **Automation:** Cloudflare Cron (replacing GitHub Actions)

## Core Improvements
1.  **Database Decoupling:** Replaces MongoDB TTL with explicit expires_at = published_at + 24h fields. Allows frontend and backend to filter via WHERE expires_at > NOW().
2.  **Serverless Ingestion:** Cloudflare Cron triggers a Worker that fetches RSS, normalizes, deduplicates (SHA-256 + SimHash), and stores directly in Turso.
3.  **Source Registry:** Moves from hardcoded Python scripts to a JSON source registry.
4.  **Verification Pivot:** Deprioritizes expensive LLM checks in favor of a robust 3-stage Corroboration Engine (Source Rep -> Corroboration -> Official Signal).

