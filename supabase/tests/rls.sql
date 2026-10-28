-- M4: RLS per tabel. Draait in een transactie die alles terugdraait; elke mislukte eis stopt met een foutmelding.
--   npm run test:rls   (in app/; gebruikt de gekoppelde Supabase CLI)
-- Rollen: gast (anon), gewone gebruiker (geen beheerder), beheerder (staat in admins).
begin;
do $$
declare
  a uuid; b uuid; n int; t record; pid text;
begin
  -- 0. Elke tabel in public heeft RLS aan.
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'RLS staat uit op tabel %', t.relname;
  end loop;

  -- Twee testgebruikers; verdwijnen met de rollback.
  insert into auth.users (id, email) values (gen_random_uuid(), 'rls-a@example.com') returning id into a;
  insert into auth.users (id, email) values (gen_random_uuid(), 'rls-b@example.com') returning id into b;
  insert into favorites (user_id, item_id) values (a, 'rls-test-a'), (b, 'rls-test-b');

  select id into pid from places limit 1;

  -- 1. Gast: leest niets, schrijft niets.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from places;      if n <> 0 then raise exception 'gast ziet % winkels', n; end if;
  select count(*) into n from markets;     if n <> 0 then raise exception 'gast ziet % markten', n; end if;
  select count(*) into n from import_runs; if n <> 0 then raise exception 'gast ziet % imports', n; end if;
  select count(*) into n from admins;      if n <> 0 then raise exception 'gast ziet % beheerders', n; end if;
  select count(*) into n from favorites;   if n <> 0 then raise exception 'gast ziet % favorieten', n; end if;
  begin insert into favorites (user_id, item_id) values (a, 'stiekem'); raise exception 'gast kon een favoriet toevoegen'; exception when insufficient_privilege or check_violation or not_null_violation or foreign_key_violation then null; when raise_exception then raise; end;
  update markets set status = 'cancel'; get diagnostics n = row_count; if n <> 0 then raise exception 'gast wijzigde % markten', n; end if;
  -- Statusbestand: publiek, maar alleen gepubliceerde statussen en geen andere velden.
  select count(*) into n from json_array_elements(market_status()->'markets') e where e->>'status' not in ('org', 'chk', 'unconf', 'cancel') or (select count(*) from json_object_keys(e)) <> 3;
  if n <> 0 then raise exception 'statusbestand lekt % rijen (kandidaat/afgewezen of extra velden)', n; end if;
  begin insert into contributions (user_id, item_id, kind, data) values (a, pid, 'review', '{"stars":5,"month":"2026-10"}'); raise exception 'gast kon een bijdrage doen'; exception when insufficient_privilege or invalid_parameter_value then null; when raise_exception then raise; end;
  begin perform delete_me(); raise exception 'gast mag delete_me uitvoeren'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  -- Meldingen: gast mag melden via report(), maar niet direct in de tabel schrijven of lezen; onzin wordt geweigerd.
  perform report(pid, 'dicht', 'rls-test');
  select count(*) into n from reports; if n <> 0 then raise exception 'gast ziet % meldingen', n; end if;
  perform log_error('rls-test', '/test', 'test');
  select count(*) into n from client_errors; if n <> 0 then raise exception 'gast ziet % foutmeldingen', n; end if;
  begin insert into client_errors (msg) values ('x'); raise exception 'gast schreef direct in client_errors'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  begin insert into reports (item_id, name, what) values ('x', 'x', 'dicht'); raise exception 'gast schreef direct in reports'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  begin perform report('bestaat-niet', 'dicht'); raise exception 'melding over onbekend item geaccepteerd'; exception when invalid_parameter_value then null; when raise_exception then raise; end;
  begin perform report(pid, 'hack'); raise exception 'melding met onbekende soort geaccepteerd'; exception when check_violation then null; when raise_exception then raise; end;
  reset role;
  select count(*) into n from reports where note = 'rls-test' and name <> ''; if n <> 1 then raise exception 'melding van gast niet opgeslagen'; end if;

  -- 2. Gewone gebruiker (a, met een e-mailadres dat geen beheerder is): alleen eigen favorieten.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'geen-beheerder@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from places;  if n <> 0 then raise exception 'gebruiker ziet % winkels via de database', n; end if;
  select count(*) into n from markets; if n <> 0 then raise exception 'gebruiker ziet % markten via de database', n; end if;
  select count(*) into n from admins;  if n <> 0 then raise exception 'gebruiker ziet de beheerderslijst'; end if;
  select count(*) into n from reports; if n <> 0 then raise exception 'gebruiker ziet % meldingen', n; end if;
  select count(*) into n from client_errors; if n <> 0 then raise exception 'gebruiker ziet % foutmeldingen', n; end if;
  update markets set status = 'cancel'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker wijzigde % markten', n; end if;
  update places set status = 'verborgen'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker verborg % winkels', n; end if;
  select count(*) into n from favorites where item_id like 'rls-test-%'; if n <> 1 then raise exception 'gebruiker ziet % testfavorieten (verwacht alleen de eigen)', n; end if;
  begin insert into favorites (user_id, item_id) values (b, 'stiekem'); raise exception 'gebruiker kon een favoriet voor een ander toevoegen'; exception when insufficient_privilege or check_violation then null; when raise_exception then raise; end;
  delete from favorites where item_id = 'rls-test-b'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker verwijderde een favoriet van een ander'; end if;
  insert into favorites (item_id) values ('rls-test-eigen'); -- user_id vult zichzelf (auth.uid())
  -- Bijdragen: eerst een schermnaam; inhoud gecontroleerd; zelf goedkeuren kan niet; anderen zien je bijdragen niet.
  begin insert into contributions (item_id, kind, data) values (pid, 'review', '{"stars":5,"month":"2026-10"}'); raise exception 'bijdrage zonder schermnaam geaccepteerd'; exception when invalid_parameter_value then null; when raise_exception then raise; end;
  insert into profiles (name) values ('rls test a');
  begin insert into contributions (item_id, kind, data) values (pid, 'review', '{"stars":9,"month":"2026-10"}'); raise exception 'review met 9 sterren geaccepteerd'; exception when check_violation then null; when raise_exception then raise; end;
  begin insert into contributions (item_id, kind, data) values (pid, 'review', '{"stars":4,"month":"2099-01"}'); raise exception 'review uit de toekomst geaccepteerd'; exception when check_violation then null; when raise_exception then raise; end;
  begin insert into contributions (item_id, kind, data) values (pid, 'foto', format('{"path":"%s/x.webp"}', b)::jsonb); raise exception 'foto in de map van een ander geaccepteerd'; exception when check_violation then null; when raise_exception then raise; end;
  begin insert into contributions (item_id, kind, data, status) values (pid, 'review', '{"stars":4,"month":"2026-10"}', 'goed'); raise exception 'gebruiker kon een goedgekeurde bijdrage invoegen'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  insert into contributions (item_id, kind, data) values (pid, 'review', '{"stars":4,"text":"rls-test","month":"2026-10"}');
  insert into contributions (item_id, kind, data) values (pid, 'tijden', json_build_object('oh', 'Mo-Sa 10:00-17:00', 'seen', current_date)::jsonb);
  update contributions set status = 'goed' where data->>'text' = 'rls-test';
  select count(*) into n from contributions where data->>'text' = 'rls-test' and status = 'nieuw'; if n <> 1 then raise exception 'gebruiker kon zijn eigen review goedkeuren'; end if;
  reset role;
  insert into profiles (user_id, name) values (b, 'rls test b');
  insert into contributions (user_id, item_id, kind, data) values (b, pid, 'review', '{"stars":1,"text":"rls-test-b","month":"2026-10"}');
  set local role authenticated;
  select count(*) into n from contributions where data->>'text' = 'rls-test-b'; if n <> 0 then raise exception 'gebruiker ziet de bijdrage van een ander'; end if;
  update contributions set data = '{"stars":5,"month":"2026-10"}' where data->>'text' = 'rls-test-b'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker wijzigde de review van een ander'; end if;
  select count(*) into n from profiles; if n <> 1 then raise exception 'gebruiker ziet % profielen (verwacht alleen het eigen)', n; end if;
  reset role;
  select count(*) into n from favorites where user_id = a and item_id = 'rls-test-eigen'; if n <> 1 then raise exception 'eigen favoriet niet aan de gebruiker gekoppeld'; end if;

  -- 3. Beheerder: ziet alles en mag markten en winkels wijzigen, maar geen beheerders toevoegen.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', (select email from admins limit 1))::text, true);
  set local role authenticated;
  select count(*) into n from places;  if n < 1000 then raise exception 'beheerder ziet maar % winkels', n; end if;
  select count(*) into n from markets; if n = 0 then raise exception 'beheerder ziet geen markten'; end if;
  update markets set seen_at = seen_at where id = (select id from markets limit 1); get diagnostics n = row_count; if n <> 1 then raise exception 'beheerder kan geen markt wijzigen'; end if;
  select count(*) into n from client_errors where msg = 'rls-test'; if n <> 1 then raise exception 'beheerder ziet de foutmelding van de gast niet'; end if;
  update contributions set status = 'goed', decided_at = now() where data->>'text' = 'rls-test'; get diagnostics n = row_count; if n <> 1 then raise exception 'beheerder kan een bijdrage niet goedkeuren'; end if;
  select count(*) into n from contributions where data->>'text' like 'rls-test%'; if n <> 2 then raise exception 'beheerder ziet % testbijdragen (verwacht 2)', n; end if;
  update reports set done_at = now() where note = 'rls-test'; get diagnostics n = row_count; if n <> 1 then raise exception 'beheerder kan een melding niet afhandelen'; end if;
  begin insert into admins values ('indringer@example.com'); raise exception 'beheerder kon zelf een beheerder toevoegen'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  begin delete from markets where true; get diagnostics n = row_count; if n <> 0 then raise exception 'beheerder kon % markten verwijderen', n; end if; exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'RLS: alle eisen gehaald';
end $$;
select 'RLS: alle eisen gehaald' as uitkomst;
rollback;
