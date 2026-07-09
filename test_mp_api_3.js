const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'book_price'`);
  console.log("bookPrice:", res.rows[0].value);
  await client.end();
}
run().catch(console.error);
