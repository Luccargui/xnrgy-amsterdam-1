-- ═══════════════════════════════════════════════════════════════════
--  XNRGY Amsterdam 1 · configuración de Supabase
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
--
--  Cómo funciona el acceso:
--   · Cualquiera puede crearse una cuenta desde la web, pero no ve nada
--     privado hasta que la dueña o una capitana la aprueba.
--   · Roles: owner (dueña de la web), captain (capitana), manager, player (jugadora).
--   · Dueña, capitana y managers aprueban cuentas, hacen alineaciones y ven
--     los datos de contacto de todas. También pueden nombrar managers.
--     Solo la dueña nombra a la capitana.
--   · Las jugadoras ven de las demás solo la foto, las banderas, el nombre,
--     el lado de la pista y la mano.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Perfiles de las jugadoras (uno por cuenta) ------------------------
create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 60),
  last_name   text not null check (char_length(last_name) between 1 and 80),
  side        text not null check (side in ('left', 'right', 'any')),
  hand        text not null check (hand in ('left', 'right', 'both')),
  country     text not null check (country ~ '^[A-Z]{2}$'),
  region      text not null check (char_length(region) between 1 and 10),
  region_name text check (char_length(region_name) <= 120),
  photo       text check (photo is null or (char_length(photo) <= 200000 and photo like 'data:image/%')),
  updated_at  timestamptz not null default now()
);

-- 1b. Datos de contacto (solo los ven ella misma, la dueña y las capitanas)
create table if not exists public.player_contacts (
  id         uuid primary key references public.players (id) on delete cascade,
  phone      text not null check (char_length(phone) between 6 and 25),
  email      text not null check (char_length(email) between 3 and 120),
  knltb      text not null check (knltb ~ '^[0-9]{6,10}$'),
  updated_at timestamptz not null default now()
);
-- Instalaciones antiguas guardaban el contacto dentro de players: se mueve aquí.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'phone') then
    insert into public.player_contacts (id, phone, email, knltb)
      select id, phone, email, knltb from public.players
      on conflict (id) do nothing;
    alter table public.players drop column phone, drop column email, drop column knltb;
  end if;
end $$;

-- 2. Roles: dueña, capitanas y jugadoras aprobadas ---------------------
create table if not exists public.team_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null
);
alter table public.team_roles drop constraint if exists team_roles_role_check;
alter table public.team_roles add constraint team_roles_role_check check (role in ('owner', 'captain', 'manager', 'player'));

-- 3. Solicitudes de acceso de las cuentas nuevas -----------------------
create table if not exists public.join_requests (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name  text not null check (char_length(last_name) between 1 and 80),
  email      text not null check (char_length(email) between 3 and 120),
  created_at timestamptz not null default now()
);

-- 4. Jornadas: alineaciones y resultados --------------------------------
create table if not exists public.rounds (
  r          int primary key check (r between 1 and 30),
  pairs      jsonb not null default '[]'::jsonb,
  results    jsonb not null default '[]'::jsonb,
  us         int check (us between 0 and 99),
  them       int check (them between 0 and 99),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- 5. ¿Tiene la persona conectada alguno de estos roles? ----------------
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

-- 6. Reglas de seguridad (RLS) -----------------------------------------
alter table public.players       enable row level security;
alter table public.team_roles    enable row level security;
alter table public.join_requests enable row level security;
alter table public.rounds        enable row level security;
alter table public.player_contacts enable row level security;

-- Jugadoras: solo las aprobadas ven los perfiles; cada una crea y cambia
-- el suyo; la dueña puede corregir o borrar cualquiera.
drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
drop policy if exists "players_update" on public.players;
drop policy if exists "players_delete" on public.players;
create policy "players_select" on public.players for select to authenticated
  using (private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "players_insert" on public.players for insert to authenticated
  with check (id = (select auth.uid()) and private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "players_update" on public.players for update to authenticated
  using (id = (select auth.uid()) or private.has_role(array['owner']))
  with check (id = (select auth.uid()) or private.has_role(array['owner']));
create policy "players_delete" on public.players for delete to authenticated
  using (private.has_role(array['owner']));

-- Contacto: cada una ve y cambia el suyo; dueña y capitanas ven los de todas.
drop policy if exists "contacts_select" on public.player_contacts;
drop policy if exists "contacts_insert" on public.player_contacts;
drop policy if exists "contacts_update" on public.player_contacts;
drop policy if exists "contacts_delete" on public.player_contacts;
create policy "contacts_select" on public.player_contacts for select to authenticated
  using (id = (select auth.uid()) or private.has_role(array['owner', 'captain', 'manager']));
create policy "contacts_insert" on public.player_contacts for insert to authenticated
  with check (id = (select auth.uid()) and private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "contacts_update" on public.player_contacts for update to authenticated
  using (id = (select auth.uid()) or private.has_role(array['owner']))
  with check (id = (select auth.uid()) or private.has_role(array['owner']));
create policy "contacts_delete" on public.player_contacts for delete to authenticated
  using (private.has_role(array['owner']));

-- Roles: cada una ve el suyo y las aprobadas ven todos.
-- Dueña, capitana y managers aprueban jugadoras y nombran managers;
-- solo la dueña nombra o quita a la capitana.
drop policy if exists "roles_select" on public.team_roles;
drop policy if exists "roles_insert" on public.team_roles;
drop policy if exists "roles_update" on public.team_roles;
drop policy if exists "roles_delete" on public.team_roles;
create policy "roles_select" on public.team_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(array['owner', 'captain', 'manager', 'player']));
create policy "roles_insert" on public.team_roles for insert to authenticated
  with check (
    (role in ('player', 'manager') and private.has_role(array['owner', 'captain', 'manager']))
    or (role = 'captain' and private.has_role(array['owner']))
  );
create policy "roles_update" on public.team_roles for update to authenticated
  using (
    (role in ('player', 'manager') and private.has_role(array['owner', 'captain', 'manager']))
    or (role in ('player', 'manager', 'captain') and private.has_role(array['owner']))
  )
  with check (
    (role in ('player', 'manager') and private.has_role(array['owner', 'captain', 'manager']))
    or (role in ('player', 'manager', 'captain') and private.has_role(array['owner']))
  );
create policy "roles_delete" on public.team_roles for delete to authenticated
  using (
    (role in ('player', 'manager') and private.has_role(array['owner', 'captain', 'manager']))
    or (role = 'captain' and private.has_role(array['owner']))
  );

-- Solicitudes: cada cuenta nueva crea la suya y la ve;
-- dueña y capitanas las ven todas y las borran al aprobar o rechazar.
drop policy if exists "requests_select" on public.join_requests;
drop policy if exists "requests_insert" on public.join_requests;
drop policy if exists "requests_update" on public.join_requests;
drop policy if exists "requests_delete" on public.join_requests;
create policy "requests_select" on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(array['owner', 'captain', 'manager']));
create policy "requests_insert" on public.join_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "requests_update" on public.join_requests for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "requests_delete" on public.join_requests for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_role(array['owner', 'captain', 'manager']));

-- Jornadas: cualquiera ve los resultados del equipo (la web es pública);
-- solo la dueña y las capitanas hacen alineaciones y apuntan resultados.
drop policy if exists "rounds_select" on public.rounds;
drop policy if exists "rounds_insert" on public.rounds;
drop policy if exists "rounds_update" on public.rounds;
create policy "rounds_select" on public.rounds for select to anon, authenticated using (true);
create policy "rounds_insert" on public.rounds for insert to authenticated
  with check (private.has_role(array['owner', 'captain', 'manager']));
create policy "rounds_update" on public.rounds for update to authenticated
  using (private.has_role(array['owner', 'captain', 'manager']))
  with check (private.has_role(array['owner', 'captain', 'manager']));

-- 7. Permisos de la API ------------------------------------------------
revoke all on public.players, public.player_contacts, public.team_roles, public.join_requests from anon;
grant select on public.rounds to anon;
grant select, insert, update, delete on public.players, public.player_contacts, public.team_roles, public.join_requests, public.rounds to authenticated;
