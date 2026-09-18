"""
verifier.py -- Multi-tier article verification engine.

Implements a 4-tier verification pipeline:
  Tier 1: Source reputation scoring (graded, not binary).
  Tier 2: Cluster corroboration (>= 3 distinct sources on same story).
  Tier 3: LLM fact-check via OpenAI GPT-4o-mini (if API key configured).
  Default: Unverified / pending.

Each tier returns a VerificationResult with a confidence score in [0, 1].
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from clusterer import get_cluster_source_count
from config import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Graded source reputation registry
# --------------------------------------------------------------------------- #

SOURCE_REPUTATION: dict[str, float] = {
    "BBC": 0.95,
    "Reuters": 0.95,
    "AP News": 0.95,
    "The Hindu": 0.90,
    "Indian Express": 0.88,
    "TechCrunch": 0.85,
    "The Verge": 0.85,
    "NDTV": 0.82,
    "Economic Times": 0.82,
    "Al Jazeera": 0.80,
    # Hindi-language sources (less data to assess -- moderate default)
    "Dainik Jagran": 0.65,
    "Amar Ujala": 0.65,
    # Aggregators / community sites
    "Hacker News": 0.55,
    "NewsAPI": 0.50,
}

# Corroboration requires this many distinct sources covering the same story.
CORROBORATION_THRESHOLD: int = 3


def calculate_source_score(source_name: str) -> float:
    """Return the reputation score for a given source.

    Args:
        source_name: Publisher name as stored in the article document.

    Returns:
        Float in [0, 1] -- higher means more trusted.
        Unknown sources default to 0.50.
    """
    return SOURCE_REPUTATION.get(source_name, 0.50)


# --------------------------------------------------------------------------- #
# Result container
# --------------------------------------------------------------------------- #


@dataclass
class VerificationResult:
    """Outcome of the verification pipeline for a single article."""

    verified: bool
    """True if the article cleared the verification threshold."""

    score: float
    """Confidence score in [0.0, 1.0]."""

    tier: str
    """Tier that produced the result: 'source_rep' | 'corroboration' | 'llm' | 'pending'."""


# --------------------------------------------------------------------------- #
# Tier 3: LLM check
# --------------------------------------------------------------------------- #


async def llm_check(title: str, summary: str) -> VerificationResult:
    """Call OpenAI GPT-4o-mini to flag obvious misinformation.

    Sends only the headline and summary (never the full article body) to the
    LLM and asks it to assess credibility on a 0-1 scale.

    Args:
        title:   Article headline.
        summary: Own-worded 1-2 sentence summary.

    Returns:
        VerificationResult with tier="llm".
    """
    try:
        from openai import AsyncOpenAI  # Lazy import -- not required if no key.

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = (
            "You are a misinformation detection assistant. "
            "Given the headline and summary of a news article, assess its credibility.\n\n"
            f"Headline: {title}\n"
            f"Summary: {summary}\n\n"
            "Respond with ONLY a JSON object in this exact format:\n"
            '{"score": <float 0.0-1.0>, "reason": "<one sentence>"}\n'
            "Where score 1.0 = highly credible, 0.0 = likely misinformation.\n"
            "Do not include any text outside the JSON object."
        )

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.1,
        )

        import json

        raw = response.choices[0].message.content or ""
        data = json.loads(raw.strip())
        score = float(data.get("score", 0.5))
        score = max(0.0, min(1.0, score))  # Clamp to [0, 1].
        verified = score >= 0.65

        logger.info(
            "LLM verification: title=%r score=%.2f reason=%s",
            title,
            score,
            data.get("reason", ""),
        )
        return VerificationResult(verified=verified, score=score, tier="llm")

    except Exception as exc:
        logger.error("llm_check failed: %s", exc)
        # Fall through to unverified result on LLM errors.
        return VerificationResult(verified=False, score=0.3, tier="pending")


# --------------------------------------------------------------------------- #
# Main verification dispatcher
# --------------------------------------------------------------------------- #


async def verify_article(article: object, db: AsyncIOMotorDatabase) -> VerificationResult:
    """Run the full 4-tier verification pipeline for an article.

    Tier progression:
    1. Source reputation >= 0.80 --> verified.
    2. Source reputation 0.60-0.79 --> try corroboration.
    3. Unknown source (< 0.60) or corroboration failed --> LLM (if key set).
    4. Default: unverified/pending.

    Args:
        article: An object (or Pydantic model) with ``source_name``,
                 ``cluster_id``, ``title``, and ``summary`` attributes.
        db:      Motor database instance.

    Returns:
        VerificationResult describing the outcome.
    """
    source_name: str = getattr(article, "source_name", "")
    cluster_id: Optional[str] = getattr(article, "cluster_id", None)
    title: str = getattr(article, "title", "")
    summary: str = getattr(article, "summary", "")

    # ------------------------------------------------------------------ #
    # Tier 1: Source reputation
    # ------------------------------------------------------------------ #
    reputation_score = calculate_source_score(source_name)

    if reputation_score >= 0.80:
        logger.debug("Tier 1 pass: source=%s score=%.2f", source_name, reputation_score)
        return VerificationResult(
            verified=True,
            score=reputation_score,
            tier="source_rep",
        )

    # ------------------------------------------------------------------ #
    # Tier 2: Cluster corroboration
    # ------------------------------------------------------------------ #
    if cluster_id:
        source_count = await get_cluster_source_count(cluster_id, db)
        if source_count >= CORROBORATION_THRESHOLD:
            # Blend reputation score with corroboration bonus.
            blended = min(0.85, reputation_score + 0.20 * source_count)
            logger.debug(
                "Tier 2 pass: cluster=%s sources=%d score=%.2f",
                cluster_id,
                source_count,
                blended,
            )
            return VerificationResult(
                verified=True,
                score=blended,
                tier="corroboration",
            )

    # Partial credit: source is in 0.60-0.79 range but corroboration failed.
    if reputation_score >= 0.60:
        return VerificationResult(
            verified=False,
            score=reputation_score * 0.8,
            tier="pending",
        )



    # ------------------------------------------------------------------ #
    # Default: unverified
    # ------------------------------------------------------------------ #
    logger.debug("No verification tier passed for source=%s", source_name)
    return VerificationResult(verified=False, score=0.3, tier="pending")
