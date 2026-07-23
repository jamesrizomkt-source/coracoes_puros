-- ==============================================================
-- TELEGRAM NOTIFICATIONS TRIGGERS & PLPGSQL FUNCTION
-- ==============================================================

-- 1. Criar a função plpgsql para enviar a requisição HTTP POST para o telegram-webhook usando pg_net
create or replace function public.trigger_telegram_webhook()
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
    url := 'https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/telegram-webhook',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );

  return NEW;
end;
$$ language plpgsql security definer;


-- 2. Atualizar o trigger de pedidos (orders)
DROP TRIGGER IF EXISTS "telegram_order_notification" ON "public"."orders";
CREATE TRIGGER "telegram_order_notification"
AFTER INSERT OR UPDATE ON "public"."orders"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_telegram_webhook();


-- 3. Criar trigger para novas respostas de Quiz (quiz_responses)
DROP TRIGGER IF EXISTS "telegram_quiz_notification" ON "public"."quiz_responses";
CREATE TRIGGER "telegram_quiz_notification"
AFTER INSERT ON "public"."quiz_responses"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_telegram_webhook();


-- 4. Criar trigger para novas mensagens de contato (messages)
DROP TRIGGER IF EXISTS "telegram_message_notification" ON "public"."messages";
CREATE TRIGGER "telegram_message_notification"
AFTER INSERT ON "public"."messages"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_telegram_webhook();
