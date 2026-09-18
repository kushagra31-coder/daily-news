const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'https://daily-vanish-kushagra31-coder.aws-ap-south-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk3MzY2NzQsImlkIjoiMDFhMGI0OWMtYTIwMS03NWE3LWEyN2ItMDcxYjFiMDA3OTU3Iiwia2lkIjoiUlhMdzRQNnc2SElsNnZvdUlLS0l3LVpsS3oxNnZlQjAtVTJiUV9FUFM4byIsInJpZCI6ImJmZGNjZDMwLWI1OTEtNDc5OC05NTNkLTZmNjY0ODNlNmY0MiJ9.rDlwska-avDJG6jBoYkwRLIaNOqItsvtAbR7lPJ10Exz_AMaH62KnlYoCGB9hwmH3Od8cZeWLkvBMPjW95L_Cg',
  });
  const res = await client.execute("SELECT name, type FROM sqlite_schema WHERE type='table'");
  console.log(res.rows);
}
main();
