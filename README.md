# Lonchera Solo México

Prototipo PWA para validar pedidos escolares antes de implementar cuentas reales, pagos o infraestructura productiva.

## Qué incluye

- Recorrido para familias: alumno, fecha, menú, carrito y confirmación.
- Vista administrativa: métricas, calendario e importación simulada.
- KDS de cocina: aceptar, preparar, empacar y marcar órdenes.
- Diseño adaptable a teléfono, tablet y escritorio.
- Español de Honduras e inglés de Estados Unidos.
- Manifest y service worker para instalación como PWA.
- Datos completamente ficticios y ningún cobro.

## Ejecutar

Requiere Node.js 22 o superior y pnpm 11.

```bash
pnpm install
pnpm run dev
```

Abrir `http://localhost:3000`.

## Verificar

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm test
```

El plan de producto y arquitectura está en `docs/PLAN_MAESTRO_LONCHERA.md`.
