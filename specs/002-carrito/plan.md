# Implementation Plan: Carrito multivendedor — interfaz (frontend)

**Branch**: `feat/frontend-carrito` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md) §5–§6

**Input**: Feature specification from `/specs/002-carrito/spec.md` (criterios CA-F1…CA-F12; aclaraciones de la sesión 2026-11-06)

**Trazabilidad**: HU04, HU05, HU06 · RF20, RF21, RF22, RF23, RF24 (+ RF04, RF15, RF19 como apoyo) · ADR-001, ADR-002 · RC01–RC03, RC06 · AC01, AC04, AC09, AC10

## Summary

El backend del carrito (S-06) ya está integrado en `main` (`1aab552`). Este plan cubre solo el **frontend**: la página `/carrito`, el bloque «Agregar al carrito» del detalle del producto y el enlace «Carrito» del encabezado. La interfaz consume los 5 endpoints existentes de `/api/v1/carrito`, muestra los importes tal como los entrega la API y no calcula dinero en el navegador. Enfoque técnico: componentes cliente de Next.js (como el resto de la interfaz: sesión de Supabase en el navegador), una capa fina en `lib/api.ts`, lógica pura (validación de cantidad, mensajes) en `lib/carrito.ts` con pruebas unitarias, pruebas de componente con la API simulada y una prueba de navegador con Playwright sobre red simulada. No se toca el backend, el esquema ni los documentos aprobados.

## Technical Context

**Language/Version**: TypeScript 5 (estricto), Node.js 24, Next.js 16.4.5 (App Router, `cacheComponents: true`), React 19.3

**Primary Dependencies**: las existentes (Tailwind 4, `@supabase/ssr`). **Nuevas, solo de desarrollo y solo para pruebas**: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` (mismo ejecutor que el backend, constitución IX). `@playwright/test` ya está instalado.

**Storage**: ninguno en el cliente (RI-2: el carrito se lee siempre de la API); sin `localStorage` ni caché propia.

**Testing**: Vitest (unitarias y de componente, `npm test`), Playwright (`npm run test:e2e`), `npm run lint`, `npm run build`; en backend `npm run arquitectura` y la suite existente para comprobar que no hay regresiones.

**Target Platform**: navegador moderno de escritorio y móvil (Chromium para las pruebas), responsive (AC09, AC10).

**Project Type**: aplicación web: `frontend/` (Next.js) sobre `backend/` (monolito modular NestJS, sin cambios).

**Performance Goals**: sin presupuesto numérico propio en la documentación para esta pantalla; AC01 pide respuesta adecuada del carrito. Decisión: una consulta del carrito por visita a `/carrito` y ninguna en el resto de páginas (CA-F12).

**Constraints**: importes como texto de la API (constitución III); autorización real en el backend (V); solo `NEXT_PUBLIC_*` públicos; sin pedido ni pago (spec §1).

**Scale/Scope**: 1 página nueva, 2 componentes nuevos de carrito, 2 componentes modificados (detalle y encabezado), ≤ 50 productos por carrito (R3).

## Constitution Check

*GATE: antes de la investigación y de nuevo tras el diseño.* Constitución v1.1.1.

- [x] **I. Monolito modular**: N/A para el backend (sin cambios); el frontend es un contenedor separado que usa la API REST (RC06).
- [x] **II. Clean Architecture**: N/A en el frontend; la lógica pura va en `lib/` sin dependencias de React, y los componentes solo presentan.
- [x] **III. Frontend**: Next.js/React/TypeScript sobre `/api/v1`; importes como texto, sin sumas con `number`; sin secretos; el ocultamiento por rol es solo comodidad (CA-F8).
- [x] **IV. Persistencia**: N/A (sin esquema ni migración nuevos).
- [x] **V. Autenticación/autorización**: roles desde PostgreSQL vía `GET /auth/me` (hook existente); el backend ya responde 401/403 (R1); se prueban redirección sin sesión y «acceso restringido» por rol.
- [x] **VI. Pagos**: N/A — no se implementa pago ni pedido; no se altera nada de Mercado Pago (CA-F11).
- [x] **VII. Inventario**: N/A — el carrito no reserva (R8); la UI no valida stock como control de consistencia, solo muestra lo que informa el servidor.
- [x] **VIII. Seguridad**: sin secretos en el repositorio ni en logs; las pruebas no llaman a Supabase real (red simulada); entradas validadas antes de enviar y por el servidor; el acceso cruzado entre clientes está cubierto en backend (`carrito.e2e-spec.ts`). Auditoría: sin módulo, las operaciones del carrito quedan sin auditar (ya declarado en el backend).
- [x] **IX. Calidad**: plan con pruebas unitarias, de componente y de navegador ligadas a CA-F1…CA-F12 (ver `tasks.md`), más compilación, lint y regresión del backend.
- [x] **X. Trazabilidad**: HU04–HU06 y RF20–RF24 existen en `docs/01-analisis-de-sistema/`; la spec no reescribe requisitos (las decisiones de interfaz están en *Clarifications* y §5).

**Re-evaluación tras el diseño (Fase 1)**: sin cambios; ninguna compuerta violada. *Complexity Tracking*: vacío.

## Project Structure

### Documentation (this feature)

```text
specs/002-carrito/
├── spec.md              # §1–§4 backend (S-06), §5–§6 interfaz, Clarifications
├── plan.md              # este archivo
├── research.md          # decisiones y alternativas
├── data-model.md        # tipos del carrito en el cliente y estados de la interfaz
├── quickstart.md        # cómo validar de extremo a extremo
├── contracts/
│   ├── api-carrito.md   # contrato HTTP consumido (existente, sin cambios)
│   └── ui-carrito.md    # rutas, componentes y estados de la interfaz
├── checklists/          # lista de calidad de la especificación (si se genera)
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── carrito/page.tsx                     # NUEVO: ruta /carrito (acceso solo CLIENTE)
├── components/
│   ├── carrito/
│   │   ├── CarritoVista.tsx                 # NUEVO: grupos por puesto, líneas, totales, vaciar
│   │   ├── LineaCarrito.tsx                 # NUEVO: cantidad, quitar, estado de disponibilidad
│   │   └── ComprarProducto.tsx              # NUEVO: cantidad + «Agregar al carrito» (detalle)
│   ├── catalogo/DetalleProducto.tsx         # MODIFICA: reemplaza el aviso «compra próximamente»
│   └── SiteHeader.tsx                       # MODIFICA: enlace «Carrito» solo para CLIENTE
├── lib/
│   ├── api.ts                               # MODIFICA: 5 funciones del carrito
│   ├── tipos.ts                             # MODIFICA: tipos Carrito, GrupoPuesto, LineaCarrito
│   ├── hooks.ts                             # MODIFICA: useSesion() (perfil sin redirigir)
│   └── carrito.ts                           # NUEVO: lógica pura (validar cantidad, textos)
├── lib/carrito.test.ts                      # NUEVO: pruebas unitarias
├── components/carrito/*.test.tsx            # NUEVO: pruebas de componente (API simulada)
├── components/SiteHeader.test.tsx           # NUEVO: enlace «Carrito» solo para clientes
├── app/carrito/page.test.tsx                # NUEVO: sin sesión → /login; otro rol → acceso restringido
├── test/utilidades.tsx                      # NUEVO: fixtures y simulaciones compartidas
├── e2e/carrito.spec.ts                      # NUEVO: prueba de navegador (red simulada)
├── vitest.config.ts · playwright.config.ts  # NUEVO
└── package.json                             # MODIFICA: scripts test y test:e2e; devDependencies
```

**Structure Decision**: se reutiliza la estructura existente del frontend (rutas en `app/`, componentes por área en `components/`, acceso a la API solo en `lib/api.ts`, `Acceso` para el control por rol). El backend, `prisma/`, `docs/` y los diagramas C4 no cambian.

## Dependencias y riesgos

| Id | Riesgo / dependencia | Mitigación |
|---|---|---|
| D1 | Backend del carrito en `main` (`1aab552`) con sus 5 endpoints | Contrato fijado en `contracts/api-carrito.md`; los tipos del cliente lo reflejan |
| D2 | Hooks y componentes existentes (`useCarga`, `Acceso`, `Contenedor`, `Aviso`) | Reutilizarlos; no duplicar |
| R1 | Next 16 cambia APIs (aviso de `frontend/AGENTS.md`) | Se consultó `node_modules/next/dist/docs` (componentes cliente, `cacheComponents`); se sigue el patrón de páginas cliente ya funcionando (`/cuenta`, `/catalogo`) y se verifica con `npm run build` |
| R2 | El frontend no tiene infraestructura de pruebas | Añadir Vitest + Testing Library + jsdom como devDependencies (decisión D3 en `research.md`); se declara el cambio de `package-lock.json` |
| R3 | Sin Supabase ni backend con credenciales reales en las pruebas | Prueba de navegador con **red simulada** (sesión y API interceptadas); se informa como tal, **no** como integración con el backend real |
| R4 | Clics rápidos sobre cantidades pueden enviar solicitudes cruzadas | Deshabilitar los controles de una línea mientras su solicitud está en curso (CA-F10); la respuesta de la API sustituye siempre al estado (RI-2) |
| R5 | La cookie de sesión simulada de Supabase puede no ser aceptada por el cliente | Se prueba primero en un caso mínimo; si no funciona, la prueba de navegador se declara no ejecutada y quedan las de componente |
| R6 | Sumar importes en el navegador reintroduciría errores de coma flotante | Prohibido por RI-1; una prueba comprueba que lo mostrado coincide carácter por carácter con la respuesta |

## Complexity Tracking

Sin violaciones de la constitución que justificar. La única adición estructural (infraestructura de pruebas del frontend) responde al principio IX.
