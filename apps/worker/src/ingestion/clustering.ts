import { computeSimHash, hammingDistance } from './simhash';
import { IArticleRepository } from '../repositories';

const CLUSTER_THRESHOLD = 20; // Max hamming distance for 64-bit simhash
const CLUSTER_TIME_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function assignCluster(
  title: string,
  titleHash: bigint,
  publishedAt: Date,
  repo: IArticleRepository
): Promise<string> {
  const recentArticles = await repo.getRecentArticles(CLUSTER_TIME_WINDOW_MS);
  
  for (const article of recentArticles) {
    if (!article.cluster_id) continue;
    
    // Parse BigInt from stored string hash
    let existingHash = 0n;
    try {
      existingHash = BigInt(article.title_hash);
    } catch (e) { continue; }
    
    const dist = hammingDistance(titleHash, existingHash);
    if (dist <= CLUSTER_THRESHOLD) {
      return article.cluster_id;
    }
  }
  
  // Create new cluster
  const newClusterId = crypto.randomUUID();
  await repo.insertCluster({
    id: newClusterId,
    created_at: new Date(),
    topic: title.slice(0, 50)
  });
  
  return newClusterId;
}
