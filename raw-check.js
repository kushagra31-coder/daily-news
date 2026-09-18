const url = 'https://daily-vanish-kushagra31-coder.aws-ap-south-1.turso.io/v2/pipeline';
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk3MzY2NzQsImlkIjoiMDFhMGI0OWMtYTIwMS03NWE3LWEyN2ItMDcxYjFiMDA3OTU3Iiwia2lkIjoiUlhMdzRQNnc2SElsNnZvdUlLS0l3LVpsS3oxNnZlQjAtVTJiUV9FUFM4byIsInJpZCI6ImJmZGNjZDMwLWI1OTEtNDc5OC05NTNkLTZmNjY0ODNlNmY0MiJ9.rDlwska-avDJG6jBoYkwRLIaNOqItsvtAbR7lPJ10Exz_AMaH62KnlYoCGB9hwmH3Od8cZeWLkvBMPjW95L_Cg';
fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    requests: [
      { type: 'execute', stmt: { sql: 'SELECT name FROM sqlite_schema WHERE type="table"' } },
      { type: 'execute', stmt: { sql: 'PRAGMA table_info(articles)' } }
    ]
  })
}).then(r => r.json()).then(r => console.dir(r, {depth: null}));
