import { IArticleRepository } from '../repositories';
import { articles } from '@news/db';
import { eq } from 'drizzle-orm';

// Official sources give an immediate verification bump
const OFFICIAL_SOURCES = new Set(['whitehouse', 'gov', 'who', 'un']);
const CORROBORATION_THRESHOLD = 3;

export async function verifyArticle(
  articleTitle: string,
  sourceId: string,
  sourceTrustScore: number,
  clusterId: string,
  repo: IArticleRepository
): Promise<{ score: number, tier: string }> {
  
  let score = sourceTrustScore;
  let tier = 'source_rep';

  if (OFFICIAL_SOURCES.has(sourceId)) {
    return { score: 1.0, tier: 'official_signal' };
  }

  // Check cluster corroboration
  const clusterSources = await repo.getClusterSources(clusterId);
  const uniqueSources = new Set(clusterSources);
  uniqueSources.add(sourceId); // include current

  if (uniqueSources.size >= CORROBORATION_THRESHOLD) {
    score = Math.min(1.0, score + 0.20 * uniqueSources.size);
    tier = 'corroboration';
  }

  return { score, tier };
}
