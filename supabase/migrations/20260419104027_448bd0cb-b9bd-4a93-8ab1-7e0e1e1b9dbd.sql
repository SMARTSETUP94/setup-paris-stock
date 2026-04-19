-- Drop dependent views
DROP VIEW IF EXISTS public.catalogue_visible CASCADE;

-- Move epaisseur_mm from matieres to panneaux
ALTER TABLE public.matieres DROP COLUMN IF EXISTS epaisseur_mm;

ALTER TABLE public.panneaux ADD COLUMN IF NOT EXISTS epaisseur_mm integer NOT NULL DEFAULT 0;
ALTER TABLE public.panneaux ALTER COLUMN epaisseur_mm DROP DEFAULT;

-- New uniqueness constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matieres_typologie_variante_uniq'
  ) THEN
    ALTER TABLE public.matieres
      ADD CONSTRAINT matieres_typologie_variante_uniq UNIQUE (typologie_id, variante);
  END IF;
END $$;

-- Drop any prior unique on matieres including epaisseur if existed (defensive)
DO $$
DECLARE _c text;
BEGIN
  FOR _c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.matieres'::regclass
      AND contype = 'u'
      AND conname LIKE '%epaisseur%'
  LOOP
    EXECUTE format('ALTER TABLE public.matieres DROP CONSTRAINT %I', _c);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'panneaux_matiere_format_epaisseur_uniq'
  ) THEN
    ALTER TABLE public.panneaux
      ADD CONSTRAINT panneaux_matiere_format_epaisseur_uniq UNIQUE (matiere_id, longueur_mm, largeur_mm, epaisseur_mm);
  END IF;
END $$;

-- Recreate catalogue_visible view, exposing epaisseur_mm from panneaux
CREATE OR REPLACE VIEW public.catalogue_visible AS
SELECT
  p.id,
  p.matiere_id,
  m.code        AS matiere_code,
  m.libelle     AS matiere_libelle,
  m.famille,
  m.unite_stock,
  m.seuil_alerte,
  p.largeur_mm,
  p.longueur_mm,
  p.epaisseur_mm,
  p.surface_m2,
  p.reference_fournisseur,
  p.prix_achat_ht,
  p.cump_ht,
  p.actif,
  p.auto_masque_si_zero,
  p.created_at,
  COALESCE(s.quantite_actuelle, 0::numeric) AS stock_actuel,
  COALESCE(s.quantite_actuelle, 0::numeric) * COALESCE(p.cump_ht, 0::numeric) AS valeur_stock_ht
FROM public.panneaux p
JOIN public.matieres m ON m.id = p.matiere_id
LEFT JOIN public.stock_actuel s ON s.panneau_id = p.id;