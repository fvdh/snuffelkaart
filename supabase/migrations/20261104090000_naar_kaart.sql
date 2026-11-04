-- Teller erbij (Freek, 4 nov: "triggeren we mensen wel om door te klikken naar onze kaart?"):
--   naarkaart  <paginasleutel>   klik van een losse pagina (winkel, markt, organisator, plaats) naar de app; sleutel zoals bij pagina
alter table tellers drop constraint tellers_metric_check;
alter table tellers add constraint tellers_metric_check
  check (metric in ('pagina', 'badge', 'afstand', 'plaats', 'regio', 'zoekleeg', 'filter', 'uur', 'dagplan', 'naarkaart'));
