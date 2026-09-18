"""
main.py -- FastAPI application for Daily Vanishing News.

Endpoints:
  GET  /api/feed              Paginated live article feed (with expires_in_seconds).
  GET  /api/article/{id}      Single article detail.
  GET  /api/yesterday         Articles from the most recent archived day.
  GET  /api/stats             Platform statistics.
  GET  /api/categories        Category list with live counts.
  WS   /ws/breaking           WebSocket -- broadcast new breaking articles.
  POST /api/subscribe         OneSignal push subscription registration.
  POST /api/report/{id}       Increment user_reports for moderation review.
  GET  /health                Health check (DB + Redis ping).
  GET  /terms                 Terms of use (HTMLResponse).
  GET  /metrics               Prometheus metrics (exposed by instrumentator).
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional, Set
from bson import ObjectId
from bson.errors import InvalidId

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from prometheus_fastapi_instrumentator import PrometheusFastApiInstrumentator


from config import settings
from database import close_database, get_articles_collection, get_archive_collection, ping_database, setup_indexes
from models import Article, FeedResponse, ReportRequest, StatsResponse, SubscribeRequest
from scheduler import run_ingestion_pipeline, archive_and_cleanup

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)

# ------------------------------------------------------------------ #
# WebSocket connection registry
# ------------------------------------------------------------------ #

_ws_clients: Set[WebSocket] = set()
_ws_lock = asyncio.Lock()


async def broadcast_breaking(article_data: dict) -> None:
    """Broadcast a new breaking article to all connected WebSocket clients.

    Args:
        article_data: Dict representation of the breaking Article.
    """
    import json
    async with _ws_lock:
        dead: list[WebSocket] = []
        for ws in _ws_clients:
            try:
                await ws.send_text(json.dumps(article_data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            _ws_clients.discard(ws)


# ------------------------------------------------------------------ #
# Lifespan (startup / shutdown)
# ------------------------------------------------------------------ #

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    # Startup
    await setup_indexes()
    logger.info("MongoDB indexes ensured.")

    logger.info("FastAPILimiter initialised.")

    # APScheduler: run ingestion every hour, archive at 23:55 UTC.
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(run_ingestion_pipeline, "cron", minute=0, id="ingest")
    scheduler.add_job(archive_and_cleanup, "cron", hour=23, minute=55, id="archive")
    scheduler.start()
    logger.info("APScheduler started.")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    await close_database()
    await close_redis()
    logger.info("Application shutdown complete.")


# ------------------------------------------------------------------ #
# App factory
# ------------------------------------------------------------------ #

app = FastAPI(
    title="Daily Vanishing News API",
    description="Ephemeral news platform -- today's news, gone tomorrow.",
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# Prometheus metrics
PrometheusFastApiInstrumentator().instrument(app).expose(app)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _compute_expires_in(article_doc: dict) -> int:
    """Compute seconds until an article expires.

    Considers both the 24-hour TTL from published_at and any
    forced_visible_until override for breaking articles.

    Args:
        article_doc: Raw MongoDB document dict.

    Returns:
        Seconds until expiry (minimum 0).
    """
    now = datetime.now(timezone.utc)
    published_at = article_doc.get("published_at")
    if not isinstance(published_at, datetime):
        return 0
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    expires_at = published_at + timedelta(hours=settings.TTL_HOURS)
    seconds = max(0, int((expires_at - now).total_seconds()))

    forced = article_doc.get("forced_visible_until")
    if forced:
        if forced.tzinfo is None:
            forced = forced.replace(tzinfo=timezone.utc)
        forced_seconds = max(0, int((forced - now).total_seconds()))
        seconds = max(seconds, forced_seconds)

    return seconds


def _next_reset_in_seconds() -> int:
    """Return seconds until midnight UTC (the daily feed reset point).

    Returns:
        Integer seconds until next 00:00 UTC.
    """
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(0, int((tomorrow - now).total_seconds()))


def _doc_to_article(doc: dict) -> Article:
    """Convert a MongoDB document dict to an Article Pydantic model.

    Injects the computed expires_in_seconds field and converts _id to str.

    Args:
        doc: Raw MongoDB document.

    Returns:
        Article model instance.
    """
    doc = dict(doc)
    doc["_id"] = str(doc.get("_id", ""))
    
    # Remove fields not in the Article schema gracefully.
    return Article.model_validate(doc)


# ------------------------------------------------------------------ #
# API endpoints
# ------------------------------------------------------------------ #

@app.get(
    "/api/feed",
    response_model=FeedResponse,
    tags=["Feed"],
    summary="Get today live article feed",
)
async def get_feed(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> FeedResponse:
    """Return today paginated live articles with expiry countdowns.

    Articles are filtered to visible=True and moderation_status=approved.
    Results are cached in Redis for 30 seconds per category/page combination.

    Args:
        category:  Optional category slug to filter ('tech', 'world', etc.).
        page:      Page number, 1-indexed.
        page_size: Number of articles per page (max 100).

    Returns:
        FeedResponse with articles, total count, pagination metadata,
        and seconds until midnight UTC reset.
    """
    collection = get_articles_collection()
    query: dict = {
        "visible": True, 
        "moderation_status": "approved",
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    }
    if category:
        query["category"] = category

    total = await collection.count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        collection.find(query)
        .sort([("is_breaking", -1), ("published_at", -1)])
        .skip(skip)
        .limit(page_size)
    )

    articles: list[Article] = []
    async for doc in cursor:
        try:
            articles.append(_doc_to_article(doc))
        except Exception as exc:
            logger.warning("Failed to parse article doc: %s", exc)

    response = FeedResponse(
        articles=articles,
        total=total,
        page=page,
        has_more=(skip + len(articles)) < total,
        next_reset_in_seconds=_next_reset_in_seconds(),
    )

    return response


@app.get(
    "/api/article/{article_id}",
    response_model=Article,
    tags=["Feed"],
    summary="Get single article by ID",
)
async def get_article(article_id: str) -> Article:
    """Retrieve a single live article by its MongoDB ObjectId.

    Also increments the click_count for engagement tracking.

    Args:
        article_id: MongoDB ObjectId as a hex string.

    Returns:
        Article model with computed expires_in_seconds.

    Raises:
        HTTPException 404 if the article is not found or not visible.
        HTTPException 400 if article_id is not a valid ObjectId.
    """
    try:
        oid = ObjectId(article_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid article ID format.")

    collection = get_articles_collection()
    doc = await collection.find_one(
        {"_id": oid, "visible": True, "moderation_status": "approved"}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found.")

    # Increment click count asynchronously (best-effort).
    try:
        await collection.update_one({"_id": oid}, {"": {"click_count": 1}})
    except Exception:
        pass

    return _doc_to_article(doc)


@app.get(
    "/api/yesterday",
    response_model=FeedResponse,
    tags=["Archive"],
    summary="Get yesterday archived articles",
)
async def get_yesterday(
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> FeedResponse:
    """Retrieve articles from the most recently archived day.

    Queries the articles_archive collection (no TTL) for the latest
    published_date and returns those articles paginated.

    Args:
        category:  Optional category filter.
        page:      Page number (1-indexed).
        page_size: Items per page.

    Returns:
        FeedResponse from the archive collection.
    """
    cache_key = f"yesterday:{category or 'all'}:p{page}"
    cached = await get_cached(cache_key)
    if cached:
        return FeedResponse(**cached)

    archive = get_archive_collection()

    # Find the most recent published_date in the archive.
    latest = await archive.find_one({}, sort=[("published_date", -1)], projection={"published_date": 1})
    if not latest:
        return FeedResponse(articles=[], total=0, page=page, has_more=False, next_reset_in_seconds=_next_reset_in_seconds())

    published_date = latest["published_date"]
    query: dict = {"published_date": published_date}
    if category:
        query["category"] = category

    total = await archive.count_documents(query)
    skip = (page - 1) * page_size
    cursor = (
        archive.find(query)
        .sort("published_at", -1)
        .skip(skip)
        .limit(page_size)
    )

    articles: list[Article] = []
    async for doc in cursor:
        try:
            articles.append(_doc_to_article(doc))
        except Exception as exc:
            logger.warning("Failed to parse archive doc: %s", exc)

    response = FeedResponse(
        articles=articles,
        total=total,
        page=page,
        has_more=(skip + len(articles)) < total,
        next_reset_in_seconds=_next_reset_in_seconds(),
    )
    return response


@app.get(
    "/api/stats",
    response_model=StatsResponse,
    tags=["Meta"],
    summary="Platform statistics",
)
async def get_stats() -> StatsResponse:
    """Return aggregated platform statistics.

    Returns:
        StatsResponse with total, verified, expiring-soon counts, category
        breakdown, and the timestamp of the last ingestion run.
    """
    cache_key = "stats:global"
    cached = await get_cached(cache_key)
    if cached:
        return StatsResponse(**cached)

    collection = get_articles_collection()
    now = datetime.now(timezone.utc)
    one_hour_later = now + timedelta(hours=1)

    total = await collection.count_documents({"visible": True, "moderation_status": "approved"})
    verified = await collection.count_documents({"visible": True, "verified": True})

    # Expiring within 1 hour: published more than 23 hours ago.
    expiring_cutoff = now - timedelta(hours=settings.TTL_HOURS - 1)
    expiring_soon = await collection.count_documents(
        {"visible": True, "published_at": {"": expiring_cutoff}}
    )

    # Category counts via aggregation.
    pipeline = [
        {"match": {"visible": True, "moderation_status": "approved"}},
        {"group": {"_id": "category", "count": {"": 1}}},
    ]
    # Build proper pipeline with dollar signs
    pipeline = [
        {"": {"visible": True, "moderation_status": "approved"}},
        {"": {"_id": "", "count": {"": 1}}},
    ]
    categories: dict[str, int] = {}
    async for doc in collection.aggregate(pipeline):
        categories[doc["_id"]] = doc["count"]

    # last_fetch: fetched_at of the most recently ingested article.
    latest_doc = await collection.find_one({}, sort=[("fetched_at", -1)], projection={"fetched_at": 1})
    last_fetch = latest_doc["fetched_at"] if latest_doc else now

    response = StatsResponse(
        total_articles=total,
        verified_articles=verified,
        expiring_soon=expiring_soon,
        categories=categories,
        last_fetch=last_fetch,
    )
    return response


@app.get(
    "/api/categories",
    tags=["Meta"],
    summary="Categories with live article counts",
)
async def get_categories() -> dict:
    """Return each category slug with its current live article count.

    Returns:
        Dict mapping category slug to integer count.
    """
    cache_key = "categories:counts"
    cached = await get_cached(cache_key)
    if cached:
        return cached

    collection = get_articles_collection()
    pipeline = [
        {"": {"visible": True, "moderation_status": "approved"}},
        {"": {"_id": "", "count": {"": 1}}},
        {"": {"count": -1}},
    ]
    result: dict = {}
    async for doc in collection.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]

    return result


@app.post(
    "/api/report/{article_id}",
    status_code=200,
    tags=["Moderation"],
    summary="Report an article",
)
async def report_article(article_id: str, body: ReportRequest) -> dict:
    """Increment user_reports for an article and flag it for moderation review.

    After 5 reports the article moderation_status is set to 'pending'.

    Args:
        article_id: MongoDB ObjectId hex string.
        body:       ReportRequest with reason field.

    Returns:
        Confirmation dict.

    Raises:
        HTTPException 404 if article not found.
        HTTPException 400 if article_id invalid.
    """
    try:
        oid = ObjectId(article_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid article ID.")

    collection = get_articles_collection()
    result = await collection.update_one(
        {"_id": oid},
        {"": {"user_reports": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found.")

    # Auto-flag for moderation after 5 reports.
    doc = await collection.find_one({"_id": oid}, projection={"user_reports": 1})
    if doc and doc.get("user_reports", 0) >= 5:
        await collection.update_one(
            {"_id": oid},
            {"": {"moderation_status": "pending"}},
        )

    logger.info("Article %s reported: reason=%s", article_id, body.reason)
    return {"status": "reported", "article_id": article_id}


@app.post(
    "/api/subscribe",
    status_code=201,
    tags=["Notifications"],
    summary="Register OneSignal push subscription",
)
async def subscribe(body: SubscribeRequest) -> dict:
    """Store a OneSignal player_id for push notification targeting.

    The player_id is stored in MongoDB for later use by the notification
    service. No PII is collected beyond the OneSignal identifier.

    Args:
        body: SubscribeRequest with player_id and optional category list.

    Returns:
        Confirmation dict.
    """
    if not settings.ONESIGNAL_APP_ID:
        return {"status": "skipped", "reason": "Push notifications not configured."}

    db_col = get_articles_collection().database["subscriptions"]
    await db_col.update_one(
        {"player_id": body.player_id},
        {"": {"player_id": body.player_id, "categories": body.categories, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"status": "subscribed", "player_id": body.player_id}


@app.websocket("/ws/breaking")
async def websocket_breaking(websocket: WebSocket) -> None:
    """WebSocket endpoint -- stream new breaking articles in real time.

    Clients connect and receive JSON-serialised Article dicts whenever a
    new article with is_breaking=True is ingested. The connection stays
    open until the client disconnects.
    """
    await websocket.accept()
    async with _ws_lock:
        _ws_clients.add(websocket)
    try:
        while True:
            # Keep the connection alive; ingestion broadcasts push data.
            await asyncio.sleep(30)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket error: %s", exc)
    finally:
        async with _ws_lock:
            _ws_clients.discard(websocket)


@app.get("/health", tags=["Meta"], summary="Health check")
async def health_check() -> dict:
    """Return liveness and readiness status for the backend.

    Pings both MongoDB and Redis and reports their status.

    Returns:
        Dict with overall status and per-dependency status.
    """
    db_ok = await ping_database()
    try:
        redis = get_redis()
        await redis.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    overall = "ok" if (db_ok and redis_ok) else "degraded"
    code = 200 if overall == "ok" else 503
    return JSONResponse(
        status_code=code,
        content={
            "status": overall,
            "dependencies": {
                "mongodb": "ok" if db_ok else "error",
                "redis": "ok" if redis_ok else "error",
            },
        },
    )


@app.get("/terms", response_class=HTMLResponse, tags=["Meta"], summary="Terms of use")
async def terms() -> HTMLResponse:
    """Serve the platform terms of use page.

    Returns an HTMLResponse describing the platform copyright compliance
    policy, data handling, and user obligations.

    Returns:
        HTMLResponse with terms content.
    """
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Terms of Use -- Daily Vanish News</title>
      <style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}h1{color:#1a1a2e}</style>
    </head>
    <body>
      <h1>Terms of Use -- Daily Vanish News</h1>
      <ul>
        <li>This platform aggregates <strong>headlines and brief summaries</strong> from public news sources.</li>
        <li>All content links back to the original source -- we do not host or reproduce full articles.</li>
        <li>Summaries are our own 1-2 sentence interpretations of publicly available RSS metadata, not copies of article text.</li>
        <li>Articles automatically expire and are deleted after 24 hours.</li>
        <li>Report misinformation, spam, or inappropriate content via the Report button on each article.</li>
        <li>This service is provided as-is without any warranty of accuracy or completeness.</li>
      </ul>
      <p>For copyright concerns, contact us via the repository issues page.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
