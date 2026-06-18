const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Senh@Fort3Git@db.lmdawrnbnnrnmxbrmgak.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT * FROM http((
        'POST',
        'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate',
        ARRAY[
          http_header('Authorization', 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZTM3YjZmNzJhN2Q4YmY1ZjkzMzM0MGNkZDdiNGJiYzc5ZmQ4NzhjNzk3ODQ2MjAzZmIyNmI0OTBhMTdhZWNmNDAzOGVkYjZhMTllZjU2NmYiLCJpYXQiOjE3ODE1NDg2NDkuMjc4ODU1LCJuYmYiOjE3ODE1NDg2NDkuMjc4ODU3LCJleHAiOjE4MTMwODQ2NDkuMjYxMDQ2LCJzdWIiOiJhMjA3ZTAyYi0yNWJlLTQ4MzYtOTE0Ni01YTUyZmVlMzRkNzAiLCJzY29wZXMiOlsiY2FydC1yZWFkIiwiY2FydC13cml0ZSIsImNvbXBhbmllcy1yZWFkIiwiY29tcGFuaWVzLXdyaXRlIiwiY291cG9ucy1yZWFkIiwiY291cG9ucy13cml0ZSIsIm5vdGlmaWNhdGlvbnMtcmVhZCIsIm9yZGVycy1yZWFkIiwicHJvZHVjdHMtcmVhZCIsInByb2R1Y3RzLWRlc3Ryb3kiLCJwcm9kdWN0cy13cml0ZSIsInB1cmNoYXNlcy1yZWFkIiwic2hpcHBpbmctY2FsY3VsYXRlIiwic2hpcHBpbmctY2FuY2VsIiwic2hpcHBpbmctY2hlY2tvdXQiLCJzaGlwcGluZy1jb21wYW5pZXMiLCJzaGlwcGluZy1nZW5lcmF0ZSIsInNoaXBwaW5nLXByZXZpZXciLCJzaGlwcGluZy1wcmludCIsInNoaXBwaW5nLXNoYXJlIiwic2hpcHBpbmctdHJhY2tpbmciLCJlY29tbWVyY2Utc2hpcHBpbmciLCJ0cmFuc2FjdGlvbnMtcmVhZCIsInVzZXJzLXJlYWQiLCJ1c2Vycy13cml0ZSIsIndlYmhvb2tzLXJlYWQiLCJ3ZWJob29rcy13cml0ZSIsIndlYmhvb2tzLWRlbGV0ZSIsInRkZWFsZXItd2ViaG9vayJdfQ.TaHz1MaQCEcFPneoRihxry2O19kgnO7P2szma9lXnljmgPfhQZaOKCFJsBjozkHiM9yyTCJxVpw_lcelVdO6gZdozfJZ8-loeBfgz3XBRgIGdl-84lllZiz5tRYeRr4Es37LycWfHWO6SSZpdI_QMcNbVN4jMVwWNTZJU7Oo0QrF7lO-awgNDx1ibOxwQc90gqgKzZX2SNimMBKkw94HPEqkFGiPyAx0knCBlmYrWVylCqKZw3bgjB5bGhNPQhGnZmZWFiJkL5nyCQAOtMPvB4mi-H5gfEM7GgvdlkWBib9qcCImcEMtFqvmQ-GhsCxiLukLx91g3yWyw34chB1RluGgfUDn-HXBVzF1mkc5KN3Xsdr2sS21SkgYqvS27B-gEPumVvVcw1oyRs0SiPGuGsBDnfSCQr6kKR3OLMSLBKS5fT7LDvKL3Fq_SeRGCRVkir11NVQYuDofsPMz4BVe2WVBAqP5RFav4Bs-8Fu5D-_9IacLl8xmhSjh2Xxt_ck9IdJpoh4UQ-zhX3SJiupwdTNnt4LZybFrxSXM_yRFrtzF3c2XABf_vx0KqvOjyuKG4LJmJrAtVhZ_GF5HdGxsg1D8pI2laoBRdYBWZh_w40OeYQ5OKk7lDzqQZyzeOt_ofh0PjNk5qszQeKemT-ZHmp6zISjCyS8OyA3YbECBGEE'),
          http_header('Accept', 'application/json'),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{"from":{"postal_code":"31910040"},"to":{"postal_code":"31910040"},"products":[{"id":"coracoes-puros-livro","width":15,"height":2,"length":22,"weight":0.3,"insurance_value":0,"quantity":1}],"options":{"receipt":false,"own_hand":false,"collect":false,"insurance_value":0}}'
      )::http_request)
    `);
    console.log("Sandbox Result:", res.rows[0]);
  } catch (err) {
    console.error("SQL Error:", err.message);
  }
  await client.end();
}
run().catch(console.error);
