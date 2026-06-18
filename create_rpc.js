const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  await client.query(`
    CREATE OR REPLACE FUNCTION get_book_price()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_price text;
    BEGIN
      SELECT value INTO v_price FROM settings WHERE key = 'book_price';
      RETURN v_price;
    END;
    $$;
  `);
  console.log("RPC created");
  await client.end();
}
run();
