const fs = require('fs');
let index = fs.readFileSync('apps/worker/src/index.ts', 'utf-8');
if (!index.includes('TURSO_URL')) {
    index = index.replace(/export type Bindings = \{[\s\S]*?\}/, (match) => {
        return match.replace('}', '  TURSO_URL?: string;\n  TURSO_AUTH_TOKEN?: string;\n}');
    });
    fs.writeFileSync('apps/worker/src/index.ts', index);
}
