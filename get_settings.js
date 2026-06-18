const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const res = await client.query('SELECT key, value FROM settings WHERE key IN (\'book_price\', \'shipping_config\')');
  console.log(res.rows);
  await client.end();
}
run();
