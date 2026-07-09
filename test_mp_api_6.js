const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'mercado_pago_token'`);
  const token = res.rows.length ? res.rows[0].value : Deno.env.get('MP_ACCESS_TOKEN');
  if(!token) { console.log("NO TOKEN"); process.exit(1); }
  
  const payload = {
    payment_method_id: "pix",
    payer: { email: "test@example.com", first_name: "Test", last_name: "User" },
    transaction_amount: 44.90,
    description: "Adquirir Exemplar: Corações Puros",
    additional_info: {
      items: [
        {
          id: "123", title: "Book", quantity: 1, unit_price: 44.90
        }
      ]
    }
  };

  const mpRes = await globalThis.fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await mpRes.json();
  console.log("MP Response for items test:", JSON.stringify(data, null, 2));

  await client.end();
}
run().catch(console.error);
