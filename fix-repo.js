const fs = require('fs');
let repo = fs.readFileSync('apps/worker/src/repositories.ts', 'utf-8');
repo = repo.replace(/total\.filter\(a => a\.verification_score/g, 'total.filter((a: any) => a.verification_score');
repo = repo.replace(/total\.filter\(a => a\.expires_at/g, 'total.filter((a: any) => a.expires_at');
fs.writeFileSync('apps/worker/src/repositories.ts', repo);
