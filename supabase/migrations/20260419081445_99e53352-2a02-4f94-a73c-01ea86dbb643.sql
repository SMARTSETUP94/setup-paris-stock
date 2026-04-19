-- Drop indexes (dépendent de l'extension dans public)
drop index if exists public.matieres_libelle_trgm_idx;
drop index if exists public.matieres_code_trgm_idx;

-- Déplacer pg_trgm vers le schéma extensions
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- Recréer les index avec les opclass du schéma extensions
create index if not exists matieres_libelle_trgm_idx
  on public.matieres using gin (libelle extensions.gin_trgm_ops);

create index if not exists matieres_code_trgm_idx
  on public.matieres using gin (code extensions.gin_trgm_ops);

-- Donner accès au schéma extensions
grant usage on schema extensions to anon, authenticated, service_role;