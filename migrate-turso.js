const { createClient } = require('@libsql/client');
const fs = require('fs');

async function main() {
  const client = createClient({
    url: 'libsql://daily-vanish-kushagra31-coder.aws-ap-south-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk3MzY2NzQsImlkIjoiMDFhMGI0OWMtYTIwMS03NWE3LWEyN2ItMDcxYjFiMDA3OTU3Iiwia2lkIjoiUlhMdzRQNnc2SElsNnZvdUlLS0l3LVpsS3oxNnZlQjAtVTJiUV9FUFM4byIsInJpZCI6ImJmZGNjZDMwLWI1OTEtNDc5OC05NTNkLTZmNjY0ODNlNmY0MiJ9.rDlwska-avDJG6jBoYkwRLIaNOqItsvtAbR7lPJ10Exz_AMaH62KnlYoCGB9hwmH3Od8cZeWLkvBMPjW95L_Cg',
  });

  const sql0 = fs.readFileSync('packages/db/migrations/0000_goofy_fantastic_four.sql', 'utf8').replace(/--> statement-breakpoint/g, '');
  const sql1 = fs.readFileSync('packages/db/migrations/0001_burly_champions.sql', 'utf8').replace(/--> statement-breakpoint/g, '');

  try {
    console.log('Executing Multiple 0000...');
    await client.executeMultiple(sql0);
    console.log('Executing Multiple 0001...');
    await client.executeMultiple(sql1);
    console.log('Done!');
  } catch (e) {
    console.error(e);
  }
}
main();
