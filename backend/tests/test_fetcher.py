"""
test_fetcher.py -- Unit tests for URL normalization, hashing, and summary generation.

All tests are purely in-memory and require no external services (no MongoDB, no Redis).
Run with:  pytest backend/tests/test_fetcher.py -v
"""

from __future__ import annotations

import sys
import pathlib

# Allow importing from the backend package root without installing the package.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import pytest

from dedup import compute_url_hash, normalize_url, compute_title_hash, is_near_duplicate
from scheduler import generate_summary


# --------------------------------------------------------------------------- #
# URL normalisation
# --------------------------------------------------------------------------- #


class TestNormalizeUrl:
    """Tests for normalize_url()."""

    def test_forces_https(self) -> None:
        """HTTP URLs should be upgraded to HTTPS."""
        result = normalize_url("http://example.com/article")
        assert result.startswith("https://")

    def test_strips_www(self) -> None:
        """www. prefix should be removed from the hostname."""
        result = normalize_url("https://www.bbc.com/news/article")
        assert "www." not in result

    def test_strips_utm_params(self) -> None:
        """All UTM tracking parameters should be removed."""
        url = "https://example.com/article?utm_source=twitter&utm_campaign=test"
        result = normalize_url(url)
        assert "utm_source" not in result
        assert "utm_campaign" not in result

    def test_strips_fbclid(self) -> None:
        """Facebook Click ID and generic ref params should be removed."""
        url = "https://example.com/article?fbclid=abc123&ref=homepage"
        result = normalize_url(url)
        assert "fbclid" not in result
        assert "ref" not in result

    def test_preserves_non_tracking_params(self) -> None:
        """Query parameters that are not tracking-related should be kept."""
        url = "https://example.com/article?id=42&page=2"
        result = normalize_url(url)
        assert "id=42" in result
        assert "page=2" in result

    def test_strips_fragment(self) -> None:
        """URL fragments (#section) should be removed."""
        url = "https://example.com/article#section-3"
        result = normalize_url(url)
        assert "#" not in result

    def test_strips_trailing_slash(self) -> None:
        """Trailing slashes on path should be stripped."""
        url = "https://example.com/article/"
        result = normalize_url(url)
        # Path should not end with /article/ (it should be /article)
        assert not result.endswith("article/")

    def test_identical_urls_normalize_identically(self) -> None:
        """A dirty URL and its clean equivalent should produce the same canonical form."""
        url1 = "http://www.example.com/article/?utm_source=x"
        url2 = "https://example.com/article"
        assert normalize_url(url1) == normalize_url(url2)


# --------------------------------------------------------------------------- #
# URL hash computation
# --------------------------------------------------------------------------- #


class TestComputeUrlHash:
    """Tests for compute_url_hash()."""

    def test_returns_64_char_hex(self) -> None:
        """SHA-256 should produce a 64-character lowercase hex string."""
        result = compute_url_hash("https://example.com/article")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_same_url_same_hash(self) -> None:
        """Computing hash twice for the same URL must be deterministic."""
        url = "https://bbc.com/news/uk-12345"
        assert compute_url_hash(url) == compute_url_hash(url)

    def test_different_url_different_hash(self) -> None:
        """Different URLs must produce different hashes."""
        h1 = compute_url_hash("https://bbc.com/news/uk-12345")
        h2 = compute_url_hash("https://bbc.com/news/uk-99999")
        assert h1 != h2

    def test_equivalent_urls_same_hash(self) -> None:
        """UTM-dirty URL should hash identically to the clean canonical URL."""
        dirty = "http://www.bbc.com/news/article/?utm_source=twitter"
        clean = "https://bbc.com/news/article"
        assert compute_url_hash(dirty) == compute_url_hash(clean)


# --------------------------------------------------------------------------- #
# SimHash title fingerprinting
# --------------------------------------------------------------------------- #


class TestComputeTitleHash:
    """Tests for compute_title_hash()."""

    def test_returns_numeric_string(self) -> None:
        """SimHash value should be a non-empty numeric string."""
        result = compute_title_hash("India wins cricket match against Pakistan")
        assert result.isdigit() or result == "0"

    def test_same_title_same_hash(self) -> None:
        """Identical titles must produce the same SimHash."""
        title = "Breaking: Markets crash amid global uncertainty"
        assert compute_title_hash(title) == compute_title_hash(title)

    def test_different_titles_usually_different(self) -> None:
        """Very different headlines should produce different SimHash values."""
        h1 = compute_title_hash("Apple launches new iPhone model today")
        h2 = compute_title_hash("India floods displace thousands in Bihar")
        assert h1 != h2

    def test_empty_title_returns_zero(self) -> None:
        """An empty title should return '0' without raising."""
        assert compute_title_hash("") == "0"

    def test_near_duplicate_titles_have_low_hamming_distance(self) -> None:
        """Titles that differ by a few words should have Hamming distance <= 10."""
        t1 = "India wins cricket World Cup final against Australia"
        t2 = "India wins cricket World Cup final"
        h1 = compute_title_hash(t1)
        h2 = compute_title_hash(t2)
        assert is_near_duplicate(h1, h2, threshold=10), (
            f"Expected near-duplicate but Hamming distance too large: {h1} vs {h2}"
        )

    def test_very_different_titles_not_near_duplicates(self) -> None:
        """Semantically unrelated titles should NOT be near-duplicates at threshold=3."""
        h1 = compute_title_hash("Stock market crashes globally amid recession fears")
        h2 = compute_title_hash("Local bakery wins award for sourdough bread")
        assert not is_near_duplicate(h1, h2, threshold=3)


# --------------------------------------------------------------------------- #
# Summary generation (copyright-safe)
# --------------------------------------------------------------------------- #


class TestGenerateSummary:
    """Tests for generate_summary()."""

    def test_strips_html_tags(self) -> None:
        """HTML markup should be stripped from the RSS description."""
        raw = "<p>Breaking news: <b>earthquake</b> hits California.</p>"
        result = generate_summary(raw)
        assert "<" not in result
        assert ">" not in result
        assert "Breaking news" in result

    def test_truncates_to_200_chars(self) -> None:
        """Output must never exceed 200 characters."""
        raw = "A" * 300
        result = generate_summary(raw)
        assert len(result) <= 200

    def test_returns_at_most_two_sentences(self) -> None:
        """Only the first two sentences should be retained."""
        raw = "First sentence. Second sentence. Third sentence. Fourth sentence."
        result = generate_summary(raw)
        assert "Third" not in result
        assert "Fourth" not in result

    def test_empty_input_returns_empty(self) -> None:
        """Empty input should return an empty string without raising."""
        assert generate_summary("") == ""

    def test_collapses_whitespace(self) -> None:
        """Multiple consecutive spaces should be collapsed to a single space."""
        raw = "News   item   with   extra   spaces."
        result = generate_summary(raw)
        assert "  " not in result

    def test_result_never_exceeds_200_chars_various_inputs(self) -> None:
        """Fuzz check: 200-character limit must hold for diverse inputs."""
        inputs = [
            "word " * 100,
            "A" * 500,
            "<b>" * 50 + "text" + "</b>" * 50,
            "Sentence one. Sentence two. " * 10,
        ]
        for inp in inputs:
            result = generate_summary(inp)
            assert len(result) <= 200, (
                f"Summary too long ({len(result)}) for input starting: {inp[:40]!r}"
            )

    def test_meaningful_text_preserved(self) -> None:
        """Key words from the description should appear in the summary."""
        raw = "Scientists discover new planet. It orbits a distant star."
        result = generate_summary(raw)
        assert "Scientists" in result
        assert "planet" in result
