const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'melhor_envio_token'`);
  const token = res.rows[0].value;
  
  const apiRes = await globalThis.fetch("https://melhorenvio.com.br/api/v2/me/shipment/companies", {
    headers: { "Authorization": "Bearer " + token, "Accept": "application/json" }
  });
  const data = await apiRes.json();
  const total = data.find(c => c.name.toLowerCase().includes("total express"));
  console.log(total);
  await client.end();
}
run().catch(console.error);
