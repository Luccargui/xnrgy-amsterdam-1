-- ═══════════════════════════════════════════════════════════════════
--  XNRGY Amsterdam 1 · configuración de Supabase
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Perfiles de las jugadoras (uno por cuenta) ------------------------
create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 60),
  last_name   text not null check (char_length(last_name) between 1 and 80),
  phone       text not null check (char_length(phone) between 6 and 25),
  email       text not null check (char_length(email) between 3 and 120),
  knltb       text not null check (knltb ~ '^[0-9]{6,10}$'),
  side        text not null check (side in ('left', 'right', 'any')),
  hand        text not null check (hand in ('left', 'right', 'both')),
  country     text not null check (country ~ '^[A-Z]{2}$'),
  region      text not null check (char_length(region) between 1 and 10),
  region_name text check (char_length(region_name) <= 120),
  photo       text check (photo is null or (char_length(photo) <= 200000 and photo like 'data:image/%')),
  updated_at  timestamptz not null default now()
);

-- 2. Roles: la dueña de la web y las capitanas -------------------------
create table if not exists public.team_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('owner', 'captain'))
);

-- 3. Jornadas: alineaciones y resultados --------------------------------
create table if not exists public.rounds (
  r          int primary key check (r between 1 and 30),
  pairs      jsonb not null default '[]'::jsonb,
  results    jsonb not null default '[]'::jsonb,
  us         int check (us between 0 and 99),
  them       int check (them between 0 and 99),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- 4. ¿Tiene la persona conectada alguno de estos roles? ----------------
--    Vive en un esquema privado para que no se pueda llamar desde la API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.has_role(roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_roles
    where user_id = auth.uid() and role = any (roles)
  );
$$;
revoke all on function private.has_role(text[]) from public, anon;
grant execute on function private.has_role(text[]) to authenticated;
drop function if exists public.has_role(text[]) cascade;

-- 5. Reglas de seguridad (RLS) -----------------------------------------
alter table public.players    enable row level security;
alter table public.team_roles enable row level security;
alter table public.rounds     enable row level security;

-- Jugadoras: solo las del equipo (con sesión) ven los perfiles;
-- cada una crea y cambia el suyo; la dueña puede corregir o borrar cualquiera.
drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
drop policy if exists "players_update" on public.players;
drop policy if exists "players_delete" on public.players;
create policy "players_select" on public.players for select to authenticated using (true);
create policy "players_insert" on public.players for insert to authenticated with check (id = auth.uid());
create policy "players_update" on public.players for update to authenticated
  using (id = (select auth.uid()) or private.has_role(array['owner']))
  with check (id = (select auth.uid()) or private.has_role(array['owner']));
create policy "players_delete" on public.players for delete to authenticated using (private.has_role(array['owner']));

-- Roles: las del equipo los ven; solo la dueña nombra o quita capitanas.
drop policy if exists "roles_select" on public.team_roles;
drop policy if exists "roles_insert" on public.team_roles;
drop policy if exists "roles_delete" on public.team_roles;
create policy "roles_select" on public.team_roles for select to authenticated using (true);
create policy "roles_insert" on public.team_roles for insert to authenticated
  with check (private.has_role(array['owner']) and role = 'captain');
create policy "roles_delete" on public.team_roles for delete to authenticated
  using (private.has_role(array['owner']) and role = 'captain');

-- Jornadas: cualquiera puede ver los resultados del equipo (la web es pública);
-- solo la dueña y las capitanas hacen alineaciones y apuntan resultados.
drop policy if exists "rounds_select" on public.rounds;
drop policy if exists "rounds_insert" on public.rounds;
drop policy if exists "rounds_update" on public.rounds;
create policy "rounds_select" on public.rounds for select to anon, authenticated using (true);
create policy "rounds_insert" on public.rounds for insert to authenticated
  with check (private.has_role(array['owner', 'captain']));
create policy "rounds_update" on public.rounds for update to authenticated
  using (private.has_role(array['owner', 'captain']))
  with check (private.has_role(array['owner', 'captain']));

-- 6. Permisos de la API ------------------------------------------------
revoke all on public.players, public.team_roles from anon;
grant select on public.rounds to anon;
grant select, insert, update, delete on public.players, public.team_roles, public.rounds to authenticated;
