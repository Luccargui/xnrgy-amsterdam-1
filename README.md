# XNRGY Amsterdam 1 · web del equipo

Web del equipo de pádel XNRGY Amsterdam 1 (AA Drink Winter Padel 2026/2027, Padel Dames Zaterdag 3e klasse).
Está en **https://xnrgyams1.com** (alojada en GitHub Pages; el dominio está en Porkbun) y guarda los datos en Supabase.
Email del equipo: team@xnrgyams1.com e info@xnrgyams1.com (reenvío de Porkbun a Gmail).

## Qué hay en cada archivo

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño (modo oscuro y claro, móvil y escritorio) |
| `i18n.js` | Textos en ES/EN/TR/NL y política de privacidad |
| `app.js` | Funcionamiento de la web |
| `sw.js` | Service worker: avisos push y app instalable |
| `tools/bump-version.sh` | Sube la versión tras cada cambio (las jugadoras reciben la web nueva sin borrar caché) |
| `config.js` | Dirección y clave pública de Supabase, clave pública de los avisos y clave del CAPTCHA |
| `flags/`, `flags-index.json`, `regions.json` | Banderas (una imagen por país/región) y lista de regiones |
| `fonts/` | Fuentes Barlow y Barlow Condensed servidas desde la web (sin Google Fonts) · SIL Open Font License |
| `og-image.jpg` | Imagen que se ve al compartir el enlace en WhatsApp y redes |
| `favicon.svg`, `*.png`, `site.webmanifest` | Icono de la web y de la app en el móvil |
| `vendor/` | Librería de Supabase |
| `supabase-setup.sql` | Crea las tablas, los roles (dueña, capitanas, jugadoras), las solicitudes de acceso y las reglas de seguridad |
| `supabase-owner.sql` | Te hace dueña de la web (se ejecuta una vez) |
| `supabase-extras.sql` | Disponibilidad y coches, quedada, clasificación, suscripción al calendario y última visita |
| `supabase/functions/calendar/` | Función que genera el calendario personal (.ics) de cada jugadora |
| `supabase/functions/notify/` | Avisos push: alineación publicada, recordatorio de disponibilidad (cada día a las 18:00, 4 días antes de cada jornada) y prueba |
| `404.html` | Página de error con el estilo de la web |
| `.github/workflows/supabase-keepalive.yml` | Mantiene Supabase activo mientras haya visitas en los últimos 3 meses |
| `supabase-rivals.sql` | Jugadoras de los equipos rivales (de MijnKNLTB) para elegir contra quién se jugó |
| `supabase-reset-password.sql` | Pone una contraseña provisional a una jugadora que la ha olvidado |

## Cómo entra una jugadora nueva

1. Abre la web, va a **Mi perfil → Crear cuenta** y pone su nombre, apellidos, email y contraseña.
2. Su cuenta queda **pendiente**: no ve la plantilla ni los datos de contacto.
3. Tú o una capitana la aprobáis en **Alineaciones → Solicitudes de acceso**.
4. Al volver a entrar, ya puede rellenar su perfil y ver sus partidos.

Ajustes necesarios en Supabase → **Authentication**:
- **Allow new users to sign up**: activado.
- **Confirm email**: activado. Los emails salen por Brevo (SMTP `smtp-relay.brevo.com:587`) desde `team@xnrgyams1.com`, con las plantillas de `email-templates/`.
- **URL Configuration**: Site URL `https://xnrgyams1.com` y Redirect URLs `https://xnrgyams1.com/**` y `https://www.xnrgyams1.com/**`.

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

## Privacidad

La política de privacidad está en la propia web (`#privacidad`, enlazada en el pie). Al crear una cuenta hay que aceptarla; la fecha y la versión aceptadas se guardan en los datos de la cuenta en Supabase (`privacy_accepted_at`, `privacy_version`). Si cambias la política, actualiza `PRIVACY_VERSION` en `index.html`.

## Ten en cuenta

- El plan gratuito de Supabase pausa el proyecto tras 7 días sin uso. El proceso «Mantener Supabase activo» (GitHub Actions, cada lunes) lo evita mientras haya habido visitas en los últimos 90 días; si pasan más de 3 meses sin visitas, se desactiva y Supabase se pausa. Para volver: Supabase → **Restore project** y GitHub → Actions → «Mantener Supabase activo» → **Enable workflow**.
- La web no aparece en Google (`noindex`).
- La clave de `config.js` es la pública (publishable/anon). Nunca pongas ahí la clave secreta ni la `service_role`.

Banderas: [Vexillo](https://github.com/kreativekorp/vexillo) (MPL-2.0), [region-flags](https://github.com/fonttools/region-flags), regiones de [country-region-data](https://github.com/country-regions/country-region-data) (MIT), [supabase-js](https://github.com/supabase/supabase-js) (MIT).

## Novedades (noviembre 2026)

- **Fotos** en Supabase Storage (bucket privado `photos`): solo las ven jugadoras aprobadas, con enlaces firmados que el navegador guarda 7 días.
- **Edición simultánea**: si dos capitanas guardan la misma jornada, la segunda recibe un aviso y puede recargar, en lugar de borrar los cambios de la otra.
- **App instalable y avisos push** (Mi perfil → App y avisos). En iPhone hace falta añadir la web a la pantalla de inicio primero.
- **Portada personalizada** con sesión iniciada y **barra inferior** en el móvil.
- **«He visto la alineación»**: la capitana ve un ✓ junto a cada jugadora.
- **CAPTCHA invisible** (Cloudflare Turnstile) en entrar/crear cuenta: se activa al poner `turnstileSiteKey` en `config.js` y la clave secreta en Supabase → Authentication → Attack Protection.

## Novedades (5 noviembre 2026)

- **Calendario editable**: las jornadas están en la tabla `fixtures` de Supabase. La capitana o las managers las cambian en **Alineaciones → Calendario de la liga**; la web, los calendarios suscritos y los avisos leen de ahí.
- **Resultados por pareja**: cada pareja apunta su resultado en **Mis partidos** desde el día del partido (función `submit_pair_result`). La capitana lo ve marcado como pendiente y lo confirma al guardar la jornada.
- **Perfil en pestañas** (Partidos · Disponibilidad · Mis datos), **ficha de cada jugadora** al pulsar su tarjeta y **primeros pasos** en la portada para las nuevas.
- **Registro de errores**: si la web falla en el móvil de alguien, queda en la tabla `client_errors` (se borra a los 90 días).
- **Prueba automática**: `.github/workflows/smoke-test.yml` abre la web en móvil y escritorio, claro y oscuro y en los 4 idiomas en cada cambio (`tests/smoke.mjs`). Si algo se rompe, GitHub avisa por email.
