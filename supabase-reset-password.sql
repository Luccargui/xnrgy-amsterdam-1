-- ═══════════════════════════════════════════════════════════════════
--  Poner una contraseña provisional nueva a una jugadora que ha
--  olvidado la suya. Cambia el email y la contraseña, y pulsa Run en
--  Supabase → SQL Editor. Después díselas a ella: al entrar puede
--  cambiarla por una suya desde "Mi perfil → Cambiar contraseña".
-- ═══════════════════════════════════════════════════════════════════
update auth.users
set encrypted_password = extensions.crypt('Provisional-2026', extensions.gen_salt('bf')),
    updated_at = now()
where email = 'email.de.la.jugadora@ejemplo.com';

-- Debe salir "UPDATE 1". Si sale "UPDATE 0", el email no está bien escrito.
