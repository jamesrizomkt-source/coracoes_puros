const SUPABASE_URL = "https://lmdawrnbnnrnmxbrmgak.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs";

async function run() {
  const headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY, // Use anon key to simulate admin.js if service role key not available
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  };

  const key = "melhor_envio_token";
  const value = "test_token_123";

  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?on_conflict=key`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
run();
