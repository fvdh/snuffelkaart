-- M2 deel 1: Supabase als bron van waarheid (§6.1, §6.2).
-- ponytail: één record = één jsonb-document (zelfde vorm als in places.json / markets.json) plus de kolommen waarop we
-- filteren of die beheer wijzigt. Typed kolommen per veld (PostGIS, enz.) pas als een query ze nodig heeft.

create table places (
  id text primary key,                       -- osm-n123 / ov-abc…
  data jsonb not null,                       -- naam, soort, adres, oh (opening_hours-bron), website, …
  status text not null default 'actief' check (status in ('actief', 'verborgen')),
  locked text[] not null default '{}',       -- velden die met de hand zijn gezet: een import laat ze staan
  seen_at timestamptz,                       -- laatste import waarin hij voorkwam
  updated_at timestamptz not null default now()
);

create table markets (                       -- één rij per editie (datum); reeksen pas als we herhaalpatronen binnenhalen
  id text primary key,
  date date not null,
  source text not null,                      -- organisator, of 'gemeenteblad'
  data jsonb not null,
  status text not null check (status in ('org', 'chk', 'unconf', 'cancel', 'kandidaat', 'afgewezen')),
  locked text[] not null default '{}',
  seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create index markets_date on markets (date);
create index markets_status on markets (status);

create table import_runs (
  id bigint generated always as identity primary key,
  source text not null,                      -- 'places' of 'markets'
  at timestamptz not null default now(),
  counts jsonb not null default '{}'
);

create table admins (email text primary key);

-- RLS: niemand leest of schrijft zonder regel. Imports en export gebruiken de secret key (die omzeilt RLS).
alter table places enable row level security;
alter table markets enable row level security;
alter table import_runs enable row level security;
alter table admins enable row level security;

create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email')
$$;

create policy beheer_lezen on places for select to authenticated using (is_admin());
create policy beheer_wijzigen on places for update to authenticated using (is_admin()) with check (is_admin());
create policy beheer_lezen on markets for select to authenticated using (is_admin());
create policy beheer_wijzigen on markets for update to authenticated using (is_admin()) with check (is_admin());
create policy beheer_lezen on import_runs for select to authenticated using (is_admin());
