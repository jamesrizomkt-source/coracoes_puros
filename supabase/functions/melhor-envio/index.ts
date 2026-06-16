import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Cabeçalhos padrão para habilitar CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-webhook-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Interface das Configurações do Melhor Envio mapeadas do Banco de Dados
interface GlobalSettings {
  melhor_envio_token?: string;
  melhor_envio_origin_cep?: string;
  melhor_envio_sandbox?: string;
  melhor_envio_insurance_enabled?: string;
  melhor_envio_ar_enabled?: string;
  book_price?: string;
  book_weight?: string;
  book_width?: string;
  book_height?: string;
  book_length?: string;
  admin_email?: string;
}

// 1. Função utilitária para buscar e formatar configurações globais da tabela public.settings
async function fetchGlobalSettings(supabaseUrl: string, supabaseKey: string): Promise<GlobalSettings> {
  const url = `${supabaseUrl}/rest/v1/settings`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao buscar configurações globais: ${res.statusText} - ${errorText}`);
  }

  const settingsArray = await res.json();
  const settings: GlobalSettings = {};
  settingsArray.forEach((item: { key: string; value: string }) => {
    (settings as any)[item.key] = item.value;
  });

  return settings;
}

serve(async (req) => {
  // Tratar requisição CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, ""); // Remover barra final se houver

    // Buscar configurações globais e do livro salvas no ADM
    const settings = await fetchGlobalSettings(supabaseUrl, supabaseKey);

    const meToken = settings.melhor_envio_token;
    const meOriginCep = settings.melhor_envio_origin_cep ? settings.melhor_envio_origin_cep.replace(/\D/g, "") : "";
    const isSandbox = settings.melhor_envio_sandbox === "true";
    const insuranceEnabled = settings.melhor_envio_insurance_enabled === "true";
    const arEnabled = settings.melhor_envio_ar_enabled === "true";

    // Fallbacks para as dimensões e preço do livro físico
    const bookPrice = parseFloat(settings.book_price || "49.90");
    const bookWeight = parseFloat(settings.book_weight || "0.300");
    const bookWidth = parseFloat(settings.book_width || "15");
    const bookHeight = parseFloat(settings.book_height || "2");
    const bookLength = parseFloat(settings.book_length || "22");

    // Validação de credenciais básicas do Melhor Envio
    if (!meToken || !meOriginCep) {
      return new Response(
        JSON.stringify({ 
          error: "API do Melhor Envio não está configurada no Painel Administrativo. Preencha o token e o CEP de origem." 
        }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const melhorEnvioBaseUrl = isSandbox 
      ? "https://sandbox.melhorenvio.com.br" 
      : "https://api.melhorenvio.com.br";

    // -------------------------------------------------------------
    // ENDPOINT: COTAÇÃO DE FRETE (POST /calculate)
    // -------------------------------------------------------------
    if (path.endsWith("/calculate")) {
      if (req.method !== "POST") {
        return new Response("Método Não Permitido", { status: 405, headers: corsHeaders });
      }

      const body = await req.json();
      const toPostalCode = body.to_postal_code ? body.to_postal_code.replace(/\D/g, "") : "";
      const bookId = body.book_id || "coracoes-puros-livro";

      if (!toPostalCode || toPostalCode.length !== 8) {
        return new Response(
          JSON.stringify({ error: "CEP de destino inválido ou não informado. Deve conter exatamente 8 dígitos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Aplicação da regra de Seguro Automático configurada no ADM
      const insuranceValue = insuranceEnabled ? bookPrice : 0;

      // Montar payload para API do Melhor Envio (V2)
      const meRequestPayload = {
        from: {
          postal_code: meOriginCep,
        },
        to: {
          postal_code: toPostalCode,
        },
        products: [
          {
            id: bookId,
            width: bookWidth,
            height: bookHeight,
            length: bookLength,
            weight: bookWeight,
            insurance_value: insuranceValue,
            quantity: 1,
          }
        ],
        options: {
          receipt: arEnabled, // Aplicação da regra de Aviso de Recebimento (AR) do ADM
          own_hand: false,
          collect: false,
          insurance_value: insuranceValue,
        }
      };

      // Disparar POST para cálculo
      const calculateRes = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/calculate`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${meToken}`,
          "User-Agent": `Antigravity Integration (jjamesnt@gmail.com)`,
        },
        body: JSON.stringify(meRequestPayload),
      });

      if (!calculateRes.ok) {
        const errText = await calculateRes.text();
        return new Response(
          JSON.stringify({ error: `Erro na cotação do Melhor Envio: ${calculateRes.statusText}`, details: errText }),
          { status: calculateRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const servicesResult = await calculateRes.json();

      if (!Array.isArray(servicesResult)) {
        return new Response(
          JSON.stringify({ error: "Resposta inesperada da API do Melhor Envio.", details: servicesResult }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filtrar serviços com erro
      const validServices = servicesResult.filter((s: any) => !s.error);

      // Regra de Negócio: Priorizar e colocar no topo a modalidade "Correios Impresso Módico" (ID 17 ou nome similar)
      validServices.sort((a: any, b: any) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        const aIsImpresso = nameA.includes("impresso") || nameA.includes("modico") || nameA.includes("módico") || a.id === 17;
        const bIsImpresso = nameB.includes("impresso") || nameB.includes("modico") || nameB.includes("módico") || b.id === 17;

        if (aIsImpresso && !bIsImpresso) return -1;
        if (!aIsImpresso && bIsImpresso) return 1;
        
        // Em caso de empate, ordena pelo menor preço
        return parseFloat(a.price) - parseFloat(b.price);
      });

      return new Response(
        JSON.stringify({
          success: true,
          configuracoes_aplicadas: {
            seguro_ativo: insuranceEnabled,
            valor_seguro: insuranceValue,
            ar_ativo: arEnabled,
            sandbox: isSandbox
          },
          servicos: validServices
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------
    // ENDPOINT: COMPRA / GERAÇÃO DE ETIQUETA NO CARRINHO (POST /cart)
    // -------------------------------------------------------------
    if (path.endsWith("/cart")) {
      if (req.method !== "POST") {
        return new Response("Método Não Permitido", { status: 405, headers: corsHeaders });
      }

      const body = await req.json();
      const serviceId = body.service_id || 17; // Default: Impresso Módico (ID 17)
      const buyer = body.buyer; // Detalhes do comprador enviados no payload

      if (!buyer || !buyer.name || !buyer.email || !buyer.phone || !buyer.postal_code || !buyer.address || !buyer.number || !buyer.district || !buyer.city || !buyer.state_abbr) {
        return new Response(
          JSON.stringify({ error: "Dados do destinatário incompletos no payload (buyer)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insuranceValue = insuranceEnabled ? bookPrice : 0;

      // Montar payload da compra respeitando as mesmas regras de Seguro e AR do ADM
      const cartRequestPayload = {
        service: serviceId,
        agency: body.agency_id || null, // Opcional (obrigatório apenas para Jadlog)
        from: {
          name: "Corações Puros",
          phone: "11999999999",
          email: settings.admin_email || "jjamesnt@gmail.com",
          document: "00000000000100", // CNPJ Padrão/Simulado
          address: "Rua do Livro",
          number: "100",
          complement: "",
          district: "Centro",
          city: "São Paulo",
          state_abbr: "SP",
          country_id: "BR",
          postal_code: meOriginCep,
        },
        to: {
          name: buyer.name,
          phone: buyer.phone.replace(/\D/g, ""),
          email: buyer.email,
          document: buyer.document ? buyer.document.replace(/\D/g, "") : "", // CPF do comprador
          address: buyer.address,
          number: buyer.number,
          complement: buyer.complement || "",
          district: buyer.district,
          city: buyer.city,
          state_abbr: buyer.state_abbr,
          country_id: "BR",
          postal_code: buyer.postal_code.replace(/\D/g, ""),
        },
        products: [
          {
            name: "Livro Físico - Corações Puros",
            quantity: 1,
            unitary_value: bookPrice,
          }
        ],
        volumes: [
          {
            width: bookWidth,
            height: bookHeight,
            length: bookLength,
            weight: bookWeight,
          }
        ],
        options: {
          receipt: arEnabled, // Aplicação de Aviso de Recebimento
          own_hand: false,
          collect: false,
          non_commercial: true, // Declaração de conteúdo não comercial para livros
          insurance_value: insuranceValue, // Aplicação de Seguro Automático
        }
      };

      // Enviar requisição para adicionar ao carrinho do Melhor Envio
      const cartRes = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/cart`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${meToken}`,
          "User-Agent": `Antigravity Integration (jjamesnt@gmail.com)`,
        },
        body: JSON.stringify(cartRequestPayload),
      });

      if (!cartRes.ok) {
        const errText = await cartRes.text();
        return new Response(
          JSON.stringify({ error: `Erro ao adicionar etiqueta ao carrinho: ${cartRes.statusText}`, details: errText }),
          { status: cartRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cartData = await cartRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          configuracoes_aplicadas: {
            seguro_ativo: insuranceEnabled,
            valor_seguro: insuranceValue,
            ar_ativo: arEnabled,
            sandbox: isSandbox
          },
          cart: cartData
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rota padrão se não for /calculate ou /cart
    return new Response(
      JSON.stringify({ error: "Endpoint não encontrado. Use /calculate ou /cart." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Erro na Deno Edge Function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
