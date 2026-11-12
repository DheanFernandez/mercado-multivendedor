# Implementation Plan: Pedidos y subpedidos (S-07 · crear y consultar el pedido)

**Branch**: `feat/pedidos-backend` | **Date**: 2026-11-06 (revisión 2) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-pedidos-subpedidos/spec.md` (Clarify cerrado; resoluciones técnicas del equipo incorporadas el 2026-11-06)

**Trazabilidad**: HU07, HU09 · RF25–RF31 (+ RF32 solo presentación) · ADR-001, ADR-002, ADR-003 (§6.2, §7, §10) · RC04–RC07, RC11, RC12 · AC01, AC04, AC06–AC08, AC12 · DA02, DA07, DA09, DA14 · EQ-02 (y EQ-03 como complemento)

**Estado de este plan**: solo diseño. **No se ha modificado código, esquema, migraciones, dependencias ni módulos existentes.**

## Summary

Crear un pedido a partir del carrito del cliente autenticado como **una sola operación atómica** sobre PostgreSQL que abarca el pedido, sus subpedidos por puesto, las líneas con precios históricos, el historial inicial, las reservas de Inventario y el vaciado del carrito. La operación se ejecuta con una **unidad de trabajo compartida** (`uow.ejecutar(async () => …)`, sin parámetro de transacción) cuya transacción se propaga de forma implícita a los repositorios de Carrito, Pedidos, Inventario y Catálogo (lectura). Tres decisiones gobiernan la corrección:

1. **Fuente autoritativa del carrito**: el pedido se construye con el carrito leído **con bloqueo dentro de la transacción**; no hay lectura previa que pueda quedar obsoleta.
2. **Bloqueo estable por cliente**: un bloqueo consultivo transaccional por cliente serializa sus solicitudes (misma clave o claves distintas), incluso si el carrito no existe o está vacío.
3. **Idempotencia por `(cliente, clave)`** con restricción única como red de seguridad; la primera ejecución exitosa registra la identidad y la huella del carrito procesado, sin comparar contenido en los reintentos.

Antes de construir sobre la propagación implícita, la tarea **POC-001** la verifica con PostgreSQL real; si falla, se detiene la implementación y se revisa el diseño.

## Technical Context

**Language/Version**: TypeScript 6 (ESM), Node.js 24, NestJS 12

**Primary Dependencies**: las existentes (Prisma 7 + `@prisma/adapter-pg`, `@nestjs/config`). **Ninguna dependencia nueva**: `node:async_hooks` (contexto) y `node:crypto` (aleatoriedad y hash).

**Storage**: PostgreSQL 17; migración **aditiva** con RLS, `CHECK`, claves foráneas e índices; importes `NUMERIC`. Sin triggers diferidos de totales.

**Testing**: Vitest — unitarias (`npm test`), HTTP (`npm run test:e2e`), PostgreSQL (`npm run test:db`); `npm run build`, `npm run lint`, `npm run arquitectura`, `prisma validate`.

**Target Platform**: servidor Node 24; API REST `/api/v1`. **Project Type**: monolito modular (`backend/`); sin frontend en esta fase.

**Performance Goals**: AC01 no fija umbral numérico para pedidos; no se inventa. Se mide el comportamiento bajo concurrencia (EQ-02, EQ-03).

**Constraints**: transacción con operaciones **locales de PostgreSQL** únicamente (sin llamadas externas); una sola conexión por solicitud; ninguna llamada a Mercado Pago; ninguna duración de reserva en el dominio.

**Scale/Scope**: ≤ 50 productos distintos y ≤ 10 000 unidades por línea; 1 módulo nuevo, 4 rutas, 4 tablas.

## Constitution Check

*Antes de la investigación y de nuevo tras el diseño.* Constitución v1.1.1.

- [x] **I. Monolito modular**: el trabajo pertenece a `orders`; usa Carrito e Inventario solo por su `index.ts`; Carrito usa Catálogo como ya hace; sin ciclos (`orders → cart, inventory`; `cart → catalog`). Cada módulo toca solo sus tablas: Pedidos guarda **instantáneas** de puesto y producto.
- [x] **II. Clean Architecture**: `domain/` y `application/` sin NestJS, Prisma ni otros módulos; casos de uso con puertos; controlador sin reglas; el mecanismo transaccional solo en `infrastructure/` y `shared/infrastructure/`.
- [x] **III. Frontend**: N/A.
- [x] **IV. Persistencia**: migración aditiva y revisada, RLS sin políticas, `CHECK`, FK `RESTRICT`, `NUMERIC`; sin `migrate reset` ni `db push`; **no se aplica a la base compartida sin orden explícita**.
- [x] **V. Autenticación/autorización**: rutas privadas; solo CLIENTE; pruebas 401/403/404 y matriz de autorización ampliada.
- [x] **VI. Pagos**: N/A — ni pago, ni cobro, ni Webhook (FR-023).
- [x] **VII. Inventario**: reservas atómicas condicionales existentes dentro de la unidad, idempotentes por `pedido:<id>`; vencimiento configurable (puerto), no constante; pruebas de concurrencia, fallo a mitad y reintento.
- [x] **VIII. Seguridad**: sin secretos; clave aislada por cliente; entradas validadas; operaciones **sin auditar** salvo el historial (DEC-05).
- [x] **IX. Calidad**: pruebas unitarias, HTTP, PostgreSQL y concurrencia ligadas a CA-O1…CA-O28; **POC-001** como compuerta previa.
- [x] **X. Trazabilidad**: HU/RF/ADR existentes; interpretaciones en *Clarifications* y DE-1…DE-5.

**Re-evaluación tras el diseño (Fase 1)**: se mantiene. Excepciones en *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/003-pedidos-subpedidos/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/api-pedidos.md · contracts/contratos-modulos.md
├── checklists/requirements.md
└── tasks.md                          # /speckit-tasks
```

### Source Code (previsto, `backend/`)

```text
backend/src/
├── shared/infrastructure/prisma/
│   ├── contexto-transaccional.ts     # NUEVO  AsyncLocalStorage (solo `run`) con bandera de vigencia
│   ├── unidad-de-trabajo.ts          # NUEVO  (POC-001, aislado) límite de transacción y reintentos
│   ├── errores-transitorios.ts       # NUEVO  clasificación de errores reintentables
│   └── prisma.service.ts             # CAMBIA tras la POC: db, atomico(), unidadDeTrabajo()
└── modules/
    ├── orders/                       # NUEVO
    │   ├── domain/        pedido · subpedido · linea-pedido · estado-subpedido · estado-general
    │   │                  · codigo-pedido · huella-carrito · errors
    │   ├── application/ports/       pedido.repository · unidad-de-trabajo.port · carrito.port
    │   │                  · reserva-inventario.port · configuracion-reserva.port · reloj.port · generador-codigo.port
    │   ├── application/use-cases/   crear-pedido · consultar-pedido · listar-pedidos · consultar-historial (+ test-doubles)
    │   ├── infrastructure/ prisma-pedido.repository · postgres-unidad-de-trabajo · carrito.adapter · inventario.adapter
    │   │                  · configuracion-reserva-entorno.adapter · generador-codigo-criptografico
    │   ├── entry-adapters/ pedidos.controller · index.ts · orders.module.ts
    ├── cart/        index.ts NUEVO · use-cases `ObtenerCarritoParaPedido`, `VaciarCarritoDelPedido` · repo CAMBIA
    ├── catalog/     index.ts CAMBIA (lote de detalles) · repo CAMBIA (usa la transacción activa)
    └── inventory/   index.ts CAMBIA (exporta el error de stock) · repo CAMBIA
backend/prisma/      schema.prisma CAMBIA · migrations/<ts>_pedidos NUEVA
```

**Structure Decision**: capas como `inventory` y `cart`. El puerto `UnidadDeTrabajo` es de Pedidos (diseño interno aprobado) y su implementación delega en un componente compartido de Prisma.

## Flujo y transacción (Pedido–Inventario–Carrito)

```text
POST /api/v1/pedidos {claveIdempotencia}  ─►  CrearPedido.ejecutar(actor, cmd)
 0  (fuera de la transacción)  rol CLIENTE · validar la clave
 1  (fuera)  repetición rápida: pedidos.buscarPorClave(cliente, clave) ─► existe ─► 200 + el mismo pedido ─ FIN   (sin consultar la configuración, DI-2)
 1b (fuera)  solo creación nueva: duración = ConfiguracionReservaPort (falta/inválida ─► 503)
 2  uow.ejecutar(async () => {      BEGIN · reintento de la UNIDAD COMPLETA (máx. 5 intentos; 40P01/40001/P2034)
      a  pedidos.bloquearCliente(cliente)   pg_advisory_xact_lock(hashtextextended('pedidos:crear:'+cliente, 0))
                                            serializa por cliente; estable aunque el carrito no exista o esté vacío
      b  pedidos.buscarPorClave(cliente, clave)  existe ─► devolver ese pedido (replay) · sin escribir ni reservar
      c  carrito.obtenerParaPedido(cliente)   FOR UPDATE (carrito + ítems) · lectura AUTORITATIVA
                                              + datos de Catálogo en lote por la misma conexión
         vacío o líneas no comprables ─► error de dominio ─► ROLLBACK (no se reintenta)
      d  Pedido.crear(líneas, carritoId, huellaCarrito)                     (dominio puro)
      e  pedido = pedidos.insertar(pedido)  devuelve el pedido CON código `PED-XXXXXXXX` (DI-1); colisión ─► otro código (≤ 5, sin error ni reintento de transacción)
         pedidos.guardarDetalle(subpedidos, líneas, historial inicial)
      f  carrito.vaciarDelPedido(cliente)                                   (ya bloqueado)
      g  inventario.reservar('pedido:<id>', todos los productos ordenados, expiraEn = reloj + duración)
         sin stock ─► StockInsuficiente(producto) ─► ROLLBACK (no se reintenta)      ◄ última operación
    })   COMMIT
 3  replay ─► 200 · pedido nuevo ─► 201
```

**Orden de bloqueos** (único en todo el sistema): **(1)** bloqueo consultivo del cliente, **(2)** fila del carrito y sus ítems, **(3)** filas de inventario ordenadas por producto. `agregar` del carrito toma carrito → ítems; `fijarCantidad`/`quitar` solo ítems; Inventario solo sus filas: no existen ciclos con la unidad.

## Decisiones de implementación aprobadas (tras T010)

| Id | Decisión | Motivo | Efecto |
|---|---|---|---|
| DI-1 | `PedidoRepository.insertar()` devuelve el `Pedido` inmutable con su código asignado | El dominio es inmutable: `Pedido.conCodigo()` produce una instancia nueva y el caso de uso necesita el código para responder y reservar | contracts §4; puerto y dobles de T009 |
| DI-2 | Orden: rol y clave → repetición rápida → duración → unidad. La repetición de una operación confirmada no consulta la configuración ni reserva | Recuperar un pedido ya creado no depende de la configuración de nuevas reservas | spec FR-014, FR-028, US1-8, CA-O24; flujo de arriba; `crear-pedido.use-cases.spec` |
| DI-3 | Identificadores de pedido, subpedidos y líneas con `randomUUID` (`node:crypto`) en la capa de aplicación | Módulo nativo de Node, no un framework; `npm run arquitectura` lo admite | sin refactorización |

## Correcciones de la revisión de riesgos críticos

### RC-1 · La lectura previa del carrito no puede ser la fuente del pedido

La versión anterior leía el carrito fuera de la transacción y comparaba después. **Se elimina**: no hay lectura previa del carrito. La única lectura es la del paso **c**, con `FOR UPDATE` sobre la fila del carrito y de sus ítems dentro de la transacción; esas líneas (y los datos de Catálogo leídos por la **misma conexión**, en lote) son lo único que alimenta el dominio. Consecuencias: no existe el conflicto «carrito modificado» (cualquier edición concluye antes del bloqueo —y entra en el pedido— o espera hasta el commit —y queda en el carrito ya vacío—); el pedido guarda `carrito_id` y `huella_carrito` del contenido realmente procesado. El precio también es el leído dentro de la transacción. Para no abrir una segunda conexión (inanición del pool), el repositorio de Catálogo debe usar la transacción activa y se añade una lectura **en lote** (≤ 50 productos, una consulta).

### RC-2 · Dos solicitudes concurrentes con claves distintas sobre el mismo carrito

Un `SELECT … FOR UPDATE` sobre el carrito **no basta**: si la fila del carrito no existe, o el carrito está vacío, no hay nada que bloquear y las comprobaciones previas pueden competir. Mecanismo estable: **bloqueo consultivo transaccional por cliente** (`pg_advisory_xact_lock(hashtextextended('pedidos:crear:' || cliente_id, 0))`) como **primera** sentencia de la unidad.

| Situación | Resultado |
|---|---|
| misma clave simultánea | la 2.ª espera; al obtener el bloqueo ve el pedido (paso b) y lo devuelve sin escribir ni reservar |
| claves distintas, mismo carrito con contenido | la 2.ª espera; al obtener el bloqueo el carrito ya está vacío → «carrito vacío» (409), sin reservas |
| carrito inexistente o vacío | no hay filas que bloquear, pero el bloqueo por cliente serializa igualmente; resultado «carrito vacío» sin escrituras |
| clientes distintos | no se bloquean entre sí (la colisión de hash solo serializa de más, nunca produce incorrección) |

La restricción única `(cliente_id, clave_idempotencia)` queda como **red de seguridad**: con el bloqueo y la comprobación del paso b no debería dispararse. El bloqueo se libera solo al confirmar o revertir; no hay riesgo de bloqueo huérfano.

### RC-3 · Propagación con `AsyncLocalStorage`, Prisma 7 y `adapter-pg`

Justificación completa, límites, anidación y aislamiento: `research.md` D1. Resumen: el contexto se publica con `AsyncLocalStorage.run` **dentro** del callback de `$transaction`, de modo que cada solicitud tiene su propio almacén aunque las conexiones se compartan por el pool; el cliente transaccional lleva una bandera de vigencia que se apaga al cerrar y los accesos fuera de vigencia **fallan** en lugar de usar el pool (fail-fast). Las llamadas anidadas se unen (sin puntos de guardado). La **POC-001** verifica estas afirmaciones con PostgreSQL real **antes** de integrar nada.

## Reservas expiradas y coherencia de estado con Pagos (pendiente de S-08)

No se implementa en esta fase; se documenta para no comprometer a Pagos. **Propuestas que requieren aprobación antes de S-08.**

| Invariante | Estado hoy | Tratamiento propuesto |
|---|---|---|
| **C1** subpedido en `ESPERANDO_PAGO` ⇒ la reserva `pedido:<id>` está `RESERVADA` (vigente o vencida pendiente de expirar) | se cumple al crear; **se rompe** si alguien ejecuta `ExpirarReservasVencidas` de Inventario | No registrar programador hasta S-08; S-08 expone `ExpirarPedidosVencidos` en Pedidos y evita que Inventario libere por su cuenta las reservas con prefijo `pedido:` |
| **C2** `EXPIRADO` ⇒ reservas `LIBERADAS` | no alcanzable | una sola unidad: `LiberarReserva('pedido:<id>', 'EXPIRACION')` + `Subpedido.expirar()` + historial |
| **C3** `PAGO_APROBADO` ⇒ reserva `RESERVADA`/`CONFIRMADA` | no alcanzable | `PagoAprobado` y expiración se **serializan** con el mismo mecanismo de bloqueo consultivo, esta vez por pedido (`'pedidos:estado:' + id`) |
| **C4** aprobación tardía | no alcanzable | la reserva original queda `LIBERADA` y es idempotente por clave: se necesita una **clave nueva** (`pedido:<id>:r<n>`) y reservar de nuevo todo el pedido (ADR-003 §6.5) |

Reglas para S-08: la consulta a la pasarela y la creación del cobro van **fuera** de la transacción (ADR-003 §6.5, C4 N4); un programador de tareas (hoy inexistente) invoca la expiración; el registro del pago PENDIENTE (C4 N4 paso 9) participará de la misma unidad de trabajo; los pedidos ya creados en `ESPERANDO_PAGO` sin pago asociado deberán conciliarse. **Decisiones pendientes de aprobación para S-08**: dónde vive la expiración, la política de la clave `…:r<n>` y la conciliación de pedidos previos.

## Estrategia de pruebas

| Nivel | Qué prueba | Criterios | Archivos previstos |
|---|---|---|---|
| **Compuerta POC-001** (PostgreSQL real) | misma transacción entre repositorios, rollback total, anidación controlada, sin fuga de contexto entre solicitudes concurrentes, reintento de la unidad completa con interbloqueo real, sin inanición del pool | CA-O9, O27 | `test/poc-unidad-de-trabajo.db-spec.ts` |
| Unitaria (dominio) | estado general, transiciones válidas e inválidas (C4 N4), código (`PED-` + 8, alfabeto, 1 000 sin repetir con aleatoriedad inyectada), agrupación, importes exactos, huella del carrito | CA-O1–O5, O19, O25, O26 | `domain/*.spec.ts` |
| Unitaria (casos de uso) | éxito; stock insuficiente; carrito vacío/no vigente; replay (200) con carrito vacío o distinto; configuración 503; reintento de la unidad ante errores transitorios y **no** reintento de errores de dominio; colisión de código separada del reintento; fallo forzado en cada paso con una unidad de trabajo en memoria | CA-O6–O13, O21, O23, O24, O26–O28 | `application/use-cases/*.spec.ts` |
| HTTP (repositorios en memoria) | 201/200/400/401/403/404/409/503; aislamiento; estado general; historial; matriz de autorización | CA-O14–O18, O21 | `test/pedidos.e2e-spec.ts` + matriz |
| PostgreSQL | restricciones (únicos, `CHECK`, claves foráneas compuestas, triggers de inmutabilidad, RLS); **EQ-02**: fallo inyectado tras cada paso y comparación SQL | CA-O2, O3, O9, O18 | `test/pedidos.db-spec.ts`, `test/pedidos-atomicidad.db-spec.ts` |
| PostgreSQL (concurrencia) | 2 clientes por el último stock ×100 (**EQ-03**); 20 solicitudes con la misma clave; 2 claves sobre el mismo carrito y cliente sin carrito (×100); edición concurrente del carrito; pedidos cruzados para interbloqueo; colisión de código forzada; reintentos agotados | CA-O11, O20, O23, O26–O28 | `test/pedidos-concurrencia.db-spec.ts` |
| Regresión | suites de Inventario (`inventario*.db-spec`, `eq03-concurrencia`), Carrito, Catálogo y todas las unitarias/HTTP deben seguir en verde tras tocar sus repositorios | — | existentes |
| Calidad | `npm run build`, `lint`, `arquitectura`, `prisma validate`; migración revisada | CA-O22 | — |

## Archivos existentes que cambiarían (previsto; **no se tocan ahora**)

| Archivo | Cambio previsto | Justificación |
|---|---|---|
| `shared/infrastructure/prisma/prisma.service.ts` (+ 3 archivos nuevos) | `db`, `atomico()`, `unidadDeTrabajo()` | único lugar que conoce la transacción activa; aditivo; **solo tras POC-001** |
| `inventory/infrastructure/prisma-inventario.repository.ts` | los 4 métodos de escritura usan `atomico()` | participar en la unidad; fuera de ella, comportamiento idéntico |
| `inventory/index.ts` | exportar `StockInsuficienteError` | identificar el producto sin importar internos |
| `cart/infrastructure/prisma-carrito.repository.ts`, `cart/application/ports/ports.ts`, `test-doubles.ts` | `agregar` usa `atomico()`; nuevos `bloquearYListar` y `vaciarItems`; dobles | lectura autoritativa con bloqueo y vaciado |
| `cart/application/use-cases/` (nuevo), `cart/index.ts` (nuevo), `cart.module.ts` | `ObtenerCarritoParaPedido`, `VaciarCarritoDelPedido`; exports | contrato público que C4 N3 exige entre Pedidos y Carrito |
| `catalog/application/…`, `catalog/infrastructure/prisma-catalogo.repository.ts`, `catalog/index.ts`, `catalog.module.ts` | lectura **en lote** de detalles y uso de la transacción activa | datos de precio dentro de la unidad sin segunda conexión |
| `modules/orders/**`, `orders.module.ts` | módulo nuevo | |
| `prisma/schema.prisma` + `migrations/<ts>_pedidos` | 4 modelos, 1 enum, relaciones inversas en `Usuario`, `Puesto`, `Producto` | tablas del módulo |
| `backend/.env.example` | `PEDIDOS_RESERVA_MINUTOS` **sin valor** | sin valor de negocio asumido |
| `test/helpers/*`, `test/matriz-autorizacion.e2e-spec.ts` | doble de Pedidos, limpieza, rutas | pruebas |

**No se tocan** (decisión del equipo): `specs/001-inventario/`, `specs/002-carrito/`, `frontend/`, `.specify/feature.json`, documentos `docs/01`–`docs/04`. Las enmiendas aditivas a las especificaciones anteriores se difieren hasta confirmar los cambios sin commit del frontend.

## Dependencias pendientes y riesgos

| Dependencia | Efecto |
|---|---|
| Pagos (S-08) | pago PENDIENTE, cobro, `PagoAprobado`, **expiración** (RF54, requiere programador inexistente), conciliación de pedidos previos (sección anterior) |
| Configuración (S-04) | sustituir el adaptador de entorno del puerto de duración |
| Auditoría (DEC-05) | operaciones sin auditar salvo el historial |
| Reportes / DEC-09 | consulta de comerciante, trabajador y administrador |
| DEC-06 | `orders` frente a `pedidos` |

| Id | Riesgo | Mitigación |
|---|---|---|
| R1 | La propagación implícita falla con Prisma 7/`adapter-pg` o se filtra entre solicitudes | **POC-001** como compuerta; si falla, detener y solicitar revisión (plan B: contexto explícito, que exigiría nueva aprobación) |
| R2 | Regresión al modificar repositorios de Inventario, Carrito y Catálogo | cambio mecánico y mínimo; suites existentes como compuerta |
| R3 | Una transacción por solicitud retiene una conexión (`DATABASE_POOL_MAX` = 10) y un acceso fuera del contexto abriría una segunda → inanición | todas las lecturas de la unidad por la conexión activa; **fail-fast** si se accede fuera de vigencia; prueba de carga en la POC |
| R4 | Transacción más larga que la reserva aislada (lectura de carrito y catálogo dentro) y mayor retención de bloqueos (EQ-03 se midió sin pedido) | lote de catálogo (1 consulta), reserva **al final**, bloqueo por cliente (no entre clientes); repetir la medición EQ-03 sobre «crear pedido» |
| R5 | Interbloqueos | orden de bloqueos fijo; Inventario ordena por producto; reintento de la unidad; prueba de interbloqueo real |
| R6 | Reejecutar el bloque tras un reintento duplicaría efectos | el bloque solo escribe en la base y se reconstruye desde cero; el `id` se conserva entre intentos |
| R7 | Un cliente reutiliza una clave para una compra nueva y recibe el pedido anterior | limitación documentada (DE-5); guía para el frontend: una clave por intento de compra |
| R8 | `fijarCantidad`/`quitar` del carrito esperan durante la unidad | aceptado (milisegundos); tras el commit devuelven «no está en el carrito» |
| R9 | Un repositorio que abra su propia transacción rompería la atomicidad | regla: solo `db`/`atomico()`; prueba de propagación e inspección en revisión |
| R10 | Expiración de Inventario ejecutada antes de S-08 desincroniza el estado | no registrar programador; sección C1–C4 |
| R11 | Cambios del frontend sin commit en `specs/002-carrito/` | no editar ese directorio |

## Complexity Tracking

| Desviación | Por qué es necesaria | Alternativa más simple descartada |
|---|---|---|
| Contexto transaccional implícito (`AsyncLocalStorage`) | Es la forma aprobada (`uow.ejecutar(async () => …)`, `reservar(…)` sin contexto) y no cambia contratos ya implementados | contexto explícito (cambia firmas y C4); compensación (contradice ADR-003 §6.2 y EQ-02); escritura en tablas ajenas (viola C4 N3 regla 3) |
| Bloqueo consultivo por cliente | `FOR UPDATE` no cubre carrito inexistente o vacío | solo `FOR UPDATE` del carrito (carrera con claves distintas en carrito vacío) |
| Lectura de Catálogo dentro de la transacción | la fuente autoritativa debe verificarse tras el bloqueo; son lecturas locales de PostgreSQL | lectura previa fuera de la transacción (puede quedar obsoleta; descartada por el equipo) |
| Una sola llamada de reserva con todos los productos | Inventario ya ordena y bloquea por producto; evita interbloqueos | bucle por producto del diagrama C4 N4 (ilustrativo) |
| Reservar al final, no antes de registrar como en ADR-003 §6.2 | minimiza el tiempo con filas de inventario bloqueadas; en una transacción atómica el orden no altera el resultado | reservar primero |
