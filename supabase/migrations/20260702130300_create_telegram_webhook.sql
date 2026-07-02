CREATE TRIGGER "telegram_order_notification"
AFTER INSERT ON "public"."orders"
FOR EACH ROW
EXECUTE FUNCTION "supabase_functions"."http_request"(
  'https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/telegram-webhook',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '1000'
);
