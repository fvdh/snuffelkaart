-- Zoekwoorden uit Google Search Console (scripts/fetch-gsc.mjs, elke nacht de laatste dagen): per dag, zoekwoord en pagina.
-- Google geeft alleen totalen (geen personen) en laat zeldzame zoekwoorden zelf weg. Alleen beheer leest.
create table zoekwoorden (
  day date not null,
  query text not null check (length(query) <= 300),
  page text not null check (length(page) <= 300),
  clicks integer not null default 0,
  impressions integer not null default 0,
  position real,
  primary key (day, query, page)
);
alter table zoekwoorden enable row level security;
create policy beheer_lezen on zoekwoorden for select to authenticated using (is_admin());

-- Beheer: opgeteld over een periode (PostgREST geeft per verzoek hooguit 1000 rijen). Positie gewogen naar vertoningen.
create function beheer_zoekwoorden(sinds date) returns json language sql stable security definer set search_path = public as $$
  select case when is_admin() then json_build_object(
    'queries', coalesce((select json_agg(json_build_array(query, c, i, p) order by i desc) from (select query, sum(clicks) c, sum(impressions) i, round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) p from zoekwoorden where day >= sinds group by query order by sum(impressions) desc limit 300) q), '[]'),
    'pages', coalesce((select json_agg(json_build_array(page, c, i, p) order by i desc) from (select page, sum(clicks) c, sum(impressions) i, round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) p from zoekwoorden where day >= sinds group by page order by sum(impressions) desc limit 500) q), '[]'),
    'days', coalesce((select json_agg(json_build_array(day, c, i) order by day) from (select day, sum(clicks) c, sum(impressions) i from zoekwoorden where day >= sinds group by day) q), '[]'))
  else null end;
$$;
revoke execute on function beheer_zoekwoorden(date) from public;
grant execute on function beheer_zoekwoorden(date) to authenticated;
