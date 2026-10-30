-- Dashboard en Klikken lezen de tellers in één verzoek (beide tabellen, vanaf een datum). Alleen voor beheerders.
-- Ook minder gevoelig voor adblockers die adressen met "clicks" erin tegenhouden.
create function beheer_tellers(sinds date) returns json language sql stable security definer set search_path = public as $$
  select case when is_admin() then json_build_object(
    'tellers', coalesce((select json_agg(json_build_object('day', day, 'metric', metric, 'key', key, 'n', n)) from tellers where day >= sinds), '[]'),
    'clicks', coalesce((select json_agg(json_build_object('day', day, 'item_id', item_id, 'what', what, 'n', n)) from clicks where day >= sinds), '[]'))
  else null end;
$$;
revoke execute on function beheer_tellers(date) from public;
grant execute on function beheer_tellers(date) to authenticated;
