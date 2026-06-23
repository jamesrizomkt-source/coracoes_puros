const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS mp_fee_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS payment_method TEXT;
  `);
  console.log("Columns added successfully.");
  await client.end();
}
run().catch(console.error);
