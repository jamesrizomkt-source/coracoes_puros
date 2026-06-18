const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`SELECT value FROM settings WHERE key = 'melhor_envio_token'`);
  const token = res.rows[0]?.value;
  await client.end();

  if (!token) return;

  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    console.log("JWT Payload:", JSON.parse(payload));
  } else {
    console.log("Token is not a valid JWT!");
  }
}
run().catch(console.error);
