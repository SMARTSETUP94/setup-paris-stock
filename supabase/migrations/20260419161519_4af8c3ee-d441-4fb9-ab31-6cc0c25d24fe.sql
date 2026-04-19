-- Table de surcharge pour personnaliser label/couleur des familles d'enum
CREATE TABLE public.familles_overrides (
  famille public.famille_matiere PRIMARY KEY,
  label text,
  couleur text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.familles_overrides ENABLE ROW LEVEL SECURITY;

-- Lecture publique authentifiée (pour que tous les rôles voient les libellés/couleurs)
CREATE POLICY "Tous authentifiés lisent overrides familles"
ON public.familles_overrides
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Lecture publique anonyme également (pour SSR / pages publiques éventuelles)
CREATE POLICY "Lecture publique overrides familles"
ON public.familles_overrides
FOR SELECT
TO anon
USING (true);

-- Écriture admin uniquement
CREATE POLICY "Admins gèrent overrides familles"
ON public.familles_overrides
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger updated_at + updated_by
CREATE OR REPLACE FUNCTION public.familles_overrides_set_updated()
RETURNS trigger
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

CREATE TRIGGER trg_familles_overrides_set_updated
BEFORE INSERT OR UPDATE ON public.familles_overrides
FOR EACH ROW
EXECUTE FUNCTION public.familles_overrides_set_updated();