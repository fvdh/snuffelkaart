-- M4: RLS per tabel. Draait in een transactie die alles terugdraait; elke mislukte eis stopt met een foutmelding.
--   npm run test:rls   (in app/; gebruikt de gekoppelde Supabase CLI)
-- Rollen: gast (anon), gewone gebruiker (geen beheerder), beheerder (staat in admins).
begin;
do $$
declare
  a uuid; b uuid; n int; t record;
begin
  -- 0. Elke tabel in public heeft RLS aan.
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'RLS staat uit op tabel %', t.relname;
  end loop;

  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users order by created_at offset 1 limit 1;
  if a is null or b is null then raise exception 'test heeft twee gebruikers in auth.users nodig'; end if;
  insert into favorites (user_id, item_id) values (a, 'rls-test-a'), (b, 'rls-test-b');

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
  begin perform delete_me(); raise exception 'gast mag delete_me uitvoeren'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  reset role;

  -- 2. Gewone gebruiker (a, met een e-mailadres dat geen beheerder is): alleen eigen favorieten.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'geen-beheerder@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from places;  if n <> 0 then raise exception 'gebruiker ziet % winkels via de database', n; end if;
  select count(*) into n from markets; if n <> 0 then raise exception 'gebruiker ziet % markten via de database', n; end if;
  select count(*) into n from admins;  if n <> 0 then raise exception 'gebruiker ziet de beheerderslijst'; end if;
  update markets set status = 'cancel'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker wijzigde % markten', n; end if;
  update places set status = 'verborgen'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker verborg % winkels', n; end if;
  select count(*) into n from favorites where item_id like 'rls-test-%'; if n <> 1 then raise exception 'gebruiker ziet % testfavorieten (verwacht alleen de eigen)', n; end if;
  begin insert into favorites (user_id, item_id) values (b, 'stiekem'); raise exception 'gebruiker kon een favoriet voor een ander toevoegen'; exception when insufficient_privilege or check_violation then null; when raise_exception then raise; end;
  delete from favorites where item_id = 'rls-test-b'; get diagnostics n = row_count; if n <> 0 then raise exception 'gebruiker verwijderde een favoriet van een ander'; end if;
  insert into favorites (item_id) values ('rls-test-eigen'); -- user_id vult zichzelf (auth.uid())
  reset role;
  select count(*) into n from favorites where user_id = a and item_id = 'rls-test-eigen'; if n <> 1 then raise exception 'eigen favoriet niet aan de gebruiker gekoppeld'; end if;

  -- 3. Beheerder: ziet alles en mag markten en winkels wijzigen, maar geen beheerders toevoegen.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', (select email from admins limit 1))::text, true);
  set local role authenticated;
  select count(*) into n from places;  if n < 1000 then raise exception 'beheerder ziet maar % winkels', n; end if;
  select count(*) into n from markets; if n = 0 then raise exception 'beheerder ziet geen markten'; end if;
  update markets set seen_at = seen_at where id = (select id from markets limit 1); get diagnostics n = row_count; if n <> 1 then raise exception 'beheerder kan geen markt wijzigen'; end if;
  begin insert into admins values ('indringer@example.com'); raise exception 'beheerder kon zelf een beheerder toevoegen'; exception when insufficient_privilege then null; when raise_exception then raise; end;
  begin delete from markets where true; get diagnostics n = row_count; if n <> 0 then raise exception 'beheerder kon % markten verwijderen', n; end if; exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'RLS: alle eisen gehaald';
end $$;
select 'RLS: alle eisen gehaald' as uitkomst;
rollback;
