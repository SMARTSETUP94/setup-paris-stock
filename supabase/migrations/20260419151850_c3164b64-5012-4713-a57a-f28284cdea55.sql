-- =====================================================================
-- Étape 2 : migration data + refonte RLS
-- =====================================================================

-- A) Migrer les comptes existants : tiers -> mobile
UPDATE public.profiles SET role = 'mobile' WHERE role = 'tiers';

-- B) Changer la valeur par défaut de la colonne profiles.role
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'mobile'::app_role;

-- C) Mettre à jour handle_new_user (rôle par défaut = mobile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role := 'mobile';
  _is_whitelisted boolean;
  _has_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email))
    INTO _is_whitelisted;

  IF _is_whitelisted THEN
    _role := 'admin';
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND actif = true)
      INTO _has_admin;
    IF NOT _has_admin THEN
      _role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, nom_complet, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    _role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- D) Mettre à jour ensure_current_profile (rôle par défaut = mobile)
CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _role app_role := 'mobile';
  _is_whitelisted boolean;
  _has_admin boolean;
  _profile public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.* INTO _profile FROM public.profiles p WHERE p.id = _uid;
  IF FOUND THEN
    RETURN _profile;
  END IF;

  SELECT u.email,
         COALESCE(u.raw_user_meta_data->>'nom_complet', u.email)
    INTO _email, _name
  FROM auth.users u
  WHERE u.id = _uid;

  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(_email))
    INTO _is_whitelisted;

  IF _is_whitelisted THEN
    _role := 'admin';
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND actif = true)
      INTO _has_admin;
    IF NOT _has_admin THEN
      _role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, nom_complet, role)
  VALUES (_uid, _email, _name, _role)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$function$;

-- E) Helpers de rôle
CREATE OR REPLACE FUNCTION public.is_magasinier(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.has_role(_user_id, 'magasinier') $$;

CREATE OR REPLACE FUNCTION public.is_mobile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.has_role(_user_id, 'mobile') $$;

-- Combinateur pratique pour le back-office
CREATE OR REPLACE FUNCTION public.is_admin_or_magasinier(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'magasinier') $$;

-- =====================================================================
-- F) Suppression des policies dépendantes de affaire_acces
--    (avant de drop la table et les fonctions)
-- =====================================================================
DROP POLICY IF EXISTS "Tiers voient matières via panneaux autorisés" ON public.matieres;
DROP POLICY IF EXISTS "Tiers voient panneaux de leurs affaires" ON public.panneaux;
DROP POLICY IF EXISTS "Tiers voient leurs affaires autorisées" ON public.affaires;
DROP POLICY IF EXISTS "Tiers lisent mouvements de leurs affaires" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Tiers créent sorties sur leurs affaires" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Admins gèrent accès" ON public.affaire_acces;
DROP POLICY IF EXISTS "Tiers voient leurs propres accès" ON public.affaire_acces;

-- G) Drop la table affaire_acces et les fonctions liées
DROP TABLE IF EXISTS public.affaire_acces CASCADE;
DROP FUNCTION IF EXISTS public.affaires_autorisees_tiers(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tiers_a_acces_affaire(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tiers_peut_ecrire_mvt(uuid, uuid) CASCADE;

-- =====================================================================
-- H) Refonte des RLS sur toutes les tables métier
-- =====================================================================

-- AFFAIRES : admin/magasinier gèrent tout, mobile lit les affaires actives
DROP POLICY IF EXISTS "Admins gèrent affaires" ON public.affaires;
CREATE POLICY "Admin et magasinier gèrent affaires" ON public.affaires
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Mobile lit affaires actives" ON public.affaires
  FOR SELECT TO authenticated
  USING (
    public.is_mobile(auth.uid())
    AND statut IN ('devis'::statut_affaire, 'en_cours'::statut_affaire)
  );

-- TYPOLOGIES : admin/magasinier gèrent, mobile lit les actives
DROP POLICY IF EXISTS "Admins gèrent typologies" ON public.typologies;
DROP POLICY IF EXISTS "Utilisateurs authentifiés lisent typologies actives" ON public.typologies;
CREATE POLICY "Admin et magasinier gèrent typologies" ON public.typologies
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Tous authentifiés lisent typologies actives" ON public.typologies
  FOR SELECT TO authenticated
  USING (actif = true AND auth.uid() IS NOT NULL);

-- MATIERES : admin/magasinier gèrent, mobile lit les actives
DROP POLICY IF EXISTS "Admins gèrent matières" ON public.matieres;
CREATE POLICY "Admin et magasinier gèrent matières" ON public.matieres
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Mobile lit matières actives" ON public.matieres
  FOR SELECT TO authenticated
  USING (public.is_mobile(auth.uid()) AND actif = true);

-- PANNEAUX : admin/magasinier gèrent, mobile lit les actifs (besoin pour scanner)
DROP POLICY IF EXISTS "Admins gèrent panneaux" ON public.panneaux;
CREATE POLICY "Admin et magasinier gèrent panneaux" ON public.panneaux
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Mobile lit panneaux actifs" ON public.panneaux
  FOR SELECT TO authenticated
  USING (public.is_mobile(auth.uid()) AND actif = true);

-- FOURNISSEURS : admin/magasinier gèrent
DROP POLICY IF EXISTS "Admins gèrent fournisseurs" ON public.fournisseurs;
CREATE POLICY "Admin et magasinier gèrent fournisseurs" ON public.fournisseurs
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));

-- BONS DE COMMANDE : admin/magasinier gèrent
DROP POLICY IF EXISTS "Admins gèrent BDC" ON public.bons_de_commande;
CREATE POLICY "Admin et magasinier gèrent BDC" ON public.bons_de_commande
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));

-- BDC LIGNES : admin/magasinier gèrent
DROP POLICY IF EXISTS "Admins gèrent lignes BDC" ON public.bdc_lignes;
CREATE POLICY "Admin et magasinier gèrent lignes BDC" ON public.bdc_lignes
  FOR ALL TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()))
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));

-- MOUVEMENTS_STOCK
DROP POLICY IF EXISTS "Admins lisent mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Admins insèrent mouvements" ON public.mouvements_stock;

-- Lecture : admin et magasinier voient tout, mobile voit ses propres mouvements
CREATE POLICY "Admin et magasinier lisent tous mouvements" ON public.mouvements_stock
  FOR SELECT TO authenticated
  USING (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Mobile lit ses propres mouvements" ON public.mouvements_stock
  FOR SELECT TO authenticated
  USING (public.is_mobile(auth.uid()) AND effectue_par = auth.uid());

-- Insertion
CREATE POLICY "Admin et magasinier insèrent mouvements" ON public.mouvements_stock
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_magasinier(auth.uid()));
CREATE POLICY "Mobile crée sorties sur affaires actives" ON public.mouvements_stock
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_mobile(auth.uid())
    AND type = 'sortie'::type_mouvement
    AND effectue_par = auth.uid()
    AND affaire_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.affaires a
      WHERE a.id = affaire_id
        AND a.statut IN ('devis'::statut_affaire, 'en_cours'::statut_affaire)
    )
  );

-- =====================================================================
-- I) PROFILES : admin garde tout, magasinier lit (pour assigner responsables)
-- =====================================================================
CREATE POLICY "Magasinier lit profils" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_magasinier(auth.uid()));

-- admin_emails et app_settings restent strictement admin (déjà OK)
