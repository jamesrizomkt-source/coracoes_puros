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
    const { order_id, total_price, customer_name, customer_email, formData, device_id } = body

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 
      })
    }

    // Proteção contra Replay Attack (Duplicidade) e captura de dados para Antifraude
    const { data: currentOrder, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single()

    if (orderError || !currentOrder) {
      return new Response(JSON.stringify({ error: "Order not found" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 
      })
    }

    if (currentOrder.status !== "pending") {
      return new Response(JSON.stringify({ error: "Order is no longer pending. Payment may already be in process or paid." }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 
      })
    }


    if (!MP_ACCESS_TOKEN) {
      console.warn("MP_ACCESS_TOKEN is missing or not configured.")
    }

    const nameParts = (customer_name || "Cliente").split(" ")
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(" ") || "Sobrenome"

    const { data: bookPriceData, error: bookPriceError } = await supabase.rpc('get_book_price')
    let bookPrice = 59.90
    if (!bookPriceError && bookPriceData) {
      bookPrice = parseFloat(String(bookPriceData).replace(/['"]/g, '').replace(',', '.'))
    }
    const safeShipping = Number(body.shippingPrice) || 0
    const shippingServiceId = body.shippingServiceId || null
    const qty = Number(body.qty) || 1
    const calculatedTotal = (bookPrice * qty) + safeShipping

    if (formData?.issuer_id) {
      formData.issuer_id = Number(formData.issuer_id)
    }

    // Regras de validação do Mercado Pago
    if (formData) {
      if (formData.payment_method_id === "pix") {
        delete formData.installments;
        delete formData.issuer_id;
        delete formData.token;
      } else {
        if (!formData.token) {
          return new Response(JSON.stringify({ error: "Token is required for credit card" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }
        if (qty === 1 && formData.installments > 1) {
          return new Response(JSON.stringify({ error: "Installments > 1 not allowed for 1 item" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }
        if (qty >= 2 && formData.installments > 3) {
          return new Response(JSON.stringify({ error: "Installments > 3 not allowed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }
      }
    }

    // Salva o preço de frete e transportadora no banco ANTES de chamar o MP
    if (order_id) {
      await supabase.from("orders").update({
        shipping_price: safeShipping,
        shipping_service_id: shippingServiceId
      }).eq("id", order_id)
    }

    // Montar o objeto additional_info para diminuir bloqueios do Antifraude
    const additionalInfo = {
      items: [
        {
          id: "livro_coracoes_puros",
          title: "Livro Físico - Corações Puros",
          description: "Exemplar impresso do livro Corações Puros",
          category_id: "books",
          quantity: qty,
          unit_price: Number(bookPrice.toFixed(2))
        }
      ],
      payer: {
        first_name: customer_name.split(' ')[0],
        last_name: customer_name.split(' ').slice(1).join(' ') || "Sobrenome",
        phone: {
          area_code: formData?.payer?.phone?.area_code || "31",
          number: formData?.payer?.phone?.number || "999999999"
        },
        address: {
          zip_code: formData?.payer?.address?.zip_code || "00000000",
          street_name: formData?.payer?.address?.street_name || "N/A",
          street_number: formData?.payer?.address?.street_number || "SN"
        },
        registration_date: new Date().toISOString(),
        is_first_purchase_online: true
      },
      shipments: {
        local_pickup: body.shippingServiceId === 'pickup',
        receiver_address: {
          zip_code: formData?.payer?.address?.zip_code || currentOrder?.address_cep || "00000000",
          street_name: formData?.payer?.address?.street_name || currentOrder?.address_street || "Rua",
          street_number: formData?.payer?.address?.street_number || currentOrder?.address_number || "S/N",
          floor: currentOrder?.address_complement || "",
          apartment: currentOrder?.address_complement || "",
          city_name: formData?.payer?.address?.city_name || currentOrder?.address_city || "Cidade",
          state_name: formData?.payer?.address?.state_name || currentOrder?.address_state || "Estado"
        }
      }
    };

    // Se recebermos formData do Payment Brick, usamos. Senão, fallback pro PIX.
    const payload = formData ? {
      ...formData,
      transaction_amount: calculatedTotal,
      description: "Adquirir Exemplar: Corações Puros",
      external_reference: order_id,
      notification_url: MP_WEBHOOK_URL || `${SUPABASE_URL}/functions/v1/mercado-pago-webhook`,
      additional_info: additionalInfo,
      payer: {
        ...formData.payer,
        // Garantir que temos os dados do cliente
        first_name: formData.payer?.first_name || firstName,
        last_name: formData.payer?.last_name || lastName,
      }
    } : {
      transaction_amount: calculatedTotal,
      description: "Adquirir Exemplar: Corações Puros",
      payment_method_id: "pix",
      additional_info: additionalInfo,
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

    // A Chave de Idempotência evita cobrança duplicada caso a internet caia.
    // Porém, se o cartão for recusado e o cliente tentar um NOVO cartão, precisamos de uma chave nova (usando o token do cartão).
    // Removed token from idempotency key as per AI feedback
    const idempotencyKey = crypto.randomUUID();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
      "X-Idempotency-Key": idempotencyKey
    };

    if (device_id) {
      headers["X-meli-session-id"] = device_id;
    }

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("[MercadoPago Error]", data)
      return new Response(JSON.stringify({ success: false, error: "Failed to create payment", details: data }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      })
    }

    let mpFeeAmount = 0;
    if (data.fee_details && data.fee_details.length > 0) {
      mpFeeAmount = data.fee_details.reduce((acc: number, fee: any) => acc + (Number(fee.amount) || 0), 0);
    }
    const paymentMethod = data.payment_method_id || data.payment_type_id || "unknown";

    if (data.status === "approved") {
      await supabase.from("orders").update({ 
        status: "paid",
        mp_payment_id: String(data.id),
        payment_origin: "mercadopago",
        mp_fee_amount: mpFeeAmount,
        payment_method: paymentMethod
      }).eq("id", order_id)
    } else {
      // Grava o ID de pagamento no banco de dados para segurança
      await supabase.from("orders").update({ 
        mp_payment_id: String(data.id),
        payment_method: paymentMethod
      }).eq("id", order_id)
    }
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
