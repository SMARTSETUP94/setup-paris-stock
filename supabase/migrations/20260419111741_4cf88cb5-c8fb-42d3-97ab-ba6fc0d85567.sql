-- ============================================
-- 1. TYPOLOGIES : exiger authentification
-- ============================================
DROP POLICY IF EXISTS "Tiers lisent typologies actives" ON public.typologies;

CREATE POLICY "Utilisateurs authentifiés lisent typologies actives"
ON public.typologies
FOR SELECT
TO authenticated
USING (actif = true AND auth.uid() IS NOT NULL);

-- ============================================
-- 2. STORAGE : mouvements-photos
-- ============================================
-- Nettoyer toutes les policies existantes sur ce bucket
DROP POLICY IF EXISTS "Authenticated can view mouvements photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload mouvements photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update mouvements photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete mouvements photos" ON storage.objects;
DROP POLICY IF EXISTS "Mouvements photos visibles authentifiés" ON storage.objects;
DROP POLICY IF EXISTS "Upload mouvements photos authentifiés" ON storage.objects;

-- SELECT : admin OU tiers ayant accès à au moins une affaire référencée par un mouvement avec cette photo
CREATE POLICY "Mouvements photos - lecture admin ou tiers autorisé"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'mouvements-photos'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mouvements_stock m
      WHERE m.photo_url LIKE '%' || storage.objects.name || '%'
        AND m.affaire_id IS NOT NULL
        AND public.tiers_a_acces_affaire(auth.uid(), m.affaire_id)
    )
  )
);

-- INSERT : admin OU tiers pouvant écrire un mouvement
-- Note: à l'upload le mouvement n'existe pas encore, on autorise tout authentifié pouvant créer des mouvements
CREATE POLICY "Mouvements photos - upload admin ou tiers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mouvements-photos'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.affaire_acces aa
      WHERE aa.tiers_profile_id = auth.uid()
        AND aa.expire_le > now()
        AND aa.permissions IN ('sortie','entree_sortie')
    )
  )
);

-- UPDATE / DELETE : admin uniquement
CREATE POLICY "Mouvements photos - update admin uniquement"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'mouvements-photos' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'mouvements-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Mouvements photos - delete admin uniquement"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'mouvements-photos' AND public.is_admin(auth.uid()));

-- ============================================
-- 3. STORAGE : matieres-photos (retirer public)
-- ============================================
-- Forcer le bucket en privé
UPDATE storage.buckets SET public = false WHERE id = 'matieres-photos';

-- Nettoyer policies existantes
DROP POLICY IF EXISTS "Public can view matieres photos" ON storage.objects;
DROP POLICY IF EXISTS "Matieres photos publiques" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload matieres photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage matieres photos" ON storage.objects;

-- SELECT : tout utilisateur authentifié (les matières sont visibles selon RLS de la table)
CREATE POLICY "Matieres photos - lecture authentifiés"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'matieres-photos');

-- INSERT/UPDATE/DELETE : admin uniquement
CREATE POLICY "Matieres photos - upload admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Matieres photos - update admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Matieres photos - delete admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));