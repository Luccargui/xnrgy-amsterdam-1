-- La jugadora rellena su ficha al crear la cuenta (va en los metadatos de la cuenta, clave "profile").
-- Al aprobarla, la ficha y sus contactos se crean con esos datos ya comprobados, y se borran de los metadatos.
create or replace function private.player_card_on_role()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  md jsonb; pf jsonb; v_email text;
  v_first text; v_last text;
  v_country text; v_region text; v_region_name text; v_side text; v_hand text; v_bday date;
  v_phone text; v_knltb text;
begin
  select coalesce(u.raw_user_meta_data, '{}'::jsonb), u.email into md, v_email from auth.users u where u.id = new.user_id;
  md := coalesce(md, '{}'::jsonb);
  pf := case when jsonb_typeof(md->'profile') = 'object' then md->'profile' else '{}'::jsonb end;

  v_first := left(trim(md->>'first_name'), 60); v_last := left(trim(md->>'last_name'), 80);
  if coalesce(v_first, '') = '' or coalesce(v_last, '') = '' then
    select left(trim(jr.first_name), 60), left(trim(jr.last_name), 80) into v_first, v_last
      from public.join_requests jr where jr.user_id = new.user_id;
  end if;
  if coalesce(v_first, '') = '' or coalesce(v_last, '') = '' then
    return new; -- sin nombre no se crea nada: la ficha llegará cuando ella guarde su perfil
  end if;

  -- Los metadatos los escribe la propia usuaria: solo se usa lo que cumple las reglas de la tabla
  v_country := upper(trim(pf->>'country'));
  if v_country is null or v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  v_region := left(trim(pf->>'region'), 10);
  if v_country is null or coalesce(v_region, '') = '' then v_country := null; v_region := null; end if;
  v_region_name := case when v_region is null then null else nullif(left(trim(pf->>'region_name'), 120), '') end;
  v_side := pf->>'side'; if v_side is null or v_side not in ('left', 'right', 'any') then v_side := null; end if;
  v_hand := pf->>'hand'; if v_hand is null or v_hand not in ('left', 'right', 'both') then v_hand := null; end if;
  begin v_bday := nullif(pf->>'birthday', '')::date; exception when others then v_bday := null; end;
  if v_bday is not null and (v_bday < date '1930-01-01' or v_bday > date '2025-12-31') then v_bday := null; end if;
  v_phone := nullif(left(trim(pf->>'phone'), 25), '');
  if v_phone is not null and char_length(v_phone) < 6 then v_phone := null; end if;
  v_knltb := regexp_replace(coalesce(pf->>'knltb', ''), '\s', '', 'g');
  if v_knltb !~ '^[0-9]{6,10}$' then v_knltb := null; end if;
  if v_email is not null and char_length(v_email) not between 3 and 120 then v_email := null; end if;

  begin
    insert into public.players (id, first_name, last_name, country, region, region_name, side, hand, birthday)
      values (new.user_id, v_first, v_last, v_country, v_region, v_region_name, v_side, v_hand, v_bday)
      on conflict (id) do nothing;
  exception when others then
    insert into public.players (id, first_name, last_name) values (new.user_id, v_first, v_last) on conflict (id) do nothing;
  end;
  begin
    insert into public.player_contacts (id, phone, email, knltb) values (new.user_id, v_phone, v_email, v_knltb)
      on conflict (id) do nothing;
  exception when others then null;
  end;
  -- Ya está en su ficha: no se guarda dos veces
  if md ? 'profile' then
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'profile' where id = new.user_id;
  end if;
  return new;
exception when others then
  return new; -- crear la ficha nunca debe impedir aprobar a alguien
end; $$;
revoke all on function private.player_card_on_role() from public, anon, authenticated;
