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

### Pendiente / próximos pasos identificados (no implementados todavía)

- Procesador de `notification_outbox` para `channel = 'email'` (hoy se encolan pero nunca se envían) — bloquea el login por correo (OTP) y las notificaciones por email ya diseñadas.
- El rol `delivery` ya existe (se puede invitar personal con ese rol) pero no tiene ninguna pantalla asociada; tampoco hay evidencia fotográfica de entrega en el punto de recolección.
- Resto de hallazgos: ver la lista priorizada acordada con el equipo (rate limiting + Turnstile, CSP, login por correo con OTP, exposición pública del número de cuenta bancaria, CSV import real, integración Cybersource/BAC, impresión de etiquetas/comandas, etc.).
