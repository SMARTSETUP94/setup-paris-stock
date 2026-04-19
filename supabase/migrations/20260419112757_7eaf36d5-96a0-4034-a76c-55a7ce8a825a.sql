-- Activer Realtime sur mouvements_stock
ALTER TABLE public.mouvements_stock REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mouvements_stock;