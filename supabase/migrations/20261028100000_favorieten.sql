-- M3: accounts en favorieten. Een bezoeker ziet en wijzigt alleen zijn eigen favorieten (RLS); gasten kunnen niets.
-- item_id = id uit places.json / markets.json; geen foreign key, want winkels en markten kunnen verdwijnen (de favoriet blijft dan stil liggen).
create table favorites (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table favorites enable row level security;
create policy eigen_lezen on favorites for select to authenticated using (user_id = auth.uid());
create policy eigen_toevoegen on favorites for insert to authenticated with check (user_id = auth.uid());
create policy eigen_verwijderen on favorites for delete to authenticated using (user_id = auth.uid());

-- Account verwijderen (AVG): de gebruiker zelf, met al zijn gegevens (favorites gaat mee via on delete cascade).
create function delete_me() returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;
revoke execute on function delete_me() from public, anon;
grant execute on function delete_me() to authenticated;
