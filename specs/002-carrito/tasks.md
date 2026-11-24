---

description: "Tareas del frontend del Carrito multivendedor (S-06)"
---

# Tasks: Carrito multivendedor — interfaz (frontend)

**Input**: `specs/002-carrito/` — spec.md (§5–§6, Clarifications), plan.md, research.md, data-model.md, contracts/, quickstart.md

**Prerequisites**: backend del carrito en `main` (`1aab552`); no se modifica el backend, el esquema ni `docs/`.

**Tests**: OBLIGATORIAS (constitución IX). Cada historia empieza por sus pruebas, que deben **fallar antes** de implementar (TDD). Las pruebas de navegador usan red simulada (ver plan R3) y así se informan.

## Format: `[ID] [P?] [Story] Description — trazabilidad`

- **[P]**: paralelizable (archivos distintos, sin dependencias)
- Trazabilidad al final de cada tarea: RF/HU · criterios CA-F de la spec

## Historias de usuario (derivadas de HU04–HU06 y de los criterios de §5)

| Id | Historia | Prioridad | Criterios |
|---|---|---|---|
| US1 | Como cliente, agrego un producto desde su detalle (HU04) | P1 (MVP) | CA-F1, CA-F7 (parte), CA-F8 (detalle) |
| US2 | Como cliente, consulto mi carrito agrupado por puesto con subtotales y total (HU04, HU06) | P1 | CA-F2, CA-F3, CA-F8, CA-F9, CA-F11, CA-F12 |
| US3 | Como cliente, modifico cantidades, quito productos y vacío el carrito (HU05) | P2 | CA-F4, CA-F5 |
| US4 | Como cliente, veo la disponibilidad y los errores de cada operación (HU04) | P2 | CA-F6, CA-F7, CA-F10 |

## Phase 1: Setup

**Purpose**: infraestructura de pruebas del frontend (plan R2, research D3)

- [x] T001 Instalar devDependencies de prueba en `frontend/package.json` y `package-lock.json`: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` (esta última añadida durante la implementación: matchers de las pruebas de componente) — plan R2
- [x] T002 [P] Crear `frontend/vitest.config.ts` (entorno `jsdom`, alias `@/`, solo `**/*.test.ts(x)`, excluye `e2e/`) y el script `npm test` — plan R2
- [x] T003 [P] Crear `frontend/playwright.config.ts` (Chromium, `webServer` con `next dev`, carpeta `e2e/`) y el script `npm run test:e2e` — plan R3

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T004 [P] Añadir los tipos `Carrito`, `GrupoPuesto`, `LineaCarrito`, `EstadoLinea` en `frontend/lib/tipos.ts` según `data-model.md` — HU04–HU06 · CA-F2, CA-F3
- [x] T005 Añadir `obtenerCarrito`, `agregarAlCarrito`, `actualizarCantidadCarrito`, `quitarDelCarrito`, `vaciarCarrito` en `frontend/lib/api.ts` (rutas de `contracts/api-carrito.md`, con sesión) — RF20–RF24 (depende de T004)
- [x] T006 [P] Pruebas unitarias de lógica pura en `frontend/lib/carrito.test.ts` (validar cantidad: vacío, `0`, negativo, decimal, texto, `1e2`, 10 001; mensajes de error 0/401/409; rótulos de puesto nulo y de estado) — RF24 · CA-F4, CA-F7. **Deben fallar**
- [x] T007 Implementar `frontend/lib/carrito.ts` (`validarCantidad`, `mensajeErrorCarrito`, `rotuloPuesto`, `textoEstadoLinea`) hasta que pase T006 — RF24 · CA-F4, CA-F6, CA-F7
- [x] T008 [P] Añadir `useSesion()` (perfil sin redirigir: `cargando | visitante | cliente | otro`) en `frontend/lib/hooks.ts` — research D4 · CA-F8
- [x] T009 [P] Crear utilidades de prueba en `frontend/test/utilidades.tsx` (fixtures de `Carrito` con tres puestos, simulación de `@/lib/api`, `@/lib/supabase` y `next/navigation`) — apoyo a T010…T031

**Checkpoint**: tipos, API y lógica listos; las historias pueden comenzar.

---

## Phase 3: US1 — Agregar desde el detalle del producto (P1) 🎯 MVP

**Goal**: el cliente agrega un producto desde `/catalogo/[id]` y ve la confirmación; visitantes y otros roles ven lo aclarado en la sesión 2026-11-06.

**Independent Test**: abrir el detalle como cliente, agregar 2 unidades y ver «Agregado» con el total; como visitante ver «Ingresar para comprar»; como comerciante ver el aviso, sin botón.

### Tests US1 ⚠️ (escribir primero; deben fallar)

- [x] T010 [P] [US1] `frontend/components/carrito/ComprarProducto.test.tsx`: cliente agrega (llama a `agregarAlCarrito` con `productoId` y cantidad, muestra confirmación con el total y enlace a `/carrito`); cantidad inválida no envía; 409 muestra el mensaje del servidor sin perder el formulario; durante el envío el botón se deshabilita; visitante ve «Ingresar para comprar» con enlace a `/login`; comerciante/trabajador/administrador ven «Solo los clientes compran» sin botón — HU04 · RF20 · CA-F1, CA-F7, CA-F8, CA-F10

### Implementation US1

- [x] T011 [US1] Implementar `frontend/components/carrito/ComprarProducto.tsx` (usa `useSesion`, `validarCantidad`, `agregarAlCarrito`) — RF20 · CA-F1, CA-F8
- [x] T012 [US1] Modificar `frontend/components/catalogo/DetalleProducto.tsx`: reemplazar el aviso «La compra se habilitará próximamente» por `<ComprarProducto productoId={p.id} />` — CA-F1

**Checkpoint**: US1 funcional y comprobable de forma independiente.

---

## Phase 4: US2 — Consultar el carrito agrupado por puesto (P1)

**Goal**: página `/carrito` solo para clientes, con grupos por puesto, subtotales y total tal como los entrega la API.

**Independent Test**: con un carrito de tres puestos, `/carrito` muestra tres grupos, cada subtotal y el total idénticos carácter por carácter a la respuesta; sin sesión redirige a `/login`; otro rol ve «Acceso restringido»; vacío muestra mensaje y enlace al catálogo.

### Tests US2 ⚠️

- [x] T013 [P] [US2] `frontend/components/carrito/CarritoVista.test.tsx`: tres grupos con código y nombre del puesto, líneas con nombre/precio/cantidad/subtotal, subtotal y total exactamente iguales al texto de la API (incluye `"0.30"`, `"59.97"`), rótulo «Importe estimado», **sin** botón de pedido ni pago, estado cargando, error de carga con «Reintentar», carrito vacío con enlace a `/catalogo` — RF20–RF23 · HU04, HU06 · CA-F2, CA-F3, CA-F9, CA-F11
- [x] T014 [P] [US2] `frontend/app/carrito/page.test.tsx`: sin sesión redirige a `/login`; con rol distinto de cliente muestra «Acceso restringido» y no llama a la API del carrito — RF04 · AC04 · CA-F8
- [x] T015 [P] [US2] `frontend/components/SiteHeader.test.tsx`: el enlace «Carrito» aparece solo para `CLIENTE`, no para visitante ni otros roles, y no llama a `obtenerCarrito` — CA-F12

### Implementation US2

- [x] T016 [US2] Implementar `frontend/components/carrito/CarritoVista.tsx` (agrupación por puesto, totales, estado vacío, carga, error con reintento) y crear `frontend/components/carrito/LineaCarrito.tsx` en versión de solo lectura (nombre, precio, cantidad, subtotal) que T021 amplía — RF21–RF23 · CA-F2, CA-F3, CA-F9, CA-F11
- [x] T017 [US2] Crear `frontend/app/carrito/page.tsx` (`"use client"`, `Acceso roles={["CLIENTE"]}` → `CarritoVista`, patrón de `/cuenta`) — CA-F8
- [x] T018 [US2] Modificar `frontend/components/SiteHeader.tsx`: enlace «Carrito» (`/carrito`) solo si `sesion.rol === "CLIENTE"` — CA-F12

**Checkpoint**: US1 + US2 funcionan; se puede agregar y consultar.

---

## Phase 5: US3 — Modificar, quitar y vaciar (P2)

**Goal**: editar cantidades, quitar productos y vaciar el carrito con la respuesta de la API como estado.

**Independent Test**: cambiar una cantidad actualiza subtotales y total; quitar elimina la línea y, si era la última del puesto, el grupo; vaciar pide confirmación.

### Tests US3 ⚠️

- [x] T019 [P] [US3] `frontend/components/carrito/LineaCarrito.test.tsx`: «Actualizar» envía la cantidad válida y entrega el carrito recibido; cantidades inválidas no envían y muestran el motivo; «Quitar» llama a `quitarDelCarrito`; los controles de la línea se deshabilitan mientras envía y no se envían solicitudes duplicadas — RF24 · HU05 · CA-F4, CA-F5, CA-F10
- [x] T020 [P] [US3] Ampliar `CarritoVista.test.tsx`: tras actualizar/quitar los subtotales y el total mostrados pasan a ser los de la nueva respuesta; el grupo vacío desaparece; «Vaciar carrito» abre confirmación, «Cancelar» no envía y «Confirmar» llama a `vaciarCarrito` y muestra el estado vacío — RF24 · HU05 · CA-F4, CA-F5

### Implementation US3

- [x] T021 [US3] Ampliar `frontend/components/carrito/LineaCarrito.tsx` (campo de cantidad con etiqueta, «Actualizar», «Quitar», bloqueo en curso, error de línea) — RF24 · CA-F4, CA-F5, CA-F10
- [x] T022 [US3] Integrar `LineaCarrito` y «Vaciar carrito» con confirmación en `frontend/components/carrito/CarritoVista.tsx` — CA-F5

**Checkpoint**: US1–US3 completas.

---

## Phase 6: US4 — Disponibilidad y errores (P2)

**Goal**: mostrar el estado de cada línea y los errores del servidor sin perder el carrito mostrado.

**Independent Test**: una línea `STOCK_INSUFICIENTE` muestra «Quedan N», una `NO_DISPONIBLE` se rotula y solo se puede quitar; `requiereRevision` muestra el aviso; un 409/404/red caída se muestra junto a la acción y el carrito sigue visible.

### Tests US4 ⚠️

- [x] T023 [P] [US4] Ampliar `LineaCarrito.test.tsx` y `CarritoVista.test.tsx`: línea `STOCK_INSUFICIENTE` (texto «Quedan {disponible}» o «Agotado» si es 0, destacada, ya no suma), línea `NO_DISPONIBLE` (sin precio, «ya no está disponible», solo «Quitar»), puesto con nombre nulo rotulado «Puesto no disponible», aviso global cuando `requiereRevision` — RF15, RF19 · CA-F6
- [x] T024 [P] [US4] Ampliar las pruebas: errores 409, 404, 400 y de red (estado 0) en agregar, actualizar y quitar se muestran junto a la acción, conservan el carrito mostrado y 401 cierra la sesión local y redirige a `/login` — RF15 · CA-F7

### Implementation US4

- [x] T025 [US4] Implementar los estados de línea y el aviso de revisión en `LineaCarrito.tsx` y `CarritoVista.tsx` (usa `textoEstadoLinea`, `rotuloPuesto`) — CA-F6
- [x] T026 [US4] Implementar el tratamiento de errores en `ComprarProducto.tsx`, `LineaCarrito.tsx` y `CarritoVista.tsx` (usa `mensajeErrorCarrito`; 401 → cerrar sesión local y `/login`) — CA-F7

**Checkpoint**: todas las historias completas.

---

## Phase 7: Pruebas de navegador, verificación y revisión

- [ ] T027 Prueba de navegador `frontend/e2e/carrito.spec.ts` con **red simulada** (sesión de Supabase y `/api/v1/**` interceptadas; la API simulada reproduce el contrato de `contracts/api-carrito.md`): cliente agrega desde el detalle, abre `/carrito`, ve tres puestos con subtotales y total, cambia una cantidad, recibe un 409, quita un producto y vacía; visitante redirigido a `/login` desde `/carrito`; comerciante ve «Acceso restringido» — CA-F1…CA-F9, CA-F12 (plan R3, R5). Si la sesión simulada no es aceptada, declarar la prueba **no ejecutada**
- [ ] T028 Comprobar CA-F10 en navegador: carga, acciones en curso y vista de 375 px de ancho sin desbordes horizontales (en la prueba de T027) — AC09, AC10
- [ ] T029 Ejecutar y registrar resultados reales en `frontend/`: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` — constitución IX
- [ ] T030 Regresión del backend (sin cambios): `npm run arquitectura`, `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e` en `backend/` — constitución IX
- [ ] T031 Revisión de alcance: confirmar que no hay pedido ni pago en la interfaz, ningún cálculo monetario con `number`, ningún `localStorage`/`sessionStorage` del carrito (RI-2), ningún secreto, y que `git diff --stat` solo toca `frontend/` y `specs/002-carrito/` — constitución III, VI, VIII; CA-F11
- [ ] T032 Completar la matriz de trazabilidad de este archivo con los resultados reales (tarea → código → prueba) — constitución X

---

## Matriz de trazabilidad (HU/RF → criterio → tareas → código → prueba)

| HU · RF | Criterio | Tareas | Código | Prueba |
|---|---|---|---|---|
| HU04 · RF20 | CA-F1 | T010–T012 | `ComprarProducto.tsx`, `DetalleProducto.tsx`, `lib/api.ts` | `ComprarProducto.test.tsx`; `e2e/carrito.spec.ts` |
| HU04 · RF20, RF21 | CA-F2 | T013, T016, T017 | `CarritoVista.tsx`, `app/carrito/page.tsx` | `CarritoVista.test.tsx`; e2e |
| HU06 · RF22, RF23 | CA-F3 | T013, T016 | `CarritoVista.tsx` (texto de la API) | `CarritoVista.test.tsx`; e2e |
| HU05 · RF24 | CA-F4 | T006, T007, T019, T020, T021 | `lib/carrito.ts`, `LineaCarrito.tsx` | `carrito.test.ts`; `LineaCarrito.test.tsx` |
| HU05 · RF24 | CA-F5 | T019, T020, T021, T022 | `LineaCarrito.tsx`, `CarritoVista.tsx` | `LineaCarrito.test.tsx`; `CarritoVista.test.tsx`; e2e |
| HU04 · RF15, RF19 | CA-F6 | T023, T025 | `LineaCarrito.tsx`, `CarritoVista.tsx` | pruebas de T023 |
| HU04 · RF15 | CA-F7 | T006, T024, T026 | `lib/carrito.ts`, tres componentes | pruebas de T024; e2e (409) |
| RF04 · AC04 | CA-F8 | T008, T010, T014, T017 | `useSesion`, `Acceso`, `ComprarProducto.tsx` | `ComprarProducto.test.tsx`; `acceso.test.tsx`; e2e |
| HU04 | CA-F9 | T013, T016 | `CarritoVista.tsx` | `CarritoVista.test.tsx` |
| AC01 · AC09 · AC10 | CA-F10 | T019, T028 | `LineaCarrito.tsx`, estilos | `LineaCarrito.test.tsx`; e2e (375 px) |
| HU06 | CA-F11 | T013, T031 | `CarritoVista.tsx` | `CarritoVista.test.tsx`; revisión T031 |
| HU04 · AC01 | CA-F12 | T015, T018 | `SiteHeader.tsx` | `SiteHeader.test.tsx` |

## Dependencias y orden de ejecución

- Setup (T001–T003) → Foundational (T004–T009) → US1 y US2 (P1, pueden ir en paralelo tras T009) → US3 (depende de T016) → US4 (depende de T021) → Fase 7.
- Dentro de cada historia: pruebas primero (deben fallar), luego implementación.
- Paralelas: T002/T003; T004/T006/T008/T009; T010 con T013–T015; T019/T020; T023/T024.

## Estrategia

MVP = US1 + US2 (agregar y consultar). Luego US3 (editar) y US4 (disponibilidad y errores). La prueba de navegador y la verificación final cierran el trabajo; lo no ejecutado se informa como tal.

## Notas

- NO hacer `push` ni `merge`; el commit se crea solo con la implementación y las pruebas listas, con la autoría humana configurada y sin atribuciones de IA (CLAUDE.md, hooks).
- Antes de escribir código de Next.js se consultó `node_modules/next/dist/docs` (aviso de `frontend/AGENTS.md`).
