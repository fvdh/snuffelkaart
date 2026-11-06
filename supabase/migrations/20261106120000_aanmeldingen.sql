-- Mail-aanmeldingen met dubbele opt-in (nov 2026): de wachtlijst voor de kaartmaker en "markten dit weekend" (elke donderdag).
-- Alleen de worker (/api/aanmelden, /api/bevestig, /api/afmelden) en scripts/weekmail.mjs komen erbij, met de service role.
-- Geen policies: de browser (anon of ingelogd) kan niets lezen of schrijven. Zie privacy → "Mail van ons".
--   lijst      kaartmaker = één mail als de kaartmaker klaar is; weekend = elke donderdag de markten rond plek (km)
--   plek       wat je typte, zoals PDOK het teruggaf ("Haarlem"); lat/lon = midden van die plaats, niet je adres
--   token      zit in de bevestig- en afmeldlink; wie de link heeft, kan alleen bevestigen of afmelden
--   bevestigd  null = nog niet op de link geklikt; zulke rijen wist weekmail.mjs na 7 dagen
-- Afmelden = de rij verwijderen.
create table aanmeldingen (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lijst text not null check (lijst in ('kaartmaker', 'weekend')),
  plek text check (length(plek) <= 120),
  lat double precision check (lat between 50 and 54),
  lon double precision check (lon between 3 and 8),
  km smallint check (km between 5 and 100),
  notitie text check (length(notitie) <= 200),
  token uuid not null default gen_random_uuid() unique,
  aangemaakt timestamptz not null default now(),
  bevestigd timestamptz,
  gemaild timestamptz,
  unique (email, lijst),
  check (lijst <> 'weekend' or (lat is not null and lon is not null and km is not null))
);
alter table aanmeldingen enable row level security;
