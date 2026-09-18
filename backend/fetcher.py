"""
fetcher.py -- Async RSS feed and API fetcher.

Fetches news articles from multiple RSS sources concurrently, normalises
them into RawArticle dataclasses, and optionally extracts OpenGraph images.

Copyright compliance: Only title, author, published date, URL, and the
RSS <description> field (used for summary generation, NOT stored verbatim)
are read from feeds. Full article HTML is never downloaded or stored.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

from config import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Breaking-news keyword detection
# --------------------------------------------------------------------------- #

BREAKING_KEYWORDS: list[str] = [
    "breaking",
    "just in",
    "developing",
    "live updates",
    "urgent",
    "alert",
    "confirmed",
    "official",
    "exclusive",
]


def detect_breaking(title: str) -> bool:
    """Return True if the title contains breaking-news signal words.

    Args:
        title: Article headline to analyse.

    Returns:
        True when any breaking keyword is found (case-insensitive).
    """
    title_lower = title.lower()
    return any(keyword in title_lower for keyword in BREAKING_KEYWORDS)


# --------------------------------------------------------------------------- #
# RSS source registry
# --------------------------------------------------------------------------- #

import json
import os

sources_path = os.path.join(os.path.dirname(__file__), "sources.json")
with open(sources_path, "r", encoding="utf-8-sig") as _f:
    RSS_SOURCES: list[dict] = json.load(_f)

# --------------------------------------------------------------------------- #
# Data container
# --------------------------------------------------------------------------- #


@dataclass
class RawArticle:
    """Intermediate representation of an article as ingested from a source.

    ``raw_description`` holds the RSS <description> text which is ONLY used
    to generate the own-worded summary during pipeline processing. It is NOT
    stored in MongoDB.
    """

    title: str
    source_url: str
    source_name: str
    source_trusted: bool
    category: str
    published_at: datetime
    image_url: Optional[str]
    author: Optional[str]
    raw_description: str  # Used for summary generation only -- never stored.
    language: str = "en"
    country: str = "IN"
    is_breaking: bool = False


# --------------------------------------------------------------------------- #
# HTTP client helper
# --------------------------------------------------------------------------- #

# Shared httpx client -- reuse connection pools across concurrent fetches.
_http_client: Optional[httpx.AsyncClient] = None


def _get_http_client() -> httpx.AsyncClient:
    """Return the shared async HTTP client, creating it if needed."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            headers={"User-Agent": "DailyVanishNewsBot/1.0 (+https://github.com/daily-vanish-news)"},
            follow_redirects=True,
        )
    return _http_client


# --------------------------------------------------------------------------- #
# Feed fetching
# --------------------------------------------------------------------------- #


def _parse_published_date(entry: feedparser.FeedParserDict) -> datetime:
    """Extract and normalise the published datetime from an RSS entry.

    Tries ``published_parsed`` first (feedparser struct_time), falls back
    to ``updated_parsed``, then to the current UTC time as a last resort.

    Args:
        entry: A single feedparser entry object.

    Returns:
        Timezone-aware UTC datetime.
    """
    for attr in ("published_parsed", "updated_parsed"):
        struct = getattr(entry, attr, None)
        if struct:
            try:
                # struct_time from feedparser is always UTC.
                return datetime(*struct[:6], tzinfo=timezone.utc)
            except Exception:
                pass

    # Try parsing the raw string for RFC 2822 dates (e.g. "Mon, 01 Jan 2024 ...").
    for raw_attr in ("published", "updated"):
        raw = getattr(entry, raw_attr, None)
        if raw:
            try:
                return parsedate_to_datetime(raw).astimezone(timezone.utc)
            except Exception:
                pass

    return datetime.now(timezone.utc)


def normalize_article(raw: dict, source: dict) -> Optional[RawArticle]:
    """Convert a raw feedparser entry dict into a RawArticle.

    Args:
        raw:    A feedparser entry as a plain dict (or FeedParserDict).
        source: The source config dict from RSS_SOURCES.

    Returns:
        A RawArticle, or None if the entry lacks a title or link.
    """
    title: str = (raw.get("title") or "").strip()
    link: str = (raw.get("link") or raw.get("id") or "").strip()

    if not title or not link:
        return None

    # Author -- may be in author_detail or a plain string field.
    author: Optional[str] = None
    author_detail = raw.get("author_detail")
    if isinstance(author_detail, dict):
        author = author_detail.get("name")
    if not author:
        author = raw.get("author") or None

    # RSS description (summary) -- HTML will be stripped later in scheduler.
    description: str = (
        raw.get("summary") or raw.get("description") or ""
    )

    # Image -- try media:content or enclosure first.
    image_url: Optional[str] = None
    media_content = raw.get("media_content")
    if isinstance(media_content, list) and media_content:
        image_url = media_content[0].get("url")
    if not image_url:
        enclosures = raw.get("enclosures") or []
        for enc in enclosures:
            if isinstance(enc, dict) and enc.get("type", "").startswith("image/"):
                image_url = enc.get("href") or enc.get("url")
                break
    if not image_url:
        media_thumbnail = raw.get("media_thumbnail")
        if isinstance(media_thumbnail, list) and media_thumbnail:
            image_url = media_thumbnail[0].get("url")

    published_at = _parse_published_date(feedparser.FeedParserDict(raw))
    is_breaking = detect_breaking(title)

    return RawArticle(
        title=title,
        source_url=link,
        source_name=source["name"],
        source_trusted=source.get("trusted", False),
        category=source.get("category", "general"),
        published_at=published_at,
        image_url=image_url,
        author=author,
        raw_description=description,
        language=source.get("language", "en"),
        country=source.get("country", "IN"),
        is_breaking=is_breaking,
    )


async def fetch_rss_feed(source: dict) -> list[RawArticle]:
    """Fetch and parse a single RSS/Atom feed.

    Uses feedparser in a thread executor to avoid blocking the event loop
    (feedparser is synchronous).

    Args:
        source: One entry from RSS_SOURCES.

    Returns:
        List of RawArticle objects from the feed (may be empty on error).
    """
    loop = asyncio.get_event_loop()
    try:
        # Run synchronous feedparser in thread pool to avoid blocking.
        feed = await loop.run_in_executor(
            None, feedparser.parse, source["url"]
        )
        if feed.bozo and not feed.entries:
            logger.warning(
                "Feed %s returned bozo error: %s",
                source["name"],
                feed.bozo_exception,
            )
            return []

        articles: list[RawArticle] = []
        for entry in feed.entries:
            raw = normalize_article(dict(entry), source)
            if raw:
                articles.append(raw)

        logger.info("Fetched %d entries from %s", len(articles), source["name"])
        return articles

    except Exception as exc:
        logger.error("Failed to fetch RSS feed %s: %s", source["name"], exc)
        return []


async def fetch_hacker_news() -> list[RawArticle]:
    """Fetch front-page stories from the Hacker News Algolia API.

    Uses the HN Algolia search API to get recent front-page items with
    a minimum score threshold.

    Returns:
        List of RawArticle objects for top HN stories.
    """
    hn_source = {
        "name": "Hacker News",
        "category": "tech",
        "trusted": False,
        "language": "en",
        "country": "US",
    }
    url = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30"
    try:
        client = _get_http_client()
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

        articles: list[RawArticle] = []
        for hit in data.get("hits", []):
            title = (hit.get("title") or "").strip()
            source_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"

            if not title or not source_url:
                continue

            # Convert Unix timestamp to datetime.
            ts = hit.get("created_at_i")
            published_at = (
                datetime.fromtimestamp(ts, tz=timezone.utc)
                if ts
                else datetime.now(timezone.utc)
            )

            articles.append(
                RawArticle(
                    title=title,
                    source_url=source_url,
                    source_name="Hacker News",
                    source_trusted=False,
                    category="tech",
                    published_at=published_at,
                    image_url=None,
                    author=hit.get("author"),
                    raw_description=f"HN score: {hit.get('points', 0)}, comments: {hit.get('num_comments', 0)}",
                    language="en",
                    country="US",
                    is_breaking=detect_breaking(title),
                )
            )

        logger.info("Fetched %d stories from Hacker News Algolia API", len(articles))
        return articles

    except Exception as exc:
        logger.error("Failed to fetch Hacker News API: %s", exc)
        return []


async def fetch_newsapi(category: str = "general") -> list[RawArticle]:
    """Fetch top headlines from NewsAPI.org for a given category.

    Only called if ``settings.NEWSAPI_KEY`` is non-empty.

    Args:
        category: NewsAPI category slug (business, entertainment, general,
                  health, science, sports, technology).

    Returns:
        List of RawArticle objects, empty if NEWSAPI_KEY is not configured.
    """
    if not settings.NEWSAPI_KEY:
        return []

    url = (
        "https://newsapi.org/v2/top-headlines"
        f"?category={category}&language=en&pageSize=20&apiKey={settings.NEWSAPI_KEY}"
    )

    newsapi_source = {
        "name": "NewsAPI",
        "category": category,
        "trusted": False,
        "language": "en",
        "country": "US",
    }

    try:
        client = _get_http_client()
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "ok":
            logger.warning("NewsAPI returned non-ok status: %s", data.get("message"))
            return []

        articles: list[RawArticle] = []
        for item in data.get("articles", []):
            title = (item.get("title") or "").strip()
            # NewsAPI occasionally returns "[Removed]" titles for deleted articles.
            if not title or "[Removed]" in title:
                continue

            source_url = item.get("url") or ""
            if not source_url:
                continue

            # Parse ISO 8601 published date.
            published_str = item.get("publishedAt") or ""
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except ValueError:
                published_at = datetime.now(timezone.utc)

            source_name = (item.get("source") or {}).get("name") or "NewsAPI"

            articles.append(
                RawArticle(
                    title=title,
                    source_url=source_url,
                    source_name=source_name,
                    source_trusted=False,
                    category=category,
                    published_at=published_at,
                    image_url=item.get("urlToImage"),
                    author=item.get("author"),
                    raw_description=item.get("description") or "",
                    language="en",
                    country="US",
                    is_breaking=detect_breaking(title),
                )
            )

        logger.info(
            "Fetched %d articles from NewsAPI category=%s", len(articles), category
        )
        return articles

    except Exception as exc:
        logger.error("NewsAPI fetch failed for category=%s: %s", category, exc)
        return []


async def extract_opengraph_image(url: str) -> Optional[str]:
    """Attempt to extract the OpenGraph og:image URL from an article page.

    Respects a hard 5-second timeout and silently returns None on any error.
    Only the <head> portion is parsed; full page content is discarded.

    Args:
        url: The article URL to fetch OG metadata from.

    Returns:
        The og:image URL string, or None if unavailable.
    """
    try:
        client = _get_http_client()
        # Request only the first 32 KB to get the <head> without downloading
        # the entire article body.
        async with client.stream("GET", url, timeout=5.0) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "html" not in content_type:
                return None

            chunk = b""
            async for byte_chunk in response.aiter_bytes(chunk_size=8192):
                chunk += byte_chunk
                if len(chunk) >= 32_768:
                    break

        soup = BeautifulSoup(chunk, "html.parser")

        # Try standard og:image first.
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            img_url = str(og_image["content"]).strip()
            # Resolve relative URLs.
            if img_url.startswith("//"):
                img_url = "https:" + img_url
            elif img_url.startswith("/"):
                parsed = urlparse(url)
                img_url = f"{parsed.scheme}://{parsed.netloc}{img_url}"
            return img_url

        # Fall back to twitter:image.
        twitter_image = soup.find("meta", attrs={"name": "twitter:image"})
        if twitter_image and twitter_image.get("content"):
            return str(twitter_image["content"]).strip()

        return None

    except Exception as exc:
        logger.debug("extract_opengraph_image failed for %s: %s", url, exc)
        return None


async def fetch_all_sources() -> list[RawArticle]:
    """Fetch articles from ALL configured sources concurrently.

    Launches all RSS feed fetchers plus HN and NewsAPI (if configured) as
    concurrent coroutines via asyncio.gather. Individual source failures
    are isolated and logged without aborting the entire pipeline.

    Returns:
        Flat list of all RawArticle objects from every source.
    """
    tasks = [fetch_rss_feed(source) for source in RSS_SOURCES]

    # Add NewsAPI for each relevant category if key is configured.
    if settings.NEWSAPI_KEY:
        for cat in ("general", "technology", "business"):
            tasks.append(fetch_newsapi(cat))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles: list[RawArticle] = []
    for result in results:
        if isinstance(result, Exception):
            logger.error("A source fetch task raised an exception: %s", result)
        elif isinstance(result, list):
            all_articles.extend(result)

    logger.info("Total raw articles fetched from all sources: %d", len(all_articles))
    return all_articles
