import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
const MP_WEBHOOK_URL = Deno.env.get("MP_WEBHOOK_URL")

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "")

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json()
    const { order_id, total_price, customer_name, customer_email, formData } = body

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 
      })
    }

    if (!MP_ACCESS_TOKEN) {
      console.warn("MP_ACCESS_TOKEN is missing or not configured.")
    }

    const nameParts = (customer_name || "Cliente").split(" ")
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(" ") || "Sobrenome"

    // Se recebermos formData do Payment Brick, usamos. Senão, fallback pro PIX.
    const payload = formData ? {
      ...formData,
      description: "Adquirir Exemplar: Corações Puros",
      external_reference: order_id,
      notification_url: MP_WEBHOOK_URL || `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`,
      payer: {
        ...formData.payer,
        // Garantir que temos os dados do cliente
        first_name: formData.payer?.first_name || firstName,
        last_name: formData.payer?.last_name || lastName,
      }
    } : {
      transaction_amount: Number(total_price),
      description: "Adquirir Exemplar: Corações Puros",
      payment_method_id: "pix",
      payer: {
        email: customer_email || "cliente@exemplo.com",
        first_name: firstName,
        last_name: lastName
      },
      external_reference: order_id,
      notification_url: MP_WEBHOOK_URL || `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`
    }

    // Se não houver token configurado ainda (modo de espera), retorna sucesso simulado para o front-end
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ 
        success: true, 
        simulated: true,
        payment_id: "simulated_" + crypto.randomUUID(),
        qr_code: "00020101021226870014br.gov.bcb.pix2565pix.example.com/qr/v2/simulated-coracoes-puros-key",
        qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        ticket_url: "https://www.mercadopago.com.br",
        order_id: order_id,
        status: "approved"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })
    }

    const idempotencyKey = `${order_id}_${crypto.randomUUID()}`;

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[MercadoPago Error]", data)
      return new Response(JSON.stringify({ error: "Failed to create payment", details: data }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
      })
    }

    // Grava o ID de pagamento no banco de dados para segurança
    await supabase.from("orders").update({ mp_payment_id: String(data.id) }).eq("id", order_id)

    const transactionData = data.point_of_interaction?.transaction_data

    return new Response(JSON.stringify({ 
      success: true, 
      payment_id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      qr_code: transactionData?.qr_code,
      qr_code_base64: transactionData?.qr_code_base64,
      ticket_url: transactionData?.ticket_url,
      order_id: order_id
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
    })
  }
})
