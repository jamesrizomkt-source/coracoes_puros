const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'mercado_pago_token'`);
  const token = res.rows[0].value;
  
  const payload = {
    payment_method_id: "pix",
    payer: { email: "test@example.com" },
    transaction_amount: null
  };

  const mpRes = await globalThis.fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await mpRes.json();
  console.log("MP Response for null amount:", JSON.stringify(data, null, 2));

  const payload2 = {
    payment_method_id: "pix",
    payer: { email: "test@example.com" }
  };
  const mpRes2 = await globalThis.fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload2)
  });
  const data2 = await mpRes2.json();
  console.log("MP Response for missing amount:", JSON.stringify(data2, null, 2));

  await client.end();
}
run().catch(console.error);
