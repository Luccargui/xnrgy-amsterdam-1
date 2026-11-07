-- Dueña, capitana y manager pueden poner la disponibilidad de cualquier jugadora del equipo,
-- y les llega un aviso cuando una disponibilidad ya guardada cambia.
alter table public.availability add column if not exists updated_by uuid;
alter table public.notification_prefs add column if not exists avail boolean not null default true;

-- Quién hizo el cambio lo pone la base de datos (no se puede falsear desde la web)
create or replace function private.availability_stamp()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists availability_stamp on public.availability;
create trigger availability_stamp before insert or update on public.availability
  for each row execute function private.availability_stamp();

drop policy if exists avail_insert on public.availability;
create policy avail_insert on public.availability for insert with check (
  ((user_id = (select auth.uid())) and private.has_role(array['owner','captain','manager','player']))
  or (private.has_role(array['owner','captain','manager']) and exists (select 1 from public.team_roles tr where tr.user_id = availability.user_id))
);
drop policy if exists avail_update on public.availability;
create policy avail_update on public.availability for update
  using ((user_id = (select auth.uid())) or private.has_role(array['owner','captain','manager']))
  with check ((user_id = (select auth.uid())) or private.has_role(array['owner','captain','manager']));

-- Aviso a las responsables cuando cambia una disponibilidad que ya estaba guardada
create or replace function private.notify_avail_change()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  perform net.http_post(
    url := 'https://hnsnxdaobusdbnryitjq.supabase.co/functions/v1/notify',
    body := jsonb_build_object('action', 'avail_change', 'user_id', new.user_id, 'r', new.r,
                               'old', old.status, 'new', new.status, 'by', new.updated_by),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select v from public.app_secrets where k = 'cron')),
    timeout_milliseconds := 20000);
  return new;
exception when others then
  return new; -- un fallo del aviso nunca debe impedir guardar la disponibilidad
end; $$;
revoke all on function private.notify_avail_change() from public, anon, authenticated;
revoke all on function private.availability_stamp() from public, anon, authenticated;
drop trigger if exists availability_change_push on public.availability;
create trigger availability_change_push after update on public.availability
  for each row when (old.status is not null and old.status is distinct from new.status)
  execute function private.notify_avail_change();
