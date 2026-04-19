
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'tiers');
CREATE TYPE public.famille_matiere AS ENUM ('bois','metal','mousse','carton','dibond','pvc','forex','plexi','autre');
CREATE TYPE public.unite_stock AS ENUM ('panneau','m2','ml','piece');
CREATE TYPE public.statut_affaire AS ENUM ('devis','en_cours','termine','archive');
CREATE TYPE public.permission_acces AS ENUM ('lecture','sortie','entree_sortie');
CREATE TYPE public.statut_bdc AS ENUM ('en_attente_ocr','ocr_termine','valide','recu','annule');
CREATE TYPE public.type_mouvement AS ENUM ('entree','sortie','correction','chute_reintegration');

-- ============= TABLES =============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nom_complet text,
  role app_role NOT NULL DEFAULT 'tiers',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  email text,
  telephone text,
  adresse text,
  siret text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  famille famille_matiere NOT NULL DEFAULT 'autre',
  epaisseur_mm numeric NOT NULL,
  densite_kg_m3 numeric,
  unite_stock unite_stock NOT NULL DEFAULT 'panneau',
  seuil_alerte numeric NOT NULL DEFAULT 0,
  photo_url text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.panneaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE RESTRICT,
  longueur_mm integer NOT NULL,
  largeur_mm integer NOT NULL,
  reference_fournisseur text,
  prix_achat_ht numeric,
  surface_m2 numeric GENERATED ALWAYS AS ((longueur_mm::numeric * largeur_mm::numeric) / 1000000) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.affaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  nom text NOT NULL,
  client text,
  date_debut date,
  date_fin_prevue date,
  statut statut_affaire NOT NULL DEFAULT 'devis',
  responsable_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget_panneaux_ht numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.affaire_acces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id uuid NOT NULL REFERENCES public.affaires(id) ON DELETE CASCADE,
  tiers_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_invite text NOT NULL,
  token text NOT NULL UNIQUE,
  expire_le timestamptz NOT NULL,
  permissions permission_acces NOT NULL DEFAULT 'lecture',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bons_de_commande (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur_id uuid NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
  numero_bdc text,
  date_bdc date,
  affaire_id uuid REFERENCES public.affaires(id) ON DELETE SET NULL,
  fichier_pdf_url text,
  statut statut_bdc NOT NULL DEFAULT 'en_attente_ocr',
  montant_ht_total numeric,
  extraction_brute_json jsonb,
  cree_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);

CREATE TABLE public.bdc_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bdc_id uuid NOT NULL REFERENCES public.bons_de_commande(id) ON DELETE CASCADE,
  panneau_id uuid REFERENCES public.panneaux(id) ON DELETE SET NULL,
  matiere_libelle_brut text,
  dimensions_brut text,
  quantite numeric NOT NULL DEFAULT 0,
  prix_unitaire_ht numeric NOT NULL DEFAULT 0,
  ligne_validee boolean NOT NULL DEFAULT false
);

CREATE TABLE public.mouvements_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type type_mouvement NOT NULL,
  panneau_id uuid NOT NULL REFERENCES public.panneaux(id) ON DELETE RESTRICT,
  quantite numeric NOT NULL,
  affaire_id uuid REFERENCES public.affaires(id) ON DELETE SET NULL,
  bdc_id uuid REFERENCES public.bons_de_commande(id) ON DELETE SET NULL,
  commentaire text,
  photo_url text,
  effectue_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============= ENABLE RLS =============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panneaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affaire_acces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_de_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bdc_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;

-- ============= SECURITY DEFINER FUNCTIONS =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role AND actif = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin') $$;

CREATE OR REPLACE FUNCTION public.affaires_autorisees_tiers(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT affaire_id FROM public.affaire_acces
  WHERE tiers_profile_id = _user_id AND expire_le > now();
$$;

CREATE OR REPLACE FUNCTION public.tiers_a_acces_affaire(_user_id uuid, _affaire_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affaire_acces
    WHERE tiers_profile_id = _user_id AND affaire_id = _affaire_id AND expire_le > now()
  )
$$;

CREATE OR REPLACE FUNCTION public.tiers_peut_ecrire_mvt(_user_id uuid, _affaire_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affaire_acces
    WHERE tiers_profile_id = _user_id AND affaire_id = _affaire_id
      AND expire_le > now() AND permissions IN ('sortie','entree_sortie')
  )
$$;

-- ============= AUTO-CREATE PROFILE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom_complet, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    'tiers'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= POLICIES : PROFILES =============
CREATE POLICY "Admins voient tous les profils" ON public.profiles
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Utilisateur voit son propre profil" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins modifient les profils" ON public.profiles
FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insèrent profils" ON public.profiles
FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ============= POLICIES : FOURNISSEURS =============
CREATE POLICY "Admins gèrent fournisseurs" ON public.fournisseurs
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= POLICIES : MATIERES =============
CREATE POLICY "Admins gèrent matières" ON public.matieres
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tiers voient matières via panneaux autorisés" ON public.matieres
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.panneaux p
    JOIN public.mouvements_stock m ON m.panneau_id = p.id
    WHERE p.matiere_id = matieres.id
      AND m.affaire_id IN (SELECT public.affaires_autorisees_tiers(auth.uid()))
  )
);

-- ============= POLICIES : PANNEAUX =============
CREATE POLICY "Admins gèrent panneaux" ON public.panneaux
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tiers voient panneaux de leurs affaires" ON public.panneaux
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.mouvements_stock m
    WHERE m.panneau_id = panneaux.id
      AND m.affaire_id IN (SELECT public.affaires_autorisees_tiers(auth.uid()))
  )
);

-- ============= POLICIES : AFFAIRES =============
CREATE POLICY "Admins gèrent affaires" ON public.affaires
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tiers voient leurs affaires autorisées" ON public.affaires
FOR SELECT USING (public.tiers_a_acces_affaire(auth.uid(), id));

-- ============= POLICIES : AFFAIRE_ACCES =============
CREATE POLICY "Admins gèrent accès" ON public.affaire_acces
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Tiers voient leurs propres accès" ON public.affaire_acces
FOR SELECT USING (tiers_profile_id = auth.uid());

-- ============= POLICIES : BONS DE COMMANDE =============
CREATE POLICY "Admins gèrent BDC" ON public.bons_de_commande
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins gèrent lignes BDC" ON public.bdc_lignes
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= POLICIES : MOUVEMENTS STOCK (immuables) =============
CREATE POLICY "Admins lisent mouvements" ON public.mouvements_stock
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insèrent mouvements" ON public.mouvements_stock
FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins corrigent mouvements" ON public.mouvements_stock
FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Tiers lisent mouvements de leurs affaires" ON public.mouvements_stock
FOR SELECT USING (
  affaire_id IS NOT NULL AND public.tiers_a_acces_affaire(auth.uid(), affaire_id)
);

CREATE POLICY "Tiers créent mouvements sur leurs affaires" ON public.mouvements_stock
FOR INSERT WITH CHECK (
  affaire_id IS NOT NULL
  AND public.tiers_peut_ecrire_mvt(auth.uid(), affaire_id)
  AND effectue_par = auth.uid()
);

-- ============= VUES =============
CREATE OR REPLACE VIEW public.stock_actuel AS
SELECT panneau_id, COALESCE(SUM(quantite), 0) AS quantite_actuelle
FROM public.mouvements_stock
GROUP BY panneau_id;

CREATE OR REPLACE VIEW public.consommation_par_affaire AS
SELECT
  m.affaire_id,
  p.matiere_id,
  SUM(CASE WHEN m.quantite < 0 THEN -m.quantite ELSE 0 END) AS quantite_sortie,
  SUM(CASE WHEN m.quantite < 0 THEN -m.quantite * p.surface_m2 ELSE 0 END) AS surface_m2_totale,
  SUM(CASE WHEN m.quantite < 0 AND p.prix_achat_ht IS NOT NULL
      THEN -m.quantite * p.prix_achat_ht ELSE 0 END) AS valeur_estimee_ht
FROM public.mouvements_stock m
JOIN public.panneaux p ON p.id = m.panneau_id
WHERE m.affaire_id IS NOT NULL AND m.type = 'sortie'
GROUP BY m.affaire_id, p.matiere_id;

-- ============= INDEX =============
CREATE INDEX idx_panneaux_matiere ON public.panneaux(matiere_id);
CREATE INDEX idx_mvt_panneau ON public.mouvements_stock(panneau_id);
CREATE INDEX idx_mvt_affaire ON public.mouvements_stock(affaire_id);
CREATE INDEX idx_bdc_fournisseur ON public.bons_de_commande(fournisseur_id);
CREATE INDEX idx_bdc_lignes_bdc ON public.bdc_lignes(bdc_id);
CREATE INDEX idx_acces_token ON public.affaire_acces(token);
CREATE INDEX idx_acces_tiers ON public.affaire_acces(tiers_profile_id);
