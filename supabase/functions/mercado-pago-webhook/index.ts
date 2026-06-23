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

    const action = body.action || url.searchParams.get("action") || ""
    const topic = body.topic || url.searchParams.get("topic") || body.type || url.searchParams.get("type") || ""
    const dataIdFromUrl = url.searchParams.get("data.id")
    
    // Prioridade máxima recomendada pelo MP: query param data.id
    const paymentId = dataIdFromUrl || (body.resource ? body.resource.split("/").pop() : (body.data?.id || body.id))

    const isPaymentEvent = topic === "payment" || action.startsWith("payment.") || body.type === "payment" || url.pathname.includes("payment");

    if (!isPaymentEvent || !paymentId) {
      return new Response(JSON.stringify({ message: "Ignoring non-payment event." }), { headers: corsHeaders, status: 200 })
    }

    const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET")
    const xSignature = req.headers.get("x-signature")
    const xRequestId = req.headers.get("x-request-id")

    if (MP_WEBHOOK_SECRET && xSignature && xRequestId) {
      const parts = xSignature.split(",")
      let ts = ""
      let v1 = ""
      parts.forEach(p => {
        const [k, v] = p.split("=")
        if (k === "ts") ts = v
        if (k === "v1") v1 = v
      })
      
      const manifestId = dataIdFromUrl || paymentId
      const manifest = `id:${manifestId};request-id:${xRequestId};ts:${ts};`
      
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(MP_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      )
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest))
      const signatureArray = Array.from(new Uint8Array(signatureBuffer))
      const generatedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

      if (generatedSignature !== v1) {
        console.error("Invalid webhook signature")
        return new Response(JSON.stringify({ error: "Invalid signature" }), { headers: corsHeaders, status: 403 })
      }
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

      let mpFeeAmount = 0;
      if (paymentInfo.fee_details && paymentInfo.fee_details.length > 0) {
        mpFeeAmount = paymentInfo.fee_details.reduce((acc: number, fee: any) => acc + (Number(fee.amount) || 0), 0);
      }
      const paymentMethod = paymentInfo.payment_method_id || paymentInfo.payment_type_id || "unknown";

      // Efetua a baixa automática
      const { error: updateError } = await supabase.from("orders").update({ 
        status: "paid", 
        payment_origin: "mercadopago", 
        mp_payment_id: String(paymentId),
        mp_fee_amount: mpFeeAmount,
        payment_method: paymentMethod
      }).eq("id", orderId)

      if (updateError) {
        console.error(`[MercadoPago Webhook] Error updating order status:`, updateError);
        return new Response(JSON.stringify({ error: 'DB Update error' }), { headers: corsHeaders, status: 500 })
      }

      // Se houver transportadora, tenta comprar a etiqueta automaticamente
      if (order.shipping_service_id) {
        // Dispara de forma assíncrona (não damos await) para não prender o retorno do Webhook
        fetch(`${SUPABASE_URL}/functions/v1/melhor-envio/buy-label`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId })
        }).catch(e => console.error("Falha ao engatilhar buy-label", e));
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 })
    }

    return new Response(JSON.stringify({ warning: "Order not found" }), { headers: corsHeaders, status: 200 })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
