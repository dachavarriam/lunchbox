# Changelog

Registro de trabajo de seguridad/privacidad (rama `security-upgrades`) y de las mejoras funcionales que le siguieron (rama `functional-upgrades`) — ambas ya fusionadas a `main`. Sirve de base para documentación formal más adelante.

## [Unreleased] — rama `final-audit`

### 2026-10-23 — auditoría final de seguridad y privacidad (tras Seguridad + Funcional)

Revisión de cierre pedida explícitamente para revisar cómo quedó la plataforma después de los bloques de Seguridad y Funcional. Se encontraron y corrigieron 3 problemas concretos; el resto son notas de endurecimiento sin cambios de código (ver mensaje al usuario con el detalle completo).

- **fix(csp):** `img-src` no incluía `blob:` — la vista previa de foto nueva de `DeliveryOrderCard` (`URL.createObjectURL`) se habría bloqueado en producción por CSP. Nunca se probó en navegador durante el trabajo de "Funcional" (solo se probó el upload real vía `curl`, no el `<img>` de vista previa). Verificado ahora en vivo: una imagen cargada como blob URL carga correctamente bajo el CSP actual, sin violaciones en consola.
  Archivos: `worker/index.ts` (`contentSecurityPolicy`).
- **fix(privacidad):** el código OTP en texto plano quedaba para siempre en `notification_outbox.payload_json` una vez enviado el correo (nunca se limpiaba). Ahora, al marcar un mensaje `login_otp` como `sent`, también se limpia `payload_json`. Cubierto con una prueba nueva.
  Archivos: `worker/email.ts`, `tests/email-outbox.test.mjs`.
- **hardening:** `TURNSTILE_SECRET_KEY` y `RESEND_API_KEY` ya están configurados en producción (confirmado por el usuario durante el trabajo de Seguridad) pero no estaban en `secrets.required`, así que si alguno se borrara por error en el dashboard de Cloudflare, el login y el OTP fallarían **en silencio** (Turnstile sin aplicar, correos sin enviarse) en vez de fallar fuerte. Se agregaron a la lista de requeridos para que una futura ausencia se note de inmediato.
  Archivos: `wrangler.jsonc`, `tests/rendered-html.test.mjs`.
- `pnpm test` (11 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

## [Unreleased] — rama `functional-upgrades` (fusionada a `main`)

### 2026-10-22 — bloque "Funcional": catálogo CSV (ya real) y rol delivery con evidencia fotográfica

- **Catálogo CSV:** se revisó el pendiente "CSV import real (solo parser del lado del cliente)" y resultó estar **desactualizado** — `app/admin-view.tsx`'s `applyImport()` ya llama a los endpoints reales `POST`/`PATCH /api/demo/admin/dishes` (`worker/cms.ts`) por cada fila; el parseo CSV solo ocurre en el navegador para mostrar una vista previa antes de aplicar. Verificado en vivo: un platillo creado vía ese endpoint persiste en D1 local. No se tocó código; se actualizó la nota en "Pendiente" para reflejar la realidad.
- **feat(delivery):** el rol `delivery` (ya invitable desde Administración) ahora tiene una pantalla real, y la entrega exige evidencia fotográfica:
  - Nueva tabla `delivery_confirmations` (foto + lista de pedidos incluidos + quién y cuándo).
  - Nuevo endpoint `POST /api/demo/delivery/confirm` (rol `admin` o `delivery`): toma la misma selección de "pedidos empacados del día más próximo" que ya usaba `kds/deliver-all`, pero exige una foto (mismo validador de firma de archivo que los comprobantes de pago: JPEG/PNG/WebP/HEIC/HEIF, hasta 5 MB), la guarda en el bucket `PAYMENT_RECEIPTS` bajo el prefijo `delivery-photos/`, y además de marcar los pedidos como entregados, registra la confirmación. `GET /api/demo/kds` ahora también es legible por el rol `delivery` (antes solo admin/cocina).
  - La pantalla de Cocina (`/cocina`) ahora distingue: si la sesión tiene **únicamente** el rol `delivery` (no `kitchen` ni `admin`), ve una pantalla de Entrega (`DeliveryView`, en `app/kitchen-view.tsx`) en vez del tablero KDS — lista los pedidos empacados, pide tomar/elegir una foto y confirmar. El botón "Confirmar entregados" de la vista normal de Cocina **no se tocó** (sigue disponible para cocina/admin sin pedir foto, para no interrumpir la operación actual mientras no haya personal con rol delivery asignado).
  - Admin ganó un panel nuevo ("Evidencia de entregas", en Configuración) que lista las confirmaciones con fecha, quién entregó y cuántos pedidos, con un enlace "Ver foto" a `GET /api/demo/admin/delivery-confirmations/:id/photo` (streaming directo del objeto R2, sin exponerlo públicamente).
  - Verificado en vivo de extremo a extremo: avancé un pedido real hasta `packed`, inicié sesión real (OTP) como usuario con rol `delivery`, confirmé la entrega con una foto de prueba vía `POST /api/demo/delivery/confirm` — el pedido quedó `delivered`, la fila en `delivery_confirmations` quedó correcta, y `GET` del admin devolvió exactamente los mismos bytes de la foto subida. Confirmé además el aislamiento de roles en ambas direcciones: una sesión con rol `kitchen` (sin `delivery`) recibe 403 en `/api/demo/delivery/confirm`, y una sesión con rol `delivery` (sin `kitchen`) recibe 403 en `/api/demo/kds/deliver-all`. La pantalla `DeliveryView` se verificó visualmente en el navegador con datos reales.
  Archivos: `migrations/0022_delivery_confirmations.sql` (nuevo), `worker/index.ts` (`/api/demo/delivery/confirm`, roles de `/cocina` y `/api/demo/kds`), `worker/cms.ts` (`/api/demo/admin/delivery-confirmations*`), `app/kitchen-view.tsx` (`DeliveryView`), `app/prototype-app.tsx` (`confirmDelivery`, selección de vista por rol), `app/admin-view.tsx` (`DeliveryConfirmationsPanel`), `app/globals.css`.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos (1 warning preexistente de estilo de Next.js por usar `<img>` para la vista previa local de la foto, correcto en este caso ya que es un blob del propio dispositivo, no una imagen remota optimizable).

### 2026-10-22 (continuación) — fix: la foto de entrega es por pedido, no por lote

- El diseño original (arriba) confirmaba la entrega de **todos** los pedidos empacados del día con **una sola foto compartida** — igual que ya hacía `kds/deliver-all`. Al revisarlo en vivo con el usuario, quedó claro que eso no sirve: dos hermanos del mismo salón (el caso real de prueba) quedaban con la misma foto genérica, que no prueba nada por pedido individual ni se le puede mostrar a cada familia como comprobante de SU pedido.
  **Corregido:** ahora cada pedido empacado se confirma —y se fotografía— por separado.
  - `delivery_confirmations` pasó de "una fila por lote con lista de IDs" a **una fila por pedido** (`order_id UNIQUE`).
  - El endpoint cambió de `POST /api/demo/delivery/confirm` (lote) a `POST /api/demo/delivery/confirm/:orderId` (un pedido, valida que esté `packed` y con pago aprobado, 404/409 si no).
  - La pantalla de Entrega (`DeliveryView`) ahora es una tarjeta por pedido, cada una con su propio "Tomar foto" + "Confirmar entrega" — no un botón único para todo el lote.
  - **Nuevo:** `GET /api/demo/orders/:id/delivery-photo`, acotado al `guardian_user_id` del pedido, para que la familia vea la foto de la entrega de *su propio* pedido desde "Mis pedidos" (enlace "Ver foto de entrega" cuando `status === 'delivered'`). Sirve tanto como comprobante para el padre como de referencia si hay un reclamo después.
  - El panel de Admin ("Evidencia de entregas") ahora muestra el número de pedido y el nombre del estudiante en vez de un conteo de lote.
  - Verificado en vivo de nuevo con los dos hermanos de prueba: confirmé la entrega de uno con una foto — el otro quedó intacto (`packed`), con su propia tarjeta esperando su propia foto. Confirmé que el padre ve `has_delivery_photo: true` solo en el pedido ya confirmado, que puede descargar exactamente esos bytes desde `/api/demo/orders/:id/delivery-photo`, y que un padre *distinto* (sesión real, no relacionado con ese pedido) recibe 404 al intentar verla — no revela ni que existe.
  Archivos: `migrations/0022_delivery_confirmations.sql` (reescrita antes de compartirse), `worker/index.ts`, `worker/cms.ts`, `app/kitchen-view.tsx`, `app/prototype-app.tsx`, `app/admin-view.tsx`, `app/pipiro-shared.tsx`, `app/globals.css`.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

## [Unreleased] — rama `security-upgrades` (fusionada a `main`)

### 2026-10-22 (continuación 4) — primer despliegue real y ajustes post-deploy

- Desplegado con `vinext deploy` a los tres dominios de producción. Login con Google + Turnstile probado en vivo por el usuario — funcional.
- **fix(csp):** la consola mostró un bloqueo real: `static.cloudflareinsights.com/beacon.min.js` (Cloudflare Web Analytics, inyectado automáticamente por la zona) violaba `script-src`. Primer intento: agregar la ruta exacta `.../beacon.min.js` — seguía bloqueado, porque Cloudflare carga el script como `.../beacon.min.js/<token>` (el token va en la ruta, no en `?query`), y el CSP hace coincidencia exacta de ruta, no por prefijo. Verificado en vivo que seguía fallando antes de corregirlo. Solución final: permitir el origen completo `https://static.cloudflareinsights.com`. Su beacon postea a `/cdn-cgi/rum` del propio dominio, ya cubierto por `connect-src 'self'`.
  Archivos: `worker/index.ts` (`contentSecurityPolicy`).
- El resto de los errores de consola reportados **no son de Pipiro**: avisos de "Unrecognized feature" en Permissions-Policy vienen de `accounts.google.com`; los de `TrustedTypePolicy`/`content_script_bin.js`/`tag_assistant_api_bin.js` son de una extensión de Chrome del usuario (parece Tag Assistant); los de `hagen/brunhild.challenges.cloudflare.com`, fuentes WOFF y "No available adapters" son internos al iframe del propio widget de Turnstile, con su propia política, no la nuestra.
- Se aprovechó para arreglar el único error de tipos preexistente en la rama (`body.subject` perdía su narrowing de tipo dentro de un callback de `.flatMap`) y para agregar `.dev.vars*` a `.gitignore` (el README ya prometía que no se versionaría, pero no estaba excluido).
- Se investigó colapsar `DEMO_MODE` como parte de esta limpieza y se descartó: `/api/demo/*` es toda la API real de la app, no datos de prueba — apagar esa variable apaga el sitio completo. El verdadero atajo sin login en `worker/auth.ts` ya exige `DEMO_MODE` **y** un host privado (localhost/LAN/Tailscale) a la vez, algo que un dominio de producción nunca puede cumplir.

### 2026-10-22 (continuación 5) — Seguridad/cuentas: cuenta bancaria, sesiones activas, login por correo

- **fix(privacidad):** el número de cuenta bancaria para transferencias (expuesto en `/api/public/config`, sin requerir sesión) ahora solo se incluye si la petición trae una sesión válida (`resolveSession`). Antes cualquiera que visitara el dominio público podía leerlo sin iniciar sesión.
  Archivos: `worker/index.ts` (`/api/public/config`).
- **feat(cuenta):** nuevo diálogo "Mi cuenta" en la superficie de familias: lista las sesiones activas del usuario (dispositivo/navegador aproximado, primera vez vista, última actividad, cuál es la actual) y permite cerrar cualquiera de las otras. Dos endpoints nuevos, `GET /api/auth/sessions` y `POST /api/auth/sessions/:id/revoke`, ambos acotados por `user_id` (probado en vivo contra D1 local, incluyendo un intento real de revocar la sesión de otro usuario, que fue correctamente rechazado). `auth_sessions` ahora guarda `user_agent` y refresca `last_seen_at` de forma perezosa (como máximo una vez al día por sesión) para no escribir en cada request.
  Archivos: `migrations/0020_session_user_agent.sql` (nuevo), `worker/auth.ts` (`createSession`, `GET/POST /api/auth/sessions*`), `app/prototype-app.tsx` (`AccountDialog`), `app/globals.css`.
- **feat(login):** login por correo con código de un solo uso (OTP), como alternativa a Google para quien no usa o no quiere usar Gmail. Flujo: `POST /api/auth/email/start` (correo + Turnstile) genera un código de 6 dígitos, lo guarda **solo como hash** en `email_otp_codes` (vence a los 10 minutos) y lo encola para envío inmediato por correo; `POST /api/auth/email/verify` (correo + código) lo valida en tiempo constante, bloquea después de 5 intentos fallidos, y en caso de éxito crea la sesión reutilizando exactamente la misma lógica de vinculación/invitación que ya usaba el login de Google (cuentas nuevas solo se crean automáticamente en la superficie de familias; Admin/Cocina exigen invitación previa). Ambos endpoints están limitados por IP y por correo (reutilizando el rate limiter de D1) y devuelven siempre la misma respuesta genérica de error, para no revelar si un correo tiene cuenta o no.
  - El widget de Turnstile se extrajo a un hook compartido (`useTurnstile`) para que el botón de Google y el formulario de correo mantengan widgets independientes sin duplicar la lógica de carga del script.
  - `worker/email.ts` ahora soporta plantillas con contenido dinámico (antes solo texto fijo) para poder incluir el código en el cuerpo del correo.
  - Verificado de extremo a extremo contra D1 local: código generado, hash verificado correctamente, reintento con código equivocado rechazado de forma genérica, reutilización del mismo código rechazada tras consumirlo, bloqueo tras 5 intentos fallidos (incluso con el código correcto), y la sesión creada resuelve correctamente contra `/api/auth/session`.
  Archivos: `migrations/0021_email_otp_codes.sql` (nuevo), `worker/auth.ts` (`/api/auth/email/start`, `/api/auth/email/verify`), `worker/email.ts` (plantillas dinámicas), `worker/index.ts` (`ctx` pasado a `handleAuthApi`), `app/use-turnstile.ts` (nuevo), `app/email-login-form.tsx` (nuevo), `app/login-methods.tsx` (nuevo), `app/google-login-button.tsx`, `app/login/page.tsx`, `app/globals.css`.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### 2026-10-22 (continuación 6) — reautenticación para acciones de Admin de alto riesgo

- **feat(seguridad):** las sesiones de Admin duran 7 días, pero un puñado de acciones especialmente sensibles ahora exige que el *login* (no solo la sesión) haya ocurrido en los últimos 30 minutos — si no, el servidor responde `401 { error: "reauth_required" }` y el panel manda al administrador de vuelta a `/login` (Google u OTP) antes de dejarlo continuar; al volver a entrar se crea una sesión nueva y la acción ya puede completarse. No hay contraseña que re-pedir (el login es Google o el OTP por correo recién construido), así que "reautenticar" aquí significa "sesión reciente", no "vuelve a escribir tu clave".
  - Acciones cubiertas: invitar personal con rol `admin` o `kitchen` (no `delivery`, que es de menor privilegio), aprobar/rechazar/marcar discrepancia en pagos, cancelar un pago/pedido, y crear o editar una cuenta bancaria para transferencias.
  - `resolveSession` ahora calcula `fresh` directamente en SQL (`auth_sessions.created_at > datetime('now', '-30 minutes')`); el bypass de modo demo (solo hosts privados) se considera siempre "fresco" porque no hay sesión real que expirar.
  - Verificado en vivo contra D1 local: con una sesión de prueba de 2 horas de antigüedad, las 4 acciones de alto riesgo devuelven `401 reauth_required`; tras refrescar `created_at` a "ahora", las mismas peticiones tienen éxito; invitar con rol `delivery` nunca pide reautenticación; una lectura normal (`GET /api/demo/admin/staff`) nunca se bloquea.
  Archivos: `worker/auth.ts` (`requireFreshAuth`, `resolveSession`), `worker/cms.ts` (los 5 puntos de inserción), `app/admin-view.tsx` (`throwIfReauthRequired`, redirección a `/login`), `app/login/page.tsx`, `app/globals.css` (`.login-notice`).
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### 2026-10-22

- **fix(service-worker):** el service worker ya no cachea respuestas de `/api/*`. Antes guardaba en Cache Storage cualquier GET exitoso del mismo origen, incluyendo datos de alergias y estudiantes (`/api/demo/bootstrap`), analíticas de Administración y las imágenes de comprobantes de pago. Ahora solo se cachean el app shell estático (`/`, `/manifest.webmanifest`, íconos) y los bundles compilados bajo `/assets/`. Se incrementó la versión de caché (`v6` → `v7`) para forzar, en el siguiente arranque, la purga de cualquier dato sensible que ya estuviera cacheado en dispositivos existentes.
  Archivos: `public/sw.js`.
- **fix(auth):** al cerrar sesión se elimina toda la Cache Storage del navegador y el borrador de pedido guardado en `localStorage` (`pipiro:order-draft:v1`), para que un dispositivo compartido no arrastre datos de la sesión anterior.
  Archivos: `app/prototype-app.tsx`.
- Verificado en navegador: tras el cambio, `/api/demo/bootstrap` ya no aparece en ninguna entrada de Cache Storage; la rutina de limpieza de logout purga correctamente una caché de prueba con datos de una versión anterior.
- `tsc --noEmit` y `pnpm run lint` sin errores nuevos (queda un error preexistente en `worker/index.ts:794`, no relacionado con este trabajo).

- **fix(auth):** la sesión expira a los 7 días en vez de 30.
  Archivos: `worker/auth.ts` (`SESSION_SECONDS`).
- **refactor(bundle-split):** Admin y Cocina ya no comparten bundle con el Cliente. Antes toda la UI (familias, Administración, KDS) vivía en un solo archivo (`app/prototype-app.tsx`, ~3000 líneas) y Vite generaba un único chunk JS, así que cualquiera que visitara el dominio público del Cliente podía descargar también el código fuente de Administración y Cocina (formularios de CMS, conciliación de pagos, analíticas de ventas, gestión de personal, etc.), aunque los datos siguieran protegidos por la API.
  - Se extrajeron tipos/helpers/datos de demo compartidos a `app/pipiro-shared.tsx`.
  - `AdminView` y sus paneles (analíticas, bancos, crédito, soporte, personal, importación CSV, editor de platillos, calendario) se movieron a `app/admin-view.tsx`.
  - `KitchenView` se movió a `app/kitchen-view.tsx`.
  - `PrototypeApp` ahora carga Admin/Cocina con `React.lazy()` + `Suspense`, por lo que Vite los compila en chunks JS separados (`admin-view-*.js`, `kitchen-view-*.js`), confirmado en `dist/client/assets/` tras el build.
  - En `worker/index.ts` se bloquea servir esos dos chunks desde un host que no sea el suyo (`restrictedAssetBlocked`), para que ni siquiera conociendo el nombre exacto del archivo se puedan descargar desde el dominio del Cliente. En hosts privados de desarrollo (localhost/LAN/Tailscale) esta restricción no aplica, igual que el resto del modo demo.
  - Verificado: build de producción genera los chunks separados; en el navegador, visitar `/admin` y `/cocina` carga correctamente sus vistas vía import dinámico; visitar `/` no solicita esos chunks.
  - Se actualizó `tests/rendered-html.test.mjs`: las aserciones sobre contenido de Admin/Cocina ahora verifican los archivos nuevos en vez de `prototype-app.tsx`, se agregó una aserción que confirma que esas cadenas ya NO aparecen en `prototype-app.tsx`, y un test nuevo que verifica en producción simulada que los chunks de Admin/Cocina devuelven 404 desde el host equivocado.
  Archivos: `app/pipiro-shared.tsx` (nuevo), `app/admin-view.tsx` (nuevo), `app/kitchen-view.tsx` (nuevo), `app/prototype-app.tsx`, `worker/index.ts`, `worker/auth.ts` (export de `isPrivateDemoHost`), `tests/rendered-html.test.mjs`.
- `pnpm test` (build + suite de 6 pruebas) y `pnpm run lint` sin errores nuevos.

- **feat(rate-limit):** límites de frecuencia respaldados en D1, sin configuración de Cloudflare: por IP en `/api/auth/google/start` (15/10 min), por usuario en `/api/demo/orders` (30/10 min), `/api/demo/payment-batches` (15/10 min), subida de comprobantes (10/10 min) y `/api/demo/support` (5/10 min). Contadores de ventana fija, incremento+lectura atómico en una sola sentencia SQL (`INSERT ... ON CONFLICT ... RETURNING`), verificado directamente contra D1 local. Limpieza de contadores viejos agregada al cron existente.
  Archivos: `migrations/0019_rate_limit_counters.sql` (nuevo), `worker/rate-limit.ts` (nuevo), `worker/auth.ts`, `worker/index.ts`.
- **feat(turnstile):** verificación server-side de Cloudflare Turnstile en `/api/auth/google/start`, detrás de `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` — mientras no estén configuradas, se omite la verificación y el botón de Google funciona exactamente igual que antes. El sitekey se expone vía `/api/public/config` (es público por diseño) y un componente cliente nuevo carga el widget solo si hay sitekey configurado.
  Archivos: `worker/turnstile.ts` (nuevo), `app/google-login-button.tsx` (nuevo), `app/login/page.tsx`, `app/globals.css`, `worker/auth.ts`, `worker/index.ts`, `wrangler.jsonc` (var `TURNSTILE_SITE_KEY`).
- **feat(csp):** header `Content-Security-Policy` en todas las páginas. `script-src`/`style-src` necesitan `'unsafe-inline'` porque la hidratación SSR de este framework inyecta scripts inline con datos por-solicitud (no se pueden hashear ni mover a un archivo estático) y la app usa `style={{...}}` inline extensamente. Verificado en navegador sin violaciones en `/`, `/admin`, `/cocina`, `/login`; queda fijado con una aserción de prueba.
  Archivos: `worker/index.ts` (`contentSecurityPolicy`, `securePageResponse`).
- **feat(email):** procesador de `notification_outbox` para `channel = 'email'` vía el **Email Service nativo de Cloudflare** (`send_email` binding), no un proveedor externo — así quedó todo dentro de Cloudflare, sin API key que proteger. Mientras el dominio no esté dado de alta con `wrangler email sending enable solomexicohn.com`, cada envío falla con `E_SENDER_DOMAIN_NOT_AVAILABLE`/`E_SENDER_NOT_VERIFIED`; el procesador ya maneja eso como un reintento normal, así que no rompe nada mientras tanto. Verificado con pruebas unitarias contra la implementación real: no-op sin binding, resolución de destinatario vía `user_id`, reintentos hasta agotar intentos, manejo de destinatario faltante.
  Archivos: `worker/email.ts` (nuevo), `tests/email-outbox.test.mjs` (nuevo), `worker/index.ts`, `wrangler.jsonc` (binding `send_email` con nombre `EMAIL`, var `EMAIL_FROM`), `package.json` (el script `test` ahora corre toda la carpeta `tests/` con `--experimental-strip-types`).
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### 2026-10-22 (continuación) — Turnstile con el widget real

- El usuario creó el widget en el dashboard de Cloudflare (sitekey `0x4AAAAAAFhI35fmBflkEJWx`); quedó puesto en `wrangler.jsonc` (`TURNSTILE_SITE_KEY`). El Secret Key **no pasó por este chat** — el usuario lo guardó él mismo con `wrangler secret put TURNSTILE_SECRET_KEY` en su propia terminal. ✅ Hecho.
- **feat(turnstile):** siguiendo el patrón recomendado por Cloudflare, la verificación ahora valida también `action` (`"login"`, puesto en el widget y comprobado en el servidor) y `hostname` (debe ser uno de los tres dominios de Pipiro, más el host actual en hosts privados de desarrollo) — no solo `success === true`. Esto evita que un token resuelto en otra página se reuse contra este endpoint.
  Archivos: `worker/turnstile.ts` (`expectedTurnstileHostnames`, firma nueva de `verifyTurnstileToken`), `worker/auth.ts`, `app/google-login-button.tsx` (`action: "login"` en el widget).
- Probado en navegador con el sitekey real: el widget de Turnstile carga y se renderiza correctamente en `/login` sin errores de consola, y el botón "Continuar con Google" queda deshabilitado (sin `href`) hasta que se resuelve el reto — confirma que el gateo del lado cliente funciona. No se forzó la resolución del reto (sería pelear contra la propia protección anti-bot de Turnstile); la prueba de extremo a extremo con un humano real queda para el usuario.

### 2026-10-22 (continuación 2) — vuelta a Resend; Cloudflare Email Sending requiere plan pagado

- `wrangler email sending enable solomexicohn.com` falló (`Unauthorized [code: 2036]`) por el CLI; el usuario lo intentó también desde el dashboard y ahí quedó claro que **Email Sending requiere el plan Workers Paid** ($5/mes, incluye 3,000 correos/mes, luego $0.35 por cada 1,000 — [precio oficial](https://developers.cloudflare.com/email-service/platform/pricing/)). Lo que el usuario ya tenía activo (**Email Routing**, gratis) no sirve para este caso: solo recibe correo y puede reenviar a direcciones ya verificadas o responder a un correo entrante — no puede mandar un aviso nuevo a un Gmail de familia que nunca escribió primero.
- Decisión final: **volver a Resend** (plan gratis: 3,000 correos/mes, 100/día, 1 dominio — suficiente para el piloto). Revertido `worker/email.ts` a la API REST de Resend, quitado el binding `send_email` de `wrangler.jsonc`.
  Archivos: `worker/email.ts`, `wrangler.jsonc`, `tests/email-outbox.test.mjs`, `worker-configuration.d.ts`.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### 2026-10-22 (continuación 3) — dominio verificado y llave guardada

- El usuario verificó en Resend **`pipiro.solomexicohn.com`** directamente (no un subdominio separado). Confirmado que no hay conflicto: los registros que agregó Resend (DKIM en `resend._domainkey.pipiro`, SPF en `rsend.pipiro`/`send.pipiro`, DMARC en `_dmarc`) son subniveles distintos al registro que enruta ese host al Worker — conviven sin problema. Se decidió **dejarlo así**, sin re-verificar un subdominio aparte: para un solo flujo de correo transaccional (no hay mezcla con correo masivo ni con otro remitente) la razón de aislar reputación que da Resend no aplica realmente aquí, y re-verificar habría sido trabajo extra sin beneficio real.
  `EMAIL_FROM` ajustado a `Pipiro <pedidos@pipiro.solomexicohn.com>` para coincidir.
  Archivos: `wrangler.jsonc`, `tests/email-outbox.test.mjs`, `worker-configuration.d.ts`.
- `RESEND_API_KEY` ya se guardó como secreto del Worker (confirmado: "Uploaded secret RESEND_API_KEY"), sin pasar por el chat.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### Pendiente / próximos pasos identificados — estado al cierre de la rama `functional-upgrades`

Ambos puntos de esta lista ya se resolvieron en `functional-upgrades` (ver arriba, sección "bloque Funcional"); se deja el historial para referencia. Ver `CHANGELOG.md` más arriba para lo que sigue pendiente de verdad (push/merge a `main`, auditoría final, Cybersource/BAC, etc.).
