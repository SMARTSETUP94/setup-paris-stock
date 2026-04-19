-- Fuzzy match d'une description OCR vers les meilleurs panneaux candidats
create or replace function public.match_panneaux_par_description(
  _description text,
  _seuil real default 0.3,
  _limit integer default 5
)
returns table (
  panneau_id uuid,
  matiere_id uuid,
  matiere_libelle text,
  longueur_mm integer,
  largeur_mm integer,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id as panneau_id,
    m.id as matiere_id,
    m.libelle as matiere_libelle,
    p.longueur_mm,
    p.largeur_mm,
    greatest(
      extensions.similarity(lower(coalesce(_description, '')), lower(coalesce(m.libelle, ''))),
      extensions.similarity(lower(coalesce(_description, '')), lower(coalesce(m.code, '')))
    ) as similarity
  from public.panneaux p
  join public.matieres m on m.id = p.matiere_id
  where p.actif = true
    and m.actif = true
    and (
      extensions.similarity(lower(coalesce(_description, '')), lower(coalesce(m.libelle, ''))) >= _seuil
      or extensions.similarity(lower(coalesce(_description, '')), lower(coalesce(m.code, ''))) >= _seuil
    )
  order by similarity desc, p.created_at asc
  limit _limit;
$$;

-- Fuzzy match d'un nom de fournisseur
create or replace function public.match_fournisseur_par_nom(
  _nom text,
  _seuil real default 0.4
)
returns table (
  fournisseur_id uuid,
  nom text,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    f.id as fournisseur_id,
    f.nom,
    extensions.similarity(lower(coalesce(_nom, '')), lower(coalesce(f.nom, ''))) as similarity
  from public.fournisseurs f
  where extensions.similarity(lower(coalesce(_nom, '')), lower(coalesce(f.nom, ''))) >= _seuil
  order by similarity desc
  limit 1;
$$;

grant execute on function public.match_panneaux_par_description(text, real, integer) to authenticated;
grant execute on function public.match_fournisseur_par_nom(text, real) to authenticated;