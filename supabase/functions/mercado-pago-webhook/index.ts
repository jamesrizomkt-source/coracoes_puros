import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "")

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const rawBody = await req.text()
    let body: any = {}
    if (rawBody) {
      try { body = JSON.parse(rawBody) } catch(e) {}
    }

    const topic = body.topic || url.searchParams.get("topic") || body.type || url.searchParams.get("type")
    const paymentId = body.resource ? body.resource.split("/").pop() : (body.data?.id || url.searchParams.get("data.id") || body.id)

    if (topic !== "payment" || !paymentId) {
      return new Response(JSON.stringify({ message: "Ignoring non-payment event." }), { headers: corsHeaders, status: 200 })
    }

    // Se estiver em modo de simulação ou sem chaves configuradas
    if (!MP_ACCESS_TOKEN) {
      console.log("MP_ACCESS_TOKEN is not configured. Simulating payment success if paymentId is simulated.");
      if (String(paymentId).startsWith("simulated_")) {
        // Encontra a ordem no banco para atualizar o status
        const { data: orders } = await supabase.from("orders").select("*").eq("status", "pending").limit(1);
        if (orders && orders.length > 0) {
          const order = orders[0];
          await supabase.from("orders").update({ 
            status: "paid", 
            payment_origin: "mercadopago", 
            mp_payment_id: String(paymentId)
          }).eq("id", order.id)
        }
      }
      return new Response(JSON.stringify({ simulated: true }), { headers: corsHeaders, status: 200 })
    }

    // Consulta detalhes reais do pagamento no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` }
    })

    if (!mpRes.ok) return new Response(JSON.stringify({ error: "Failed to fetch payment info" }), { headers: corsHeaders, status: 500 })

    const paymentInfo = await mpRes.json()
    const status = paymentInfo.status
    const orderId = paymentInfo.external_reference

    if (status !== "approved" || !orderId) {
      return new Response(JSON.stringify({ message: `Payment ${status}. Ignored.` }), { headers: corsHeaders, status: 200 })
    }

    // Busca o pedido no banco
    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle()

    if (order) {
      if (order.status === "paid") {
        return new Response(JSON.stringify({ message: "Order already paid." }), { headers: corsHeaders, status: 200 })
      }

      // Efetua a baixa automática
      await supabase.from("orders").update({ 
        status: "paid", 
        payment_origin: "mercadopago", 
        mp_payment_id: String(paymentId)
      }).eq("id", orderId)

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 })
    }

    return new Response(JSON.stringify({ warning: "Order not found" }), { headers: corsHeaders, status: 200 })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
