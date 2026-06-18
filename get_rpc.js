const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'calculate_melhor_envio'
      AND n.nspname = 'public';
  `);
  console.log(res.rows[0]?.definition || "Function not found");
  await client.end();
}
run().catch(console.error);
