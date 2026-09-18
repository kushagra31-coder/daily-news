import { Hono } from 'hono';
import { ArticleRepository } from '../repositories';
import { getDb } from '../db';
import { runIngestion } from '../ingestion/pipeline';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
};

export const newsRoutes = new Hono<{ Bindings: Bindings }>();

newsRoutes.get('/seed', async (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ error: 'Forbidden in production' }, 403);
  }
  const repo = new ArticleRepository(getDb(c.env));
  const count = await runIngestion(repo);
  return c.json({ success: true, count });
});

newsRoutes.get('/', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  
  const results = await repo.getLiveArticles(category, limit, offset);

  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  
  return c.json({
    articles: results.map((row: any) => ({
      id: row.articles.id,
      _id: row.articles.id,
      title: row.articles.title,
      summary: row.articles.summary,
      source_url: row.articles.canonical_url,
      canonical_url: row.articles.canonical_url,
      category: row.articles.category,
      image_url: row.articles.image_url,
      published_at: row.articles.published_at.toISOString(),
      expires_at: row.articles.expires_at.toISOString(),
      source_name: row.sources?.name || 'Unknown',
      verification_score: row.articles.verification_score,
      verification_tier: row.articles.verification_tier,
      click_count: row.articles.click_count,
      user_reports: row.articles.user_reports
    })),
    total: await repo.getLiveArticlesCount(category)
  });
});

newsRoutes.get('/yesterday', async (c) => {
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
    })
  });
});

newsRoutes.get('/categories', async (c) => {
  return c.json([
    { id: 'world', name: 'World' },
    { id: 'tech', name: 'Technology' },
    { id: 'finance', name: 'Finance' },
    { id: 'india', name: 'India' }
  ]);
});

newsRoutes.get('/sources', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const sources = await repo.getSources();
  return c.json({ sources });
});

newsRoutes.get('/clusters/:id', async (c) => {
  const repo = new ArticleRepository(getDb(c.env));
  const id = c.req.param('id');
  const res = await repo.getCluster(id);
  if (!res.cluster) return c.json({ cluster: null, articles: [] }, 404);

  return c.json({
    cluster: res.cluster,
    articles: res.articles.map((row: any) => ({
      id: row.articles.id,
      title: row.articles.title,
      summary: row.articles.summary,
      source_url: row.articles.canonical_url,
      source_name: row.sources?.name || 'Unknown'
    }))
  });
});

newsRoutes.post('/reports', async (c) => {
  // Just a stub for batch reports or general route
  return c.json({ success: true });
});

