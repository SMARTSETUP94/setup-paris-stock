-- ============================================================
-- 1. RATTRAPAGE ADMIN RÉTROACTIF + TRIGGER PROMOTION
-- ============================================================
-- Promeut les profils existants dont l'email est dans admin_emails
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN (SELECT lower(email) FROM public.admin_emails)
  AND role <> 'admin';

-- Trigger : si on whiteliste un email après coup, promeut le profil existant
CREATE OR REPLACE FUNCTION public.promote_existing_profile_on_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'admin'
  WHERE lower(email) = lower(NEW.email)
    AND role <> 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_admin_email ON public.admin_emails;
CREATE TRIGGER trg_promote_admin_email
AFTER INSERT ON public.admin_emails
FOR EACH ROW
EXECUTE FUNCTION public.promote_existing_profile_on_admin_email();

-- ============================================================
-- 2. TABLE clients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  contact_principal text,
  email text,
  telephone text,
  adresse text,
  siret text,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent clients" ON public.clients;
CREATE POLICY "Admins gèrent clients"
ON public.clients FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 3. NUMÉRO AFFAIRE 4 CHIFFRES + 4. CLIENT_ID FK
-- ============================================================

-- 3a. Migration safe des numéros existants : on ne garde que les chiffres puis on pad à 4
UPDATE public.affaires
SET numero = lpad(
  CASE
    WHEN regexp_replace(numero, '\D', '', 'g') = '' THEN '1'
    ELSE regexp_replace(numero, '\D', '', 'g')
  END,
  4, '0'
)
WHERE numero !~ '^\d{4}$';

-- En cas de doublons après normalisation, on suffixe avec le rowid
WITH dups AS (
  SELECT id, numero,
         row_number() OVER (PARTITION BY numero ORDER BY created_at) AS rn
  FROM public.affaires
)
UPDATE public.affaires a
SET numero = lpad(((a.numero::int) + dups.rn - 1)::text, 4, '0')
FROM dups
WHERE a.id = dups.id AND dups.rn > 1;

-- 3b. CHECK constraint format strict
ALTER TABLE public.affaires
  DROP CONSTRAINT IF EXISTS affaires_numero_format_check;
ALTER TABLE public.affaires
  ADD CONSTRAINT affaires_numero_format_check CHECK (numero ~ '^\d{4}$');

-- 4a. Crée les clients manquants à partir des valeurs textes existantes (dédupliqués)
INSERT INTO public.clients (nom)
SELECT DISTINCT trim(client) AS nom
FROM public.affaires
WHERE client IS NOT NULL AND length(trim(client)) > 0
ON CONFLICT (nom) DO NOTHING;

-- 4b. Ajoute la colonne client_id (nullable d'abord pour la migration)
ALTER TABLE public.affaires
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT;

-- 4c. Backfill : associe chaque affaire à son client (matching par trim)
UPDATE public.affaires a
SET client_id = c.id
FROM public.clients c
WHERE a.client_id IS NULL
  AND a.client IS NOT NULL
  AND lower(trim(a.client)) = lower(c.nom);

-- 4d. Pour les affaires sans client renseigné, créer un client "Client non renseigné"
INSERT INTO public.clients (nom) VALUES ('Client non renseigné')
ON CONFLICT (nom) DO NOTHING;

UPDATE public.affaires
SET client_id = (SELECT id FROM public.clients WHERE nom = 'Client non renseigné')
WHERE client_id IS NULL;

-- 4e. Maintenant on peut rendre client_id NOT NULL et supprimer l'ancienne colonne client
ALTER TABLE public.affaires ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.affaires DROP COLUMN IF EXISTS client;

CREATE INDEX IF NOT EXISTS idx_affaires_client_id ON public.affaires(client_id);
