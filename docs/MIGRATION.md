# Migration Plan (v1 -> v2)

## Overview
This document tracks the migration from the MongoDB/FastAPI stack to the Turso/Worker stack.
**Rule: A phase is DONE only when its behavior works and has been tested—not when its folders, config files, or scaffolding exist.**

## Phases
*   [x] **Phase 1: Freeze Existing Product** - ✅ Done.
*   [x] **Phase 2: Fix Data Model (expires_at)** - ✅ Verified (MongoDB TTL replaced, frontend tested and works).
*   [ ] **Phase 3: Replace MongoDB with Turso** - 🟡 Scaffolded (Schema exists, waiting for connection).
*   [x] **Phase 4: Remove Redis** - ✅ Verified (All Redis code & limiters purged from API, endpoints return 200).
*   [ ] **Phase 5: Build Generic Ingestion** - ❌ Not done.
*   [x] **Phase 6: Build Source Registry** - ✅ Verified (sources.json is actively feeding pipeline).
*   [ ] **Phase 7: Dedup & Clustering** - ❌ Not done.
*   [x] **Phase 8: Simplify Verification** - ✅ Verified (LLM logic removed).
*   [ ] **Phase 9: Move Cron to Cloudflare** - 🟡 Scaffolded.
*   [ ] **Phase 10: Create V2 Edge API** - 🟡 Scaffolded.
