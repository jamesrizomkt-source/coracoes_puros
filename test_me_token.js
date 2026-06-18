const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'melhor_envio_token'`);
  const token = res.rows[0]?.value;
  await client.end();

  if (!token) {
    console.log("No token in DB");
    return;
  }

  console.log("Testing token. Length:", token.length);
  
  // Test Production
  const prodUrl = 'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate';
  const sandboxUrl = 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate';
  
  const payload = {
    "from": { "postal_code": "31910040" },
    "to": { "postal_code": "31910040" },
    "products": [
      {
        "id": "coracoes-puros-livro",
        "width": 15,
        "height": 2,
        "length": 22,
        "weight": 0.3,
        "insurance_value": 0,
        "quantity": 1
      }
    ]
  };

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'contato@coracoespuros.com.br'
  };

  try {
    console.log("Testing Production...");
    const pRes = await fetch(prodUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    const pText = await pRes.text();
    console.log("Production Status:", pRes.status, pText);
  } catch (e) {
    console.error("Production fetch failed:", e.message);
  }

  try {
    console.log("Testing Sandbox...");
    const sRes = await fetch(sandboxUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    const sText = await sRes.text();
    console.log("Sandbox Status:", sRes.status, sText);
  } catch (e) {
    console.error("Sandbox fetch failed:", e.message);
  }
}
run().catch(console.error);
