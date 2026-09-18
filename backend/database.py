"""
database.py -- Async MongoDB connection and index management.

Uses Motor (async driver) so every database call is non-blocking and
compatible with FastAPI async request handlers.
"""

from __future__ import annotations

import logging
from typing import Optional

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)
from pymongo import ASCENDING, DESCENDING, IndexModel

from config import settings

logger = logging.getLogger(__name__)

# Module-level client -- reused across requests (Motor manages the internal
# connection pool so it is safe to share a single client).
_client: Optional[AsyncIOMotorClient] = None  # type: ignore[type-arg]


def _get_client() -> AsyncIOMotorClient:  # type: ignore[type-arg]
    """Return (and lazily create) the shared Motor client."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=10,
            minPoolSize=1,
            serverSelectionTimeoutMS=5_000,
        )
        logger.info("Motor client initialised.")
    return _client


def get_database() -> AsyncIOMotorDatabase:  # type: ignore[type-arg]
    """Return the application AsyncIOMotorDatabase instance.

    The client is lazily initialised on first call and reused on
    subsequent calls, so calling this function is cheap.
    """
    return _get_client()[settings.MONGODB_DB_NAME]


def get_articles_collection() -> AsyncIOMotorCollection:  # type: ignore[type-arg]
    """Return the live ``articles`` collection (has TTL index)."""
    return get_database()["articles"]


def get_archive_collection() -> AsyncIOMotorCollection:  # type: ignore[type-arg]
    """Return the ``articles_archive`` collection (no TTL, persistent)."""
    return get_database()["articles_archive"]


async def setup_indexes() -> None:
    """Create all necessary MongoDB indexes.

    Safe to call on every application startup -- ``create_indexes`` is
    idempotent and skips existing indexes automatically.

    Indexes on ``articles``:
    - TTL on ``published_at`` (expires after TTL_HOURS * 3600 seconds)
    - Unique on ``url_hash`` (prevents duplicate ingestion)
    - Unique on ``canonical_url`` (handles syndicated content)
    - Compound (category ASC, published_at DESC)
    - Compound (verified ASC, engagement_score DESC)
    - Single on ``cluster_id``
    - Single on ``moderation_status``
    - Single on ``is_breaking``
    - Single on ``visible``
    - Single on ``expiry_warning_sent``

    Indexes on ``articles_archive``:
    - Compound (published_date DESC, category ASC)
    - Unique on ``url_hash``
    """
    articles = get_articles_collection()
    archive = get_archive_collection()

    # ------------------------------------------------------------------ #
    # Live articles collection
    # ------------------------------------------------------------------ #
    article_indexes = [
        # TTL -- MongoDB deletes documents this many seconds after published_at.
        IndexModel(
            [("expires_at", ASCENDING)],
            name="idx_expires_at",
            
        ),
        # Unique constraint prevents duplicate ingestion of the same URL.
        IndexModel(
            [("url_hash", ASCENDING)],
            name="unique_url_hash",
            unique=True,
        ),
        # Canonical URL uniqueness catches syndicated duplicates.
        IndexModel(
            [("canonical_url", ASCENDING)],
            name="unique_canonical_url",
            unique=True,
            sparse=True,  # Allow missing canonical_url without breaking uniqueness.
        ),
        # Category feed -- most recent first within each category.
        IndexModel(
            [("category", ASCENDING), ("published_at", DESCENDING)],
            name="category_published_at",
        ),
        # Verified / ranked feed -- show verified and high-engagement first.
        IndexModel(
            [("verified", ASCENDING), ("engagement_score", DESCENDING)],
            name="verified_engagement",
        ),
        # Cluster membership -- used by corroboration verifier.
        IndexModel(
            [("cluster_id", ASCENDING)],
            name="cluster_id",
            sparse=True,
        ),
        # Moderation filter -- quickly skip removed/pending content.
        IndexModel(
            [("moderation_status", ASCENDING)],
            name="moderation_status",
        ),
        # Breaking news flag -- WebSocket broadcast queries.
        IndexModel(
            [("is_breaking", ASCENDING)],
            name="is_breaking",
        ),
        # Visibility flag.
        IndexModel(
            [("visible", ASCENDING)],
            name="visible",
        ),
        # Expiry warning -- scheduler queries articles needing a push notification.
        IndexModel(
            [("expiry_warning_sent", ASCENDING), ("expires_at", ASCENDING)],
            name="idx_expiry_warning_sent_v2",
        ),
    ]

    await articles.create_indexes(article_indexes)
    logger.info("Article collection indexes ensured.")

    # ------------------------------------------------------------------ #
    # Archive collection (no TTL)
    # ------------------------------------------------------------------ #
    archive_indexes = [
        # Primary query pattern for /yesterday endpoint.
        IndexModel(
            [("published_date", DESCENDING), ("category", ASCENDING)],
            name="published_date_category",
        ),
        # Prevent duplicates when archiving.
        IndexModel(
            [("url_hash", ASCENDING)],
            name="unique_url_hash",
            unique=True,
        ),
    ]

    await archive.create_indexes(archive_indexes)
    logger.info("Archive collection indexes ensured.")


async def ping_database() -> bool:
    """Send a lightweight ping command to verify MongoDB connectivity.

    Returns:
        True if the database responds successfully, False otherwise.
    """
    try:
        await get_database().command("ping")
        return True
    except Exception as exc:
        logger.error("MongoDB ping failed: %s", exc)
        return False


async def close_database() -> None:
    """Close the Motor client and release all connections.

    Call this during application shutdown to avoid resource leaks.
    """
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("Motor client closed.")
