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
      const cartRes = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/cart`, {
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

    // Função auxiliar para buscar os dados completos do lojista (remetente)
    async function getSenderData() {
      // 1. Tentar pegar Nome e Documento do perfil da conta Melhor Envio
      let senderName = "Corações Puros";
      let senderDocument = "72985392095"; // CPF de fallback válido
      let senderPhone = "11999999999";

      try {
        const meProfileReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me`, {
          headers: { "Accept": "application/json", "Authorization": `Bearer ${meToken}` }
        });
        if (meProfileReq.ok) {
          const profile = await meProfileReq.json();
          if (profile.firstname) senderName = `${profile.firstname} ${profile.lastname || ""}`.trim();
          if (profile.document) senderDocument = profile.document;
          if (profile.phone && profile.phone.phone) senderPhone = profile.phone.phone;
        }
      } catch (e) {
        console.error("Erro ao buscar perfil ME", e);
      }

      // 2. Buscar Cidade, Estado, Rua usando o CEP de origem via ViaCEP
      let merchantCity = "São Paulo";
      let merchantState = "SP";
      let merchantAddress = "Rua Central";
      let merchantDistrict = "Centro";

      try {
        const viaCepReq = await fetch(`https://viacep.com.br/ws/${meOriginCep.replace(/\D/g, "")}/json/`);
        if (viaCepReq.ok) {
          const viaCepData = await viaCepReq.json();
          if (!viaCepData.erro) {
            merchantCity = viaCepData.localidade;
            merchantState = viaCepData.uf;
            if (viaCepData.logradouro) merchantAddress = viaCepData.logradouro;
            if (viaCepData.bairro) merchantDistrict = viaCepData.bairro;
          }
        }
      } catch (e) {
        console.error("Erro ViaCEP", e);
      }

      return {
        name: senderName,
        phone: senderPhone.replace(/\D/g, ""),
        email: settings.admin_email || "contato@coracoespuros.com",
        document: senderDocument.replace(/\D/g, ""),
        address: merchantAddress,
        number: "S/N",
        district: merchantDistrict,
        city: merchantCity,
        state_abbr: merchantState,
        country_id: "BR",
        postal_code: meOriginCep.replace(/\D/g, "")
      };
    }

    // -------------------------------------------------------------
    // ENDPOINT: GERAR ETIQUETA ÚNICA (POST /generate-label)
    // -------------------------------------------------------------
    if (path.endsWith("/generate-label")) {
      if (req.method !== "POST") return new Response("Método Não Permitido", { status: 405, headers: corsHeaders });
      
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "Acesso negado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const body = await req.json();
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const orderRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } });
      const orders = await orderRes.json();
      if (!orders || orders.length === 0) return new Response(JSON.stringify({ error: "Pedido não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      const order = orders[0];
      if (!order.address_street || !order.address_number || !order.address_cep || !order.buyer_cpf) {
        return new Response(JSON.stringify({ error: "O pedido não possui endereço completo ou CPF salvo no banco." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const senderFrom = await getSenderData();
      const insuranceValue = insuranceEnabled ? bookPrice : 0;
      
      const serviceType = isSandbox ? 2 : 17; // SEDEX no Sandbox, Impresso Módico na Produção
      
      const cartPayload = {
        service: serviceType, // 17 = Impresso módico, 2 = SEDEX
        agency: null,
        from: senderFrom,
        to: {
          name: order.name,
          phone: (order.phone || "11999999999").replace(/\D/g, ""),
          email: order.email,
          document: order.buyer_cpf.replace(/\D/g, ""),
          address: order.address_street,
          number: order.address_number,
          complement: order.address_complement || "",
          district: order.address_district || "Bairro",
          city: order.address_city,
          state_abbr: order.address_state,
          country_id: "BR",
          postal_code: order.address_cep.replace(/\D/g, "")
        },
        products: [{ name: "Livro Físico - Corações Puros", quantity: 1, unitary_value: bookPrice }],
        volumes: [{ width: bookWidth, height: bookHeight, length: bookLength, weight: bookWeight }],
        options: { receipt: arEnabled, own_hand: false, collect: false, non_commercial: true, insurance_value: insuranceValue }
      };

      const cartReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/cart`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify(cartPayload) });
      if (!cartReq.ok) return new Response(JSON.stringify({ error: "Erro ao adicionar ao carrinho Melhor Envio", details: await cartReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const cartData = await cartReq.json();
      const ticketId = cartData.id;

      const checkoutReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/checkout`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ orders: [ticketId] }) });
      if (!checkoutReq.ok) return new Response(JSON.stringify({ error: "Erro no checkout do carrinho Melhor Envio", details: await checkoutReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const generateReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/generate`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ orders: [ticketId] }) });
      if (!generateReq.ok) return new Response(JSON.stringify({ error: "Erro ao gerar etiqueta", details: await generateReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await new Promise(r => setTimeout(r, 1000));

      const printReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/print`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ mode: "public", orders: [ticketId] }) });
      if (!printReq.ok) return new Response(JSON.stringify({ error: "Erro ao imprimir etiqueta", details: await printReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const printData = await printReq.json();

      await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}`, {
        method: "PATCH",
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ melhor_envio_label_url: printData.url, melhor_envio_tracking: cartData.tracking })
      });

      return new Response(JSON.stringify({ success: true, url: printData.url, tracking: cartData.tracking }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------------------------------------------------------------
    // ENDPOINT: GERAR ETIQUETAS EM LOTE (POST /generate-labels-bulk)
    // -------------------------------------------------------------
    if (path.endsWith("/generate-labels-bulk")) {
      if (req.method !== "POST") return new Response("Método Não Permitido", { status: 405, headers: corsHeaders });
      
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "Acesso negado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const body = await req.json();
      const orderIds = body.order_ids;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return new Response(JSON.stringify({ error: "A lista de order_ids é obrigatória e não pode ser vazia." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const idsQuery = orderIds.join(",");
      const orderRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=in.(${idsQuery})&select=*`, { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } });
      const orders = await orderRes.json();
      if (!orders || orders.length === 0) return new Response(JSON.stringify({ error: "Nenhum pedido válido encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const ticketIds = [];
      const trackingMap: Record<string, any> = {};
      const cartErrors = [];
      const senderFrom = await getSenderData();

      for (const order of orders) {
        if (!order.address_street || !order.address_number || !order.address_cep || !order.buyer_cpf) {
          continue; 
        }
        if (order.melhor_envio_label_url) {
          continue; 
        }

        const insuranceValue = insuranceEnabled ? bookPrice : 0;
        
        const serviceType = isSandbox ? 2 : 17; // SEDEX no Sandbox, Impresso Módico na Produção
        
        const cartPayload = {
          service: serviceType, // 17 = Impresso módico, 2 = SEDEX
          agency: null,
          from: senderFrom,
          to: {
            name: order.name,
            phone: (order.phone || "11999999999").replace(/\D/g, ""),
            email: order.email,
            document: order.buyer_cpf.replace(/\D/g, ""),
            address: order.address_street,
            number: order.address_number,
            complement: order.address_complement || "",
            district: order.address_district || "Bairro",
            city: order.address_city,
            state_abbr: order.address_state,
            country_id: "BR",
            postal_code: order.address_cep.replace(/\D/g, "")
          },
          products: [{ name: "Livro Físico - Corações Puros", quantity: 1, unitary_value: bookPrice }],
          volumes: [{ width: bookWidth, height: bookHeight, length: bookLength, weight: bookWeight }],
          options: { receipt: arEnabled, own_hand: false, collect: false, non_commercial: true, insurance_value: insuranceValue }
        };

        const cartReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/cart`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify(cartPayload) });
        if (cartReq.ok) {
          const cartData = await cartReq.json();
          ticketIds.push(cartData.id);
          trackingMap[cartData.id] = { orderId: order.id, tracking: cartData.tracking };
        } else {
          cartErrors.push(`Pedido ${order.id.substring(0,6)}: ${await cartReq.text()}`);
        }
      }

      if (ticketIds.length === 0) {
        let errorMsg = "Nenhum pedido pôde ser adicionado ao carrinho.";
        if (cartErrors.length > 0) {
          errorMsg += `\nErros da API: ${cartErrors[0]}`;
        } else {
          errorMsg += " Faltam dados como Endereço/CPF ou a etiqueta já havia sido gerada.";
        }
        return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const checkoutReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/checkout`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ orders: ticketIds }) });
      if (!checkoutReq.ok) return new Response(JSON.stringify({ error: "Erro no checkout em lote.", details: await checkoutReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const generateReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/generate`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ orders: ticketIds }) });
      if (!generateReq.ok) return new Response(JSON.stringify({ error: "Erro ao comandar a geração das etiquetas.", details: await generateReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await new Promise(r => setTimeout(r, 1000));

      const printReq = await fetch(`${melhorEnvioBaseUrl}/api/v2/me/shipment/print`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${meToken}` }, body: JSON.stringify({ mode: "public", orders: ticketIds }) });
      if (!printReq.ok) return new Response(JSON.stringify({ error: "Erro ao gerar PDF em lote.", details: await printReq.text() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      const printData = await printReq.json();

      // Atualizar o BD
      for (const ticketId of ticketIds) {
        const orderInfo = trackingMap[ticketId];
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderInfo.orderId}`, {
          method: "PATCH",
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ melhor_envio_label_url: printData.url, melhor_envio_tracking: orderInfo.tracking })
        });
      }

      return new Response(JSON.stringify({ success: true, url: printData.url, generated_count: ticketIds.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rota padrão se não for /calculate, /cart, /generate-label, ou /generate-labels-bulk
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
