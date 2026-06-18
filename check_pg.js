const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`SELECT * FROM settings`);
  console.log("Settings in DB via pg:", res.rows);
  await client.end();
}
run().catch(console.error);
