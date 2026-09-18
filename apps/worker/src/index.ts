import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { newsRoutes } from './routes/news';
import { compatRoutes } from './routes/compatibility';
import { runIngestion } from './ingestion/pipeline';
import { ArticleRepository } from './repositories';
import { getDb } from './db';

type Bindings = {
  DB: D1Database;
  TURSO_URL?: string;
  TURSO_AUTH_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// V2 explicit routes
app.route('/api/news', newsRoutes);

// V1 compatibility aliases
app.route('/api', compatRoutes);

// Simple healthcheck
app.get('/', (c) => c.text('Vanish API V2 Edge Worker is live.'));

export default {
  fetch: app.fetch,
  
  async scheduled(event: any, env: Bindings, ctx: any) {
    if (event.cron === "*/30 * * * *") {
      const repo = new ArticleRepository(getDb(env));
      await runIngestion(repo);
    }
  }
};
