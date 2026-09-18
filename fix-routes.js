const fs = require('fs');

let r1 = fs.readFileSync('apps/worker/src/routes/compatibility.ts', 'utf-8');
r1 = r1.replace(/import \{ D1ArticleRepository \} from '\.\.\/repositories';/, "import { ArticleRepository } from '../repositories';\nimport { getDb } from '../db';");
r1 = r1.replace(/const repo = new D1ArticleRepository\(c\.env\.DB\);/g, 'const repo = new ArticleRepository(getDb(c.env));');
fs.writeFileSync('apps/worker/src/routes/compatibility.ts', r1);

let r2 = fs.readFileSync('apps/worker/src/routes/news.ts', 'utf-8');
r2 = r2.replace(/import \{ D1ArticleRepository \} from '\.\.\/repositories';/, "import { ArticleRepository } from '../repositories';\nimport { getDb } from '../db';");
r2 = r2.replace(/const repo = new D1ArticleRepository\(c\.env\.DB\);/g, 'const repo = new ArticleRepository(getDb(c.env));');
fs.writeFileSync('apps/worker/src/routes/news.ts', r2);
