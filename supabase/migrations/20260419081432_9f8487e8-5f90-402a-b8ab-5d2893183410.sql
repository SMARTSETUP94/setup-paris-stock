-- Bucket privé pour les PDF de BDC
insert into storage.buckets (id, name, public)
values ('bdc-uploads', 'bdc-uploads', false)
on conflict (id) do nothing;

-- RLS storage.objects : admins seulement
create policy "Admins lisent bdc-uploads"
on storage.objects for select
to authenticated
using (bucket_id = 'bdc-uploads' and public.is_admin(auth.uid()));

create policy "Admins déposent bdc-uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'bdc-uploads' and public.is_admin(auth.uid()));

create policy "Admins suppriment bdc-uploads"
on storage.objects for delete
to authenticated
using (bucket_id = 'bdc-uploads' and public.is_admin(auth.uid()));

create policy "Admins modifient bdc-uploads"
on storage.objects for update
to authenticated
using (bucket_id = 'bdc-uploads' and public.is_admin(auth.uid()));

-- Extension pg_trgm pour fuzzy match
create extension if not exists pg_trgm with schema public;

-- Index trigramme pour accélérer le matching matières
create index if not exists matieres_libelle_trgm_idx
  on public.matieres using gin (libelle gin_trgm_ops);

create index if not exists matieres_code_trgm_idx
  on public.matieres using gin (code gin_trgm_ops);