# Changelog

Registro de trabajo de la rama `security-upgrades`: auditoría de seguridad y privacidad, y preparación técnica para la integración de pagos con BAC/Cybersource. Sirve de base para documentación formal más adelante.

## [Unreleased] — rama `security-upgrades`

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

### Pendiente / próximos pasos identificados (no implementados todavía)

- Ninguna acción pendiente de Cloudflare/Resend para el correo — dominio verificado, API key guardada. Falta solo **desplegar** esta rama para que quede activo en producción.
- El rol `delivery` ya existe (se puede invitar personal con ese rol) pero no tiene ninguna pantalla asociada; tampoco hay evidencia fotográfica de entrega en el punto de recolección.
- Login por correo (OTP) todavía no implementado — ahora que existen rate limiting y Turnstile reutilizables, es el momento de construirlo sobre esa base.
- Resto de hallazgos: exposición pública del número de cuenta bancaria, CSV import real, integración Cybersource/BAC, impresión de etiquetas/comandas, etc.
