"""
dedup.py -- URL and title deduplication for Daily Vanishing News.

Provides two layers of deduplication:
  1. Exact URL match via SHA-256 hash of the canonical URL.
  2. Near-duplicate title detection via SimHash Hamming distance.

Uses the ``simhash`` package for SimHash computation rather than a manual
implementation, ensuring correctness and speed.
"""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from motor.motor_asyncio import AsyncIOMotorDatabase
from simhash import Simhash

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# URL normalisation tracking / query param stripping
# --------------------------------------------------------------------------- #

# Known tracking and analytics query parameters to strip from URLs.
_STRIP_PARAMS: frozenset[str] = frozenset(
    {
        # UTM parameters
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "utm_id", "utm_reader", "utm_referrer",
        # Facebook
        "fbclid", "fb_action_ids", "fb_action_types", "fb_source",
        # Google
        "gclid", "gclsrc", "dclid", "_ga",
        # Twitter / X
        "twclid",
        # Generic tracking
        "ref", "referrer", "source", "mc_cid", "mc_eid",
        # Mailchimp
        "mc_cid", "mc_eid",
        # HubSpot
        "_hsenc", "_hsmi",
        # Miscellaneous
        "sr_share", "share", "cmpid",
    }
)


def normalize_url(url: str) -> str:
    """Canonicalise a URL for reliable deduplication.

    Steps applied:
    1. Force HTTPS scheme.
    2. Strip ``www.`` prefix from hostname.
    3. Remove all known tracking / UTM query parameters.
    4. Remove URL fragment (``#section``).
    5. Strip trailing slashes from path.

    Args:
        url: Raw URL string from the RSS feed or article page.

    Returns:
        Normalised, canonical URL string.
    """
    try:
        parsed = urlparse(url.strip())

        # 1. Force HTTPS.
        scheme = "https"

        # 2. Lowercase host and strip www.
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]

        # 3. Strip tracking query params.
        raw_params = parse_qs(parsed.query, keep_blank_values=False)
        clean_params = {
            k: v for k, v in raw_params.items() if k.lower() not in _STRIP_PARAMS
        }
        clean_query = urlencode(clean_params, doseq=True)

        # 4. Remove fragment.
        # 5. Strip trailing slash from path.
        path = parsed.path.rstrip("/") or "/"

        canonical = urlunparse((scheme, host, path, parsed.params, clean_query, ""))
        return canonical

    except Exception as exc:
        logger.debug("normalize_url failed for %r: %s", url, exc)
        return url


# --------------------------------------------------------------------------- #
# Hash computation
# --------------------------------------------------------------------------- #


def compute_url_hash(url: str) -> str:
    """Compute the SHA-256 hex digest of the canonical URL.

    This serves as the primary unique key for articles in MongoDB.

    Args:
        url: Raw article URL (normalisation is applied internally).

    Returns:
        64-character lowercase hex string.
    """
    canonical = normalize_url(url)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_title_hash(title: str) -> str:
    """Compute a SimHash fingerprint of the article title.

    Tokenises and lowercases the title, strips punctuation, then feeds
    the token list into the ``simhash`` library.  The resulting 64-bit
    integer is returned as a decimal string for compact storage in MongoDB.

    Args:
        title: Raw article headline.

    Returns:
        SimHash value as a decimal string (e.g. ``"12345678901234567890"``).
    """
    # Strip punctuation and lowercase.
    normalized = re.sub(r"[^\w\s]", "", title.lower())
    tokens = normalized.split()
    if not tokens:
        # Edge case: empty title after normalisation.
        return "0"
    return str(Simhash(tokens).value)


def is_near_duplicate(hash1: str, hash2: str, threshold: int = 3) -> bool:
    """Check if two SimHash values represent near-duplicate titles.

    Args:
        hash1:     First SimHash decimal string.
        hash2:     Second SimHash decimal string.
        threshold: Maximum Hamming distance to still consider near-duplicate.
                   Default of 3 gives ~95% title similarity for typical headlines.

    Returns:
        True if Hamming distance <= threshold.
    """
    try:
        return Simhash(int(hash1)).distance(Simhash(int(hash2))) <= threshold
    except (ValueError, TypeError) as exc:
        logger.debug("is_near_duplicate comparison failed: %s", exc)
        return False


# --------------------------------------------------------------------------- #
# Database-backed deduplication checks
# --------------------------------------------------------------------------- #


async def is_duplicate(url_hash: str, db: AsyncIOMotorDatabase) -> bool:
    """Check whether an article with this URL hash already exists in MongoDB.

    Args:
        url_hash: SHA-256 hash of the canonical URL.
        db:       Motor database instance.

    Returns:
        True if a document with the given url_hash already exists.
    """
    try:
        existing = await db["articles"].find_one(
            {"url_hash": url_hash}, projection={"_id": 1}
        )
        return existing is not None
    except Exception as exc:
        logger.error("is_duplicate DB check failed for url_hash=%s: %s", url_hash, exc)
        # Fail-safe: treat as not duplicate so the article can attempt insertion.
        return False


async def find_near_duplicates(
    title_hash: str,
    db: AsyncIOMotorDatabase,
    threshold: int = 4,
) -> list[str]:
    """Return article _ids that have a title SimHash within *threshold* bits.

    Performs an in-application scan of recent title hashes rather than a
    MongoDB full-collection scan, so it is bounded by the number of articles
    currently live (typically hundreds, not millions).

    Args:
        title_hash: SimHash value (decimal string) of the candidate article.
        db:         Motor database instance.
        threshold:  Hamming distance threshold for near-duplicate detection.

    Returns:
        List of string ``_id`` values for near-duplicate articles.
    """
    near_dupes: list[str] = []
    try:
        cursor = db["articles"].find(
            {},
            projection={"_id": 1, "title_hash": 1},
        )
        async for doc in cursor:
            stored_hash = doc.get("title_hash", "0")
            if is_near_duplicate(title_hash, stored_hash, threshold=threshold):
                near_dupes.append(str(doc["_id"]))
    except Exception as exc:
        logger.error("find_near_duplicates failed: %s", exc)

    return near_dupes
