-- ═══════════════════════════════════════════════════════════════════
--  Paso final: hacer a Lucía dueña de la web.
--  Ejecuta esto en el SQL Editor DESPUÉS de haber creado tu propio
--  usuario en Authentication → Users. Si tu email es otro, cámbialo abajo.
-- ═══════════════════════════════════════════════════════════════════
insert into public.team_roles (user_id, role)
select id, 'owner' from auth.users where email = 'luciacarreraguillen@gmail.com'
on conflict (user_id) do update set role = 'owner';

-- Comprobación: debe salir una fila con tu email y el rol "owner".
select u.email, r.role
from public.team_roles r join auth.users u on u.id = r.user_id;
