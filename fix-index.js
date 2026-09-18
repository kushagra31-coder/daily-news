const fs = require('fs');
let index = fs.readFileSync('apps/worker/src/index.ts', 'utf-8');
index = index.replace(/import \{ D1ArticleRepository \} from '\.\/repositories';/, "import { ArticleRepository } from './repositories';\nimport { getDb } from './db';");
index = index.replace(/type Bindings = \{[\s\S]*?\};/, 'type Bindings = {\n  DB: D1Database;\n  TURSO_URL?: string;\n  TURSO_AUTH_TOKEN?: string;\n};');
index = index.replace(/const repo = new D1ArticleRepository\(env\.DB\);/, 'const repo = new ArticleRepository(getDb(env));');
fs.writeFileSync('apps/worker/src/index.ts', index);
