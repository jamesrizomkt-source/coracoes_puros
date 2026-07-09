const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT id, status, mp_payment_id, shipping_price FROM orders ORDER BY created_at DESC LIMIT 3`);
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
