-- 1. Table typologies
CREATE TABLE public.typologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  famille public.famille_matiere NOT NULL,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (famille, nom)
);

ALTER TABLE public.typologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent typologies"
  ON public.typologies
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tiers lisent typologies actives"
  ON public.typologies
  FOR SELECT
  USING (actif = true);

-- 2. Modifications matieres (base vide → NOT NULL direct possible)
ALTER TABLE public.matieres
  ADD COLUMN typologie_id uuid NOT NULL REFERENCES public.typologies(id) ON DELETE RESTRICT,
  ADD COLUMN variante text;

CREATE UNIQUE INDEX matieres_typologie_variante_epaisseur_uniq
  ON public.matieres (typologie_id, COALESCE(variante, ''), epaisseur_mm);

CREATE INDEX matieres_typologie_id_idx ON public.matieres (typologie_id);

-- 3. Trigger : auto-sync matieres.famille depuis typologies.famille
CREATE OR REPLACE FUNCTION public.sync_matiere_famille()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _famille public.famille_matiere;
BEGIN
  SELECT famille INTO _famille FROM public.typologies WHERE id = NEW.typologie_id;
  IF _famille IS NULL THEN
    RAISE EXCEPTION 'Typologie % introuvable', NEW.typologie_id;
  END IF;
  NEW.famille := _famille;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_matiere_famille
  BEFORE INSERT OR UPDATE OF typologie_id ON public.matieres
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_matiere_famille();