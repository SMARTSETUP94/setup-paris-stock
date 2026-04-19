-- =====================================================================
-- Refonte du modèle de rôles : admin / magasinier / mobile
-- =====================================================================

-- 1) Ajouter les nouvelles valeurs à l'enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'magasinier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mobile';
