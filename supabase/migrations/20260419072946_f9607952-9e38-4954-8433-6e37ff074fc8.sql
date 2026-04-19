-- Forcer security_invoker sur les vues pour respecter les RLS de l'appelant
ALTER VIEW public.stock_actuel SET (security_invoker = on);
ALTER VIEW public.catalogue_visible SET (security_invoker = on);
ALTER VIEW public.consommation_par_affaire SET (security_invoker = on);
ALTER VIEW public.cump_par_panneau SET (security_invoker = on);

-- Restreindre l'accès aux objets du bucket mouvements-photos :
-- on autorise la lecture par URL signée/connue mais on n'expose pas le listing.
DROP POLICY IF EXISTS "Photos mouvements lisibles publiquement" ON storage.objects;

CREATE POLICY "Photos mouvements lisibles authentifié"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mouvements-photos');

-- Idem pour matieres-photos (bucket existant) — sécurisation
DROP POLICY IF EXISTS "Photos matieres lisibles publiquement" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

CREATE POLICY "Photos matieres lisibles authentifié"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'matieres-photos');