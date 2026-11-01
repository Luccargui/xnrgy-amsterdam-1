# XNRGY Amsterdam 1 · web del equipo

Web del equipo de pádel XNRGY Amsterdam 1 (AA Drink Winter Padel 2026/2027, Padel Dames Zaterdag 3e klasse).
Está alojada en GitHub Pages y guarda los datos en Supabase.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La web entera (diseño, textos en ES/EN/TR/NL y funcionamiento) |
| `config.js` | Dirección y clave pública de Supabase |
| `flags.json`, `regions.json` | Banderas y lista de regiones |
| `vendor/` | Librería de Supabase |
| `supabase-setup.sql` | Crea las tablas, los roles (dueña, capitanas, jugadoras), las solicitudes de acceso y las reglas de seguridad |
| `supabase-owner.sql` | Te hace dueña de la web (se ejecuta una vez) |
| `supabase-rivals.sql` | Jugadoras de los equipos rivales (de MijnKNLTB) para elegir contra quién se jugó |
| `supabase-reset-password.sql` | Pone una contraseña provisional a una jugadora que la ha olvidado |

## Cómo entra una jugadora nueva

1. Abre la web, va a **Mi perfil → Crear cuenta** y pone su nombre, apellidos, email y contraseña.
2. Su cuenta queda **pendiente**: no ve la plantilla ni los datos de contacto.
3. Tú o una capitana la aprobáis en **Alineaciones → Solicitudes de acceso**.
4. Al volver a entrar, ya puede rellenar su perfil y ver sus partidos.

Ajustes necesarios en Supabase → **Authentication**:
- **Allow new users to sign up**: activado.
- **Confirm email**: desactivado. El servicio de email gratuito de Supabase solo envía correos a los miembros de tu cuenta de Supabase, así que la confirmación no les llegaría a las jugadoras.

## Si una jugadora olvida la contraseña

Abre `supabase-reset-password.sql`, cambia el email y la contraseña, pégalo en **SQL Editor** y pulsa **Run**.

## Roles y privacidad

- **Administradora:** Lucía.
- **Capitana:** Rose. Solo la administradora puede cambiar quién es la capitana.
- **Managers:** Irviani y quien nombréis. Tienen los mismos permisos que la capitana.

En la web, ve a **Alineaciones → Equipo y roles** para cambiar el rol de cada jugadora.

| | Administradora | Capitana y managers | Jugadoras |
|---|---|---|---|
| Aprobar cuentas nuevas | Sí | Sí | No |
| Hacer alineaciones y apuntar resultados | Sí | Sí | No |
| Nombrar o quitar managers | Sí | Sí | No |
| Nombrar a la capitana | Sí | No | No |
| Ver foto, banderas, nombre, lado y mano de todas | Sí | Sí | Sí |
| Ver teléfono, email y nº KNLTB de todas | Sí | Sí | Solo los suyos |

El teléfono, el email y el número KNLTB se guardan en una tabla aparte (`player_contacts`) que solo pueden leer la propia jugadora, la administradora, la capitana y las managers.

## Ten en cuenta

- El plan gratuito de Supabase pausa el proyecto si pasa una semana sin que nadie use la web. Se reactiva desde el panel de Supabase con el botón **Restore project**.
- La clave de `config.js` es la pública (publishable/anon). Nunca pongas ahí la clave secreta ni la `service_role`.

Banderas: [Vexillo](https://github.com/kreativekorp/vexillo) (MPL-2.0), [region-flags](https://github.com/fonttools/region-flags), regiones de [country-region-data](https://github.com/country-regions/country-region-data) (MIT), [supabase-js](https://github.com/supabase/supabase-js) (MIT).
