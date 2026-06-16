# Guia de Implantação: Mercado Pago (PIX Transparente) e Baixa Automática

Este guia descreve os passos necessários para configurar a infraestrutura de pagamentos via Mercado Pago (PIX transparente) e baixa automática de pedidos no projeto **Corações Puros**.

---

## 1. Variáveis de Ambiente e Configurações

No painel do Supabase (ou via CLI `supabase secrets set`), configure as seguintes chaves de ambiente nas **Edge Functions do Supabase** assim que tiver as credenciais do seu cliente:

```bash
# Credenciais do Mercado Pago
MP_ACCESS_TOKEN="APP_USR-seu-token-de-acesso-producao" # Token de produção do cliente
MP_WEBHOOK_URL="https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/mercado-pago-webhook" # URL do webhook do projeto

# Credenciais padrões do Supabase (geralmente injetadas automaticamente)
SUPABASE_URL="https://lmdawrnbnnrnmxbrmgak.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
```

No frontend (`.env` local), as configurações já estão apontando para o projeto correto:
```env
VITE_SUPABASE_URL="https://lmdawrnbnnrnmxbrmgak.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs"
```

---

## 2. Estrutura do Banco de Dados (SQL)

A tabela de pedidos (`public.orders`) já está criada e estruturada para suportar a baixa do Mercado Pago, contendo as colunas necessárias para rastrear a transação. O script correspondente em `supabase/schema.sql` inclui:

```sql
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    phone text,
    status text not null default 'pending', -- 'pending', 'paid', 'shipped', 'cancelled'
    payment_origin text,                    -- 'mercadopago'
    mp_payment_id text,                     -- ID retornado pelo Mercado Pago
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);
```

---

## 3. Supabase Edge Functions (Backend Deno)

O projeto já contém as Edge Functions totalmente implementadas na pasta `supabase/functions/`:

1. **`create-mercado-pago-payment`**: Recebe o ID do pedido e o valor total, cria a transação de PIX transparente na API do Mercado Pago e retorna o QR Code em texto (Copia e Cola) e em base64 (imagem).
2. **`check-mercado-pago-payment`**: Consulta ativamente o status de um pagamento na API do Mercado Pago (usado como fallback de segurança).
3. **`mercado-pago-webhook`**: Endpoint público que recebe a notificação instantânea do Mercado Pago e altera o status do pedido para `paid` no banco de dados automaticamente.

> 💡 **Nota sobre testes locais:** Caso as variáveis `MP_ACCESS_TOKEN` não estejam configuradas, a API automaticamente operará em **modo de simulação**, gerando Pix simulados para testes sem interrupções.

---

## 4. O que resta fazer ao receber as credenciais do cliente?

Assim que seu cliente fornecer o **Access Token** de produção do Mercado Pago dele, siga estes passos:

1. **Definir a credencial no Supabase:**
   Rode o comando no terminal do projeto:
   ```bash
   npx supabase secrets set MP_ACCESS_TOKEN="APP_USR-XXXXXX-XXXXXX"
   ```
   *(Ou adicione diretamente na aba **Settings -> API -> Edge Function Secrets** no painel web do Supabase).*

2. **Configurar o Webhook no painel do Mercado Pago:**
   * Acesse o Painel de Desenvolvedores do Mercado Pago do cliente.
   * Vá em **Notificações -> Webhooks**.
   * Insira a URL do seu webhook: `https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/mercado-pago-webhook`.
   * Selecione o evento **"Pagamentos" (payments)**.
