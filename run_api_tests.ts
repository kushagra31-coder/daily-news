
async function runApiTests() {
  const BASE = "http://127.0.0.1:8787/api/news";
  
  // 1. GET /api/news
  const feed = await (await fetch(BASE)).json();
  if (!feed.articles || typeof feed.total !== "number") throw "Failed /api/news";
  console.log("✅ GET /api/news passes");

  // 2. GET /api/news/yesterday
  const yesterday = await (await fetch(BASE + "/yesterday")).json();
  if (!yesterday.articles) throw "Failed /yesterday";
  console.log("✅ GET /api/news/yesterday passes");
  
  // 3. GET /categories
  const cats = await (await fetch(BASE + "/categories")).json();
  if (!cats.length) throw "Failed /categories";
  console.log("✅ GET /api/news/categories passes");
  
  // 4. GET /sources
  const sources = await (await fetch(BASE + "/sources")).json();
  if (!sources.sources) throw "Failed /sources";
  console.log("✅ GET /api/news/sources passes");
  
  // 5. GET /clusters/:id
  const cluster = await (await fetch(BASE + "/clusters/123")).json();
  if (!cluster.articles) throw "Failed /clusters/:id";
  console.log("✅ GET /api/news/clusters/:id passes");
  
  // 6. GET /seed
  const seed = await (await fetch(BASE + "/seed")).json();
  if (seed.success !== true) throw "Failed /seed";
  console.log("✅ GET /api/news/seed passes");

  // 7. Test Expiration via data mapping
  const futureTest = feed.articles.find(a => a.id === "test-future");
  if (futureTest) console.log("✅ Future article returned");
  const pastTest = feed.articles.find(a => a.id === "test-expired");
  if (!pastTest) console.log("✅ Expired article excluded");

}
runApiTests().catch(console.error);

