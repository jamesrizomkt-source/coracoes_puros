import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    let body: any = {}
    if (rawBody) {
      try { body = JSON.parse(rawBody) } catch(e) {}
    }

    const { message, record, type } = body

    let finalMessage = message;

    // Supabase Database Webhook (INSERT no banco)
    if (type === "INSERT" && record) {
      const { name, email, phone, status } = record;
      finalMessage = `<b>🎉 Novo Pedido Recebido!</b>\n\n<b>Nome:</b> ${name || 'N/A'}\n<b>Email:</b> ${email || 'N/A'}\n<b>Telefone:</b> ${phone || 'N/A'}\n<b>Status:</b> ${status || 'N/A'}`;
    }

    if (!finalMessage) {
      return new Response(JSON.stringify({ error: "No message provided" }), { headers: corsHeaders, status: 400 })
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn("Missing Telegram credentials. Skipping notification.")
      return new Response(JSON.stringify({ warning: "Missing credentials" }), { headers: corsHeaders, status: 200 })
    }

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: finalMessage,
        parse_mode: "HTML" // Permite formatação em HTML (<b>, <i>, <a> etc)
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("Telegram API Error:", result)
      return new Response(JSON.stringify({ error: "Failed to send message to Telegram", details: result }), { headers: corsHeaders, status: 500 })
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: corsHeaders, status: 200 })

  } catch (err: any) {
    console.error("Error sending Telegram message:", err)
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
  }
})
