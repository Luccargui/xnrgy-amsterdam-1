-- Resultados, clasificación y horarios vienen de MijnKNLTB (función knltb-sync); la web ya no los edita.
alter table public.standings
  add column if not exists pos int,
  add column if not exists matches text,
  add column if not exists sets text,
  add column if not exists games text;
alter table public.rounds add column if not exists knltb jsonb;

-- Estado de la última sincronización (se enseña en la web: "actualizado con KNLTB a las…")
create table if not exists public.knltb_sync (
  id int primary key default 1 check (id = 1),
  last_run timestamptz,
  last_ok timestamptz,
  error text,
  detail jsonb not null default '{}'::jsonb
);
alter table public.knltb_sync enable row level security;
drop policy if exists knltb_sync_read on public.knltb_sync;
create policy knltb_sync_read on public.knltb_sync for select using (true);
revoke insert, update, delete, truncate on public.knltb_sync from anon, authenticated;

-- Clasificación: solo la escribe la sincronización
drop policy if exists stand_insert on public.standings;
drop policy if exists stand_update on public.standings;
revoke insert, update, delete, truncate on public.standings from anon, authenticated;

-- Jornadas: capitanas y managers siguen poniendo parejas y quedada; resultados solo desde KNLTB
revoke insert, update, delete, truncate on public.rounds from anon, authenticated;
grant insert (r, pairs, meet_time, meet_place) on public.rounds to authenticated;
grant update (pairs, meet_time, meet_place) on public.rounds to authenticated;

-- Ya no se envían resultados por parejas desde la web
drop function if exists public.submit_pair_result(integer, integer, jsonb, jsonb);
