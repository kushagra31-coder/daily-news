const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');

async function main() {
  const localDb = new Database('apps/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite');
  
  const turso = createClient({
    url: 'libsql://daily-vanish-kushagra31-coder.aws-ap-south-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk3MzY2NzQsImlkIjoiMDFhMGI0OWMtYTIwMS03NWE3LWEyN2ItMDcxYjFiMDA3OTU3Iiwia2lkIjoiUlhMdzRQNnc2SElsNnZvdUlLS0l3LVpsS3oxNnZlQjAtVTJiUV9FUFM4byIsInJpZCI6ImJmZGNjZDMwLWI1OTEtNDc5OC05NTNkLTZmNjY0ODNlNmY0MiJ9.rDlwska-avDJG6jBoYkwRLIaNOqItsvtAbR7lPJ10Exz_AMaH62KnlYoCGB9hwmH3Od8cZeWLkvBMPjW95L_Cg'
  });

  const tables = ['sources', 'clusters', 'articles'];

  for (const table of tables) {
    console.log(`Migrating ${table}...`);
    const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      console.log(`No rows in ${table}.`);
      continue;
    }

    const cols = Object.keys(rows[0]);
    const stmts = [];
    
    for (const row of rows) {
      const vals = cols.map(c => row[c]);
      const placeholders = cols.map(() => '?').join(',');
      stmts.push({ sql: `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, args: vals });
    }
    
    // Batch execute them!
    await turso.batch(stmts, 'write');
    console.log(`Migrated ${rows.length} rows for ${table}.`);
  }
}
main().catch(console.error);
