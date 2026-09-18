"""
test_ttl.py -- Tests for TTL-based article visibility filtering.

Verifies that the feed query logic correctly treats articles older than
24 hours as expired (invisible) while those within the 24-hour window are
returned as visible. No database connection required.

Run with:  pytest backend/tests/test_ttl.py -v
"""

from __future__ import annotations

import sys
import pathlib
from datetime import datetime, timedelta, timezone

# Allow importing from the backend package root.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import pytest


# --------------------------------------------------------------------------- #
# TTL logic helpers (mirror MongoDB TTL index behaviour)
# --------------------------------------------------------------------------- #


def is_article_visible(published_at: datetime, ttl_hours: int = 24) -> bool:
    """Simulate the MongoDB TTL visibility check.

    An article is visible if it was published within the last ttl_hours.
    This mirrors the TTL index behaviour: MongoDB expires documents where
    published_at < now - ttl_hours * 3600 seconds.

    Args:
        published_at: Article publication datetime.  Naive datetimes are
                      treated as UTC (consistent with the pipeline behaviour).
        ttl_hours:    TTL window in hours (default 24).

    Returns:
        True if the article should still be visible.
    """
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        # Treat naive datetimes as UTC to match MongoDB storage behaviour.
        published_at = published_at.replace(tzinfo=timezone.utc)
    expiry = published_at + timedelta(hours=ttl_hours)
    return now < expiry


def articles_in_visible_window(
    articles: list[dict],
    ttl_hours: int = 24,
) -> list[dict]:
    """Filter a list of article dicts to those still within the TTL window.

    This mirrors the MongoDB query:
      db.articles.find({ visible: true, published_at: { gt: (now - ttl_hours) } })

    Args:
        articles:  List of dicts with a 'published_at' datetime key.
        ttl_hours: TTL window in hours.

    Returns:
        Filtered list of visible articles.
    """
    return [
        a for a in articles
        if is_article_visible(a["published_at"], ttl_hours)
    ]


# --------------------------------------------------------------------------- #
# Test cases
# --------------------------------------------------------------------------- #


class TestTTLVisibility:
    """Tests for TTL-based article visibility filtering."""

    # Helper

    @staticmethod
    def _article(hours_ago: float, title: str = "Test Article") -> dict:
        """Create a fake article dict with published_at offset from now.

        Args:
            hours_ago: How many hours in the past to set published_at.
            title:     Article title for identification in assertions.
        """
        return {
            "title": title,
            "published_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago),
        }

    # --- Core TTL boundary tests ---

    def test_article_published_23_hours_ago_is_visible(self) -> None:
        """An article published 23 h ago should still be within the 24 h TTL."""
        article = self._article(hours_ago=23)
        assert is_article_visible(article["published_at"]) is True

    def test_article_published_25_hours_ago_is_expired(self) -> None:
        """An article published 25 h ago should be past the 24 h TTL."""
        article = self._article(hours_ago=25)
        assert is_article_visible(article["published_at"]) is False

    def test_article_just_published_is_visible(self) -> None:
        """A freshly published article should always be visible."""
        article = self._article(hours_ago=0.01)  # ~36 seconds ago
        assert is_article_visible(article["published_at"]) is True

    def test_article_exactly_at_ttl_boundary_is_expired(self) -> None:
        """An article published exactly 24 h ago should be expired (not visible).

        At exactly published_at + 24h the expiry instant equals now, so
        now < expiry is False and the article is no longer visible.
        """
        # published_at = now - 24h  =>  expiry = now  =>  now < expiry is False
        article = self._article(hours_ago=24.0)
        assert is_article_visible(article["published_at"]) is False

    def test_article_one_second_before_expiry_is_visible(self) -> None:
        """An article expiring in 1 second should still be considered visible."""
        # 23 h 59 m 59 s ago
        just_before = (
            datetime.now(timezone.utc) - timedelta(hours=23, minutes=59, seconds=59)
        )
        assert is_article_visible(just_before) is True

    def test_article_published_30_minutes_ago_is_visible(self) -> None:
        """Very recent articles must always be visible."""
        article = self._article(hours_ago=0.5)
        assert is_article_visible(article["published_at"]) is True

    def test_article_published_23_point_9_hours_ago_is_visible(self) -> None:
        """Edge case just inside the 24 h window should remain visible."""
        article = self._article(hours_ago=23.9)
        assert is_article_visible(article["published_at"]) is True

    def test_article_published_48_hours_ago_is_expired(self) -> None:
        """Articles published 2 days ago should definitely be expired."""
        article = self._article(hours_ago=48)
        assert is_article_visible(article["published_at"]) is False

    # --- Batch filtering tests ---

    def test_filter_mixed_articles(self) -> None:
        """Only articles within the TTL window are returned in a batch filter."""
        articles = [
            self._article(0.5, "Breaking news"),      # 30 min ago   -- visible
            self._article(12,  "Morning headline"),    # 12 h ago     -- visible
            self._article(23.9, "Evening roundup"),    # 23.9 h ago   -- visible
            self._article(24.1, "Yesterday story"),    # 24.1 h ago   -- expired
            self._article(48,  "Old article"),         # 48 h ago     -- expired
        ]
        visible = articles_in_visible_window(articles)
        assert len(visible) == 3

        titles = [a["title"] for a in visible]
        assert "Breaking news" in titles
        assert "Morning headline" in titles
        assert "Evening roundup" in titles
        assert "Yesterday story" not in titles
        assert "Old article" not in titles

    def test_all_expired_returns_empty_list(self) -> None:
        """When all articles are expired, the result should be an empty list."""
        articles = [
            self._article(25),
            self._article(30),
            self._article(48),
        ]
        assert articles_in_visible_window(articles) == []

    def test_all_visible_returns_all_articles(self) -> None:
        """When all articles are within TTL, all should be returned."""
        articles = [
            self._article(1),
            self._article(12),
            self._article(23),
        ]
        visible = articles_in_visible_window(articles)
        assert len(visible) == 3

    def test_custom_ttl_hours_respected(self) -> None:
        """Custom TTL_HOURS value must be respected by the filter."""
        articles = [
            self._article(2,  "Within 6 h TTL"),
            self._article(7,  "Past 6 h TTL"),
        ]
        visible = articles_in_visible_window(articles, ttl_hours=6)
        assert len(visible) == 1
        assert visible[0]["title"] == "Within 6 h TTL"

    def test_naive_datetime_treated_as_utc(self) -> None:
        """Naive datetimes (no tzinfo) should be handled without raising."""
        naive_dt = datetime.utcnow() - timedelta(hours=1)
        # Should not raise -- naive datetime is treated as UTC.
        result = is_article_visible(naive_dt)
        assert result is True

    def test_naive_expired_datetime_returns_false(self) -> None:
        """A naive datetime 25 h in the past should also be detected as expired."""
        naive_old = datetime.utcnow() - timedelta(hours=25)
        assert is_article_visible(naive_old) is False
