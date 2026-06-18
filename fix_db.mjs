const SUPABASE_URL = "https://lmdawrnbnnrnmxbrmgak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs";
// We use the service role key to simulate the request to see PostgREST errors.
// Wait, the anon key is in .env, I don't have the service role key as a variable.
// I can just query it through `pg` though. But I want to see the PostgREST error.
// The user has VITE_SUPABASE_ANON_KEY.
// What if I use pg to insert directly, bypassing the UI? That would solve the problem for the user NOW!
