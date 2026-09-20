"""scheduler.py -- Ingestion pipeline orchestrator for Daily Vanishing News."""
from __future__ import annotations
import logging, re
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from prometheus_client import Counter
from clusterer import assign_cluster, get_recent_articles_for_clustering
from database import get_database
from dedup import compute_title_hash, compute_url_hash, is_duplicate, normalize_url
from fetcher import RawArticle, fetch_all_sources
from models import Article
from verifier import verify_article

logger = logging.getLogger(__name__)

articles_fetched_counter = Counter('articles_fetched_total', 'Total raw articles fetched from all sources')
articles_deduplicated_counter = Counter('articles_deduplicated_total', 'Articles skipped as duplicates')
verification_tier_counter = Counter('verification_tier_total', 'Articles per verification tier', ['tier'])

_HTML_TAG_RE = re.compile(r'<[^>]+>')
_SENTENCE_END_RE = re.compile(r'(?<=[.!?])\s+')
_MAX_SUMMARY_CHARS = 200


def generate_summary(raw_description: str) -> str:
    """Convert RSS description to a copyright-safe summary (strips HTML, max 200 chars).

    Args:
        raw_description: Raw RSS description/summary field.
    Returns:
        Cleaned summary, at most 200 characters.
    """
    text = _HTML_TAG_RE.sub(' ', raw_description)
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        return ''
    sentences = _SENTENCE_END_RE.split(text)
    summary = ' '.join(sentences[:2]).strip()
    if len(summary) > _MAX_SUMMARY_CHARS:
        summary = summary[:_MAX_SUMMARY_CHARS - 1].rsplit(' ', 1)[0] + '\u2026'
    return summary


def enforce_minimum_visibility(article: Article, min_hours: int = 2) -> Article:
    """Ensure breaking articles remain visible for at least min_hours.

    Args:
        article: Article to enforce visibility on.
        min_hours: Minimum visibility in hours (default 2).
    Returns:
        Mutated Article with forced_visible_until set if is_breaking.
    """
    if article.is_breaking:
        min_visible = article.fetched_at + timedelta(hours=min_hours)
        if article.forced_visible_until is None or min_visible > article.forced_visible_until:
            article.forced_visible_until = min_visible
    return article


def build_article(raw: RawArticle, url_hash: str, summary: str, cluster_id: Optional[str]) -> Article:
    """Construct an Article Pydantic model from a RawArticle.

    Args:
        raw: Raw article from fetcher.
        url_hash: SHA-256 of canonical URL.
        summary: Own-worded summary.
        cluster_id: Cluster identifier.
    Returns:
        Populated Article model (not yet persisted).
    """
    now = datetime.now(timezone.utc)
    canonical = normalize_url(raw.source_url)
    parsed = urlparse(canonical)
    favicon = f'{parsed.scheme}://{parsed.netloc}/favicon.ico'
    return Article(
        url_hash=url_hash,
        title_hash=compute_title_hash(raw.title),
        title=raw.title,
        summary=summary or raw.title,
        source_url=raw.source_url,
        canonical_url=canonical,
        source_name=raw.source_name,
        source_favicon=favicon,
        author=raw.author,
        image_url=raw.image_url,
        og_description=None,
        category=raw.category,
        language=raw.language,
        country=raw.country,
        published_at=raw.published_at,
        expires_at=raw.published_at + timedelta(hours=24),
        fetched_at=now,
        cluster_id=cluster_id,
        is_breaking=raw.is_breaking,
        verified=False,
        verification_score=0.0,
        verification_tier='pending',
        source_count=1,
        moderation_status='approved',
        visible=True,
        expiry_warning_sent=False,
    )


async def store_article(article: Article, db: AsyncIOMotorDatabase) -> Optional[str]:
    """Insert an article into the live articles collection.

    Args:
        article: Fully built, verified Article model.
        db: Motor database instance.
    Returns:
        Inserted _id string or None on failure.
    """
    collection = db['articles']
    doc = article.model_dump(by_alias=True, exclude={'id'})
    doc.pop('_id', None)
    try:
        result = await collection.insert_one(doc)
        return str(result.inserted_id)
    except Exception as exc:
        logger.debug('store_article failed (likely duplicate): %s', exc)
        return None


async def run_ingestion_pipeline() -> None:
    """Full pipeline: fetch -> dedup -> cluster -> verify -> store.

    Entry point for GitHub Actions hourly cron and APScheduler.
    Steps: fetch all RSS/API sources, deduplicate by URL hash,
    generate copyright-safe summaries, assign story clusters,
    enforce 2h breaking-news visibility, run 4-tier verification,
    then persist to MongoDB.
    """
    logger.info('Starting ingestion pipeline.')
    db = get_database()
    raw_articles: list[RawArticle] = await fetch_all_sources()
    articles_fetched_counter.inc(len(raw_articles))
    logger.info('Fetched %d raw articles.', len(raw_articles))
    recent_articles = await get_recent_articles_for_clustering(db)
    new_count = 0
    skipped_count = 0
    for raw in raw_articles:
        url_hash = compute_url_hash(raw.source_url)
        if await is_duplicate(url_hash, db):
            skipped_count += 1
            articles_deduplicated_counter.inc()
            continue
        summary = generate_summary(raw.raw_description)
        cluster_id = await assign_cluster(raw.title, recent_articles)
        article = build_article(raw, url_hash, summary, cluster_id)
        article = enforce_minimum_visibility(article)
        verification = await verify_article(article, db)
        article.verified = verification.verified
        article.verification_score = verification.score
        article.verification_tier = verification.tier
        verification_tier_counter.labels(tier=verification.tier).inc()
        inserted_id = await store_article(article, db)
        if inserted_id:
            new_count += 1
            recent_articles.append({'title': article.title, 'cluster_id': cluster_id})
    logger.info('Ingestion pipeline complete: %d new, %d skipped.', new_count, skipped_count)


async def archive_and_cleanup() -> list[dict]:
    """Archive today articles to cold storage and find expiry-warning articles.

    Runs at 23:55 UTC daily:
    1. Copies visible/approved articles to articles_archive (no TTL).
    2. Queries articles expiring within 1 hour with expiry_warning_sent=False,
       marks them as sent, returns details for push notification service.

    Returns:
        List of dicts with _id, title, source_name for expiry push targets.
    """
    db = get_database()
    articles_col = db['articles']
    archive_col = db['articles_archive']
    now = datetime.now(timezone.utc)
    today_str = now.strftime('%Y-%m-%d')
    archive_count = 0
    cursor = articles_col.find(
        {'visible': True, 'moderation_status': 'approved'},
        projection={'expires_in_seconds': 0},
    )
    async for doc in cursor:
        archive_doc = dict(doc)
        archive_doc['archived_at'] = now
        archive_doc['published_date'] = today_str
        try:
            await archive_col.update_one(
                {'url_hash': archive_doc['url_hash']},
                {'$set': archive_doc},
                upsert=True,
            )
            archive_count += 1
        except Exception as exc:
            logger.debug('Archive upsert failed: %s', exc)
    logger.info('Archived %d articles to cold storage.', archive_count)
    one_hour_ago = now - timedelta(hours=23)
    expiry_warning_articles: list[dict] = []
    warning_cursor = articles_col.find(
        {
            'published_at': {'$gte': one_hour_ago},
            'expiry_warning_sent': False,
            'visible': True,
            'moderation_status': 'approved',
        },
        projection={'_id': 1, 'title': 1, 'source_name': 1},
    )
    article_ids_to_update: list[ObjectId] = []
    async for doc in warning_cursor:
        expiry_warning_articles.append({
            '_id': str(doc['_id']),
            'title': doc.get('title', ''),
            'source_name': doc.get('source_name', ''),
        })
        article_ids_to_update.append(doc['_id'])
    if article_ids_to_update:
        await articles_col.update_many(
            {'_id': {'$in': article_ids_to_update}},
            {'$set': {'expiry_warning_sent': True}},
        )
        logger.info('Marked %d articles as expiry_warning_sent.', len(article_ids_to_update))
    return expiry_warning_articles
