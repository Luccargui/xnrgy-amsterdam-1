-- ═══════════════════════════════════════════════════════════════════
--  Ampliaciones: disponibilidad y coches, quedada, clasificación,
--  suscripción al calendario y registro de la última visita.
--  Se ejecuta después de supabase-setup.sql. Se puede repetir.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Disponibilidad de cada jugadora por jornada (y cómo va a ir) ------
create table if not exists public.availability (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  r          int  not null check (r between 1 and 30),
  status     text check (status in ('yes', 'maybe', 'no')),
  transport  text check (transport in ('own', 'driver', 'needs')),
  seats      int  check (seats between 1 and 8),
  from_place text check (char_length(from_place) <= 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, r)
);
alter table public.availability enable row level security;
drop policy if exists "avail_select" on public.availability;
drop policy if exists "avail_insert" on public.availability;
drop policy if exists "avail_update" on public.availability;
drop policy if exists "avail_delete" on public.availability;
create policy "avail_select" on public.availability for select to authenticated
  using (private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "avail_insert" on public.availability for insert to authenticated
  with check (user_id = (select auth.uid()) and private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "avail_update" on public.availability for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "avail_delete" on public.availability for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_role(array['owner']));
revoke all on public.availability from anon;
grant select, insert, update, delete on public.availability to authenticated;

-- 2. Hora y punto de quedada de cada jornada ---------------------------
alter table public.rounds add column if not exists meet_time  text check (meet_time ~ '^[0-2][0-9]:[0-5][0-9]$');
alter table public.rounds add column if not exists meet_place text check (char_length(meet_place) <= 80);

-- 3. Clasificación de la poule (pública; la cambian dueña, capitana y managers)
create table if not exists public.standings (
  team       text primary key check (char_length(team) between 1 and 60),
  played     int not null default 0 check (played between 0 and 30),
  won        int not null default 0 check (won between 0 and 30),
  drawn      int not null default 0 check (drawn between 0 and 30),
  lost       int not null default 0 check (lost between 0 and 30),
  points     int not null default 0 check (points between 0 and 200),
  updated_at timestamptz not null default now()
);
alter table public.standings enable row level security;
drop policy if exists "stand_select" on public.standings;
drop policy if exists "stand_insert" on public.standings;
drop policy if exists "stand_update" on public.standings;
create policy "stand_select" on public.standings for select to anon, authenticated using (true);
create policy "stand_insert" on public.standings for insert to authenticated
  with check (private.has_role(array['owner', 'captain', 'manager']));
create policy "stand_update" on public.standings for update to authenticated
  using (private.has_role(array['owner', 'captain', 'manager']))
  with check (private.has_role(array['owner', 'captain', 'manager']));
grant select on public.standings to anon;
grant select, insert, update on public.standings to authenticated;
insert into public.standings (team) values
  ('GAASPERPARK 1'), ('HEALTHCITY HOENDERDAAL 2'), ('LEISURE WORLD PADEL 1'), ('NIJKERK 1'),
  ('PLAZA PADEL AMERSFOORT 1'), ('STROKEL 1'), ('VLTV 3'), ('XNRGY AMSTERDAM 1')
on conflict (team) do nothing;

-- 4. Enlace personal para suscribirse al calendario -------------------
--    Cada jugadora tiene un código secreto; la función «calendar» lo usa
--    para darle solo sus propios partidos.
create table if not exists public.calendar_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token   uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.calendar_tokens enable row level security;
drop policy if exists "cal_select" on public.calendar_tokens;
drop policy if exists "cal_insert" on public.calendar_tokens;
drop policy if exists "cal_delete" on public.calendar_tokens;
create policy "cal_select" on public.calendar_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy "cal_insert" on public.calendar_tokens for insert to authenticated
  with check (user_id = (select auth.uid()) and private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "cal_delete" on public.calendar_tokens for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.calendar_tokens from anon;
grant select, insert, delete on public.calendar_tokens to authenticated;

-- 5. Última visita a la web (para dejar que Supabase se pause tras 3 meses sin uso)
create table if not exists public.site_activity (
  id         int primary key check (id = 1),
  last_visit timestamptz not null default now()
);
insert into public.site_activity (id) values (1) on conflict (id) do nothing;
alter table public.site_activity enable row level security;
drop policy if exists "activity_select" on public.site_activity;
create policy "activity_select" on public.site_activity for select to anon, authenticated using (true);
grant select on public.site_activity to anon, authenticated;

create or replace function public.touch_visit()
returns void
language sql security definer
set search_path = ''
as $$
  update public.site_activity set last_visit = now()
  where id = 1 and last_visit < now() - interval '1 hour';
$$;
revoke all on function public.touch_visit() from public;
grant execute on function public.touch_visit() to anon, authenticated;

notify pgrst, 'reload schema';
