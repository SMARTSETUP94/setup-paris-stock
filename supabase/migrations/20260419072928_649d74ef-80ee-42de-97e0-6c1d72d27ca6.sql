-- ============================================================
-- 1. Colonnes
-- ============================================================
ALTER TABLE public.panneaux ADD COLUMN IF NOT EXISTS cump_ht numeric(12,4);

ALTER TABLE public.mouvements_stock ADD COLUMN IF NOT EXISTS prix_unitaire_ht numeric(12,4);
ALTER TABLE public.mouvements_stock ADD COLUMN IF NOT EXISTS cump_avant numeric(12,4);
ALTER TABLE public.mouvements_stock ADD COLUMN IF NOT EXISTS cump_apres numeric(12,4);
ALTER TABLE public.mouvements_stock ADD COLUMN IF NOT EXISTS valeur_ligne_ht numeric(12,2);

-- ============================================================
-- 2. Trigger CUMP — BEFORE INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_cump_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stock_actuel numeric := 0;
  _cump_actuel numeric;
  _nouveau_cump numeric;
  _qte_abs numeric;
  _correction_cump boolean := false;
BEGIN
  SELECT COALESCE(SUM(quantite), 0) INTO _stock_actuel
  FROM public.mouvements_stock WHERE panneau_id = NEW.panneau_id;

  SELECT cump_ht INTO _cump_actuel FROM public.panneaux WHERE id = NEW.panneau_id;

  _qte_abs := abs(NEW.quantite);

  IF NEW.type = 'entree' THEN
    IF NEW.prix_unitaire_ht IS NULL THEN
      RAISE EXCEPTION 'prix_unitaire_ht requis pour une entrée';
    END IF;
    IF NEW.quantite <= 0 THEN
      RAISE EXCEPTION 'quantité doit être positive pour une entrée';
    END IF;

    IF _stock_actuel <= 0 OR _cump_actuel IS NULL THEN
      _nouveau_cump := NEW.prix_unitaire_ht;
    ELSE
      _nouveau_cump := (_stock_actuel * _cump_actuel + NEW.quantite * NEW.prix_unitaire_ht)
                      / (_stock_actuel + NEW.quantite);
    END IF;

    NEW.cump_avant := _cump_actuel;
    NEW.cump_apres := _nouveau_cump;
    NEW.valeur_ligne_ht := round(NEW.quantite * NEW.prix_unitaire_ht, 2);

  ELSIF NEW.type = 'sortie' THEN
    IF NEW.quantite >= 0 THEN
      RAISE EXCEPTION 'quantité doit être négative pour une sortie';
    END IF;

    NEW.cump_avant := _cump_actuel;
    NEW.cump_apres := _cump_actuel;
    NEW.valeur_ligne_ht := round(_qte_abs * COALESCE(_cump_actuel, 0), 2);

  ELSIF NEW.type = 'chute_reintegration' THEN
    IF NEW.quantite <= 0 THEN
      RAISE EXCEPTION 'quantité doit être positive pour une réintégration de chute';
    END IF;

    -- Réintégration à prix 0 : dilue le CUMP
    IF _stock_actuel <= 0 OR _cump_actuel IS NULL THEN
      _nouveau_cump := 0;
    ELSE
      _nouveau_cump := (_stock_actuel * _cump_actuel) / (_stock_actuel + NEW.quantite);
    END IF;

    NEW.prix_unitaire_ht := 0;
    NEW.cump_avant := _cump_actuel;
    NEW.cump_apres := _nouveau_cump;
    NEW.valeur_ligne_ht := 0;

  ELSIF NEW.type = 'correction' THEN
    IF NEW.commentaire IS NULL OR length(trim(NEW.commentaire)) = 0 THEN
      RAISE EXCEPTION 'commentaire obligatoire pour une correction';
    END IF;

    _correction_cump := position('#correction_cump' in NEW.commentaire) > 0;

    IF _correction_cump AND NEW.prix_unitaire_ht IS NOT NULL THEN
      _nouveau_cump := NEW.prix_unitaire_ht;
      NEW.cump_avant := _cump_actuel;
      NEW.cump_apres := _nouveau_cump;
    ELSE
      NEW.cump_avant := _cump_actuel;
      NEW.cump_apres := _cump_actuel;
    END IF;

    NEW.valeur_ligne_ht := round(_qte_abs * COALESCE(_cump_actuel, 0), 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_cump_before_insert ON public.mouvements_stock;
CREATE TRIGGER trg_calc_cump_before_insert
BEFORE INSERT ON public.mouvements_stock
FOR EACH ROW EXECUTE FUNCTION public.calc_cump_before_insert();

-- ============================================================
-- 3. Trigger CUMP — AFTER INSERT (mise à jour panneau)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_panneau_cump_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cump_apres IS NOT NULL THEN
    UPDATE public.panneaux SET cump_ht = NEW.cump_apres WHERE id = NEW.panneau_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_panneau_cump ON public.mouvements_stock;
CREATE TRIGGER trg_update_panneau_cump
AFTER INSERT ON public.mouvements_stock
FOR EACH ROW EXECUTE FUNCTION public.update_panneau_cump_after_insert();

-- ============================================================
-- 4. Vues
-- ============================================================
DROP VIEW IF EXISTS public.cump_par_panneau CASCADE;
DROP VIEW IF EXISTS public.consommation_par_affaire CASCADE;
DROP VIEW IF EXISTS public.catalogue_visible CASCADE;
DROP VIEW IF EXISTS public.stock_actuel CASCADE;

CREATE VIEW public.stock_actuel AS
SELECT
  p.id AS panneau_id,
  COALESCE(SUM(m.quantite), 0)::numeric AS quantite_actuelle
FROM public.panneaux p
LEFT JOIN public.mouvements_stock m ON m.panneau_id = p.id
GROUP BY p.id;

CREATE VIEW public.catalogue_visible AS
SELECT
  p.id,
  p.matiere_id,
  m.code AS matiere_code,
  m.libelle AS matiere_libelle,
  m.famille,
  m.unite_stock,
  m.seuil_alerte,
  p.largeur_mm,
  p.longueur_mm,
  p.surface_m2,
  p.reference_fournisseur,
  p.prix_achat_ht,
  p.cump_ht,
  p.actif,
  p.auto_masque_si_zero,
  p.created_at,
  COALESCE(s.quantite_actuelle, 0) AS stock_actuel,
  COALESCE(s.quantite_actuelle, 0) * COALESCE(p.cump_ht, 0) AS valeur_stock_ht
FROM public.panneaux p
JOIN public.matieres m ON m.id = p.matiere_id
LEFT JOIN public.stock_actuel s ON s.panneau_id = p.id;

CREATE VIEW public.consommation_par_affaire AS
SELECT
  m.affaire_id,
  p.matiere_id,
  p.id AS panneau_id,
  SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END) AS qte_entree,
  SUM(CASE WHEN m.type = 'sortie' THEN abs(m.quantite) ELSE 0 END) AS qte_sortie,
  SUM(CASE WHEN m.type = 'sortie' THEN m.valeur_ligne_ht ELSE 0 END) AS valeur_consommee_ht,
  SUM(CASE WHEN m.type = 'sortie' THEN abs(m.quantite) * COALESCE(p.surface_m2, 0) ELSE 0 END) AS surface_m2_totale,
  SUM(m.quantite) AS reliquat
FROM public.mouvements_stock m
JOIN public.panneaux p ON p.id = m.panneau_id
WHERE m.affaire_id IS NOT NULL
GROUP BY m.affaire_id, p.matiere_id, p.id;

CREATE VIEW public.cump_par_panneau AS
SELECT
  p.id AS panneau_id,
  p.cump_ht,
  COALESCE(s.quantite_actuelle, 0) AS stock_actuel,
  (
    SELECT json_agg(row_to_json(e) ORDER BY e.created_at DESC)
    FROM (
      SELECT created_at, prix_unitaire_ht, quantite
      FROM public.mouvements_stock
      WHERE panneau_id = p.id AND type = 'entree'
      ORDER BY created_at DESC
      LIMIT 10
    ) e
  ) AS dernieres_entrees
FROM public.panneaux p
LEFT JOIN public.stock_actuel s ON s.panneau_id = p.id;

-- ============================================================
-- 5. RLS — IMMUABILITÉ stricte
-- ============================================================
DROP POLICY IF EXISTS "Admins corrigent mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Admins insèrent mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Admins lisent mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Tiers créent mouvements sur leurs affaires" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Tiers lisent mouvements de leurs affaires" ON public.mouvements_stock;

-- SELECT
CREATE POLICY "Admins lisent mouvements"
ON public.mouvements_stock FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Tiers lisent mouvements de leurs affaires"
ON public.mouvements_stock FOR SELECT
USING (affaire_id IS NOT NULL AND tiers_a_acces_affaire(auth.uid(), affaire_id));

-- INSERT
CREATE POLICY "Admins insèrent mouvements"
ON public.mouvements_stock FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Tiers créent sorties sur leurs affaires"
ON public.mouvements_stock FOR INSERT
WITH CHECK (
  affaire_id IS NOT NULL
  AND type = 'sortie'
  AND tiers_peut_ecrire_mvt(auth.uid(), affaire_id)
  AND effectue_par = auth.uid()
);

-- UPDATE — REFUSÉ pour tous (immuabilité)
CREATE POLICY "Mouvements immuables - aucun update"
ON public.mouvements_stock FOR UPDATE
USING (false)
WITH CHECK (false);

-- DELETE — REFUSÉ pour tous (immuabilité)
CREATE POLICY "Mouvements immuables - aucun delete"
ON public.mouvements_stock FOR DELETE
USING (false);

-- ============================================================
-- 6. Storage bucket pour photos de mouvements
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('mouvements-photos', 'mouvements-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Photos mouvements lisibles publiquement" ON storage.objects;
CREATE POLICY "Photos mouvements lisibles publiquement"
ON storage.objects FOR SELECT
USING (bucket_id = 'mouvements-photos');

DROP POLICY IF EXISTS "Utilisateurs authentifiés uploadent photos mouvements" ON storage.objects;
CREATE POLICY "Utilisateurs authentifiés uploadent photos mouvements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mouvements-photos');