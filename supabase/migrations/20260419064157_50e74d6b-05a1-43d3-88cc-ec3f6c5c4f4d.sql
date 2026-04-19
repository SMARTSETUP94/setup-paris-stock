
-- 1. Nouvelle nomenclature des familles
ALTER TYPE public.famille_matiere RENAME TO famille_matiere_old;

CREATE TYPE public.famille_matiere AS ENUM (
  'bois', 'pvc', 'carton', 'dibond_tole', 'pmma', 'mousse', 'autre'
);

ALTER TABLE public.matieres
  ALTER COLUMN famille DROP DEFAULT;

ALTER TABLE public.matieres
  ALTER COLUMN famille TYPE public.famille_matiere
  USING (
    CASE famille::text
      WHEN 'bois' THEN 'bois'
      WHEN 'pvc' THEN 'pvc'
      WHEN 'carton' THEN 'carton'
      WHEN 'dibond' THEN 'dibond_tole'
      WHEN 'plexi' THEN 'pmma'
      WHEN 'mousse' THEN 'mousse'
      ELSE 'autre'
    END
  )::public.famille_matiere;

ALTER TABLE public.matieres
  ALTER COLUMN famille SET DEFAULT 'autre'::public.famille_matiere;

DROP TYPE public.famille_matiere_old;

-- 2. Élargir l'enum unite_stock
ALTER TYPE public.unite_stock ADD VALUE IF NOT EXISTS 'kg';
ALTER TYPE public.unite_stock ADD VALUE IF NOT EXISTS 'm3';
ALTER TYPE public.unite_stock ADD VALUE IF NOT EXISTS 'boite';
ALTER TYPE public.unite_stock ADD VALUE IF NOT EXISTS 'cartouche';
ALTER TYPE public.unite_stock ADD VALUE IF NOT EXISTS 'autre';

-- 3. Colonnes panneaux
ALTER TABLE public.panneaux
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
ALTER TABLE public.panneaux
  ADD COLUMN IF NOT EXISTS auto_masque_si_zero boolean NOT NULL DEFAULT true;
