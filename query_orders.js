const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT id, name, email, phone, address_cep, address_street, address_number, address_city, address_state, shipping_service_id, buyer_cpf FROM orders ORDER BY created_at DESC LIMIT 5`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
