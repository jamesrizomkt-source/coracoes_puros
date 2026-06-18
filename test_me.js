const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lmdawrnbnnrnmxbrmgak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs');
supabase.functions.invoke('melhor-envio/calculate', { body: { to_postal_code: '30130010' } })
  .then(res => console.log(JSON.stringify(res.data.servicos[0], null, 2)))
  .catch(console.error);
