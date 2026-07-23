-- ==========================================
-- SEGURANÇA E PRIVACIDADE - HARDENING DO BANCO DE DADOS
-- ==========================================

-- 1. SEGURANÇA DA TABELA DE CONFIGURAÇÕES (settings)
-- Garante que o RLS está ativado e que acessos anônimos sejam bloqueados.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Limpa políticas anteriores para evitar conflitos
DROP POLICY IF EXISTS "Allow admin read" ON public.settings;
DROP POLICY IF EXISTS "Allow admin write" ON public.settings;
DROP POLICY IF EXISTS "Allow admin update" ON public.settings;
DROP POLICY IF EXISTS "Allow anon read" ON public.settings;

-- Cria política permitindo apenas usuários autenticados (administradores logados no painel) ler as chaves
CREATE POLICY "Allow admin read" ON public.settings
    FOR SELECT TO authenticated USING (true);

-- Cria política permitindo apenas administradores fazerem inserções, atualizações ou exclusões
CREATE POLICY "Allow admin write" ON public.settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. PRIVACIDADE DA TABELA DE PEDIDOS (orders)
-- Impede que usuários anônimos consigam ler dados sensíveis dos clientes (E-mail, CPF, Endereço, etc.).
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Garante que usuários anônimos possam inserir novos pedidos (necessário no checkout)
DROP POLICY IF EXISTS "Allow anon insert" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.orders;
CREATE POLICY "Allow anon insert" ON public.orders 
    FOR INSERT WITH CHECK (true);

-- Permite que usuários anônimos localizem o pedido para ler/atualizar o status
DROP POLICY IF EXISTS "Allow anon read" ON public.orders;
CREATE POLICY "Allow anon read" ON public.orders 
    FOR SELECT TO anon USING (true);

-- 🔒 RESTRIÇÃO DE COLUNAS (LGPD):
-- Remove a permissão de SELECT total sobre as colunas da tabela de orders para o perfil anon (anônimo)
REVOKE SELECT ON public.orders FROM anon;

-- Concede SELECT apenas às colunas id e status para o perfil anon (suficiente para consultar o checkout)
GRANT SELECT (id, status) ON public.orders TO anon;

-- Concede UPDATE apenas à coluna status para o perfil anon (suficiente para cancelar o pedido no checkout)
REVOKE UPDATE ON public.orders FROM anon;
GRANT UPDATE (status) ON public.orders TO anon;


-- 3. PERMISSÕES COMPLETAS PARA ADMINISTRADORES AUTENTICADOS (orders)
DROP POLICY IF EXISTS "Allow admin read" ON public.orders;
DROP POLICY IF EXISTS "Allow admin write" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update" ON public.orders;
DROP POLICY IF EXISTS "Allow admin delete" ON public.orders;

CREATE POLICY "Allow admin read" ON public.orders 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write" ON public.orders 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
