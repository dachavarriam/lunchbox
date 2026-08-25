# Pipiro by Solo México

PWA para validar pedidos escolares de Solo México en la Escuela Internacional Sampedrana (EIS). La demostración actual no procesa pagos; el piloto incorporará primero pagos por transferencia.

## Qué incluye

- Cliente en `/`: perfiles editables, alergias, almuerzos por fecha, menú, carrito recuperable, historial y pedido persistente.
- Administración en `/admin`: catálogo bilingüe, precios, opciones obligatorias, imágenes en R2, importación CSV, calendario, cupos, ventanas de pedido y conciliación de transferencias.
- KDS de cocina en `/cocina`: recibe órdenes aprobadas y persiste sus cambios de preparación y empaque.
- EIS fija, sin selector de escuela durante el piloto.
- Solo almuerzos: entrega demo a las 11:30 a. m., mínimo un día de anticipación y cierre a las 11:59 p. m. del día anterior.
- 8 platillos permanentes configurables, bebidas separadas y especialidades publicables por fecha.
- D1 `solomexico` con migraciones versionadas y R2 `solomexico` mediante bindings.
- Diseño adaptable a teléfono, tablet y escritorio.
- Español de Honduras e inglés de Estados Unidos.
- Manifest y service worker para instalación como PWA.
- Datos de personas completamente ficticios y flujo demo de transferencia con comprobante privado; tarjeta aparece como próxima función y no procesa dinero.

## Estado de seguridad

El piloto usa sesiones de servidor y autorización por roles. Las familias solamente pueden consultar sus propios estudiantes, pedidos, pagos y créditos; Administración y KDS exigen roles internos. En producción las superficies se publican por separado en `pipiro.solomexicohn.com`, `admin-pipiro.solomexicohn.com` y `kds-pipiro.solomexicohn.com`. El modo sin login queda limitado a hosts privados de desarrollo y Tailscale.

Los comprobantes de transferencia usan el binding R2 privado `PAYMENT_RECEIPTS`, conectado al bucket privado `pipiro` y separado del bucket público `solomexico` del catálogo. Los secretos nunca se guardan en el repositorio ni se exponen como variables públicas.

## Ejecutar

Requiere Node.js 22 o superior y pnpm 11.

```bash
pnpm install
pnpm run dev
```

Abrir la dirección que muestre Vite, normalmente `http://localhost:3000`.

### Probar desde un teléfono en la misma red Wi-Fi

```bash
pnpm run dev:lan
```

Buscar la dirección IPv4 de la Mac en **Configuración del Sistema → Wi-Fi → Detalles → TCP/IP** y abrir desde el teléfono `http://IP-DE-LA-MAC:3000`. Por ejemplo: `http://192.168.1.25:3000`.

En iPhone o iPad, abrir la dirección en Safari y usar **Compartir → Agregar a pantalla de inicio**. La Mac debe permanecer encendida, el comando debe seguir ejecutándose y ambos dispositivos deben estar en la misma red. Esta dirección local es solamente para pruebas y no debe usarse con datos reales.

## Importación del catálogo

El CMS acepta archivos CSV UTF-8 de hasta 1 MB y 200 filas. Las columnas obligatorias son `nombre_es`, `nombre_en`, `descripcion_es`, `descripcion_en`, `categoria` y `precio_hnl`; `emoji` y `activo` son opcionales. La vista previa identifica productos nuevos, cambios y errores antes de aplicar la importación. Las imágenes se agregan desde el editor individual para conservar su validación y asociación correcta.

## Cloudflare local

```bash
pnpm run cf:types
pnpm run db:migrate:local
```

Las migraciones remotas solo deben ejecutarse de forma deliberada:

```bash
pnpm run db:migrate:remote
```

## Google OAuth

El Client ID público está en `wrangler.jsonc`. El secreto se instala fuera del repositorio:

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

Los callbacks de producción son:

- `https://pipiro.solomexicohn.com/api/auth/google/callback`
- `https://admin-pipiro.solomexicohn.com/api/auth/google/callback`
- `https://kds-pipiro.solomexicohn.com/api/auth/google/callback`

Cada hostname mantiene su propia cookie segura. La pantalla está disponible en `/login`. Para desarrollo local completo se puede usar `.dev.vars` sin versionarlo; una IP Tailscale no es un origen OAuth válido para Google.

## Verificar

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm test
```

La guía vigente de producto, arquitectura, seguridad y fases está en [`docs/GUIA_FUNCIONAL_PIPIRO.md`](docs/GUIA_FUNCIONAL_PIPIRO.md). El plan maestro anterior se conserva únicamente como antecedente histórico.
