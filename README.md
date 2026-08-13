# Pipiro by Solo México

PWA para validar pedidos escolares de Solo México en la Escuela Internacional Sampedrana (EIS). La primera etapa opera sin pagos.

## Qué incluye

- Cliente separado en `/`: alumno, alergias, desayuno/almuerzo, fecha, menú, carrito y confirmación.
- Administración separada en `/admin`: métricas, calendario e importación simulada.
- KDS de cocina separado en `/cocina`: aceptar, preparar, empacar y marcar órdenes.
- EIS fija, sin selector de escuela durante el piloto.
- Horarios demo: desayuno 9:00 a. m. (cierre 8:15) y almuerzo 11:30 a. m. (cierre 10:00).
- 25 platillos demo: 5 desayunos, 5 almuerzos, 5 postres, 5 bebidas y 5 especiales.
- D1 `solomexico` con migraciones versionadas y R2 `solomexico` mediante bindings.
- Diseño adaptable a teléfono, tablet y escritorio.
- Español de Honduras e inglés de Estados Unidos.
- Manifest y service worker para instalación como PWA.
- Datos de personas completamente ficticios y ningún cobro.

## Estado de seguridad

Las rutas ya están separadas visual y técnicamente, pero todavía no tienen autenticación. No deben publicarse para uso real hasta implementar login, sesiones y autorización por rol en cada endpoint. Los secretos nunca deben guardarse en el repositorio ni exponerse como variables públicas.

## Ejecutar

Requiere Node.js 22 o superior y pnpm 11.

```bash
pnpm install
pnpm run dev
```

Abrir la dirección que muestre Vite, normalmente `http://localhost:3000`.

## Cloudflare local

```bash
pnpm run cf:types
pnpm run db:migrate:local
```

Las migraciones remotas solo deben ejecutarse de forma deliberada:

```bash
pnpm run db:migrate:remote
```

## Verificar

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm test
```

El plan de producto y arquitectura está en `docs/PLAN_MAESTRO_LONCHERA.md`.
