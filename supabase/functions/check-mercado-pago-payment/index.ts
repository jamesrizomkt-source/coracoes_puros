import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { payment_id, order_id } = await req.json()
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")

    if (!payment_id || !order_id) {
      return new Response(JSON.stringify({ error: "Config/arguments missing" }), { headers: corsHeaders, status: 400 })
    }

    // Se estiver em simulação/sem chaves
    if (!MP_ACCESS_TOKEN) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      const { data: order } = await supabase.from("orders").select("*").eq("id", order_id).single()
      if (order && order.status === "paid") {
        return new Response(JSON.stringify({ status: "approved" }), { headers: corsHeaders, status: 200 })
      }
      return new Response(JSON.stringify({ status: "pending" }), { headers: corsHeaders, status: 200 })
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
    })

    if (!mpRes.ok) return new Response(JSON.stringify({ error: "MP API error" }), { headers: corsHeaders, status: 400 })
    const mpData = await mpRes.json()

    if (mpData.status === "approved") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      const { data: order } = await supabase.from("orders").select("*").eq("id", order_id).single()

      if (order && order.status !== "paid") {
        await supabase.from("orders").update({
          status: "paid",
          payment_origin: "mercadopago",
          mp_payment_id: String(payment_id)
        }).eq("id", order_id)
      }
    }

    return new Response(JSON.stringify({ status: mpData.status }), { headers: corsHeaders, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 })
  }
})
