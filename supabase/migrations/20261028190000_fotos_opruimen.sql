-- Foto's zonder bijdrage (account verwijderd, bijdrage ingetrokken of afgewezen): de nachtelijke export ruimt ze op via de storage-API.
-- Alleen voor de service key; storage.objects is niet via PostgREST bereikbaar.
create function orphan_photos() returns table (bucket text, name text) language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('fotos-nieuw', 'fotos') and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.contributions c where c.kind = 'foto' and c.data->>'path' = o.name
      and (c.status = 'goed' or (o.bucket_id = 'fotos-nieuw' and c.status = 'nieuw')))
$$;
revoke execute on function orphan_photos() from public, anon, authenticated;
grant execute on function orphan_photos() to service_role;
