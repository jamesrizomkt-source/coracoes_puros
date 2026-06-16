-- Habilita a extensão para geração de UUIDs, se não estiver habilitada
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. TABELA DE LEADS / CONTATOS
-- ==========================================
create table if not exists public.leads (
    id uuid primary key default gen_random_uuid(),
    name text,
    email text not null unique,
    phone text,
    status text not null default 'pending', -- 'pending', 'contacted', 'subscribed'
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
alter table public.leads enable row level security;

-- Remove políticas anteriores para evitar conflitos ao reexecutar
drop policy if exists "Allow anonymous inserts" on public.leads;
drop policy if exists "Allow admin read" on public.leads;
drop policy if exists "Allow admin update" on public.leads;

-- Política: Qualquer pessoa (anônima) pode cadastrar um lead
create policy "Allow anonymous inserts" on public.leads
    for insert with check (true);

-- Política: Apenas usuários autenticados (administradores) podem visualizar os leads
create policy "Allow admin read" on public.leads
    for select using (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem atualizar leads (ex: mudar status)
create policy "Allow admin update" on public.leads
    for update using (auth.role() = 'authenticated');


-- ==========================================
-- 2. TABELA DE RESPOSTAS DO QUIZ
-- ==========================================
create table if not exists public.quiz_responses (
    id uuid primary key default gen_random_uuid(),
    score integer not null,
    total_questions integer not null default 6,
    answers jsonb, -- Detalhes das respostas escolhidas pelo usuário
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
alter table public.quiz_responses enable row level security;

-- Remove políticas anteriores para evitar conflitos ao reexecutar
drop policy if exists "Allow anonymous inserts" on public.quiz_responses;
drop policy if exists "Allow admin read" on public.quiz_responses;

-- Política: Qualquer pessoa (anônima) pode registrar respostas do quiz
create policy "Allow anonymous inserts" on public.quiz_responses
    for insert with check (true);

-- Política: Apenas usuários autenticados podem ver as estatísticas/respostas do quiz
create policy "Allow admin read" on public.quiz_responses
    for select using (auth.role() = 'authenticated');


-- ==========================================
-- 3. TABELA DE MENSAGENS / CONTATOS (SUPORTE)
-- ==========================================
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    message text not null,
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
alter table public.messages enable row level security;

-- Remove políticas anteriores para evitar conflitos ao reexecutar
drop policy if exists "Allow anonymous inserts" on public.messages;
drop policy if exists "Allow admin read" on public.messages;

-- Política: Qualquer pessoa (anônima) pode enviar uma mensagem
create policy "Allow anonymous inserts" on public.messages
    for insert with check (true);

-- Política: Apenas usuários autenticados podem visualizar as mensagens recebidas
create policy "Allow admin read" on public.messages
    for select using (auth.role() = 'authenticated');


-- ==========================================
-- 4. TABELA DE PEDIDOS DE LIVROS
-- ==========================================
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    phone text,
    status text not null default 'pending', -- 'pending', 'paid', 'shipped', 'cancelled'
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
alter table public.orders enable row level security;

-- Remove políticas anteriores para evitar conflitos ao reexecutar
drop policy if exists "Allow anonymous inserts" on public.orders;
drop policy if exists "Allow admin read" on public.orders;
drop policy if exists "Allow admin update" on public.orders;
drop policy if exists "Allow admin delete" on public.orders;

-- Políticas de acesso
create policy "Allow anonymous inserts" on public.orders
    for insert with check (true);

create policy "Allow admin read" on public.orders
    for select using (auth.role() = 'authenticated');

create policy "Allow admin update" on public.orders
    for update using (auth.role() = 'authenticated');

create policy "Allow admin delete" on public.orders
    for delete using (auth.role() = 'authenticated');

-- ==========================================
-- 5. CONFIGURAÇÃO DE WEBHOOKS & ENVIOS DE E-MAILS (BREVO + SUPABASE EDGE FUNCTIONS)
-- ==========================================

-- Habilitar a extensão pg_net para fazer requisições HTTP a partir do banco de dados
create extension if not exists pg_net with schema extensions;

-- Criar a função plpgsql para enviar a requisição HTTP POST para a nossa Edge Function
create or replace function public.trigger_send_emails_webhook()
returns trigger as $$
declare
  payload jsonb;
begin
  -- Construir o JSON de payload com os dados novos e antigos
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', case when TG_OP = 'UPDATE' then row_to_json(OLD) else null end
  );

  -- Realizar a chamada HTTP assíncrona usando net.http_post
  perform net.http_post(
    url := 'https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/send-emails',
    headers := '{"Content-Type": "application/json", "x-supabase-webhook-secret": "CoracoesPurosSecretWebhook2026Token!!"}'::jsonb,
    body := payload
  );

  return NEW;
end;
$$ language plpgsql security definer;

-- Criar a trigger para a tabela public.orders
drop trigger if exists tr_orders_send_emails on public.orders;
create trigger tr_orders_send_emails
after insert or update on public.orders
for each row
execute function public.trigger_send_emails_webhook();

-- Criar a trigger para a tabela public.messages
drop trigger if exists tr_messages_send_emails on public.messages;
create trigger tr_messages_send_emails
after insert on public.messages
for each row
execute function public.trigger_send_emails_webhook();

