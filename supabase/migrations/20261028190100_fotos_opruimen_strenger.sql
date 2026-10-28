-- Strenger: in fotos-nieuw blijft alleen wat nog gekeurd moet worden; goedgekeurd staat in fotos.
create or replace function orphan_photos() returns table (bucket text, name text) language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('fotos-nieuw', 'fotos') and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.contributions c where c.kind = 'foto' and c.data->>'path' = o.name
      and c.status = case o.bucket_id when 'fotos' then 'goed' else 'nieuw' end)
$$;
