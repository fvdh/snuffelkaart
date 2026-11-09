-- Gebeurtenissenlog voor /beheer (Inzicht, Live): wat een bezoek doet, in volgorde. Anoniem: een bezoek is een willekeurige code die
-- alleen in die browsertab bestaat en elke dag wisselt (lib/ev.ts). Geen cookie, geen IP, geen account, geen exacte plek.
-- Bewaard 90 dagen; de dagtellers (tellers, clicks) blijven daarnaast bestaan. Zie privacy → "Wat we tellen".
--   t        soort: pv (pagina), binnen (eerste pagina van een bezoek; k = bron), view/plan/route/site/tel/share (k = item),
--            filter, zoek0 (k = zoekwoorden zonder resultaat), dagplan, plaats, naarkaart, bijdrage
--   p        pad van de pagina (/kaart/, /winkel/…)
--   d        apparaat: m (aanraakscherm) of d
create table events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  s text not null check (s ~ '^[a-z0-9]{8,16}$'),
  t text not null check (t ~ '^[a-z0-9]{2,12}$'),
  k text not null default '' check (length(k) <= 120 and k !~ '[@<>]'),
  p text not null default '' check (length(p) <= 120),
  d text check (d in ('m', 'd'))
);
create index events_at on events (at);
alter table events enable row level security;
create policy beheer_lezen on events for select to authenticated using (is_admin());

-- ponytail: rem van 3000 per uur voor iedereen samen (spam blaast hooguit het log op); opruimen af en toe bij het schrijven.
create function ev(s text, t text, k text default '', p text default '', d text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.002 then delete from events where at < now() - interval '90 days'; end if;
  if (select count(*) from events where at > now() - interval '1 hour') >= 3000 then return; end if;
  insert into events (s, t, k, p, d) values (ev.s, ev.t, left(coalesce(ev.k, ''), 120), left(coalesce(ev.p, ''), 120), ev.d);
end $$;
revoke execute on function ev(text, text, text, text, text) from public;
grant execute on function ev(text, text, text, text, text) to anon, authenticated;

-- Beheer: alle gebeurtenissen vanaf een tijdstip, compact als rijen [tijd, bezoek, soort, sleutel, pad, apparaat].
create function beheer_events(sinds timestamptz) returns json language sql stable security definer set search_path = public as $$
  select case when is_admin() then coalesce((select json_agg(json_build_array(extract(epoch from at)::bigint, s, t, k, p, d) order by at)
    from events where at >= sinds), '[]') else null end;
$$;
revoke execute on function beheer_events(timestamptz) from public;
grant execute on function beheer_events(timestamptz) to authenticated;
