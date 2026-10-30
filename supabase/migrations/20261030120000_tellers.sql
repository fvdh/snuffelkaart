-- Anonieme tellers voor het dashboard in /beheer (naast de klikteller): per dag, soort en sleutel één getal. Nooit per persoon:
-- geen IP, geen account, geen getypte tekst, geen exacte plek (regio's zijn vakken van ±10 km). Zie privacy → "Wat we tellen".
--   pagina   id van een winkel/markt of org:<slug>   bezoek aan een losse pagina (vaak via Google)
--   badge    <slug>                                  binnengekomen via de badge op de site van een organisator
--   afstand  <item-id>|<0-5|5-15|15-30|30+>          afstand van de gekozen plek tot wat je opent
--   plaats   <plaatsnaam>                            gekozen plaats bij Waar (geen straat, geen postcode)
--   regio    <lat>,<lon> op 0,1 graad                waar mensen kijken, ook met "mijn locatie"
--   zoekleeg (leeg)                                  zoeken zonder resultaat (niet wát er gezocht is)
--   filter   type:m, open, gratis, cat:antiek …      welk filter aangezet wordt
--   uur      <weekdag 0-6>-<uur 0-23>                wanneer de app geopend wordt
--   dagplan  <actie>|<stops>|<markt ja/nee>|<dag>    start of route van een dagplan
create table tellers (
  day date not null default current_date,
  metric text not null check (metric in ('pagina', 'badge', 'afstand', 'plaats', 'regio', 'zoekleeg', 'filter', 'uur', 'dagplan')),
  key text not null default '' check (length(key) <= 120 and key !~ '[@<>]'),
  n integer not null default 1,
  primary key (day, metric, key)
);
alter table tellers enable row level security;
create policy beheer_lezen on tellers for select to authenticated using (is_admin());

-- ponytail: geen rem, net als count_click; spam blaast alleen tellers op. Rem per uur als dat gebeurt.
create function tel(metric text, key text default '') returns void language sql security definer set search_path = public as $$
  insert into tellers (metric, key) values (tel.metric, coalesce(tel.key, ''))
  on conflict (day, metric, key) do update set n = tellers.n + 1;
$$;
revoke execute on function tel(text, text) from public;
grant execute on function tel(text, text) to anon, authenticated;
