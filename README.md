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
| `supabase-setup.sql` | Crea las tablas y las reglas de seguridad (se ejecuta una vez) |
| `supabase-owner.sql` | Te hace dueña de la web (se ejecuta una vez) |
| `supabase-reset-password.sql` | Pone una contraseña provisional a una jugadora que la ha olvidado |

## Cómo se da de alta a una jugadora

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Escribe su email y una contraseña provisional, y marca **Auto Confirm User**.
3. Pásale el enlace de la web, su email y la contraseña provisional.
4. Ella entra en **Mi perfil**, rellena sus datos y cambia la contraseña.

## Si una jugadora olvida la contraseña

Abre `supabase-reset-password.sql`, cambia el email y la contraseña, pégalo en **SQL Editor** y pulsa **Run**.

## Capitanas

En la web, con tu sesión iniciada, ve a **Alineaciones** y marca quién más puede hacer alineaciones.

## Ten en cuenta

- El plan gratuito de Supabase pausa el proyecto si pasa una semana sin que nadie use la web. Se reactiva desde el panel de Supabase con el botón **Restore project**.
- La clave de `config.js` es la pública (publishable/anon). Nunca pongas ahí la clave secreta ni la `service_role`.

Banderas: [Vexillo](https://github.com/kreativekorp/vexillo) (MPL-2.0), [region-flags](https://github.com/fonttools/region-flags), regiones de [country-region-data](https://github.com/country-regions/country-region-data) (MIT), [supabase-js](https://github.com/supabase/supabase-js) (MIT).
