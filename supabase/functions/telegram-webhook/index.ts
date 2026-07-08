import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

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

    const { message, record, type, table } = body
    
    let finalMessage = message;

    // Supabase Database Webhook (INSERT no banco)
    if (type === "INSERT" && record) {
      if (table === "quiz_responses") {
        finalMessage = `<b>🧠 Novo Quiz Respondido!</b>\n\n<b>Email:</b> ${record.email || 'N/A'}\n<b>Pontuação:</b> ${record.score || 0}/${record.total_questions || 5}`;
      } else if (table === "messages") {
        finalMessage = `<b>📩 Nova Mensagem de Contato!</b>\n\n<b>Nome:</b> ${record.name || 'N/A'}\n<b>Email:</b> ${record.email || 'N/A'}\n<b>Mensagem:</b> ${record.message || 'N/A'}`;
      } else if (table === "orders") {
        finalMessage = `<b>🎉 Novo Pedido Recebido!</b>\n\n<b>Nome:</b> ${record.name || 'N/A'}\n<b>Email:</b> ${record.email || 'N/A'}\n<b>Telefone:</b> ${record.phone || 'N/A'}\n<b>Status:</b> ${record.status || 'N/A'}`;
      } else {
        finalMessage = `<b>🔔 Novo Registro (${table || 'Desconhecido'})!</b>\n<pre>${JSON.stringify(record, null, 2)}</pre>`;
      }
    }

    if (!finalMessage) {
      return new Response(JSON.stringify({ error: "No message provided" }), { headers: corsHeaders, status: 400 })
    }

    // Inicializa o cliente do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca as configurações na tabela de settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['telegram_enabled', 'telegram_token', 'telegram_chat']);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return new Response(JSON.stringify({ error: "Failed to fetch settings" }), { headers: corsHeaders, status: 500 });
    }

    let isEnabled = false;
    let TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    let TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    settingsData?.forEach((row: any) => {
      if (row.key === 'telegram_enabled' && row.value === 'true') isEnabled = true;
      if (row.key === 'telegram_token' && row.value) TELEGRAM_BOT_TOKEN = row.value;
      if (row.key === 'telegram_chat' && row.value) TELEGRAM_CHAT_ID = row.value;
    });

    if (!isEnabled) {
      return new Response(JSON.stringify({ success: true, message: "Telegram notifications disabled in settings" }), { headers: corsHeaders, status: 200 })
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
