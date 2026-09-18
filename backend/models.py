"""
models.py -- Pydantic v2 data models for Daily Vanishing News.

All API request / response shapes and MongoDB document schemas live here.
IMPORTANT: Full article text is NEVER stored. Only headline, own-worded
summary (<= 200 chars), source URL, image URL, and metadata are persisted.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Core article document
# --------------------------------------------------------------------------- #


class Article(BaseModel):
    """Represents a single news article stored in MongoDB.

    The TTL index on ``published_at`` ensures MongoDB automatically removes
    documents after 24 hours, making the collection ephemeral by design.

    Copyright note: Only ``title``, ``summary`` (own-wording, <=200 chars),
    ``source_url``, ``image_url`` and metadata fields are stored -- never
    full article body text.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None, alias="_id")
    """MongoDB ObjectId as string. Populated when reading from the DB."""

    url_hash: str
    """SHA-256 of the canonical (normalised) source URL. Unique index key."""

    title_hash: str
    """SimHash of the article title used for near-deduplication."""

    title: str
    """Original article headline -- the only verbatim text from the source."""

    summary: str
    """1-2 sentence own-worded summary (<= 200 chars). NOT the article body."""

    source_url: str
    """Link to the original article page."""

    canonical_url: str = ""
    """Canonical URL after normalization (stripping tracking params, enforcing HTTPS).
    Used alongside url_hash to detect syndicated content across different domains."""

    source_name: str
    """Human-readable publisher name, e.g. "BBC", "Reuters"."""

    source_favicon: str = ""
    """URL of the publisher's favicon for display purposes."""

    author: Optional[str] = None
    """Byline author name when available in the RSS feed."""

    image_url: Optional[str] = None
    """OpenGraph or RSS thumbnail URL. Never a scraped full-article image."""

    og_description: Optional[str] = None
    """OpenGraph meta description -- copyright-safe snippet from the source page."""

    category: str = "general"
    """Topic category: 'tech' | 'world' | 'finance' | 'india' | 'general'."""

    language: str = "en"
    """BCP-47 language code of the article, e.g. 'en', 'hi'."""

    country: str = "IN"
    """ISO-3166-1 alpha-2 country code for geo-targeting, e.g. 'IN', 'US', 'GB'."""

    published_at: datetime
    """Publication timestamp. MongoDB TTL index fires 24 h after this value."""

    fetched_at: datetime
    """Timestamp when the article was ingested by the pipeline."""

    forced_visible_until: Optional[datetime] = None
    """Overrides TTL: breaking articles remain visible for at least 2 hours
    from ingestion even if published_at would expire them sooner."""

    cluster_id: Optional[str] = None
    """Identifier shared by articles covering the same story / event."""

    verified: bool = False
    """True once the article passes any verification tier."""

    verification_score: float = 0.0
    """Confidence score in [0.0, 1.0] assigned by the verification engine."""

    verification_tier: str = "pending"
    """Which tier produced the result: 'source_rep' | 'corroboration' |
    'llm' | 'pending'."""

    source_count: int = 1
    """Number of distinct sources covering the same cluster."""

    moderation_status: str = "approved"
    """Human / automated moderation state: 'approved' | 'pending' | 'removed'."""

    user_reports: int = 0
    """Accumulated user-submitted reports (misinformation, spam, etc.)."""

    engagement_score: float = 0.0
    """Derived engagement metric used for feed ranking."""

    click_count: int = 0
    """Number of times users clicked through to the original article."""

    visible: bool = True
    """Set to False to soft-hide an article without waiting for TTL."""

    is_breaking: bool = False
    """True when the article was fetched within the last 2 hours or has breaking keywords."""

    expiry_warning_sent: bool = False
    """True once the 1-hour-before-expiry push notification has been dispatched.
    Prevents duplicate notifications on subsequent scheduler runs."""

    expires_at: datetime
    """Absolute expiration timestamp (published_at + 24h). Used for live queries."""


# --------------------------------------------------------------------------- #
# Archive document
# --------------------------------------------------------------------------- #


class ArticleArchive(Article):
    """Cold-storage copy of an article.

    Identical schema to ``Article`` but stored in the ``articles_archive``
    collection which has NO TTL index, so records persist indefinitely and
    can be queried via the /yesterday endpoint.
    """

    archived_at: datetime
    """When the archive job copied this document."""

    published_date: str
    """YYYY-MM-DD string derived from ``published_at``. Used as a filter
    key so /yesterday can efficiently retrieve all articles from a given day."""


# --------------------------------------------------------------------------- #
# API response shapes
# --------------------------------------------------------------------------- #


class FeedResponse(BaseModel):
    """Paginated list of articles returned by GET /api/feed."""

    articles: list[Article]
    """Current page of articles with computed ``expires_in_seconds``."""

    total: int
    """Total number of articles matching the current filter."""

    page: int
    """Current page number (1-indexed)."""

    has_more: bool
    """True when additional pages are available."""

    next_reset_in_seconds: int
    """Seconds until midnight UTC -- the point at which today's feed resets."""


class StatsResponse(BaseModel):
    """Aggregated platform statistics returned by GET /api/stats."""

    total_articles: int
    """Total live articles currently in the main collection."""

    verified_articles: int
    """Subset of total that have passed any verification tier."""

    expiring_soon: int
    """Articles whose TTL fires within the next 60 minutes."""

    categories: Dict[str, int]
    """Article count broken down by category slug."""

    last_fetch: datetime
    """UTC timestamp of the most recent ingestion pipeline run."""


class ReportRequest(BaseModel):
    """Body of POST /api/report/{id}."""

    reason: str
    """One of: 'misinformation' | 'spam' | 'inappropriate'."""


# --------------------------------------------------------------------------- #
# Internal / lightweight shapes
# --------------------------------------------------------------------------- #


class CategoryCount(BaseModel):
    """Single category with its live article count."""

    category: str
    count: int


class SubscribeRequest(BaseModel):
    """Body of POST /api/subscribe for OneSignal push registration."""

    player_id: str
    """OneSignal device Player ID."""

    categories: list[str] = []
    """Optional list of category slugs the user wants notifications for."""
