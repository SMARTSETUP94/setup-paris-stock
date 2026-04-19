
-- Default unite_stock = m2
ALTER TABLE public.matieres
  ALTER COLUMN unite_stock SET DEFAULT 'm2'::public.unite_stock;

-- Vue catalogue_visible
DROP VIEW IF EXISTS public.catalogue_visible;
CREATE VIEW public.catalogue_visible
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.matiere_id,
  p.longueur_mm,
  p.largeur_mm,
  p.surface_m2,
  p.prix_achat_ht,
  p.reference_fournisseur,
  p.actif,
  p.auto_masque_si_zero,
  p.created_at,
  m.code AS matiere_code,
  m.libelle AS matiere_libelle,
  m.famille,
  m.unite_stock,
  m.seuil_alerte,
  COALESCE(s.quantite_actuelle, 0) AS stock_actuel
FROM public.panneaux p
JOIN public.matieres m ON m.id = p.matiere_id
LEFT JOIN public.stock_actuel s ON s.panneau_id = p.id
WHERE p.actif = true
  AND m.actif = true
  AND (COALESCE(s.quantite_actuelle, 0) > 0 OR p.auto_masque_si_zero = false);

-- Storage bucket photos matières
INSERT INTO storage.buckets (id, name, public)
VALUES ('matieres-photos', 'matieres-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Photos matières lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'matieres-photos');

CREATE POLICY "Admins uploadent photos matières"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins modifient photos matières"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins suppriment photos matières"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'matieres-photos' AND public.is_admin(auth.uid()));
