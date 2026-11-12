---

description: "Tareas de Pedidos y subpedidos (S-07): crear y consultar el pedido"
---

# Tasks: Pedidos y subpedidos (S-07)

**Input**: `specs/003-pedidos-subpedidos/` — spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

**Prerequisites**: `main` en `1aab552` (Carrito e Inventario integrados). **No se implementa nada hasta la autorización explícita del responsable.**

**Tests**: OBLIGATORIAS (constitución IX), escritas **antes** de la implementación de cada historia y verificadas en rojo. Todo lo que no se ejecute se informa como no ejecutado.

## Format: `[ID] [P?] [Story] Descripción (archivos) — RF/HU · CA — Verificación`

- **[P]**: paralelizable (archivos distintos, sin dependencias incompletas)
- Rutas relativas a `backend/` salvo indicación; `<ts>` = marca de tiempo de la migración
- Reglas permanentes: no tocar `frontend/`, `specs/001-inventario/`, `specs/002-carrito/`, `.specify/feature.json` ni `docs/01`–`docs/04`; **ninguna migración sobre la base compartida, commit, push ni merge sin orden explícita**; las pruebas de base de datos usan solo el PostgreSQL local aislado.

## Historias de usuario

| Id | Historia | Prioridad | Criterios |
|---|---|---|---|
| US1 | Crear un pedido multivendedor desde mi carrito (HU07) | P1 🎯 MVP | CA-O1–O9, O21, O23, O24 |
| US2 | Reintentar sin duplicar y con concurrencia segura (ADR-003 §7) | P1 | CA-O10–O13, O20, O23, O26–O28 |
| US3 | Consultar el estado y los importes de mi pedido (HU09) | P2 | CA-O4, O14–O16, O25 |
| US4 | Ver el historial de cambios de estado (HU09, RF31) | P2 | CA-O17–O19 |

---

## Fase 0 — Compuerta de diseño (bloquea todo lo demás)

- [x] **POC-001** [GATE] Verificar con **PostgreSQL real** que la unidad de trabajo propaga la misma transacción entre repositorios, revierte todo, admite anidación controlada y no filtra el contexto entre solicitudes concurrentes. Archivos **aislados** (nada existente se modifica): `src/shared/infrastructure/prisma/contexto-transaccional.ts`, `unidad-de-trabajo.ts`, `errores-transitorios.ts` (+ su `*.spec.ts` unitario) y `test/poc-unidad-de-trabajo.db-spec.ts`. — CA-O9, CA-O27 · research D1–D2 · R1, R3 — **Verificación**: las ocho comprobaciones V1–V8 de §«Diseño de POC-001» en verde, **3 ejecuciones consecutivas**.
  - **RESULTADO (2026-11-06): POC-001 APROBADA.** V1–V8 en verde en **3 ejecuciones completas consecutivas** (33/33 cada una) y además con orden aleatorio y con un rol de base de datos sin superusuario; detalle, evidencia y limitaciones en [`poc-001-resultado.md`](poc-001-resultado.md). Las tareas T001–T029 **siguen sin autorizar**.
  - **Si cualquier comprobación falla: DETENER la implementación**, registrar el hallazgo y solicitar revisión del diseño (plan alternativo: contexto explícito, que exige nueva aprobación). No se ejecuta ninguna tarea posterior.

---

## Fase 1 — Fundamentos (depende de POC-001 en verde)

- [x] T001 Integrar el mecanismo validado en `PrismaService` (`db`, `atomico()`, `unidadDeTrabajo()`), reutilizando los archivos de POC-001; fuera de una unidad el comportamiento es idéntico al actual (`src/shared/infrastructure/prisma/prisma.service.ts`; renombrar la prueba a `test/unidad-de-trabajo.db-spec.ts` ejecutada contra `PrismaService`). — plan «Archivos que cambiarían» · R1, R9 — **Verificación**: la suite de POC-001 pasa contra `PrismaService`; `npm test` y `npm run build` sin errores.
- [x] T002 Inventario participa en la unidad: los 4 métodos de escritura usan `atomico()`; exportar `StockInsuficienteError` (`src/modules/inventory/infrastructure/prisma-inventario.repository.ts`, `src/modules/inventory/index.ts`). — RF25, RF15 · R2 — **Verificación (compuerta de regresión)**: `inventario.use-cases.spec`, `inventario.e2e-spec`, `inventario.db-spec`, `inventario-invariantes.db-spec`, `eq03-concurrencia.db-spec` **sin cambio de resultado**; prueba nueva: `reservar` dentro de una unidad comparte `txid` y se revierte con ella.
- [x] T003 Carrito participa en la unidad: `agregar` usa `atomico()`; nuevos `bloquearYListar` (FOR UPDATE de carrito e ítems, orden por producto) y `vaciarItems` en el repositorio y el puerto, con su doble en memoria (`src/modules/cart/infrastructure/prisma-carrito.repository.ts`, `src/modules/cart/application/ports/ports.ts`, `src/modules/cart/application/use-cases/test-doubles.ts`). — Q4, RF24 · R2, R8 — **Verificación**: `carrito.use-cases.spec`, `carrito.e2e-spec`, `carrito.db-spec` sin cambio; pruebas nuevas: `bloquearYListar` bloquea `agregar`/`fijarCantidad`/`quitar` concurrentes hasta el commit, carrito inexistente devuelve vacío.
- [x] T004 [P] Catálogo en lote y por la conexión activa: `ObtenerDetallesCatalogo(ids[])` (puerto, caso de uso, repositorio `detalles` con `db`) y export en `index.ts`/módulo (`src/modules/catalog/application/ports/catalogo.repository.ts`, `…/use-cases/catalogo.use-cases.ts`, `…/infrastructure/prisma-catalogo.repository.ts`, `src/modules/catalog/index.ts`, `catalog.module.ts`). — RF19, DA11 — **Verificación**: pruebas unitarias del lote (omite no publicados, ≤ 50 ids, una consulta) y `catalogo.use-cases.spec`/e2e existentes sin cambio; prueba PostgreSQL: dentro de una unidad usa la misma `txid`.
- [x] T005 API pública de Carrito para Pedidos: casos de uso `ObtenerCarritoParaPedido` (exige unidad vigente, bloquea, lee Catálogo en lote, devuelve líneas comprables o no y `carritoId`) y `VaciarCarritoDelPedido`; `cart/index.ts` y exports del módulo (`src/modules/cart/application/use-cases/pedido.use-cases.ts` + `.spec.ts`, `src/modules/cart/index.ts`, `cart.module.ts`). Depende de T003 y T004. — Q4, FR-027 · CA-O23 — **Verificación**: unitarias (falla sin unidad, vacío/sin carrito, líneas no comprables, orden estable); PostgreSQL: durante la lectura bloqueada ninguna edición concurrente se pierde ni se duplica; `npm run arquitectura` sin violaciones.

**Checkpoint**: la unidad de trabajo existe en `PrismaService`; Inventario, Carrito y Catálogo participan; las suites existentes siguen en verde.

---

## Fase 2 — US1: Crear un pedido multivendedor (P1) 🎯 MVP

### Pruebas US1 ⚠️ (escribir primero; deben fallar)

- [x] T006 [P] [US1] Pruebas unitarias del dominio: `pedido.entity.spec.ts` (1–50 líneas, agrupación por puesto, subtotales y total exactos con 0.10×3, 19.99×3 y máximos), `estado-subpedido.spec.ts` (todas las transiciones de C4 N4 válidas e inválidas), `estado-general.spec.ts` (común / `MIXTO`), `codigo-pedido.spec.ts` (`PED-` + 8, alfabeto sin `I L O U`, 1 000 sin repetir con aleatoriedad inyectada), `huella-carrito.spec.ts` (orden estable, sensibilidad al contenido) (`src/modules/orders/domain/*.spec.ts`). — RF26–RF29, RF31 · CA-O1, O2, O3, O5, O19, O25 — **Verificación**: rojas antes de T008.
- [x] T007 [P] [US1] Pruebas unitarias de `CrearPedido` con dobles: éxito; stock insuficiente; carrito vacío; líneas no vigentes; configuración ausente/inválida (503); repetición devuelve el pedido existente con carrito vacío; **no** se reintentan errores de dominio; error transitorio reintenta la unidad completa (máx. 5) y luego 503; colisión de código reintentada sin consumir intentos de transacción; fallo forzado en cada paso restaura todos los almacenes en memoria; rol distinto de cliente (`src/modules/orders/application/use-cases/crear-pedido.use-cases.spec.ts`). — RF25, RF26 · CA-O6, O7, O8, O10, O24, O26 — **Verificación**: rojas antes de T010.
  - T007 pospuesta hasta disponer de T009 y T010. No ejecutable como prueba funcional independiente en este incremento.
  - Ejecutada después de T009, con rojo funcional (50/50) antes de T010.

### Implementación US1

- [x] T008 [US1] Dominio de Pedidos: `pedido.entity.ts`, `subpedido.entity.ts`, `linea-pedido.ts`, `estado-subpedido.ts`, `estado-general.ts`, `codigo-pedido.ts`, `huella-carrito.ts`, `errors.ts` (`src/modules/orders/domain/`). Sin NestJS ni Prisma. — RF26–RF29, RF31 · CA-O1–O3, O5, O19, O25 — **Verificación**: T006 en verde.
- [x] T009 [US1] Puertos y dobles de aplicación: `PedidoRepository`, `UnidadDeTrabajo`, `CarritoPort`, `ReservaInventarioPort`, `ConfiguracionReservaPort`, `RelojPort`, `GeneradorCodigoPort`, y `test-doubles.ts` con una **unidad de trabajo en memoria que restaura los almacenes y simula los reintentos ante errores transitorios (máx. 5)** (`src/modules/orders/application/ports/*.ts`, `…/use-cases/test-doubles.ts`). — contracts §4 — **Verificación**: compila; `npm run arquitectura` sin violaciones (dominio y aplicación sin framework).
- [x] T010 [US1] Caso de uso `CrearPedido` (flujo del plan: rol, clave, duración, unidad con lectura autoritativa, dominio, inserción, vaciado, reserva al final) (`src/modules/orders/application/use-cases/crear-pedido.use-case.ts`). — RF25–RF29, FR-006–FR-011, FR-027 · CA-O1–O8, O24 — **Verificación**: T007 en verde.
  - DI-1 y DI-2 aplicadas tras T010 (plan.md «Decisiones de implementación aprobadas»): `insertar` devuelve el pedido con código; la repetición se resuelve antes de consultar la configuración. Pruebas: `crear-pedido.use-cases.spec.ts` (DI-2).
- [x] T011 [US1] Esquema y migración **aditiva** `<ts>_pedidos`: 4 modelos, enum `EstadoPedidoPuesto`, relaciones inversas, `CHECK`, claves foráneas compuestas, triggers de inmutabilidad (**sin** triggers diferidos de totales), RLS (`prisma/schema.prisma`, `prisma/migrations/<ts>_pedidos/migration.sql`). — data-model §2–§3 · AC08 — **Verificación**: `npx prisma validate`; migración **revisada** y aplicada **solo** a la base local aislada (`npm run db:test:migrate`); **no** se aplica a la base compartida sin orden explícita.
  - Migración `20261109000000_pedidos` revisada y aplicada solo a `mercado_test` (127.0.0.1:55433). Estructura verificada en `test/pedidos-esquema.db-spec.ts` (catálogo, aditividad y sincronía con `schema.prisma`); el comportamiento de las restricciones se prueba en T016.
- [x] T012 [US1] `PrismaPedidoRepository`: `bloquearCliente` (bloqueo consultivo; `pg_advisory_xact_lock` devuelve `void`, tipo que Prisma no deserializa en consultas crudas: se ejecuta con `$executeRaw` o se convierte el resultado; **riesgo a verificar** en esta tarea), `buscarPorClave`, `insertar` con código y colisión resuelta con `ON CONFLICT DO NOTHING` (bucle propio ≤ 5), `guardarDetalle` (subpedidos, líneas, historial inicial en bloque), lecturas por cliente; importes con `NUMERIC` sin coma flotante (`src/modules/orders/infrastructure/prisma-pedido.repository.ts`). Depende de T011. — RF26–RF29, RF31 · CA-O2, O3 — **Verificación** (original): ~~pruebas de persistencia de T016~~ → **revisada** (regularización del 2026-11-07, aprobada por el responsable): ver abajo.
  - **Regularización (2026-11-07).** La verificación original dependía de una tarea posterior (T016). Se separa así:
    - **Verificación aislada de T012 (criterio vigente)**: `test/pedidos-repositorio.db-spec.ts` (repositorio contra PostgreSQL en un esquema desechable de la base aislada, sin `session_replication_role`) y `src/modules/orders/infrastructure/importes.spec.ts` en verde en **3 ejecuciones consecutivas**, junto con `pedido-reconstitucion.spec.ts`; y sin regresiones en las suites unitaria, HTTP y PostgreSQL completas, `npx prisma validate`, `npm run lint`, `npm run build` y `npm run arquitectura`; `tsc --noEmit` sin errores nuevos.
    - **Integración completa (responsabilidad de T016, no de T012)**: restricciones PostgreSQL (únicos, `CHECK`, claves foráneas compuestas, RLS, inmutabilidad), CA-O4, fallo inyectado tras cada paso del flujo `CrearPedido`, consultas de integridad `total = Σ subtotales` / `subtotal = Σ líneas` y EQ-02. T016 sigue **pendiente**.
  - **Resultados reales (2026-11-07, base `mercado_test` en `mercado-test-db`, 127.0.0.1:55433)**: específicas 3/3 ejecuciones en verde (21/21 PostgreSQL; 27/27 unitarias de `importes` + reconstitución); unitarias 548/548; HTTP 126/126; PostgreSQL 191/191 (14 archivos); `prisma validate`, lint (0 errores; 5 avisos, ninguno en archivos de T012), build y arquitectura (133 módulos, 0 violaciones) correctos; `tsc --noEmit`: 3 errores, los 3 **preexistentes** en `1aab552` (`autenticacion.e2e-spec`, `inventario.db-spec`, `inventario-invariantes.db-spec`), 0 nuevos.
  - **Riesgo `void` verificado**: con `$queryRaw`, `pg_advisory_xact_lock` falla (`P2010 · Failed to deserialize column of type 'void'`, `UnsupportedNativeDataType`); con `$executeRaw` funciona. El repositorio usa `$executeRaw`.
  - **Sensibilidad (mutaciones controladas, posteriores a la implementación; no son evidencia de pruebas escritas antes)**: 20 de 23 mutaciones detectadas (bloqueo, clave del bloqueo, `$queryRaw`, `ON CONFLICT`, límite de códigos, traducción del conflicto de clave, filtros por cliente de `buscarPorId`/`listar`/`historial`, orden, historial y líneas de `guardarDetalle`, unidad obligatoria, lectura por la transacción, total persistido, conversión de importes). Sobreviven 3, que son huecos de las **pruebas**, no defectos del código: escritura de importes con coma flotante (solo diverge cerca de 9·10¹⁵ céntimos, fuera de los importes del dominio), y las validaciones de reconstitución «subtotal = Σ líneas» y «subtotal de línea», enmascaradas por la validación del nivel superior en sus pruebas.
  - **Sin evidencia de rojo previo**: no consta que las pruebas de T012 se vieran fallar antes de la implementación; no se reconstruye a posteriori.
  - **Alcance**: añade `Pedido.reconstituir` (dominio) y `ClaveIdempotenciaEnUsoError` (puerto). Las lecturas `buscarPorId`, `listar` e `historial` corresponden al puerto de contracts §4 y quedan verificadas a nivel de repositorio (aislamiento por cliente, importes exactos, estados); los casos de uso y las rutas siguen siendo de **T021** y **T023**, que siguen pendientes.
- [ ] T013 [P] [US1] Adaptadores y servicios: `CarritoAdapter` y `InventarioAdapter` (solo `index.ts`; traducen `StockInsuficienteError`), `ConfiguracionReservaEntornoAdapter` (`PEDIDOS_RESERVA_MINUTOS`, regex `^[1-9][0-9]{0,7}$`, **sin valor predeterminado**), `RelojSistema`, `GeneradorCodigoCriptografico` (`crypto.randomInt`) (`src/modules/orders/infrastructure/*.ts` + `*.spec.ts`). — Q2, Q9, RF27 · CA-O2, O24, O26 — **Verificación**: unitarias de la tabla de validación (ausente, vacía, `0`, `-1`, `1.5`, `1e3`, ` 5`, `007`, 9 dígitos, válidos), del alfabeto y la longitud, y de la traducción de errores.
- [ ] T014 [US1] Unidad de trabajo y cableado: `PostgresUnidadDeTrabajo`, `orders.module.ts` (importa `CartModule` e `InventoryModule`), `PedidosController` con `POST /api/v1/pedidos` (201 al crear, **200 en repetición**), `index.ts` del módulo, variable `PEDIDOS_RESERVA_MINUTOS` **comentada y sin valor** en `.env.example` (`src/modules/orders/infrastructure/postgres-unidad-de-trabajo.ts`, `…/orders.module.ts`, `…/entry-adapters/pedidos.controller.ts`, `…/index.ts`, `.env.example`). — RF26, FR-021 — **Verificación**: `npm run build`, `npm run arquitectura`.
- [ ] T015 [US1] Pruebas HTTP del POST con la aplicación en memoria (extender `test/helpers/app-en-memoria.ts` con dobles de Pedidos): 201, 400 (clave ausente/mal formada), 401, 403, 409 (stock con `productoId`, carrito vacío, líneas no vigentes), 503 (sin configuración), el pedido pertenece al cliente de la sesión y no al del cuerpo, importes exactos de un pedido de 3 puestos (`test/pedidos.e2e-spec.ts`, `test/helpers/app-en-memoria.ts`). — RF26, RF28, RF32 · CA-O1, O5, O6, O8, O13, O16, O21, O24 — **Verificación**: verdes.
- [ ] T016 [US1] Pruebas de PostgreSQL de integridad y **EQ-02**: restricciones (únicos, `CHECK`, claves foráneas compuestas, RLS, inmutabilidad), cambio de precio posterior sin alterar el pedido (CA-O4), y **fallo inyectado tras cada paso** (bloqueo, lectura, inserción, detalle, vaciado, reserva) comparando por SQL antes y después pedidos, subpedidos, líneas, historial, reservas, movimientos, `stock_reservado` y líneas del carrito; consultas de integridad `total = Σ subtotales` y `subtotal = Σ líneas`; la limpieza usa `session_replication_role = replica` solo sobre filas etiquetadas (`test/pedidos.db-spec.ts`, `test/pedidos-atomicidad.db-spec.ts`, `test/helpers/pedidos-db.ts`). — AC08, EQ-02 · CA-O2, O3, O4, O6, O7, O9, O18, O21 — **Verificación**: **0** pedidos, subpedidos, reservas o líneas de carrito inconsistentes tras cada fallo (SC-001).

**Checkpoint MVP**: un cliente crea un pedido de varios puestos, atómico y consultable por SQL.

---

## Fase 3 — US2: Idempotencia y concurrencia (P1)

### Pruebas US2 ⚠️

- [ ] T017 [P] [US2] Pruebas PostgreSQL de concurrencia: 2 clientes por el último stock ×100 (EQ-03); 20 solicitudes con la misma clave → 1 pedido y 1 reserva; **2 claves distintas sobre el mismo carrito ×100 y cliente sin carrito** → 1 conversión, la otra «carrito vacío»; edición concurrente del carrito durante la creación (sin líneas perdidas ni duplicadas); pedidos cruzados para interbloqueo real con reintento acotado; colisión de código forzada con un generador determinista; reintentos agotados → 503; ninguna conexión adicional (pool de 3) (`test/pedidos-concurrencia.db-spec.ts`). — AC07, DA02 · CA-O2, O11, O20, O23, O26, O27, O28 — **Verificación**: rojas antes de T019.
- [ ] T018 [P] [US2] Pruebas HTTP y unitarias de idempotencia: repetir la clave → 200 con el mismo pedido y sin reservar de nuevo **con el carrito vacío o distinto**; una clave de otro cliente no devuelve su pedido; clave obligatoria y válida (`test/pedidos.e2e-spec.ts`, `crear-pedido.use-cases.spec.ts`). — ADR-003 §7 · CA-O10, O12, O13 — **Verificación**: rojas antes de T019.

### Implementación US2

- [ ] T019 [US2] Completar la creación concurrente y la repetición: bloqueo por cliente como primera sentencia, comprobación de repetición dentro de la unidad y atajo previo, integración de `unidadDeTrabajo` con la clasificación de errores (reintentar solo transitorios; no dominio ni integridad), colisión de código separada de los reintentos (`src/modules/orders/application/use-cases/crear-pedido.use-case.ts`, `…/infrastructure/prisma-pedido.repository.ts`, `…/postgres-unidad-de-trabajo.ts`). — FR-012–FR-015, FR-029 · CA-O10–O12, O20, O23, O26–O28 — **Verificación**: T017 y T018 en verde; **0** pedidos o reservas duplicados (SC-002, SC-003, SC-009–SC-011).

---

## Fase 4 — US3: Consultar mi pedido (P2)

- [ ] T020 [P] [US3] Pruebas HTTP de consulta: `GET /api/v1/pedidos` (paginación, solo propios, del más reciente al más antiguo), `GET /api/v1/pedidos/:id` (código, fecha, subpedidos, líneas, subtotales, total, `estadoGeneral` común o `MIXTO`), otro cliente → 404, id inválido → 404, 401/403, importes sin cambios tras modificar el precio del producto (`test/pedidos.e2e-spec.ts`, `test/pedidos.db-spec.ts`). — RF30, RF32 · CA-O4, O14, O15, O16, O25 — **Verificación**: rojas antes de T021.
- [ ] T021 [US3] Casos de uso `ConsultarPedido` y `ListarPedidos`, lecturas del repositorio y rutas `GET` en el controlador; respuestas con importes como texto y `estadoGeneral` derivado, sin `urlCheckout` (`src/modules/orders/application/use-cases/consultar-pedido.use-case.ts`, `listar-pedidos.use-case.ts`, `…/infrastructure/prisma-pedido.repository.ts`, `…/entry-adapters/pedidos.controller.ts`). — RF30, RF32, FR-016, FR-017 · CA-O14, O15, O25 — **Verificación**: T020 en verde.

---

## Fase 5 — US4: Historial de estados (P2)

- [ ] T022 [P] [US4] Pruebas del historial: HTTP `GET /api/v1/pedidos/:id/historial` (registro inicial por subpedido con `estadoAnterior` nulo, orden cronológico, paginación, ajeno → 404) y PostgreSQL (los triggers impiden `UPDATE` y `DELETE` de líneas e historial y la modificación de columnas protegidas de `pedidos` y `subpedidos`); la máquina de estados rechaza transiciones inválidas (`test/pedidos.e2e-spec.ts`, `test/pedidos.db-spec.ts`). — RF31, AC06 · CA-O17, O18, O19 — **Verificación**: rojas antes de T023.
- [ ] T023 [US4] Caso de uso `ConsultarHistorial`, lectura del repositorio y ruta del historial (`src/modules/orders/application/use-cases/consultar-historial.use-case.ts`, `…/infrastructure/prisma-pedido.repository.ts`, `…/entry-adapters/pedidos.controller.ts`). — RF31 · CA-O17–O19 — **Verificación**: T022 en verde.

---

## Fase 6 — Verificación transversal, mediciones y evidencias

- [ ] T024 [P] Matriz de autorización: 4 rutas × 6 identidades (anónimo, cliente, trabajador, comerciante, administrador, otro cliente) (`test/matriz-autorizacion.e2e-spec.ts`). — AC04, AC12 · CA-O16 — **Verificación**: 100 % de casos conformes.
- [ ] T025 **Compatibilidad con los tests existentes**: ejecutar completas y registrar resultados reales: `npm test`, `npm run test:e2e`, `npm run test:db`, `npm run lint`, `npm run build`, `npm run arquitectura`, `npx prisma validate` (sin cambios de resultado respecto a la línea base de Inventario, Carrito y Catálogo). — CA-O22 · R2 — **Verificación**: todas en verde; cualquier regresión detiene el avance.
- [ ] T026 **Medición EQ-02**: informe reproducible de fallos forzados con consultas SQL antes y después (0 pedidos, subpedidos, líneas o reservas inconsistentes) y su evidencia (`test/pedidos-atomicidad.db-spec.ts` con `EVIDENCIA_DIR`, `docs/05-implementacion/evidencias/EQ-02/<fecha>/`). — EQ-02, SC-001 — **Verificación**: informe generado con resultados reales.
- [ ] T027 **Medición EQ-03 sobre «crear pedido»**: arnés de medición con las mismas clases de producción y solo la base local aislada, y guion k6; repetir la línea base de `ReservarInventario` (400/400 iteraciones; 10 reservas con 200 usuarios virtuales) sobre el flujo completo y comparar (`src/scripts/servidor-pedidos.ts`, `ops/k6/eq03-pedido.js`, `docs/05-implementacion/evidencias/EQ-03/<fecha>/`). — EQ-03, AC07, R4 — **Verificación**: 0 pedidos o reservas incompatibles; sin errores inesperados; limitaciones declaradas. Si no se ejecuta, se informa como no ejecutada.
- [ ] T028 **Evidencias para la sustentación**: documento de lo implementado y verificado (`docs/05-implementacion/05-pedidos-subpedidos.md`), actualización de las matrices de cumplimiento de `docs/05` con estados reales, y registro de limitaciones y dependencias (Pagos S-08, Configuración S-04, DEC-05, DEC-09, DEC-06); **propuesta escrita** de enmienda a la tabla «Estado de los módulos» de la constitución (no se edita sin aprobación) y de las discrepancias con C4 N4 (`carritoId`, orden de la secuencia, reserva en una sola llamada, pago pendiente) para el registro DEC-12; **sin tocar** `docs/01`–`docs/04`. — constitución X — **Verificación**: cada RF/HU/CA enlaza a su prueba y a su resultado real.
- [ ] T029 **Revisión (etapa 8)**: checklist de Governance de la constitución (límites entre módulos, dominio sin framework, autorización y denegación, sin secretos, migración aditiva con RLS, importes exactos, trazabilidad, resultados reales), `/code-review`, e informe de lo implementado, verificado y pendiente. — constitución IX–X — **Verificación**: informe sin hallazgos críticos abiertos; el commit se crea **solo con orden explícita**, con autoría humana y sin atribuciones de IA.

---

## Dependencias y orden de ejecución

```text
POC-001 ──(en verde)──► T001 ──► T002 ─┐
                          │             ├─► T005 ──► [Fase 2: US1]
                          ├──► T003 ───┤
                          └──► T004 ───┘
US1:  T006 ∥ T007 (pruebas)  →  T008 → T009 → T010
      T011 → T012 ; T013 ∥ ; T014 (tras T010, T012, T013) → T015 → T016
US2:  T017 ∥ T018 (pruebas, tras US1) → T019
US3:  T020 → T021          (puede ir en paralelo con US4 tras US1)
US4:  T022 → T023
Fase 6: T024 ∥ T025 → T026 ∥ T027 → T028 → T029
```

- **Bloqueos duros**: POC-001 → todo; T001 → T002–T005; T011 → T012; US1 completa → US2, US3, US4.
- **Paralelas**: T003 ∥ T004 (tras T001); T006 ∥ T007; T013 ∥ T011/T012; T017 ∥ T018; T020 ∥ T022; T024 ∥ T025; T026 ∥ T027.
- **Mismo archivo, secuenciales**: `pedidos.controller.ts` (T014 → T021 → T023), `prisma-pedido.repository.ts` (T012 → T019 → T021 → T023), `crear-pedido.use-case.ts` (T010 → T019), `pedidos.e2e-spec.ts` (T015 → T018 → T020 → T022).

## Estrategia

1. **POC-001**. Si falla, **detener y revisar el diseño**.
2. Fundamentos con compuerta de regresión (T001–T005).
3. **MVP** = US1 (T006–T016). Luego US2 (obligatoria antes de considerarlo completo), US3 y US4.
4. Fase 6: compatibilidad, mediciones EQ-02/EQ-03 y evidencias.

---

## Diseño de POC-001

**Objetivo**: demostrar con PostgreSQL real, **antes** de tocar ningún módulo existente, que el contexto transaccional implícito es correcto, aislado y seguro bajo concurrencia.

**Aislamiento**: código nuevo y autónomo (`contexto-transaccional.ts`, `unidad-de-trabajo.ts` sobre un `PrismaClient` de prueba, `errores-transitorios.ts`); tablas **propias de la prueba** (`poc_uow_a`, `poc_uow_b`) creadas y eliminadas por la prueba en el PostgreSQL local aislado (guarda `base-aislada`); no es una migración. Tres «repositorios» de prueba imitan los patrones reales: uno con `db` directo, otro con `atomico()` como Inventario y otro con lecturas como Catálogo.

| Id | Qué se verifica | Cómo |
|---|---|---|
| **V1** Misma transacción | los tres repositorios usan **una** transacción | `txid_current()` y `pg_backend_pid()` idénticos en los tres dentro de la unidad y distintos de una conexión externa; los cambios no son visibles desde otra conexión hasta el commit; el repositorio B **lee lo que A escribió** sin confirmar |
| **V2** Rollback total | cualquier fallo revierte todo | error lanzado tras escribir A y B, error lanzado dentro de B tras escribir A, y violación de restricción: **0 filas** en ambas tablas |
| **V3** Anidación controlada | unidad dentro de unidad y `atomico()` dentro de unidad **se unen** | mismo `txid`, sin conexión adicional; un error interior revierte el exterior; el interior **no reintenta** por su cuenta: un error transitorio interior lo reintenta la unidad exterior completa, una sola vez |
| **V4** Sin fuga entre solicitudes | cada solicitud ve solo su transacción | 100 unidades concurrentes con esperas aleatorias (`setImmediate`, temporizadores, `Promise.all` interno): 100 `txid` distintos, cada fila lleva el `txid` de **su** solicitud; fuera de la unidad no hay contexto; un temporizador creado **antes** no hereda contexto; una promesa que sobrevive al commit y accede a `db` **falla de inmediato** (fail-fast) en lugar de usar el pool |
| **V5** Reintento de la unidad completa | transitorios reintentan todo el bloque; el resto no | **interbloqueo real** (dos unidades toman bloqueos consultivos en orden inverso): una recibe `40P01`, se reintenta el bloque entero y ambas terminan con **una sola fila cada una**; `40001` simulado; reintentos agotados tras exactamente **5** intentos → error de servicio no disponible; error de dominio y violación única (`23505`): **1** intento |
| **V6** Sin inanición del pool | una unidad retiene una sola conexión | pool de 3 con 30 unidades concurrentes de varias operaciones cada una: todas terminan, y `pg_stat_activity` nunca supera el máximo |
| **V7** Comportamiento actual preservado | `atomico()` fuera de una unidad se comporta como hoy | misma transacción corta con reintento; 20 llamadas concurrentes correctas |
| **V8** Contexto y promesas perezosas de Prisma | el almacén persiste a través de `await` y de consultas lanzadas en paralelo | `Promise.all` de varias consultas de `db` dentro de la unidad comparten `txid` |

**Criterio de aceptación**: V1–V8 en verde en **3 ejecuciones consecutivas**. **Criterio de fallo**: cualquier V1–V6 en rojo, o intermitencia → **detener**, no ejecutar T001 y entregar el hallazgo con una propuesta de rediseño para nueva aprobación. El resultado (éxito o fallo) se registra en este archivo junto a POC-001 y, si procede, en un informe breve de la POC.

---

## Matriz de trazabilidad (RF/HU → criterio → tareas → pruebas)

| HU · RF | Criterios | Tareas | Pruebas principales |
|---|---|---|---|
| HU07 · RF25 (reverificar y reservar) | CA-O6, O7, O8, O9, O20 | T002, T005, T007, T010, T016, T017 | `crear-pedido.use-cases.spec`, `pedidos-atomicidad.db-spec`, `pedidos-concurrencia.db-spec` |
| HU07 · RF26 (pedido de 1..N puestos) | CA-O1 | T006, T008, T015, T016 | `pedido.entity.spec`, `pedidos.e2e-spec` |
| HU07 · RF27 (código único) | CA-O2, O26 | T006, T012, T013, T016, T017 | `codigo-pedido.spec`, `pedidos.db-spec`, `pedidos-concurrencia.db-spec` |
| HU07 · RF28 (cliente del pedido) | CA-O21 | T015, T016 | `pedidos.e2e-spec`, `pedidos.db-spec` |
| HU07 · RF29 (subpedidos por puesto) | CA-O3 | T006, T016 | `pedido.entity.spec`, `pedidos.db-spec` |
| RF32 (presentación de subtotales y total) | CA-O5, O14 | T006, T015, T020, T021 | `pedido.entity.spec`, `pedidos.e2e-spec` |
| HU09 · RF30 (estado y consulta) | CA-O4, O14, O15, O16, O25 | T006, T020, T021, T024 | `estado-general.spec`, `pedidos.e2e-spec`, matriz |
| HU09 · RF31 (historial) | CA-O17, O18, O19 | T006, T016, T022, T023 | `estado-subpedido.spec`, `pedidos.db-spec`, `pedidos.e2e-spec` |
| ADR-003 §7 (idempotencia) | CA-O10, O11, O12, O13 | T007, T015, T017, T018, T019 | `pedidos-concurrencia.db-spec`, `pedidos.e2e-spec` |
| Q2 · RF45 (duración configurable) | CA-O24 | T013, T015 | `configuracion-reserva-entorno.adapter.spec`, `pedidos.e2e-spec` |
| Q4 · AC08 (carrito atómico y bloqueo) | CA-O23, O28 | T003, T005, T017, T019 | `carrito.db-spec`, `pedidos-concurrencia.db-spec` |
| Q5 · EQ-02 (atomicidad, reintento) | CA-O9, O27 | **POC-001**, T001, T016, T017 | `poc-unidad-de-trabajo.db-spec`, `pedidos-atomicidad.db-spec` |
| Constitución IX | CA-O22 | T025, T029 | suites completas, lint, build, arquitectura |

## Trazabilidad de requisitos funcionales de la especificación (FR → criterio → tareas)

| FR | Criterio | Tareas |
|---|---|---|
| FR-001 crear desde el carrito | CA-O1 | T008, T010, T014, T015 |
| FR-002 cliente de la sesión | CA-O21 | T015, T016 |
| FR-003 código único `PED-XXXXXXXX` | CA-O2, O26 | T006, T012, T013, T017 |
| FR-004 subpedido por puesto | CA-O3 | T006, T016 |
| FR-005 importes exactos | CA-O5 | T006, T015 |
| FR-006 reverificar y reservar | CA-O6 | T002, T007, T010, T016 |
| FR-007 falta de stock | CA-O7 | T007, T016 |
| FR-008 carrito vacío o no vigente | CA-O8 | T005, T007, T015 |
| FR-009 importes históricos | CA-O4 | T016, T020 |
| FR-010 atomicidad y reintentos (≤ 5) | CA-O9, O27 | POC-001, T001, T016, T017 |
| FR-011 estado inicial | CA-O1, O17 | T006, T008 |
| FR-012 idempotencia por `(cliente, clave)` | CA-O10 | T007, T018, T019 |
| FR-013 misma clave simultánea | CA-O11 | T017, T019 |
| FR-014 repetición sin comparar contenido; huella del carrito | CA-O12 | T012, T016, T018, T019 |
| FR-015 último stock | CA-O20 | T017 |
| FR-016 consulta y estado general | CA-O14, O25 | T020, T021 |
| FR-017 presentación sin datos de pago | CA-O5, O14 | T015, T021 |
| FR-018 historial inmutable | CA-O17, O18 | T011, T016, T022 |
| FR-019 transiciones permitidas | CA-O19 | T006, T022 |
| FR-020 solo cliente y aislamiento | CA-O15, O16 | T015, T020, T024 |
| FR-021 códigos HTTP | CA-O13, O16, O24 | T015, T020 |
| FR-022 errores controlados | CA-O9 | T015, T016 |
| FR-023 sin pago ni Webhook · FR-025 sin cancelación | (límites) | T014 (ninguna ruta de pago ni cancelación), T024 (la matriz solo contiene las 4 rutas), T029 |
| FR-024 sin tocar documentos originales | (límite) | reglas permanentes, T029 |
| FR-026 sin expiración (dependencia explícita) | (límite) | `plan.md` §«Reservas expiradas…», T028 |
| FR-027 lectura autoritativa y vaciado | CA-O23 | T003, T005, T010, T017 |
| FR-028 duración configurable | CA-O24 | T013, T015 |
| FR-029 serialización por cliente | CA-O28 | T012, T017, T019 |

## Notas

- Las tareas de pruebas preceden a la implementación y deben verse **fallar** primero; lo que no se ejecute se informará como no ejecutado.
- Las pruebas de base de datos usan el PostgreSQL local aislado de Docker (práctica vigente desde S-05/S-06; la constitución v1.1.1 dice «base de desarrollo»); la POC crea y elimina sus propias tablas `poc_uow_*` y las pruebas de pedidos limpian solo sus filas etiquetadas.
- **No** ejecutar commit, push, merge ni migraciones sobre la base compartida sin orden explícita; sin atribuciones de IA en commits ni PR.
- Las enmiendas aditivas a `specs/001-inventario` y `specs/002-carrito` quedan **diferidas** hasta que se confirmen los cambios del frontend sin commit.
