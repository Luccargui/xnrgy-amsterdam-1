-- Cambio de fecha de una jornada por el equipo (dueña, capitana o manager).
-- knltb_date / knltb_time: la fecha que publica KNLTB (solo la escribe la sincronización).
-- date / time: la fecha que se usa en la web, el calendario y los avisos.
-- La sincronización solo pisa date/time cuando KNLTB publica una fecha distinta de la que tenía,
-- así que una fecha cambiada a mano se mantiene hasta que KNLTB publique un cambio.
alter table public.fixtures add column if not exists knltb_date date, add column if not exists knltb_time text;
update public.fixtures set knltb_date = date, knltb_time = time where knltb_date is null;
alter table public.fixtures add column if not exists moved boolean generated always as
  (knltb_date is not null and (date is distinct from knltb_date or coalesce(time, '') <> coalesce(knltb_time, ''))) stored;

-- Desde la web solo se pueden escribir las columnas de siempre (la fecha de KNLTB no)
revoke insert, update on public.fixtures from anon, authenticated;
grant insert (r, date, time, home, away, venue_name, venue_street, venue_city, updated_at) on public.fixtures to authenticated;
grant update (r, date, time, home, away, venue_name, venue_street, venue_city, updated_at) on public.fixtures to authenticated;
