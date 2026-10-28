-- M5: bijdragen van bezoekers (§3.2, §7). Openingstijden, reviews en foto's in één tabel en één wachtrij.
-- Alles via goedkeuring; alleen ingelogd; limieten per dag. Goedgekeurd gaat via de export naar /data/extra.json
-- (los van het open OSM-bestand: deze gegevens zijn van Snuffelkaart, niet ODbL).

-- Schermnaam: wat anderen bij je review of foto zien. Geen echte naam nodig.
create table profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null unique check (name ~ '^[[:alnum:]][[:alnum:] ._-]{1,28}[[:alnum:]]$'),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy eigen_lezen on profiles for select to authenticated using (user_id = auth.uid() or is_admin());
create policy eigen_toevoegen on profiles for insert to authenticated with check (user_id = auth.uid());
create policy eigen_wijzigen on profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table contributions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,                      -- id uit places.json (winkels)
  kind text not null check (kind in ('tijden', 'review', 'foto')),
  data jsonb not null,                        -- tijden: {oh, seen}; review: {stars, text, month}; foto: {path, caption}
  status text not null default 'nieuw' check (status in ('nieuw', 'goed', 'afgewezen')),
  reason text check (length(reason) <= 300),  -- bij afwijzen verplicht; de inzender ziet hem (DSA art. 17)
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index contributions_queue on contributions (created_at) where status = 'nieuw';
create index contributions_item on contributions (item_id) where status = 'goed';
-- Eén review per persoon per winkel; aanpassen = dezelfde rij, die opnieuw gekeurd wordt.
create unique index contributions_een_review on contributions (user_id, item_id) where kind = 'review';
alter table contributions enable row level security;
create policy eigen_lezen on contributions for select to authenticated using (user_id = auth.uid() or is_admin());
create policy eigen_toevoegen on contributions for insert to authenticated with check (user_id = auth.uid() and status = 'nieuw');
-- Eigen review aanpassen of een bijdrage intrekken; de inhoud gaat dan opnieuw langs beheer (trigger zet status terug).
create policy eigen_wijzigen on contributions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy eigen_intrekken on contributions for delete to authenticated using (user_id = auth.uid());
create policy beheer_wijzigen on contributions for update to authenticated using (is_admin()) with check (is_admin());

-- Controle van de inhoud (de app controleert ook, maar de database is de grens) en de limieten (§7.1).
create function contributions_check() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; n int;
begin
  if not is_admin() then
    if tg_op = 'UPDATE' then
      if new.kind <> old.kind or new.item_id <> old.item_id then raise exception 'soort en winkel liggen vast' using errcode = '22023'; end if;
      new.status := 'nieuw'; new.reason := null; new.decided_at := null; new.created_at := now();
    end if;
    if not exists (select 1 from profiles where user_id = new.user_id) then raise exception 'kies eerst een schermnaam' using errcode = '22023'; end if;
    if not exists (select 1 from places where id = new.item_id and status = 'actief') then raise exception 'onbekende winkel' using errcode = '22023'; end if;
    select count(*) into n from contributions where user_id = new.user_id and created_at > now() - interval '1 day' and id <> coalesce(new.id, -1);
    if n >= 20 then raise exception 'je hebt vandaag al 20 bijdragen gedaan; morgen weer' using errcode = '54000'; end if;
    select count(*) into n from contributions where user_id = new.user_id and kind = 'foto' and created_at > now() - interval '1 day' and id <> coalesce(new.id, -1);
    if new.kind = 'foto' and n >= 10 then raise exception 'je hebt vandaag al 10 foto''s toegevoegd; morgen weer' using errcode = '54000'; end if;
  end if;
  if new.kind = 'review' and not (
       jsonb_typeof(d->'stars') = 'number' and (d->>'stars')::int between 1 and 5
       and length(coalesce(d->>'text', '')) between 0 and 1000
       and d->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' and (d->>'month') <= to_char(now(), 'YYYY-MM') and (d->>'month') >= to_char(now() - interval '3 years', 'YYYY-MM'))
    then raise exception 'review: sterren 1-5, tekst tot 1000 tekens, maand van je bezoek (niet in de toekomst)' using errcode = '23514'; end if;
  if new.kind = 'tijden' and not (length(d->>'oh') between 3 and 300 and d->>'seen' ~ '^\d{4}-\d{2}-\d{2}$' and (d->>'seen')::date between current_date - 90 and current_date)
    then raise exception 'tijden: openingstijden en de datum waarop je ze zag (afgelopen 90 dagen)' using errcode = '23514'; end if;
  if new.kind = 'foto' and not (d->>'path' like new.user_id::text || '/%' and length(coalesce(d->>'caption', '')) <= 200)
    then raise exception 'foto: onbekend bestand' using errcode = '23514'; end if;
  return new;
end $$;
create trigger contributions_check before insert or update on contributions for each row execute function contributions_check();

-- Wat de export (service key) en beheer nodig hebben: schermnamen bij goedgekeurde bijdragen.
-- Foto's: 'fotos-nieuw' is privé (eigen map + beheer), 'fotos' is openbaar; beheer kopieert bij goedkeuren.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-nieuw', 'fotos-nieuw', false, 2000000, array['image/webp', 'image/jpeg']),
       ('fotos', 'fotos', true, 2000000, array['image/webp', 'image/jpeg']);
create policy foto_uploaden on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-nieuw' and (storage.foldername(name))[1] = auth.uid()::text);
create policy foto_eigen_of_beheer on storage.objects for select to authenticated
  using (bucket_id = 'fotos-nieuw' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy foto_eigen_weg on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-nieuw' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy foto_publiceren on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and is_admin());
create policy foto_beheer_lezen on storage.objects for select to authenticated using (bucket_id = 'fotos' and is_admin());
create policy foto_beheer_weg on storage.objects for delete to authenticated using (bucket_id = 'fotos' and is_admin());
