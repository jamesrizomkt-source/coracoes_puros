const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'melhor_envio_token'`);
  const token = res.rows[0].value;
  
  const apiRes = await globalThis.fetch("https://melhorenvio.com.br/api/v2/me/shipment/agencies?company=1&country=BR&postal_code=31910040", {
    headers: { "Authorization": "Bearer " + token, "Accept": "application/json" }
  });
  const data = await apiRes.json();
  console.log(JSON.stringify(data.data ? data.data[0] : data[0], null, 2));
  await client.end();
}
run().catch(console.error);
