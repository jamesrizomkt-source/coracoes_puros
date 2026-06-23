import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
serve(async (req) => {
  const token = Deno.env.get("MP_ACCESS_TOKEN");
  if (!token) return new Response("No token", { status: 500 });
  
  // Try getting the user profile first to get user_id
  const meRes = await fetch("https://api.mercadopago.com/users/me", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const me = await meRes.json();
  const userId = me.id;
  if (!userId) return new Response(JSON.stringify(me), { status: 500 });

  // Try the balance endpoint
  const balRes = await fetch(`https://api.mercadopago.com/users/${userId}/mercadopago_account/balance`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const balance = await balRes.json();
  return new Response(JSON.stringify({ me: me.id, balance }), { status: 200, headers: { "Content-Type": "application/json" } });
})
