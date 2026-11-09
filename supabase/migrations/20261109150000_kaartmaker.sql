-- Kaartmaker (nov 2026): een ingelogde organisator zet zelf een markt of garagesale op de kaart (/kaartmaker/).
--   markt       (vrijmarkt, buurtmarkt, rommelmarkt) staat meteen live: status 'org', status vastgezet, zodat een import hem nooit
--               terugzet (scripts/db.mjs vanished). De export zet hem in markets.json zoals elke andere markt.
--   garagesale  wacht eerst op ons (status 'wacht', niet openbaar). Na goedkeuring krijgt hij een pagina waar buren zonder account
--               hun adres opgeven (worker /api/garagesale). Elk adres keuren we ook; goedgekeurde adressen komen alleen via
--               garage_kaart() in de browser, nooit in de statische HTML of markets.json. De dag na de garagesale wist garage_opruimen() ze.
-- De gebruiker kan niet zelf in markets schrijven: alles gaat via kaartmaker_maak(), die de invoer controleert.

alter table markets drop constraint markets_status_check;
alter table markets add constraint markets_status_check check (status in ('org', 'chk', 'unconf', 'cancel', 'kandidaat', 'afgewezen', 'wacht'));

-- Wie welke markt maakte. Los van markets.data, want die is openbaar. email: om de organisator te kunnen mailen (alleen beheer ziet het).
-- Account weg → deze rij weg; de markt zelf blijft staan (openbare gegevens).
create table kaartmakers (
  market_id text primary key references markets (id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
create index kaartmakers_user on kaartmakers (user_id, created_at);
alter table kaartmakers enable row level security;
create policy beheer_lezen on kaartmakers for select to authenticated using (is_admin());

-- Adressen van buren bij een garagesale. Geen naam, geen e-mail, geen IP: alleen het adres (zoals PDOK het teruggaf) en wat je verkoopt.
create table garage_adressen (
  id bigint generated always as identity primary key,
  market_id text not null references markets (id) on delete cascade,
  adres text not null check (length(adres) between 5 and 120),
  lat double precision not null check (lat between 50.7 and 53.7),
  lon double precision not null check (lon between 3.2 and 7.3),
  wat text check (length(wat) <= 80),
  status text not null default 'nieuw' check (status in ('nieuw', 'goed', 'afgewezen')),
  created_at timestamptz not null default now(),
  unique (market_id, adres)
);
alter table garage_adressen enable row level security;
create policy beheer_lezen on garage_adressen for select to authenticated using (is_admin());
create policy beheer_wijzigen on garage_adressen for update to authenticated using (is_admin()) with check (is_admin());

create function vandaag_nl() returns date language sql stable as $$ select (now() at time zone 'Europe/Amsterdam')::date $$;

-- Nieuwe markt of garagesale. Fouten als Nederlandse zin (de pagina toont hem zo). Hooguit 5 per gebruiker per dag.
create function kaartmaker_maak(soort text, naam text, org text, plaats text, adres text, datum date, van int, tot int, lat double precision, lon double precision,
  entree text default null, info text default null, url text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); nid text; garage boolean := soort = 'Garagesale';
  nm text := trim(naam); og text := trim(org); pl text := trim(plaats); ad text := nullif(trim(adres), '');
  en text := nullif(trim(entree), ''); nf text := nullif(trim(info), ''); u text := nullif(trim(url), '');
begin
  if uid is null then raise exception 'Log eerst in.' using errcode = '42501'; end if;
  if soort is null or soort not in ('Vrijmarkt', 'Buurtmarkt', 'Rommelmarkt', 'Garagesale') then raise exception 'Kies wat voor markt het is.' using errcode = '22023'; end if;
  if length(nm) not between 3 and 80 then raise exception 'Geef de markt een naam van 3 tot 80 tekens.' using errcode = '22023'; end if;
  if length(og) not between 2 and 80 then raise exception 'Vul in wie het organiseert.' using errcode = '22023'; end if;
  if length(pl) not between 2 and 60 then raise exception 'Vul de plaats in.' using errcode = '22023'; end if;
  if length(ad) > 120 or length(en) > 40 or length(nf) > 500 then raise exception 'Een van de velden is te lang.' using errcode = '22023'; end if;
  if datum is null or datum < vandaag_nl() or datum > vandaag_nl() + 366 then raise exception 'Kies een datum vanaf vandaag, hooguit een jaar vooruit.' using errcode = '22023'; end if;
  if van is null or tot is null or van not between 0 and 1380 or tot not between van + 30 and 1440 then raise exception 'De eindtijd moet minstens een half uur na de begintijd liggen.' using errcode = '22023'; end if;
  if lat is null or lon is null or lat not between 50.7 and 53.7 or lon not between 3.2 and 7.3 then raise exception 'Kies een plek in Nederland.' using errcode = '22023'; end if;
  if u is not null and (length(u) > 200 or u !~ '^https?://[^\s/]+\.[^\s]+$') then raise exception 'De website moet beginnen met https://' using errcode = '22023'; end if;
  if (select count(*) from kaartmakers k where k.user_id = uid and k.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Je hebt vandaag al 5 markten gemaakt. Morgen kan het weer; mail ons als je er meer nodig hebt.' using errcode = '54000';
  end if;
  nid := 'km-' || substr(md5(gen_random_uuid()::text), 1, 10);
  insert into markets (id, date, source, status, locked, data) values (nid, datum, og, case when garage then 'wacht' else 'org' end,
    array['status', 'name', 'kind', 'place', 'addr', 'lat', 'lon', 'start', 'end', 'entree'],
    jsonb_strip_nulls(jsonb_build_object('t', 'm', 'name', nm, 'kind', soort, 'org', og, 'place', pl, 'addr', ad, 'date', datum, 'start', van, 'end', tot,
      'timeKnown', true, 'lat', round(lat::numeric, 5), 'lon', round(lon::numeric, 5), 'exact', true, 'entree', coalesce(en, 'onbekend'), 'schema', '',
      'info', nf, 'url', u, 'adressen', case when garage then true end)));
  insert into kaartmakers (market_id, user_id, email) values (nid, uid, coalesce(auth.jwt() ->> 'email', ''));
  return nid;
end $$;
revoke execute on function kaartmaker_maak(text, text, text, text, text, date, int, int, double precision, double precision, text, text, text) from public, anon;
grant execute on function kaartmaker_maak(text, text, text, text, text, date, int, int, double precision, double precision, text, text, text) to authenticated;

-- Jouw markten (de organisator kan markets niet lezen), met het aantal adressen bij een garagesale en waarom we hem niet plaatsten.
create function mijn_markten() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', m.id, 'date', m.date, 'status', m.status, 'name', m.data ->> 'name', 'kind', m.data ->> 'kind', 'place', m.data ->> 'place',
    'adressen', (m.data ->> 'adressen')::boolean, 'nieuw', (select count(*) from garage_adressen a where a.market_id = m.id and a.status = 'nieuw'),
    'goed', (select count(*) from garage_adressen a where a.market_id = m.id and a.status = 'goed'), 'why', m.data ->> 'rejectWhy') order by m.date), '[]')
  from kaartmakers k join markets m on m.id = k.market_id where k.user_id = auth.uid() and m.date >= vandaag_nl()
$$;
revoke execute on function mijn_markten() from public, anon;
grant execute on function mijn_markten() to authenticated;

-- Stoppen: nog niet openbaar → weg; openbaar → afgelast (bezoekers die hem al zagen, zien dat hij niet doorgaat). Adressen meteen weg.
create function kaartmaker_stop(markt text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from kaartmakers where market_id = markt and user_id = auth.uid()) then raise exception 'Dit is niet jouw markt.' using errcode = '42501'; end if;
  delete from garage_adressen where market_id = markt;
  delete from markets where id = markt and status in ('wacht', 'afgewezen');
  update markets set status = 'cancel', data = data || '{"cancelWhy": "afgelast door de organisator"}', locked = array(select distinct unnest(locked || array['status', 'cancelWhy'])), updated_at = now()
  where id = markt and status in ('org', 'chk', 'unconf');
end $$;
revoke execute on function kaartmaker_stop(text) from public, anon;
grant execute on function kaartmaker_stop(text) to authenticated;

-- Openbaar: goedgekeurde adressen van één garagesale die nog moet komen (of vandaag is). Alleen voor de kaart op die pagina.
create function garage_kaart(markt text) returns table (adres text, lat double precision, lon double precision, wat text) language sql stable security definer set search_path = public as $$
  select a.adres, a.lat, a.lon, a.wat from garage_adressen a join markets m on m.id = a.market_id
  where a.market_id = markt and a.status = 'goed' and m.status in ('org', 'chk') and m.date >= vandaag_nl()
  order by a.adres
$$;
revoke execute on function garage_kaart(text) from public;
grant execute on function garage_kaart(text) to anon, authenticated;

-- De dag na de garagesale: adressen weg (ook nooit gekeurde). Draait bij elke export (scripts/db.mjs), minstens elke nacht.
create function garage_opruimen() returns int language sql security definer set search_path = public as $$
  with weg as (delete from garage_adressen a using markets m where m.id = a.market_id and m.date < vandaag_nl() returning 1) select count(*)::int from weg
$$;
revoke execute on function garage_opruimen() from public, anon, authenticated;
grant execute on function garage_opruimen() to service_role;
