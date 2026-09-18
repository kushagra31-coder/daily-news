import { Hono } from 'hono';
import { ArticleRepository } from '../repositories';
import { getDb } from '../db';

type Bindings = {
  DB: D1Database;
};

export const compatRoutes = new Hono<{ Bindings: Bindings }>();

compatRoutes.get('/feed', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  
  const results = await repo.getLiveArticles(category, limit, offset);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const nextResetInSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  
  return c.json({
    articles: results.map((row: any) => ({
      id: row.articles.id,
      _id: row.articles.id,
      url_hash: row.articles.url_hash,
      title: row.articles.title,
      summary: row.articles.summary,
      source_url: row.articles.canonical_url,
      canonical_url: row.articles.canonical_url,
      category: row.articles.category,
      image_url: row.articles.image_url,
      published_at: row.articles.published_at.toISOString(),
      expires_at: row.articles.expires_at.toISOString(),
      source_name: row.sources?.name || 'Unknown',
      source_favicon: '', 
      verification_score: row.articles.verification_score,
      verification_tier: row.articles.verification_tier,
      verified: true,
      source_count: 1,
      moderation_status: 'approved',
      user_reports: row.articles.user_reports,
      engagement_score: 0,
      click_count: row.articles.click_count,
      is_breaking: false,
      language: 'en',
      country: 'US',
      expiry_warning_sent: false
    })),
    total: await repo.getLiveArticlesCount(category),
    page: page,
    has_more: results.length === limit,
    next_reset_in_seconds: nextResetInSeconds
  });
});

compatRoutes.get('/yesterday', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const results = await repo.getYesterdayArticles();
  
  return c.json({
    articles: results.map((row: any) => {
      const a = row.articles ? row.articles : row;
      return {
        id: a.id,
        _id: a.id,
        title: a.title,
        summary: a.summary,
        source_url: a.canonical_url,
        canonical_url: a.canonical_url,
        category: a.category,
        image_url: a.image_url,
        published_at: a.published_at.toISOString(),
        expires_at: a.expires_at.toISOString(),
      };
    }),
    total: results.length, page: 1, has_more: false, next_reset_in_seconds: 0
  });
});

compatRoutes.get('/stats', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const stats = await repo.getStats();
  return c.json(stats);
});

compatRoutes.get('/sources', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const sources = await repo.getSources();
  return c.json({ sources });
});

compatRoutes.get('/clusters/:id', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const id = c.req.param('id');
  const res = await repo.getCluster(id);
  
  if (!res.cluster) return c.json({ cluster: null, articles: [] }, 404);

  return c.json({
    cluster: res.cluster,
    articles: res.articles.map((row: any) => ({
      id: row.articles.id,
      _id: row.articles.id,
      title: row.articles.title,
      summary: row.articles.summary,
      source_url: row.articles.canonical_url,
      category: row.articles.category,
      published_at: row.articles.published_at.toISOString(),
      expires_at: row.articles.expires_at.toISOString(),
      source_name: row.sources?.name || 'Unknown'
    }))
  });
});

compatRoutes.post('/report/:id', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const id = c.req.param('id');
  await repo.incrementReport(id);
  return c.json({ success: true, message: 'Reported successfully' });
});

compatRoutes.post('/click/:id', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const id = c.req.param('id');
  await repo.incrementClick(id);
  return c.json({ success: true });
});




