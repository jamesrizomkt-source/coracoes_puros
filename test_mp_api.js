const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'mercado_pago_token'`);
  const token = res.rows[0].value;
  console.log("Token:", token.substring(0, 10) + "...");
  
  const payload = {
    transaction_amount: 59.90,
    description: "Adquirir Exemplar: Corações Puros",
    payment_method_id: "pix",
    payer: {
      email: "test@example.com",
      first_name: "Test",
      last_name: "User"
    },
    external_reference: "12345"
  };

  const mpRes = await globalThis.fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "X-Idempotency-Key": "test-123456" },
    body: JSON.stringify(payload)
  });
  const data = await mpRes.json();
  console.log("MP Response:", JSON.stringify(data, null, 2));
  await client.end();
}
run().catch(console.error);
