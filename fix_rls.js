const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres.lmdawrnbnnrnmxbrmgak:Senh@Fort3Git@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  await client.query(`
    DROP POLICY IF EXISTS "Allow anon read" ON public.orders;
    CREATE POLICY "Allow anon read" ON public.orders FOR SELECT USING (true);
  `);
  console.log('RLS updated successfully.');
  await client.end();
}
run().catch(console.error);
