-- Klikteller: hoe vaak een winkel of markt bekeken, in een dagplan gezet, gedeeld of doorgeklikt wordt (route, website/organisator,
-- bellen). Alleen tellers per dag, per plek en per soort: geen losse klikken, geen IP, geen account. Beheer leest (ook voor organisatoren).
create table clicks (
  day date not null default current_date,
  item_id text not null check (item_id ~ '^[A-Za-z0-9_.:-]{1,120}$'),
  what text not null check (what in ('view', 'plan', 'share', 'route', 'site', 'tel')),
  n integer not null default 1,
  primary key (day, item_id, what)
);
alter table clicks enable row level security;
create policy beheer_lezen on clicks for select to authenticated using (is_admin());

-- ponytail: geen rem; iemand die spamt, blaast alleen tellers op (geen opslaggroei: één rij per dag/plek/soort). Rem per uur als dat gebeurt.
create function count_click(item_id text, what text) returns void language sql security definer set search_path = public as $$
  insert into clicks (item_id, what) values (count_click.item_id, count_click.what)
  on conflict (day, item_id, what) do update set n = clicks.n + 1;
$$;
revoke execute on function count_click(text, text) from public;
grant execute on function count_click(text, text) to anon, authenticated;
