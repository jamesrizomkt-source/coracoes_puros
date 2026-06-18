import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmdawrnbnnrnmxbrmgak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('settings').upsert({
    key: 'test_upsert',
    value: 'test_val',
    updated_at: new Date().toISOString()
  });
  console.log('Upsert result:', data, error);
}
run();
