-- Cuando cambia la fecha u hora de una jornada que aún no se ha jugado (desde la web o porque la cambia KNLTB):
--  * si cambia el día: se borra la disponibilidad marcada para esa jornada (era para la fecha anterior)
--    y se avisa a todo el equipo para que la vuelva a marcar;
--  * si solo cambia la hora: se avisa de la hora nueva y la disponibilidad se mantiene.
-- No se avisa a quien hizo el cambio.
create or replace function private.fixture_date_change()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  day_changed boolean := old.date is distinct from new.date;
begin
  if greatest(old.date, new.date) < today then return new; end if;
  if day_changed then
    delete from public.availability where r = new.r;
  end if;
  begin
    perform net.http_post(
      url := 'https://hnsnxdaobusdbnryitjq.supabase.co/functions/v1/notify',
      body := jsonb_build_object('action', 'date_change', 'r', new.r, 'reset', day_changed, 'by', auth.uid()),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select v from public.app_secrets where k = 'cron')),
      timeout_milliseconds := 20000);
  exception when others then
    null; -- un fallo del aviso nunca debe impedir guardar la fecha
  end;
  return new;
end; $$;
revoke all on function private.fixture_date_change() from public, anon, authenticated;
drop trigger if exists fixture_date_change_push on public.fixtures;
create trigger fixture_date_change_push after update of date, time on public.fixtures
  for each row when (old.date is distinct from new.date or coalesce(old.time, '') is distinct from coalesce(new.time, ''))
  execute function private.fixture_date_change();
