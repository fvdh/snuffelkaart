-- M6 monitoring: JavaScript-fouten bij bezoekers, zodat we zien wat er stukgaat zonder dat iemand het meldt.
-- Zelfde opzet als meldingen: gasten alleen via log_error(), geen IP of account; beheer leest.
create table client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  msg text not null check (length(msg) <= 500),
  src text check (length(src) <= 300),   -- pagina en bestand:regel
  ua text check (length(ua) <= 200)      -- browser, om fouten per browser te herkennen
);
create index client_errors_at on client_errors (at);
alter table client_errors enable row level security;
create policy beheer_lezen on client_errors for select to authenticated using (is_admin());

-- ponytail: rem van 200 per uur voor iedereen samen; ouder dan 30 dagen gaat weg bij de volgende fout. Geen aparte opruimtaak.
create function log_error(msg text, src text default null, ua text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from client_errors where at > now() - interval '1 hour') >= 200 then return; end if;
  delete from client_errors where at < now() - interval '30 days';
  insert into client_errors (msg, src, ua) values (left(log_error.msg, 500), left(log_error.src, 300), left(log_error.ua, 200));
end $$;
revoke execute on function log_error(text, text, text) from public;
grant execute on function log_error(text, text, text) to anon, authenticated;
