const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`SELECT * FROM pg_policies WHERE tablename = 'settings'`);
  console.log(res.rows);
  
  // Also create an INSERT policy if it's missing, just in case!
  // It's probably easier to just allow admins to ALL.
  await client.query(`
    DROP POLICY IF EXISTS "Admins podem fazer tudo nas settings" ON settings;
    CREATE POLICY "Admins podem fazer tudo nas settings" ON settings
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  `);
  
  console.log("Updated policies!");
  
  await client.end();
}
run().catch(console.error);
