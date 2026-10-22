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

### Pendiente / próximos pasos identificados (no implementados todavía)

- La cookie de sesión dura hasta 30 días y no expira por inactividad ni al cerrar la pestaña o la app — en un dispositivo compartido (tablet de cocina, computadora de Admin), la sesión sigue activa si nadie hace clic en "Cerrar sesión". Falta: sesión más corta y/o cierre automático por inactividad para los roles `admin`/`kitchen`.
- Separar el bundle de Admin/Cocina del bundle del Cliente (hoy los tres viven en `app/prototype-app.tsx` y se sirven sin distinción de host).
- Procesador de `notification_outbox` para `channel = 'email'` (hoy se encolan pero nunca se envían).
- Resto de hallazgos: ver la lista priorizada acordada con el equipo (rate limiting + Turnstile, CSP, login por correo con OTP, exposición pública del número de cuenta bancaria, CSV import real, integración Cybersource/BAC, flujo de evidencia de entrega, etc.).
