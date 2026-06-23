DROP POLICY IF EXISTS "Allow anon read" ON public.orders;
CREATE POLICY "Allow anon read" ON public.orders FOR SELECT USING (true);
