import { IArticleRepository } from '../repositories';
import { fetchRSS } from './rss';
import { computeSimHash } from './simhash';
import { assignCluster } from './clustering';
import { verifyArticle } from './corroboration';
import SOURCES_JSON from '../../../../backend/sources.json';

const SOURCES = SOURCES_JSON as Array<{ id?: string, name: string, url: string, category: string, score?: number, trusted: boolean, country?: string }>;

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function runIngestion(repo: IArticleRepository) {
  console.log('Starting V2 Edge Ingestion...');
  
  // Seed sources first
  for (const s of SOURCES) {
    if (!s.url) continue;
    const sourceId = s.id || s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    try {
      await repo.insertSource({
        id: sourceId,
        name: s.name,
        feed_url: s.url,
        category: s.category,
        country: s.country || 'Unknown',
        trust_score: s.score || (s.trusted ? 0.9 : 0.5),
        active: true
      });
    } catch(e) {} 
  }

  let newArticles = 0;

  for (const s of SOURCES) {
    if (!s.url) continue;
    const sourceId = s.id || s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const score = s.score || (s.trusted ? 0.9 : 0.5);

    try {
      const items = await fetchRSS(s.url, sourceId);
      
      for (const item of items) {
        if (!item.title || !item.link) continue;
        
        const urlHash = await sha256(item.link);
        const existing = await repo.findByUrlHash(urlHash);
        if (existing) continue; // Exact duplicate
        
        const titleHash = computeSimHash(item.title);
        const clusterId = await assignCluster(item.title, titleHash, item.publishedAt, repo);
        
        const verification = await verifyArticle(item.title, sourceId, score, clusterId, repo);
        
        const now = new Date();
        const expires = new Date(item.publishedAt.getTime() + 24 * 60 * 60 * 1000);
        
        await repo.insertArticle({
          id: urlHash.slice(0, 16),
          url_hash: urlHash,
          title_hash: titleHash.toString(), // Store BigInt as string
          title: item.title,
          summary: item.summary.slice(0, 200),
          canonical_url: item.link,
          source_id: sourceId,
          category: s.category,
          image_url: null,
          published_at: item.publishedAt,
          fetched_at: now,
          expires_at: expires,
          cluster_id: clusterId,
          verification_score: verification.score,
          verification_tier: verification.tier
        });
        newArticles++;
      }
    } catch (e) {
      console.error('Failed source:', s.name, e);
    }
  }
  return newArticles;
}
