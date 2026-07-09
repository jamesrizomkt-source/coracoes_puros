const fetch = require('node-fetch');
async function run() {
  const res = await fetch("https://sandbox.melhorenvio.com.br/api/v2/me/companies", {
    headers: { "Accept": "application/json" }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
