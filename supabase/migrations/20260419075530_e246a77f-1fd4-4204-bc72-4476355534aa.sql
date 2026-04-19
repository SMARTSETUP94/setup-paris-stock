-- ===== 1. ROLLBACK : convertir client_id (FK) en client (texte) =====
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS client text;

-- Récupérer le nom du client depuis la table clients avant suppression
UPDATE public.affaires a
SET client = c.nom
FROM public.clients c
WHERE a.client_id = c.id AND (a.client IS NULL OR a.client = '');

-- Pour les affaires sans match (ne devrait pas arriver mais safe), mettre placeholder
UPDATE public.affaires SET client = 'Client inconnu' WHERE client IS NULL OR client = '';

-- Drop la FK + colonne client_id
ALTER TABLE public.affaires DROP CONSTRAINT IF EXISTS affaires_client_id_fkey;
ALTER TABLE public.affaires DROP COLUMN IF EXISTS client_id;

-- Drop la table clients
DROP TABLE IF EXISTS public.clients CASCADE;

-- Rendre client NOT NULL maintenant qu'il est rempli
ALTER TABLE public.affaires ALTER COLUMN client SET NOT NULL;

-- ===== 2. Supprimer la contrainte CHECK sur numero (format libre) =====
ALTER TABLE public.affaires DROP CONSTRAINT IF EXISTS affaires_numero_format_check;
ALTER TABLE public.affaires DROP CONSTRAINT IF EXISTS affaires_numero_check;

-- ===== 3. Nouvelles colonnes affaires =====
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS code_chantier text;
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS charge_affaires_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS charge_affaires_libre text;
ALTER TABLE public.affaires ADD COLUMN IF NOT EXISTS code_interne text;

-- Initialiser code_chantier pour les affaires existantes (= numero + "_" + nom tronqué)
UPDATE public.affaires
SET code_chantier = COALESCE(numero, '') || CASE WHEN numero IS NOT NULL AND nom IS NOT NULL THEN '_' ELSE '' END || COALESCE(left(nom, 60), '')
WHERE code_chantier IS NULL OR code_chantier = '';

-- Pour les affaires qui auraient code_chantier vide, mettre un fallback
UPDATE public.affaires SET code_chantier = 'AFFAIRE_' || substring(id::text, 1, 8) WHERE code_chantier IS NULL OR trim(code_chantier) = '';

-- Rendre code_chantier NOT NULL + UNIQUE
ALTER TABLE public.affaires ALTER COLUMN code_chantier SET NOT NULL;

-- Drop ancien unique sur numero s'il existe, ajouter unique sur code_chantier
ALTER TABLE public.affaires DROP CONSTRAINT IF EXISTS affaires_numero_key;
ALTER TABLE public.affaires DROP CONSTRAINT IF EXISTS affaires_code_chantier_key;
ALTER TABLE public.affaires ADD CONSTRAINT affaires_code_chantier_key UNIQUE (code_chantier);

-- numero devient nullable et libre
ALTER TABLE public.affaires ALTER COLUMN numero DROP NOT NULL;

-- ===== 4. Trigger : auto-extraction du numero depuis code_chantier =====
CREATE OR REPLACE FUNCTION public.extract_numero_from_code_chantier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _match text;
BEGIN
  -- Extrait les 3 à 5 premiers chiffres en tête de code_chantier
  _match := substring(NEW.code_chantier from '^(\d{3,5})');
  IF _match IS NOT NULL THEN
    NEW.numero := _match;
  ELSE
    NEW.numero := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extract_numero ON public.affaires;
CREATE TRIGGER trg_extract_numero
BEFORE INSERT OR UPDATE OF code_chantier ON public.affaires
FOR EACH ROW
EXECUTE FUNCTION public.extract_numero_from_code_chantier();

-- Re-extraction pour les lignes existantes
UPDATE public.affaires SET code_chantier = code_chantier;

-- Index pour le tri/recherche par numero
CREATE INDEX IF NOT EXISTS idx_affaires_numero ON public.affaires(numero);
CREATE INDEX IF NOT EXISTS idx_affaires_charge_affaires_id ON public.affaires(charge_affaires_id);