---

description: "Tareas del módulo Inventario (S-05 · H2), redactadas a posteriori sobre el código integrado"
---

# Tasks: Módulo Inventario (S-05 · H2)

**Input**: `specs/001-inventario/` — spec.md, plan.md; código en `backend/src/modules/inventory/`

**Prerequisites**: módulo ya integrado en `main`. Este documento es **retrospectivo**: no añade ni modifica código, esquema ni migraciones, y no toca `docs/01`, los ADR ni los diagramas C4.

**Tests**: las tareas describen lo ya implementado y enlazan la prueba que lo respalda. Se marca `[X]` **solo** si el archivo de prueba existe y pasó en la verificación del 2026-11-23 (sección «Resultados de la verificación»). Las pruebas de base de datos (`*.db-spec.ts`) se ejecutaron el 2026-11-23 con `npm run test:db` sobre el contenedor local `mercado-test-db` (73 / 73; [evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md)); el CI ya las había ejecutado con éxito el 2026-11-18. Quedan `[ ]` solo las tareas que dependen de algo que no se ejecutó (T028).

## Format: `[ID] [P?] [Story] Description — trazabilidad`

- **[P]**: paralelizable (archivos distintos, sin dependencias)
- Trazabilidad al final de cada tarea: RF/HU/AC/ADR · regla de la spec (R1–R7)
- `Prueba:` enlaza el archivo que respalda la tarea. `Doble` = prueba con repositorio en memoria (`test-doubles.ts`): demuestra la lógica, **no** la atomicidad en PostgreSQL.

## Historias de usuario (derivadas de HU14, HU15 y de la spec §2–§4)

| Id | Historia | Prioridad | Reglas |
|---|---|---|---|
| US1 | Como comerciante titular, registro ingresos, devoluciones y ajustes de stock (HU14) | P1 (MVP) | R1, R3, R7 |
| US2 | Como comerciante titular (o administrador, solo lectura), consulto existencias y el historial de movimientos (HU14, HU15) | P1 | R1, R7 |
| US3 | Como módulo de Pedidos, reservo stock de forma atómica, todo‑o‑nada e idempotente (RF15, RF25) | P1 | R1, R2, R4, R5 |
| US4 | Como módulo de Pedidos/Pagos, libero, confirmo o expiro reservas sin descontar dos veces (RF54 parcial) | P2 | R5, R6 |

## Phase 1: Modelo y estructura

**Purpose**: esquema, invariantes y fronteras del módulo (plan: Storage y Constitution Check I, II, IV)

- [X] T001 Esquema y migración: tablas `inventarios`, `movimientos_inventario`, `reservas_inventario`; `CHECK 0 ≤ reservado ≤ físico`; FK compuesta (producto, puesto); `UNIQUE (clave_operacion, inventario_id)` — `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261107000000_inventario/migration.sql` — RF14 · R1, R5. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («restricciones del modelo (AC08)») — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*
- [X] T002 [P] Dominio `Stock` (invariante, `reservar`, `liberar`, `vender`, `variarFisico`) y `cantidadEntera` (entero, sin cero, máximo 1 000 000) — `backend/src/modules/inventory/domain/stock.ts`, `errors.ts` — RF14 · R1. Prueba: [`stock.spec.ts`](../../backend/src/modules/inventory/domain/stock.spec.ts), [`stock.jest-spec.ts`](../../backend/test/jest/stock.jest-spec.ts)
- [X] T003 [P] Puertos `InventarioRepository` y `PropiedadProductoPort`; adaptador de propiedad sobre las APIs públicas de Productos y Comerciantes — `application/ports/ports.ts`, `infrastructure/propiedad-producto.adapter.ts` — Constitución I, II. Prueba: `npm run arquitectura` (reglas `limites-entre-modulos`, `sin-framework-en-el-nucleo`, `sin-ciclos` de [`.dependency-cruiser.cjs`](../../backend/.dependency-cruiser.cjs): 0 violaciones); el adaptador se ejerce con dobles en [`app-en-memoria.ts`](../../backend/test/helpers/app-en-memoria.ts)
- [X] T004 Composición del módulo y API pública: `InventoryModule` exporta solo `ReservarInventario`, `LiberarReserva`, `ConfirmarVentaReservada`, `ExpirarReservasVencidas`, `ConsultarDisponibilidad` — `inventory.module.ts`, `index.ts` — Constitución I · spec §3. Prueba: [`inventario.e2e-spec.ts`](../../backend/test/inventario.e2e-spec.ts) (la aplicación se arma con el módulo real) y `npm run arquitectura`

**Checkpoint**: modelo y fronteras listos; las historias pueden describirse sobre ellos.

---

## Phase 2: US1 — Registrar movimientos manuales (P1) 🎯 MVP

**Goal**: el titular registra INGRESO, DEVOLUCION o AJUSTE (con signo, solo AJUSTE); el stock cambia por delta y queda un movimiento.

**Independent Test**: registrar un ingreso de 10 y un ajuste de −3 con motivo; el físico es 7 y hay dos movimientos con actor.

- [X] T005 [US1] `RegistrarMovimientoStock`: tipo manual válido, cantidad entera (negativa solo en AJUSTE), motivo ≤ 200 caracteres y obligatorio en AJUSTE; delega en `variarStock` — `inventario.use-cases.ts` — HU14 · RF12 · R3. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («registra ingresos, devoluciones y ajustes…», «un ajuste exige motivo…»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts)
- [X] T006 [US1] `POST /api/v1/inventario/productos/:productoId/movimientos` (controlador): 201 con las existencias resultantes, 400 por entrada inválida, 409 si el físico quedaría por debajo de lo reservado — `entry-adapters/inventario.controller.ts` — HU14 · RF12 · R3. Prueba: [`inventario.e2e-spec.ts`](../../backend/test/inventario.e2e-spec.ts) («el titular registra un ingreso y un ajuste…», «entradas inválidas: 400… y… 409»)
- [X] T007 [US1] Prevención de stock negativo en el caso de uso: un ajuste no baja de cero ni de lo reservado — `domain/stock.ts` (`variarFisico`), `inventario.use-cases.ts` — RF14 · R1, R3. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («prevención de stock negativo…»), [`stock.spec.ts`](../../backend/src/modules/inventory/domain/stock.spec.ts) («un ajuste no puede dejar el físico por debajo de lo reservado»)
- [X] T008 [US1] `variarStock` en PostgreSQL: crea la fila si falta, aplica el delta con `UPDATE` condicionado a `físico + Δ ≥ reservado` y escribe el movimiento en la misma transacción — `infrastructure/prisma-inventario.repository.ts` — RF12, RF13 · R3. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («movimientos y actualizaciones de stock (RF12, RF13)»: 60 ingresos simultáneos suman 60; 30 ajustes de −1 sobre stock 10 aplican exactamente 10) — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*

**Checkpoint**: US1 verificada con dobles y por HTTP; su atomicidad en PostgreSQL (T008) pasó en `test:db` el 2026-11-23.

---

## Phase 3: US2 — Consultar existencias y movimientos (P1)

**Goal**: ver físico, reservado y disponible por producto o por puesto, y el historial (más reciente primero).

**Independent Test**: producto sin existencias → ceros; tras un ingreso, el listado y el historial lo reflejan; el comerciante B no ve nada del A.

- [X] T009 [P] [US2] `ConsultarInventarioProducto` (ceros si no hay fila) y `ListarInventario` (comerciante: solo sus puestos; administrador: todos; `puestoId` ajeno → 403; paginación) — `inventario.use-cases.ts` — HU14 · RF14 · R1, R7. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («Consultas (RF14, HU15)»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts) («el comerciante lista solo las existencias de sus puestos…»)
- [X] T010 [P] [US2] `ListarMovimientos`: historial paginado con tipo, variación, saldo, actor y referencia — `inventario.use-cases.ts` — HU15 · RF13. Prueba: [`inventario.e2e-spec.ts`](../../backend/test/inventario.e2e-spec.ts) («…el stock y los movimientos se actualizan»)
- [X] T011 [US2] Rutas `GET /api/v1/inventario`, `GET …/productos/:id` y `GET …/productos/:id/movimientos` — `entry-adapters/inventario.controller.ts` — HU14, HU15 · RF14. Prueba: [`inventario.e2e-spec.ts`](../../backend/test/inventario.e2e-spec.ts) («un producto sin existencias registradas se muestra con ceros», «el stock reservado y el disponible se reflejan en la consulta»)
- [X] T012 [US2] Contrato OpenAPI de las cuatro operaciones `inventario_*` (spec 005) — `backend/src/shared/http/openapi/operaciones.ts` — RF14. Prueba: [`documento.spec.ts`](../../backend/src/shared/http/openapi/documento.spec.ts) (incluye `POST /api/v1/inventario/productos/{productoId}/movimientos`)

**Checkpoint**: US1 + US2 forman el MVP de gestión de inventario.

---

## Phase 4: US3 — Reservar stock (P1)

**Goal**: `ReservarInventario` reserva varios productos todo‑o‑nada, ordenados por `productoId`, idempotente por `claveOperacion`; sin stock suficiente responde con conflicto controlado y no deja rastro.

**Independent Test**: stock 1 y dos operaciones distintas → una reserva y una falta de stock; repetir la misma clave no reserva de nuevo.

- [X] T013 [US3] `ReservarInventario`: valida clave (`^[A-Za-z0-9:_.-]{1,100}$`), 1–50 ítems sin repetir, cantidades enteras y vencimiento futuro; ordena por producto; delega en `reservar` — `inventario.use-cases.ts` — RF15, RF25 · R4, R5. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («valida la solicitud», «stock suficiente…», «stock insuficiente…», «el último stock se concede a una sola operación», «es todo-o-nada…», «idempotencia…», «reutilizar la clave… es un conflicto»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts)
- [X] T014 [US3] Integridad ante fallo a mitad de la transacción (lógica): no queda nada reservado ni registrado — `inventario.use-cases.ts` — AC08 · R4. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («integridad ante un fallo a mitad de la transacción…»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts) («un fallo a mitad de la transacción…»)
- [X] T015 [US3] `reservar` en PostgreSQL: `UPDATE … SET reservado = reservado + n WHERE físico − reservado ≥ n` en transacción corta, todo‑o‑nada, con reintento ante interbloqueo — `infrastructure/prisma-inventario.repository.ts` — RF15, RF25 · R2, R4. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («reservas: stock suficiente e insuficiente», «integridad de las transacciones (AC08)») — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*
- [X] T016 [US3] Concurrencia sobre las mismas unidades: dos compradores y un stock → uno gana; 50 compradores y stock 7 → exactamente 7; reservas y ajustes simultáneos conservan la invariante — AC07 · R1, R2. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («concurrencia: dos o más compradores sobre las mismas unidades (AC07)») — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*
- [X] T017 [US3] Idempotencia bajo concurrencia: la misma clave ×12 simultánea reserva una sola vez; reutilizar la clave con otros datos es conflicto — ADR-003 §7 · R5. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («reintentos e idempotencia (ADR-003 §7)») — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*
- [X] T018 [US3] Invariantes con operaciones aleatorias concurrentes (25 oleadas × 40 operaciones por semilla) — R1. Prueba: [`inventario-invariantes.db-spec.ts`](../../backend/test/inventario-invariantes.db-spec.ts) — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*
- [X] T019 [US3] EQ-03 (parte Vitest): serie 1 (stock 1, N = 2, 5 y 20, 100 iteraciones por N) y serie 2 (stock 10, 200 clientes, 100 iteraciones); comprobación SQL final `stock_reservado > stock_fisico` = 0 — AC07 · EQ-03. Prueba: [`eq03-concurrencia.db-spec.ts`](../../backend/test/eq03-concurrencia.db-spec.ts) — *ejecutada el 2026-11-23: 5 / 5 correctas; es una **repetición parcial** de la medición del 05/11 ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md)). **No repetida:** la medición con k6 ([`eq03-reserva.js`](../../ops/k6/eq03-reserva.js), [`servidor-eq03.ts`](../../backend/src/scripts/servidor-eq03.ts)); sigue vigente la del 2026-11-05 (400/400). Limitación de spec §5: mide `ReservarInventario`, no «confirmar pedido»*

**Checkpoint**: la lógica de US3 está verificada con dobles y la atomicidad y la concurrencia (T015–T018 y la parte Vitest de T019) pasaron en `test:db` el 2026-11-23; la medición con k6 de EQ-03 no se repitió.

---

## Phase 5: US4 — Liberar, confirmar y expirar (P2)

**Goal**: ciclo de vida de la reserva idempotente y serializado: solo la transacción que cambia el estado toca el stock.

**Independent Test**: liberar dos veces devuelve las unidades una vez; confirmar una reserva liberada o liberar una confirmada es conflicto; expirar solo toca lo vencido y no lo confirmado.

- [X] T020 [P] [US4] `LiberarReserva` y `ConfirmarVentaReservada`: idempotentes; confirmar baja físico y reservado a la vez sin descontar dos veces; liberar una venta confirmada y confirmar una reserva liberada son conflicto; clave inexistente → no encontrada — `inventario.use-cases.ts`, `domain/stock.ts` — RF54 (parcial) · R5, R6. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («Liberación, venta y expiración»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts), [`stock.spec.ts`](../../backend/src/modules/inventory/domain/stock.spec.ts)
- [X] T021 [P] [US4] `ExpirarReservasVencidas` (lote de 100; cada reserva en su transacción): libera solo las vencidas y no toca las confirmadas — `inventario.use-cases.ts` — RF54 (parcial) · ADR-003 §6.5. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («la expiración libera solo las reservas vencidas y es idempotente», «una reserva ya confirmada no se expira»)
- [X] T022 [US4] Serialización en PostgreSQL con `UPDATE … WHERE estado = 'RESERVADA'`: liberar ×10 devuelve una vez; confirmar ×10 descuenta una vez; liberar y confirmar a la vez, y expiración y confirmación a la vez (Webhook), nunca liberan lo ya vendido — ADR-003 §6.4–6.5 · R6. Prueba: [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) («liberación, venta y expiración (ADR-003 §6.4–6.5)») — *ejecutada el 2026-11-23: correcta; CI 2026-11-18 también correcto ([evidencia](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md))*

**Checkpoint**: US1–US4 descritas. Quedan fuera de alcance la consulta del pago antes de expirar y la aprobación tardía (dependen de Pagos; DEC-01/DEC-02).

---

## Phase 6: Autorización y aislamiento entre comerciantes (transversal)

**Purpose**: rol y propiedad en el caso de uso (constitución V y VIII; spec R7)

- [X] T023 [P] Autorización por caso de uso: solo el titular escribe; el administrador solo lee; cliente y trabajador 403; se autoriza **antes** de validar la entrada; producto inexistente o identificador malformado → 404 — `inventario.use-cases.ts` (`cargarConAcceso`) — AC04, AC12 · R7. Prueba (Doble): [`inventario.use-cases.spec.ts`](../../backend/src/modules/inventory/application/use-cases/inventario.use-cases.spec.ts) («autorización: solo el titular escribe…», «autoriza antes de validar la entrada…»), [`inventario.jest-spec.ts`](../../backend/test/jest/inventario.jest-spec.ts)
- [X] T024 [P] Acceso cruzado y roles por HTTP: el comerciante B no lee ni modifica el inventario de A; sin sesión 401; cliente y trabajador 403; administrador lee pero no escribe — AC04, AC12 · R7. Prueba: [`inventario.e2e-spec.ts`](../../backend/test/inventario.e2e-spec.ts) («sin autenticar: 401», «acceso cruzado (AC12)…», «roles sin permiso…», «producto inexistente o identificador malformado: 404»)
- [X] T025 [P] Matriz rol × ruta de las cuatro rutas de `/api/v1/inventario` — AC04. Prueba: [`matriz-autorizacion.e2e-spec.ts`](../../backend/test/matriz-autorizacion.e2e-spec.ts)

---

## Phase 7: Verificación y revisión

- [X] T026 Ejecutar y registrar resultados reales en `backend/`: `npm test`, `npm run test:e2e`, `npm run arquitectura` — constitución IX
  - *Resultado (2026-11-23):* ver «Resultados de la verificación».
- [X] T027 Ejecutar `npm run test:db` en local (Docker y base aislada `mercado-test-db`, puerto 55433) y marcar T001, T008, T015–T019 y T022 con sus resultados — constitución VII (pruebas de concurrencia)
  - *Resultado (2026-11-23):* **7 archivos, 73 / 73** (código de salida 0); salida en [`test-db.txt`](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/test-db.txt) y [`test-db-detalle.txt`](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/test-db-detalle.txt). Contenedor creado para esta ejecución, 4 migraciones aplicadas con `migrate deploy`; el contenedor se detuvo después (`stop`), sin borrar el volumen.
- [ ] T028 Repetir EQ-03 de punta a punta cuando exista `POST /pedidos` (spec §5) — AC07 · EQ-03 — *bloqueada: no existe el módulo de Pedidos en el repositorio ni la spec 003*

---

## Matriz de trazabilidad (HU/RF/AC → regla → tareas → código → prueba)

| Requisito | Regla | Tareas | Código | Prueba | Estado (2026-11-23) |
|---|---|---|---|---|---|
| RF12 · HU14 | R3 | T005, T006, T008 | `RegistrarMovimientoStock`, controlador, `variarStock` | `inventario.use-cases.spec.ts`; `inventario.e2e-spec.ts`; `inventario.db-spec.ts` | Doble, HTTP y base de datos **correctos** |
| RF13 · HU15 | — | T008, T010 | `ListarMovimientos`, tabla de movimientos | `inventario.e2e-spec.ts`; `inventario.db-spec.ts` | HTTP y libro en base de datos **correctos** |
| RF14 | R1 | T001, T002, T007, T009, T011, T012 | `Stock`, `CHECK` | `stock.spec.ts`; `inventario.use-cases.spec.ts`; `inventario.e2e-spec.ts`; `documento.spec.ts`; `inventario.db-spec.ts` | Dominio, doble, HTTP y `CHECK` **correctos** |
| RF15 · AC07 | R2 | T013, T015, T016, T019 | `ReservarInventario`, `reservar` | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts`; `eq03-concurrencia.db-spec.ts` | Lógica, atomicidad y EQ-03 (Vitest) **correctas**; k6 no repetido |
| RF25 | R4 | T013, T014, T015 | `ReservarInventario`, `reservar` | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts` | Doble y base de datos **correctos** |
| RF54 (parcial) · ADR-003 §6.5 | R6 | T020, T021, T022 | `LiberarReserva`, `ConfirmarVentaReservada`, `ExpirarReservasVencidas` | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts` | Doble y serialización **correctos** |
| ADR-003 §7 | R5 | T013, T017 | `ReservarInventario`, `reservar` | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts` | Doble y concurrencia **correctos** |
| AC08 | R4 | T001, T014, T015 | transacciones del repositorio | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts` | Doble y reversión real **correctos** |
| AC04 · AC12 | R7 | T023, T024, T025 | `cargarConAcceso` | `inventario.use-cases.spec.ts`; `inventario.e2e-spec.ts`; `matriz-autorizacion.e2e-spec.ts` | **Correctos** |
| EQ-03 | R1, R2 | T019, T028 | `servidor-eq03.ts`, k6 | `eq03-concurrencia.db-spec.ts`; `ops/k6/eq03-reserva.js` | Vitest **correcto** (repetición parcial 2026-11-23); k6 **no repetido**: vigente la medición 2026-11-05 |

## Resultados de la verificación (2026-11-23)

| Campo | Valor |
|---|---|
| Entorno | Windows 11, Node.js 24.13.1, npm 11.8.0, Vitest 4.1.12, Jest 30.5.2; `npm ci` desde `package-lock.json` en `backend/` |
| Base | `main` en `917a521` (PR #13) más esta rama `docs/sdd-001-inventario`; el código del módulo no se modificó |
| Red y datos | Unitarias, HTTP, Jest y arquitectura: sin `.env`, Supabase ni base de datos. `test:db`: contenedor local `mercado-test-db` (`127.0.0.1:55433/mercado_test`), creado para la ejecución |

| Comando (en `backend/`) | Resultado |
|---|---|
| `npm test` (`vitest run`) | **21 archivos, 338 / 338** (desde PowerShell; ver nota) |
| `npm run test:e2e` | **9 archivos, 132 / 132** con `DATABASE_URL` ficticia (`postgresql://u:p@127.0.0.1:1/x`, sin conexión real). **Sin** esa variable: 131 / 132; falla solo `app.e2e-spec.ts` («DATABASE_URL no está definida») |
| `npm run arquitectura` | Sin violaciones (111 módulos, 375 dependencias) |
| `npx vitest run src/modules/inventory` | 2 archivos, **40 / 40** (`stock.spec.ts` y `inventario.use-cases.spec.ts`) |
| `npm run test:jest` | 6 suites, **88 / 88**; incluye `stock.jest-spec.ts` e `inventario.jest-spec.ts` |
| `npm run test:db` | **7 archivos, 73 / 73**: `inventario.db-spec.ts` 25, `inventario-invariantes.db-spec.ts` 3, `eq03-concurrencia.db-spec.ts` 5, `modelo-restricciones.db-spec.ts` 13, más carrito, productos y H0 (27). Evidencia con fecha y commit en [`docs/07-sprint-02/evidencias/2026-11-23/inventario/`](../../docs/07-sprint-02/evidencias/2026-11-23/inventario/README.md) |

**Nota sobre el entorno:** desde Git Bash (ruta `d:/…` con la unidad en minúscula) `npm test` falló en 20 de 21 archivos con `Cannot read properties of undefined (reading 'config')`; no es un fallo del código: ejecutado desde PowerShell (`D:\…`) los 338 pasan. No se investigó la causa raíz más allá de ese cambio de shell.

**Limitaciones:** (1) `test:db` se ejecutó una vez completa y otra con reporte detallado, en una sola máquina y sobre PostgreSQL 17 desechable de Docker; no se midió la estabilidad entre ejecuciones; (2) las pruebas unitarias, HTTP y Jest usan el repositorio en memoria, que reproduce las reglas pero no el motor; la atomicidad y la concurrencia solo las respaldan las `*.db-spec.ts`; (3) EQ-03 se repitió **solo en su parte Vitest**: no se repitió con k6 ni de punta a punta (T028); (4) la rama no tiene commits nuevos: el resultado corresponde al código de `917a521`; (5) la cobertura de Jest es una selección de archivos y no representa la del backend.

## Dependencias y orden de ejecución

- Phase 1 → US1 y US2 (P1, paralelas) → US3 (P1) → US4 (P2, usa la reserva de US3) → Phase 6 transversal → Phase 7.
- Dentro de cada historia, la lógica con dobles (`[X]`) precede a la comprobación en PostgreSQL: la segunda es la que respalda la constitución VII. Única tarea abierta: T028 (depende de Pedidos).
- Paralelas: T002/T003; T009/T010; T020/T021; T023/T024/T025.

## Notas

- NO hacer `push` ni `merge`; los commits los hace el responsable, con la autoría humana configurada y sin atribuciones de IA (CLAUDE.md, hooks).
- Pendientes que no decide esta spec: Pagos (DEC-01/DEC-02), Auditoría (DEC-05, RF42) y Configuración (RF45); constan en `plan.md` (Dependencias y riesgos).
