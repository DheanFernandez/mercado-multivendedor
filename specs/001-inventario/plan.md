# Implementation Plan: Módulo Inventario (S-05 · H2)

**Branch**: `docs/sdd-001-inventario` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-inventario/spec.md` (reglas R1–R7, superficie §3, trazabilidad §4, limitación EQ-03 §5)

**Trazabilidad**: HU14, HU15 · RF12, RF13, RF14, RF15, RF19, RF25, RF54 (parcial) · ADR-003 (§5.6, §6.3–§6.5, §7) · AC04, AC07, AC08, AC12 · EQ-03

## Summary

Plan **retrospectivo**: el módulo `backend/src/modules/inventory/` ya está integrado en `main` y la spec 001 solo tenía `spec.md` (matriz oficial del Sprint 02, fila «Especificaciones SDD»: *Incompleta, criterios sin tareas formales*). Este documento describe el diseño tal como está implementado y lo vincula con la spec; `tasks.md` desglosa el trabajo en tareas enlazadas a sus pruebas. **No se cambia código, esquema ni migraciones**, ni los documentos aprobados (`docs/01`, ADR, C4).

Enfoque técnico implementado: existencias por producto y puesto con stock físico y reservado (el disponible se calcula); toda variación de stock es un **delta** aplicado con un `UPDATE` condicional en PostgreSQL dentro de una transacción corta; la reserva es multiproducto, todo‑o‑nada, ordenada por `productoId` e idempotente por `claveOperacion`; liberar, confirmar y expirar cambian el estado de la reserva con `UPDATE … WHERE estado = 'RESERVADA'`, de modo que solo una transacción toca el stock. La gestión manual (ingreso, devolución, ajuste) se expone por HTTP al comerciante titular; la reserva y su ciclo de vida son **API pública del módulo** (`index.ts`), sin ruta HTTP.

## Technical Context

**Language/Version**: TypeScript 6 (estricto, ESM), Node.js 24, NestJS 12

**Primary Dependencies**: las existentes del backend (Prisma 7 con `@prisma/adapter-pg`, `pg`). Ninguna nueva.

**Storage**: PostgreSQL. Tablas `inventarios`, `movimientos_inventario` y `reservas_inventario` (migración `20261107000000_inventario`) con `CHECK 0 ≤ stock_reservado ≤ stock_fisico`, clave foránea compuesta (producto, puesto) y `UNIQUE (clave_operacion, inventario_id)`.

**Testing**: Vitest — unitarias (`npm test`: dominio y casos de uso con dobles en memoria), HTTP (`npm run test:e2e`: controlador con la aplicación en memoria) y de base de datos (`npm run test:db`: repositorio Prisma, concurrencia e invariantes contra la base aislada `mercado-test-db`). Jest (`npm run test:jest`) como suite representativa (spec 006). `npm run arquitectura` (dependency-cruiser) para las fronteras del módulo. Medición EQ-03 con k6 (`ops/k6/eq03-reserva.js`).

**Target Platform**: servidor Linux/Windows con Node.js 24; PostgreSQL 16 (Supabase en despliegue, contenedor local en pruebas).

**Project Type**: monolito modular NestJS (`backend/`); el frontend no tiene pantallas de inventario.

**Performance Goals**: EQ-03 / AC07 — 0 reservas incompatibles en el 100 % de las pruebas concurrentes (medido el 2026-11-05: 400/400; ver matriz oficial del Sprint 02, fila AC07).

**Constraints**: cantidades enteras en la unidad de venta (spec §1); máximo 1 000 000 unidades por operación y 50 productos por reserva; transacciones cortas con reintento ante interbloqueo o fallo de serialización (hasta 5 intentos, ADR-003 §5.6); el vencimiento de la reserva (`expiraEn`) lo fija el llamador.

**Scale/Scope**: 1 módulo, 4 rutas HTTP, 5 casos de uso públicos, 4 casos de uso de gestión, 3 tablas.

## Constitution Check

*GATE: verificado sobre el código existente.* Constitución v1.1.1.

- [x] **I. Monolito modular**: `inventory` exporta solo su API pública (`index.ts`: `ReservarInventario`, `LiberarReserva`, `ConfirmarVentaReservada`, `ExpirarReservasVencidas`, `ConsultarDisponibilidad`); consume Productos y Comerciantes solo por sus `index.ts` (`PropiedadProductoAdapter`). Comprobado con `npm run arquitectura`.
- [x] **II. Clean Architecture**: `domain/` (`Stock`, `cantidadEntera`, errores) sin dependencias de framework; `application/` (casos de uso y puertos `InventarioRepository`, `PropiedadProductoPort`); `infrastructure/` (Prisma, adaptador de propiedad); `entry-adapters/` (controlador). Composición en `inventory.module.ts`.
- [x] **III. Frontend**: N/A — no hay interfaz de inventario.
- [x] **IV. Persistencia**: esquema Prisma y migración versionados; invariantes duplicadas en `CHECK` de PostgreSQL como última barrera.
- [x] **V. Autenticación/autorización**: `@ActorRequerido()` en todas las rutas (401 sin sesión); rol y propiedad se comprueban en el caso de uso (R7), antes de validar la entrada.
- [x] **VI. Pagos**: N/A — la consulta del pago antes de expirar y la aprobación tardía dependen de `payments` (DEC-01/DEC-02 pendientes); fuera de alcance (spec §1).
- [ ] **VII. Inventario**: cumplido salvo **tiempos de reserva configurables (RF45)**: el módulo Configuración no existe y `expiraEn` lo recibe el llamador, sin constante en código. Desviación ya declarada en la spec §1; ver *Complexity Tracking*.
- [x] **VIII. Seguridad**: pruebas de acceso cruzado (comerciante B sobre A) y de roles no autorizados en casos de uso, HTTP y matriz de autorización; entradas validadas en dominio/aplicación. **Auditoría (RF42)**: sin módulo; cada cambio deja un movimiento con actor y referencia, pero no hay registro de auditoría (spec §1; DEC-05 pendiente).
- [x] **IX. Calidad**: pruebas unitarias, HTTP, de base de datos, de invariantes aleatorias y de concurrencia EQ-03 (ver `tasks.md`).
- [x] **X. Trazabilidad**: RF, HU, AC y ADR citados existen en `docs/01-analisis-de-sistema/`; la spec no reescribe requisitos. `tasks.md` enlaza tarea → código → prueba.

**Re-evaluación tras el diseño**: sin cambios; una compuerta (VII, RF45) queda abierta por dependencia de un módulo inexistente.

## Project Structure

### Documentation (this feature)

```text
specs/001-inventario/
├── spec.md              # alcance, reglas R1–R7, superficie, trazabilidad, limitación EQ-03
├── plan.md              # este archivo
└── tasks.md             # tareas retrospectivas enlazadas a sus pruebas
```

No se generan `research.md`, `data-model.md`, `contracts/` ni `quickstart.md`: el modelo de datos está en `backend/prisma/schema.prisma` (sección *Inventario*) y el contrato HTTP en el documento OpenAPI (`backend/src/shared/http/openapi/operaciones.ts`, operaciones `inventario_*`, spec 005).

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                                   # Inventario, MovimientoInventario, ReservaInventario
│   └── migrations/20261107000000_inventario/           # tablas, CHECK, FK compuesta, índices
├── src/modules/inventory/
│   ├── domain/
│   │   ├── stock.ts                                    # Stock (invariante), cantidadEntera, MAX_CANTIDAD
│   │   ├── stock.spec.ts
│   │   └── errors.ts                                   # StockInsuficiente, StockFisicoInsuficiente, ClaveOperacionReutilizada…
│   ├── application/
│   │   ├── ports/ports.ts                              # InventarioRepository, PropiedadProductoPort, tipos
│   │   └── use-cases/
│   │       ├── inventario.use-cases.ts                 # 9 casos de uso
│   │       ├── inventario.use-cases.spec.ts
│   │       └── test-doubles.ts                         # repositorio y propiedad en memoria
│   ├── infrastructure/
│   │   ├── prisma-inventario.repository.ts             # UPDATE condicional, transacciones, reintento
│   │   └── propiedad-producto.adapter.ts               # Productos + Comerciantes por su API pública
│   ├── entry-adapters/inventario.controller.ts         # /api/v1/inventario
│   ├── inventory.module.ts                             # composición y exportaciones
│   └── index.ts                                        # API pública del módulo
├── test/
│   ├── inventario.e2e-spec.ts                          # HTTP
│   ├── matriz-autorizacion.e2e-spec.ts                 # filas de /api/v1/inventario
│   ├── inventario.db-spec.ts                           # repositorio real, concurrencia, idempotencia
│   ├── inventario-invariantes.db-spec.ts               # operaciones aleatorias concurrentes
│   ├── eq03-concurrencia.db-spec.ts                    # EQ-03 series 1 y 2
│   ├── helpers/inventario-db.ts
│   └── jest/{stock,inventario}.jest-spec.ts            # suite representativa (spec 006)
└── src/scripts/servidor-eq03.ts                        # servidor de medición para k6
ops/k6/eq03-reserva.js                                  # medición EQ-03 con k6
```

**Structure Decision**: estructura por capas del monolito modular, igual que `cart`, `products` y `merchants`. Este plan no añade ni modifica archivos de código.

## Dependencias y riesgos

| Id | Riesgo / dependencia | Mitigación / estado |
|---|---|---|
| D1 | Productos y Comerciantes (propiedad del producto y del puesto) | Puerto `PropiedadProductoPort` sobre sus APIs públicas; sin importaciones internas |
| D2 | Pedidos (`orders`) invocará `ReservarInventario` | La rama de Pedidos no está en el repositorio (no hay spec 003); el contrato de la API pública queda fijado por las pruebas de `ReservarInventario` |
| D3 | Pagos (`payments`): aprobación tardía y consulta del pago antes de expirar (ADR-003 §6.5) | **Bloqueado** por DEC-01/DEC-02 (`docs/06-gobernanza-sdd/02-registro-de-decisiones.md`); fuera de alcance |
| D4 | Configuración (RF45): tiempos de reserva | Sin módulo; `expiraEn` lo pasa el llamador (desviación de la constitución VII) |
| D5 | Auditoría (RF42) | Sin módulo; DEC-05 pendiente. Los movimientos registran actor y referencia |
| R1 | Las pruebas de concurrencia solo son fiables contra PostgreSQL real | `*.db-spec.ts` sobre la base aislada `mercado-test-db` (sustituye a Testcontainers, desviación declarada); la guarda `base-aislada.mjs` impide apuntar a una base remota |
| R2 | EQ-03 se midió sobre `ReservarInventario`, no sobre «confirmar pedido» | Declarado en spec §5; repetir de punta a punta cuando exista `POST /pedidos` |
| R3 | Cantidades enteras: no se puede vender «0,5 kg» de un producto en `KILOGRAMO` | Declarado en spec §1; requiere decidir antes la semántica de RF37 en Pedidos |
| R4 | `npm run test:db` necesita Docker; no siempre se ejecuta en local | Se ejecuta en CI (paso `test:db` del job `backend`); en `tasks.md` solo se marcan las tareas cuya prueba se verificó |

## Complexity Tracking

| Desviación | Por qué es necesaria | Alternativa más simple descartada porque |
|---|---|---|
| Constitución VII: tiempos de reserva no configurables desde el sistema (RF45) | El módulo Configuración no existe; el vencimiento es un parámetro obligatorio de `ReservarInventario` | Fijar una constante en el código violaría expresamente el principio VII |
