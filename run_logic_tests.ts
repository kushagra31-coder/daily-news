
import { computeSimHash, hammingDistance } from "./apps/worker/src/ingestion/simhash";
import { verifyArticle } from "./apps/worker/src/ingestion/corroboration";
import { assignCluster } from "./apps/worker/src/ingestion/clustering";
import { IArticleRepository } from "./apps/worker/src/repositories";

async function runTests() {
  console.log("--- 1. SimHash Tests ---");
  const h1 = computeSimHash("Apple launches new iPhone 16 Pro Max");
  const h2 = computeSimHash("Apple announces the new iPhone 16 Pro Max");
  const h3 = computeSimHash("Apple reveals next generation iPhone 16 Pro Max with AI");
  const h4 = computeSimHash("Microsoft reveals new Surface Laptop 6");
  
  const d1_2 = hammingDistance(h1, h2);
  const d1_3 = hammingDistance(h1, h3);
  const d1_4 = hammingDistance(h1, h4);
  
  console.log("Near duplicate: ", d1_2);
  console.log("Reworded: ", d1_3);
  console.log("Unrelated: ", d1_4);
  if (d1_2 <= 20 && d1_3 <= 25 && d1_4 > 25) console.log("✅ SimHash passes");
  else { console.log("❌ SimHash fails"); process.exit(1); }

  console.log("\n--- 2 & 3. Clustering & Corroboration Tests ---");
  let clusterDb: Record<string, string[]> = {};
  let recentArticles: any[] = [];
  
  const mockRepo = {
    getRecentArticles: async () => recentArticles,
    insertCluster: async (c: any) => { },
    getClusterSources: async (cid: string) => clusterDb[cid] || [],
  } as unknown as IArticleRepository;

  const cid1 = await assignCluster("Apple launches new iPhone", computeSimHash("Apple launches new iPhone"), new Date(), mockRepo);
  recentArticles.push({ title_hash: computeSimHash("Apple launches new iPhone").toString(), cluster_id: cid1 });
  clusterDb[cid1] = ["source1"];
  
  const ver1 = await verifyArticle("Apple launches new iPhone", "source1", 0.8, cid1, mockRepo);
  console.log("1 Source:", ver1);
  if (ver1.tier === "source_rep" && ver1.score === 0.8) console.log("✅ Corroboration (1 source) passes");

  const cid2 = await assignCluster("Apple announces new iPhone", computeSimHash("Apple announces new iPhone"), new Date(), mockRepo);
  if (cid1 === cid2) console.log("✅ Clustering (Same event, similar wording) passes");
  else { console.log("❌ Clustering fails: ", cid1, cid2); process.exit(1); }
  clusterDb[cid1].push("source2");

  const ver2 = await verifyArticle("Apple announces new iPhone", "source2", 0.8, cid1, mockRepo);
  console.log("2 Sources:", ver2);
  if (ver2.tier === "source_rep" && ver2.score === 0.8) console.log("✅ Corroboration (2 sources) passes");

  clusterDb[cid1].push("source3");
  const ver3 = await verifyArticle("Apple iPhone launch", "source3", 0.8, cid1, mockRepo);
  console.log("3 Sources:", ver3);
  if (ver3.tier === "corroboration" && ver3.score > 0.8) console.log("✅ Corroboration (3 sources) passes");
  
  const verOff = await verifyArticle("Apple launches new iPhone", "who", 0.8, cid1, mockRepo);
  console.log("Official Source:", verOff);
  if (verOff.tier === "official_signal" && verOff.score === 1.0) console.log("✅ Corroboration (Official signal) passes");

  const cidUnrelated = await assignCluster("Tesla announces new car", computeSimHash("Tesla announces new car"), new Date(), mockRepo);
  if (cidUnrelated !== cid1) console.log("✅ Clustering (Unrelated event) passes");
}
runTests().catch(console.error);

