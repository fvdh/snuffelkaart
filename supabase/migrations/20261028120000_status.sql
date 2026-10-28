-- M4 statusbestand (§6.1): kritieke wijzigingen (markt afgelast, winkel dicht) binnen minuten zichtbaar, zonder herbouw.
-- Iedereen mag dit lezen, maar het geeft alleen de status van gepubliceerde markten in de komende 14 dagen en de id's van
-- verborgen winkels; kandidaten, afgewezen markten en beheervelden blijven onzichtbaar (RLS op de tabellen blijft dicht).
create function market_status() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'at', now(),
    'markets', coalesce((select json_agg(json_build_object('id', id, 'status', status, 'cancelWhy', data->>'cancelWhy'))
      from markets where status in ('org', 'chk', 'unconf', 'cancel') and date between current_date and current_date + 14), '[]'),
    'hidden', coalesce((select json_agg(id) from places where status = 'verborgen'), '[]')
  )
$$;
revoke execute on function market_status() from public;
grant execute on function market_status() to anon, authenticated;
