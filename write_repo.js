const fs = require('fs');
const code = import { drizzle } from 'drizzle-orm/d1';
import { articles, sources, clusters, Article, InsertArticle, Source, InsertSource, Cluster, InsertCluster } from '@news/db';
import { eq, gt, lt, and, desc, sql } from 'drizzle-orm';

export interface IArticleRepository {
  getLiveArticles(category?: string, limit?: number, offset?: number): Promise<any[]>;
  getYesterdayArticles(limit?: number): Promise<any[]>;
  getArticleById(id: string): Promise<any | null>;
  insertArticle(article: InsertArticle): Promise<void>;
  findByUrlHash(hash: string): Promise<any | null>;
  insertSource(source: InsertSource): Promise<void>;
  getRecentArticles(windowMs: number): Promise<any[]>;
  insertCluster(cluster: InsertCluster): Promise<void>;
  getClusterSources(clusterId: string): Promise<string[]>;
  getSources(): Promise<any[]>;
  getCluster(id: string): Promise<{ cluster: any, articles: any[] }>;
  incrementClick(id: string): Promise<void>;
  incrementReport(id: string): Promise<void>;
  getStats(): Promise<any>;
}

export class D1ArticleRepository implements IArticleRepository {
  private db;
  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getLiveArticles(category?: string, limit = 20, offset = 0) {
    const now = new Date();
    let conditions = [gt(articles.expires_at, now)];
    if (category) {
      conditions.push(eq(articles.category, category));
    }
    
    return await this.db.select({
      articles: articles,
      sources: sources
    })
      .from(articles)
      .leftJoin(sources, eq(articles.source_id, sources.id))
      .where(and(...conditions))
      .orderBy(desc(articles.published_at))
      .limit(limit)
      .offset(offset);
  }

  async getYesterdayArticles(limit = 50) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setHours(23,59,59,999);

    return await this.db.select()
      .from(articles)
      .where(and(gt(articles.published_at, start), lt(articles.published_at, end)))
      .orderBy(desc(articles.published_at))
      .limit(limit);
  }

  async getArticleById(id: string) {
    const res = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);
    return res[0] || null;
  }

  async insertArticle(article: InsertArticle) {
    await this.db.insert(articles).values(article);
  }

  async findByUrlHash(hash: string) {
    const res = await this.db.select().from(articles).where(eq(articles.url_hash, hash)).limit(1);
    return res[0] || null;
  }
  
  async insertSource(source: InsertSource) {
    try {
      await this.db.insert(sources).values(source);
    } catch(e) {}
  }

  async getRecentArticles(windowMs = 12 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - windowMs);
    return await this.db.select()
      .from(articles)
      .where(gt(articles.published_at, cutoff))
      .orderBy(desc(articles.published_at));
  }

  async insertCluster(cluster: InsertCluster) {
    try {
      await this.db.insert(clusters).values(cluster);
    } catch(e) {}
  }

  async getClusterSources(clusterId: string): Promise<string[]> {
    const res = await this.db.select({ source_id: articles.source_id })
      .from(articles)
      .where(eq(articles.cluster_id, clusterId));
    return res.map((r: any) => r.source_id);
  }

  async getSources(): Promise<any[]> {
    return await this.db.select().from(sources);
  }

  async getCluster(id: string): Promise<{ cluster: any, articles: any[] }> {
    const c = await this.db.select().from(clusters).where(eq(clusters.id, id)).limit(1);
    if (!c.length) return { cluster: null, articles: [] };
    const a = await this.db.select({
      articles: articles,
      sources: sources
    })
    .from(articles)
    .leftJoin(sources, eq(articles.source_id, sources.id))
    .where(eq(articles.cluster_id, id));
    return { cluster: c[0], articles: a };
  }

  async incrementClick(id: string): Promise<void> {
    await this.db.update(articles).set({ click_count: sql\\\click_count + 1\\\ }).where(eq(articles.id, id));
  }

  async incrementReport(id: string): Promise<void> {
    await this.db.update(articles).set({ user_reports: sql\\\user_reports + 1\\\ }).where(eq(articles.id, id));
  }

  async getStats(): Promise<any> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const total = await this.db.select().from(articles).where(gt(articles.expires_at, now));
    const verified = total.filter(a => a.verification_score > 0.5);
    const expiring = total.filter(a => a.expires_at > now && a.expires_at < oneHourFromNow);

    const categoriesMap: Record<string, number> = {};
    for (const a of total) {
      categoriesMap[a.category] = (categoriesMap[a.category] || 0) + 1;
    }

    return {
      total_articles: total.length,
      verified_articles: verified.length,
      expiring_soon: expiring.length,
      categories: categoriesMap,
      last_fetch: now.toISOString()
    };
  }
}
;
fs.writeFileSync('apps/worker/src/repositories.ts', code);
