import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://cybakgeofynizvtaqlph.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5YmFrZ2VvZnluaXp2dGFxbHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODI1OTQsImV4cCI6MjA5MzA1ODU5NH0.hScq4tn1YtrRF6wtaKhJ4H3CjLRhC4acpQ0WhirMfEg";

export const supabase = createClient(supabaseUrl, supabaseKey);
