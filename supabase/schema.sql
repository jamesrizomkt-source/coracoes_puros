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
