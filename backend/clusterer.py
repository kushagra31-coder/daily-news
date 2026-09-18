"""
clusterer.py -- Story clustering for Daily Vanishing News.

Groups articles that cover the same real-world event under a shared
cluster_id. Uses lightweight TF-based keyword extraction (no external
NLP libraries required) to match articles published within a 2-hour window.
"""

from __future__ import annotations

import hashlib
import logging
import re
import string
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Stop-word list (common English words that carry no topical signal)
# --------------------------------------------------------------------------- #

_STOP_WORDS: frozenset[str] = frozenset(
    {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "shall", "can", "not", "no", "nor",
        "so", "yet", "both", "either", "neither", "each", "every", "all",
        "any", "few", "more", "most", "other", "some", "such", "than", "too",
        "very", "just", "about", "after", "before", "while", "since", "until",
        "that", "this", "these", "those", "it", "its", "as", "he", "she",
        "they", "we", "you", "i", "me", "him", "her", "us", "them", "my",
        "his", "our", "your", "their", "what", "which", "who", "whom", "how",
        "when", "where", "why", "new", "says", "said", "say", "report",
        "reports", "update", "updates",
    }
)

# Window within which articles can be clustered together.
_CLUSTER_WINDOW_HOURS: int = 2


def _extract_keywords(title: str, top_n: int = 3) -> list[str]:
    """Extract the top *top_n* content-bearing words from a title.

    Tokenises, lowercases, strips punctuation and stop words, then returns
    the most frequent (or longest, as tiebreaker) remaining tokens.

    Args:
        title:  Article headline string.
        top_n:  Number of keywords to return. Defaults to 3.

    Returns:
        List of keyword strings, ordered by frequency descending.
    """
    # Lowercase and strip punctuation.
    cleaned = re.sub(r"[^\w\s]", " ", title.lower())
    tokens = [t for t in cleaned.split() if t and t not in _STOP_WORDS and len(t) > 2]

    if not tokens:
        return []

    freq = Counter(tokens)
    # Sort by frequency desc, then by token length desc as tiebreaker (longer
    # words are usually more specific and make better cluster keys).
    top = sorted(freq.keys(), key=lambda t: (freq[t], len(t)), reverse=True)
    return top[:top_n]


def generate_cluster_id(title: str) -> str:
    """Generate a deterministic cluster key from the title keywords.

    The cluster key is an MD5 hex digest of the sorted, joined top keywords.
    Using sorted keywords makes the key order-independent so titles like
    "India wins against Pakistan" and "Pakistan loses to India" share a cluster.

    Args:
        title: Article headline.

    Returns:
        32-character hex string cluster identifier.
    """
    keywords = _extract_keywords(title, top_n=3)
    if not keywords:
        # Fallback: use a digest of the full lowercased title.
        keywords = [title.lower().strip()]
    key_string = "|".join(sorted(keywords))
    return hashlib.md5(key_string.encode("utf-8")).hexdigest()  # noqa: S324


def _titles_share_cluster(title_a: str, title_b: str, min_overlap: int = 2) -> bool:
    """Return True if two titles share at least *min_overlap* keywords.

    Args:
        title_a:     First headline.
        title_b:     Second headline.
        min_overlap: Minimum keyword overlap required to merge into same cluster.

    Returns:
        True if the keyword intersection is >= min_overlap.
    """
    kw_a = set(_extract_keywords(title_a, top_n=5))
    kw_b = set(_extract_keywords(title_b, top_n=5))
    return len(kw_a & kw_b) >= min_overlap


async def assign_cluster(
    article_title: str,
    recent_articles: list[dict],
) -> Optional[str]:
    """Assign a cluster_id to a new article.

    Looks through *recent_articles* (already fetched from DB or in-memory)
    for articles with sufficient keyword overlap.  If a match is found, the
    new article inherits that cluster_id.  Otherwise, a new cluster_id is
    generated from the article title.

    Args:
        article_title:   Headline of the article being processed.
        recent_articles: List of article dicts from the last CLUSTER_WINDOW_HOURS.
                         Each dict must have ``title`` and ``cluster_id`` fields.

    Returns:
        An existing cluster_id if a matching cluster was found, or a newly
        generated cluster_id if this article starts a new cluster.
    """
    # Try to match against recent articles.
    for recent in recent_articles:
        stored_title = recent.get("title", "")
        stored_cluster = recent.get("cluster_id")
        if not stored_cluster:
            continue
        if _titles_share_cluster(article_title, stored_title):
            logger.debug(
                "Assigned existing cluster %s to article: %r",
                stored_cluster,
                article_title,
            )
            return stored_cluster

    # No match found -- generate a new cluster_id.
    new_cluster = generate_cluster_id(article_title)
    logger.debug("Generated new cluster %s for article: %r", new_cluster, article_title)
    return new_cluster


async def get_recent_articles_for_clustering(
    db: AsyncIOMotorDatabase,
) -> list[dict]:
    """Fetch articles published within the clustering window from MongoDB.

    Args:
        db: Motor database instance.

    Returns:
        List of dicts with ``title`` and ``cluster_id`` fields.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_CLUSTER_WINDOW_HOURS)
    try:
        cursor = db["articles"].find(
            {"published_at": {"$gte": cutoff}},
            projection={"title": 1, "cluster_id": 1, "_id": 0},
        )
        return [doc async for doc in cursor]
    except Exception as exc:
        logger.error("get_recent_articles_for_clustering failed: %s", exc)
        return []


async def get_cluster_source_count(cluster_id: str, db: AsyncIOMotorDatabase) -> int:
    """Count distinct source names within a given cluster.

    Used by the corroboration verification tier: if >= 3 distinct sources
    cover the same story, the story is considered corroborated.

    Args:
        cluster_id: The cluster identifier to query.
        db:         Motor database instance.

    Returns:
        Number of distinct sources covering this cluster.
    """
    try:
        pipeline = [
            {"$match": {"cluster_id": cluster_id}},
            {"$group": {"_id": "$source_name"}},
            {"$count": "distinct_sources"},
        ]
        result = await db["articles"].aggregate(pipeline).to_list(length=1)
        if result:
            return result[0].get("distinct_sources", 0)
        return 0
    except Exception as exc:
        logger.error(
            "get_cluster_source_count failed for cluster_id=%s: %s", cluster_id, exc
        )
        return 0
