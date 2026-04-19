-- 1. Table app_settings (singleton)
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  nom_application TEXT NOT NULL DEFAULT 'Setup Stock',
  nom_organisation TEXT NOT NULL DEFAULT 'Setup Paris',
  logo_url TEXT,
  couleur_accent TEXT NOT NULL DEFAULT '#FFB700',
  pied_page_pdf TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Contrainte qui garantit qu'il n'y a qu'une seule ligne
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_singleton_check CHECK (singleton = true);

-- Insère la ligne par défaut
INSERT INTO public.app_settings (singleton) VALUES (true);

-- RLS : tout le monde peut lire (anon + authenticated), admins modifient
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde lit branding"
ON public.app_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins modifient branding"
ON public.app_settings
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins insèrent branding"
ON public.app_settings
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger updated_at + updated_by
CREATE OR REPLACE FUNCTION public.app_settings_set_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.app_settings_set_updated();

-- 2. Bucket de stockage 'branding' (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
CREATE POLICY "Branding accessible publiquement"
ON storage.objects
FOR SELECT
USING (bucket_id = 'branding');

-- Upload / update / delete : admins uniquement
CREATE POLICY "Admins uploadent branding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'branding' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins modifient branding storage"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'branding' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins suppriment branding"
ON storage.objects
FOR DELETE
USING (bucket_id = 'branding' AND public.is_admin(auth.uid()));