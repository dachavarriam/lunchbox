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
- **feat(email):** procesador de `notification_outbox` para `channel = 'email'` vía Resend, igual al patrón ya usado para push. Necesita `RESEND_API_KEY` (secreto) y usa `EMAIL_FROM` (var, con un remitente de ejemplo ya configurado); sin la llave no hace nada, no rompe lo existente. Verificado con pruebas unitarias contra la implementación real: no-op sin llave, resolución de destinatario vía `user_id`, reintentos hasta agotar intentos, manejo de destinatario faltante.
  Archivos: `worker/email.ts` (nuevo), `tests/email-outbox.test.mjs` (nuevo), `worker/index.ts`, `wrangler.jsonc` (var `EMAIL_FROM`), `package.json` (el script `test` ahora corre toda la carpeta `tests/` con `--experimental-strip-types`).
- Ninguno de los dos secretos nuevos (`TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`) se agregó a `secrets.required` en `wrangler.jsonc`, porque ambas funciones degradan sin romper nada — agregarlos ahí generaría una advertencia engañosa de "falta configurar" cuando en realidad la app sigue funcionando.
- `pnpm test` (10 pruebas), `tsc --noEmit` y `pnpm run lint` sin errores nuevos.

### Pendiente / próximos pasos identificados (no implementados todavía)

- El rol `delivery` ya existe (se puede invitar personal con ese rol) pero no tiene ninguna pantalla asociada; tampoco hay evidencia fotográfica de entrega en el punto de recolección.
- Login por correo (OTP) todavía no implementado — ahora que existen rate limiting y Turnstile reutilizables, es el momento de construirlo sobre esa base.
- Resto de hallazgos: exposición pública del número de cuenta bancaria, CSV import real, integración Cybersource/BAC, impresión de etiquetas/comandas, etc.
