const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'mercado_pago_token'`);
  const token = res.rows.length ? res.rows[0].value : null;
  if(!token) { console.log("NO TOKEN"); process.exit(1); }
  
  const additionalInfo = {
    items: [
      {
        id: "livro_coracoes_puros",
        title: "Livro Físico - Corações Puros",
        description: "Exemplar impresso do livro Corações Puros",
        category_id: "books",
        quantity: 1,
        unit_price: 44.9
      }
    ],
    payer: {
      first_name: "Test",
      last_name: "User",
      phone: { area_code: "31", number: "999999999" },
      address: { zip_code: "00000000", street_name: "N/A", street_number: "SN" }
    }
  };

  const payload = {
    payment_method_id: "pix",
    payer: { email: "test@example.com", first_name: "Test", last_name: "User" },
    transaction_amount: 44.9,
    description: "Adquirir Exemplar: Corações Puros",
    external_reference: "b43522d4-febe-4bda-aa0d-f5ab58f096e2",
    additional_info: additionalInfo
  };

  const mpRes = await globalThis.fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "X-Idempotency-Key": "test-12345678" },
    body: JSON.stringify(payload)
  });
  const data = await mpRes.json();
  console.log("MP Response:", JSON.stringify(data, null, 2));
  await client.end();
}
run().catch(console.error);
