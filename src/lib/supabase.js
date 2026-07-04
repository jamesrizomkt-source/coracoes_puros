import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://lmdawrnbnnrnmxbrmgak.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs";

export const supabase = createClient(supabaseUrl, supabaseKey);
