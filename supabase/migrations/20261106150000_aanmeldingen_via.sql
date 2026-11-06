-- Op welke pagina iemand zich aanmeldde (/, /haarlem/, /winkel/…): zo zien we welke pagina's aanmeldingen opleveren. Geen persoonsgegeven.
alter table aanmeldingen add column via text check (via ~ '^/[A-Za-z0-9/_-]{0,119}$');
