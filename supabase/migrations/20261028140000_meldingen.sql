-- "Klopt er iets niet?": een bezoeker (ook zonder account) meldt een fout bij een winkel of markt; de melding komt in /beheer.
-- Gasten krijgen geen toegang tot de tabel; ze kunnen alleen report() aanroepen. Die controleert de invoer, zet de naam erbij
-- (zodat beheer niet alle winkels hoeft te laden) en heeft een rem tegen spam.
create table reports (
  id bigint generated always as identity primary key,
  item_id text not null,
  name text not null,
  what text not null check (what in ('dicht', 'tijden', 'plek', 'afgelast', 'anders')),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index reports_open on reports (created_at) where done_at is null;
alter table reports enable row level security;
create policy beheer_lezen on reports for select to authenticated using (is_admin());
create policy beheer_wijzigen on reports for update to authenticated using (is_admin()) with check (is_admin());

-- ponytail: rem van 60 meldingen per uur voor iedereen samen (geen IP in de database, AVG). Per bezoeker remmen als er echt spam komt.
create function report(item_id text, what text, note text default null) returns void language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select coalesce(
    (select data->>'name' from places p where p.id = report.item_id),
    (select data->>'name' from markets m where m.id = report.item_id and m.status in ('org', 'chk', 'unconf', 'cancel'))) into n;
  if n is null then raise exception 'onbekende winkel of markt' using errcode = '22023'; end if;
  if (select count(*) from reports where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'er komen nu te veel meldingen binnen; probeer het later' using errcode = '54000';
  end if;
  insert into reports (item_id, name, what, note) values (report.item_id, n, report.what, nullif(trim(report.note), ''));
end $$;
revoke execute on function report(text, text, text) from public;
grant execute on function report(text, text, text) to anon, authenticated;
