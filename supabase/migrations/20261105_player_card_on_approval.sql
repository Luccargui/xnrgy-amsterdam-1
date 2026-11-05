-- Al aprobar a una jugadora (nuevo rol en team_roles) se crea su ficha con el nombre de la solicitud,
-- para que salga en Jugadoras y en las alineaciones aunque todavía no haya rellenado "Mis datos".
-- País y región pasan a ser opcionales en la base de datos (la web los sigue exigiendo en el formulario).
alter table public.players alter column country drop not null;
alter table public.players alter column region drop not null;

create or replace function private.player_card_on_role()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_first text; v_last text;
begin
  select left(trim(jr.first_name), 60), left(trim(jr.last_name), 80) into v_first, v_last
    from public.join_requests jr where jr.user_id = new.user_id;
  if coalesce(v_first, '') = '' or coalesce(v_last, '') = '' then
    select left(trim(u.raw_user_meta_data->>'first_name'), 60), left(trim(u.raw_user_meta_data->>'last_name'), 80)
      into v_first, v_last from auth.users u where u.id = new.user_id;
  end if;
  if coalesce(v_first, '') = '' or coalesce(v_last, '') = '' then return new; end if;
  insert into public.players (id, first_name, last_name) values (new.user_id, v_first, v_last) on conflict (id) do nothing;
  return new;
exception when others then return new;
end; $$;
revoke all on function private.player_card_on_role() from public, anon, authenticated;

drop trigger if exists team_role_player_card on public.team_roles;
create trigger team_role_player_card after insert on public.team_roles
  for each row execute function private.player_card_on_role();
