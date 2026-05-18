import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const ADMIN_EMAIL = "jjamesnt@gmail.com";
const SENDER_EMAIL = "jjamesnt@gmail.com";
const SENDER_NAME = "Corações Puros - Alê Portela";

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: any;
  old_record: any;
}

serve(async (req) => {
  // Tratar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // Validar segredo do webhook para segurança
  const secret = req.headers.get("x-supabase-webhook-secret");
  if (secret !== "CoracoesPurosSecretWebhook2026Token!!") {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log(`Recebido webhook para tabela ${payload.table}, tipo ${payload.type}`);

    // 1. Notificação de Novo Pedido (INSERT na tabela orders)
    if (payload.table === 'orders' && payload.type === 'INSERT') {
      const order = payload.record;
      await sendAdminNewOrderEmail(order);
      return new Response(JSON.stringify({ success: true, message: 'Alerta de novo pedido enviado.' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Confirmação de Pagamento para o Comprador (UPDATE na tabela orders para 'paid')
    if (payload.table === 'orders' && payload.type === 'UPDATE') {
      const oldOrder = payload.old_record;
      const newOrder = payload.record;

      if (oldOrder.status !== 'paid' && newOrder.status === 'paid') {
        await sendCustomerPaidEmail(newOrder);
        return new Response(JSON.stringify({ success: true, message: 'Confirmação de pagamento enviada para o cliente.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 3. Notificação de Nova Mensagem no Fale Conosco (INSERT na tabela messages)
    if (payload.table === 'messages' && payload.type === 'INSERT') {
      const msg = payload.record;
      await sendAdminNewMessageEmail(msg);
      return new Response(JSON.stringify({ success: true, message: 'Alerta de contato enviado ao admin.' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Nenhuma ação executada para este payload.' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Erro na Edge Function:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Funções auxiliares para enviar e-mails via Brevo HTTP API
async function sendEmailBrevo(toEmail: string, toName: string, subject: string, htmlContent: string) {
  if (!BREVO_API_KEY) {
    throw new Error("Erro: A variável de ambiente BREVO_API_KEY não foi configurada no Supabase.");
  }
  const url = 'https://api.brevo.com/v3/smtp/email';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to: [
        {
          email: toEmail,
          name: toName
        }
      ],
      subject: subject,
      htmlContent: htmlContent
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail pelo Brevo: ${response.status} ${response.statusText} - ${errorText}`);
  }

  console.log(`E-mail enviado com sucesso para ${toEmail} | Assunto: ${subject}`);
}

async function sendAdminNewOrderEmail(order: any) {
  const subject = `🚨 Novo Pedido de Livro Recebido! - ${order.name}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #f39a00; border-bottom: 2px solid #f39a00; padding-bottom: 10px;">Novo Pedido de Exemplar!</h2>
      <p>Olá, Alê Portela!</p>
      <p>Um novo pedido do livro <strong>Corações Puros</strong> acaba de ser registrado na sua Landing Page:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; width: 30%;">Nome:</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.name || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">E-mail:</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.email}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">Telefone:</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">${order.phone || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">Status:</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; color: #d97706; font-weight: bold;">🟡 Pendente</td>
        </tr>
      </table>
      
      <p>Acesse o seu <strong>Painel Administrativo</strong> para gerenciar este pedido e entrar em contato com o comprador via WhatsApp para finalizar o pagamento e detalhes do envio.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://coracoespuros.com.br/admin.html" target="_blank" style="background-color: #f39a00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acessar Painel de Gestão</a>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">Sistema de Gestão Comercial - Corações Puros © 2026</p>
    </div>
  `;

  await sendEmailBrevo(ADMIN_EMAIL, "Alê Portela", subject, htmlContent);
}

async function sendCustomerPaidEmail(order: any) {
  const subject = `📖 Pagamento Confirmado! Seu livro Corações Puros está garantido!`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 50px;">📖</span>
      </div>
      <h2 style="color: #10b981; text-align: center; margin-bottom: 10px;">Seu pagamento foi confirmado!</h2>
      <p>Olá, <strong>${order.name}</strong>!</p>
      
      <p>Ficamos muito felizes em confirmar que o seu pagamento pelo exemplar do livro <strong>Corações Puros</strong>, de autoria da Alê Portela, foi recebido com sucesso! 🎉</p>
      
      <p>O seu exemplar já está garantido e entra agora na nossa fila de preparação para envio ou entrega.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Detalhes do seu Pedido:</h4>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Destinatário:</strong> ${order.name}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>E-mail:</strong> ${order.email}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>WhatsApp:</strong> ${order.phone || 'Não informado'}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Status do Livro:</strong> 🟢 Confirmado & Pago</p>
      </div>

      <p>Caso falte algum dado de envio, ou se houver atualizações sobre o frete/código de rastreio, nós entraremos em contato direto com você através do seu WhatsApp.</p>
      
      <p style="margin-top: 30px;">Desejamos que este livro e a sua mensagem de amor, prevenção e proteção fortaleçam muito a sua vida e a sua comunidade!</p>
      
      <p style="margin-bottom: 0;">Com carinho,</p>
      <p style="font-weight: bold; color: #f39a00; margin-top: 5px;">Alê Portela & Equipe Corações Puros</p>
      
      <p style="color: #64748b; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 30px;">Corações Puros © 2026 | Landing Page e Vendas Oficiais</p>
    </div>
  `;

  await sendEmailBrevo(order.email, order.name, subject, htmlContent);
}

async function sendAdminNewMessageEmail(msg: any) {
  const subject = `✉️ Nova Mensagem no Fale Conosco de ${msg.name}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Contato no Fale Conosco!</h2>
      <p>Olá, Alê Portela!</p>
      <p>Você recebeu um novo contato pelo formulário de Fale Conosco da Landing Page:</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Nome:</strong> ${msg.name}</p>
        <p style="margin: 5px 0;"><strong>E-mail:</strong> ${msg.email}</p>
        <p style="margin: 15px 0 5px 0;"><strong>Mensagem enviada:</strong></p>
        <div style="background-color: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 4px; font-style: italic; color: #334155;">
          ${msg.message ? msg.message.replace(/\n/g, '<br>') : 'Mensagem vazia'}
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="mailto:${msg.email}?subject=Resposta: Contato Corações Puros" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Responder por E-mail</a>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">Sistema de Gestão Comercial - Corações Puros © 2026</p>
    </div>
  `;

  await sendEmailBrevo(ADMIN_EMAIL, "Alê Portela", subject, htmlContent);
}
