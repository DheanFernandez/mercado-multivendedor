# Especificación: Módulo Inventario (S-05 · H2)

Derivada de documentación cerrada (RF, HU, ADR-003, C4 N4, EQ-03). No la modifica ni amplía el alcance. Constitución: principios II, VII, VIII, IX.

## 1. Alcance

| Dentro | Fuera (declarado) |
|---|---|
| Existencias por producto y puesto (físico, reservado, disponible) | Pedidos y carrito (`orders`, `cart` aún no existen): la reserva se expone como API pública del módulo (`ReservarInventario`), no como ruta HTTP |
| Movimientos: ingreso, venta, devolución, ajuste (+ reserva y liberación como trazabilidad) | Consulta del estado del pago antes de expirar y aprobación tardía (ADR-003 §6.5, depende de `payments`; DEC-01/02) |
| Actualización controlada de stock (deltas atómicos, nunca valores absolutos) | Tiempos de reserva configurables (RF45, módulo Configuración): `expiraEn` lo recibe el llamador |
| Reserva multiproducto todo‑o‑nada, idempotente por clave de operación | Variaciones de peso o precio (HU18) y cantidades fraccionarias: las cantidades son **enteros** en la unidad de venta |
| Liberación, confirmación de venta y expiración idempotentes | Auditoría (RF42): no existe el módulo; **las operaciones de inventario quedan sin auditar**, pero cada cambio deja un movimiento con actor y referencia |
| Permisos y propiedad del puesto (AC12) | Rol `TRABAJADOR_PUESTO` (permisos delegados no definidos): sin acceso |

**Cantidades enteras (revisado):** RF12–RF15, RF19, RF25 y ADR-003 no fijan el tipo de la cantidad; los pesos y volúmenes variables aparecen solo como *variaciones* durante la preparación (RF37, HU18, ADR-003 §6.4), que son del pedido y no del stock. Por eso el stock se lleva en enteros de la unidad de venta del producto (`UnidadVenta`: un producto en `KILOGRAMO` se cuenta en kilogramos; para vender fracciones se publica en `GRAMO`). Limitación conocida: no se puede pedir «0,5 kg» de un producto en `KILOGRAMO`. Cambiar a cantidades decimales exige decidir antes la semántica de RF37 en Pedidos; no se justifica con la documentación actual.

## 2. Reglas (normativas)

- R1 `0 ≤ reservado ≤ físico` siempre; `disponible = físico − reservado` (RF14). Garantizado por `CHECK` en PostgreSQL.
- R2 Reservar = `UPDATE … SET reservado = reservado + n WHERE físico − reservado ≥ n` dentro de una transacción corta (RF15, RF25, ADR-003 §6.3). Sin filas afectadas ⇒ falta de stock (409 controlado).
- R3 Ajustes y entradas son deltas (`físico = físico + Δ`), condicionados a `físico + Δ ≥ reservado`: dos actualizaciones simultáneas nunca se pisan.
- R4 Una reserva de varios productos es todo‑o‑nada y bloquea filas en orden de `productoId` (sin interbloqueos entre reservas).
- R5 Idempotencia: la `claveOperacion` + producto es única. Repetir la misma solicitud devuelve el resultado anterior sin reservar de nuevo; reutilizar la clave con otros ítems es conflicto.
- R6 Liberar/confirmar cambian el estado de la reserva con un `UPDATE … WHERE estado = 'RESERVADA'`: solo la transacción que cambia el estado toca el stock ⇒ idempotentes y serializadas entre sí (liberar/expirar vs. confirmar/Webhook).
- R7 Escribir stock: solo el comerciante **titular** del puesto del producto. Leer: el titular y el administrador (supervisión). Clientes y trabajadores: 403. El administrador no escribe stock.

## 3. Superficie

HTTP (comerciante): `GET /api/v1/inventario[?puestoId]`, `GET /api/v1/inventario/productos/:id`, `GET …/movimientos`, `POST …/movimientos {tipo: INGRESO|DEVOLUCION|AJUSTE, cantidad, motivo?}`.
API pública del módulo (para `orders`/`payments`/`catalog`): `ReservarInventario`, `LiberarReserva`, `ConfirmarVentaReservada`, `ExpirarReservasVencidas`, `ConsultarDisponibilidad`.

## 4. Trazabilidad requisito → criterio → prueba

| Requisito / HU / AC | Criterio de aceptación | Prueba |
|---|---|---|
| RF12 · HU14 | El titular registra ingresos y ajustes; el stock se actualiza | `inventario.use-cases.spec.ts` (registrar); `test/inventario.e2e-spec.ts` (POST/GET); `test/inventario.db-spec.ts` (deltas) |
| RF13 · HU15 | Cada cambio genera un movimiento con tipo, variación, saldo, actor y referencia | `inventario.use-cases.spec.ts` (movimientos); `inventario.db-spec.ts` (movimientos) |
| RF14 | Se distinguen físico, reservado y disponible; `CHECK` del modelo | `domain/stock.spec.ts`; `inventario.db-spec.ts` (restricciones) |
| RF15 · AC07 | Nunca se confirma más que el disponible | `inventario.db-spec.ts` (suficiente/insuficiente, último stock) y **EQ-03** |
| RF25 | Reverificación atómica al confirmar | `inventario.db-spec.ts` (reserva todo‑o‑nada) |
| RF54 · ADR-003 §6.5 (parcial) | Liberación/expiración idempotente y serializada con la confirmación | `inventario.db-spec.ts` (liberar, expirar vs. confirmar) |
| ADR-003 §7 | Reintentos no duplican la reserva | `inventario.use-cases.spec.ts`; `inventario.db-spec.ts` (misma clave ×N simultáneo) |
| AC08 | Fallo a mitad de transacción deja el inventario intacto | `inventario.db-spec.ts` (integridad) |
| AC04 · AC12 | Rol y propiedad; acceso cruzado (comerciante B sobre A) | `inventario.use-cases.spec.ts`; `inventario.e2e-spec.ts` |
| AC07 · EQ-03 | 0 reservas incompatibles en el 100 % de las pruebas concurrentes | `eq03-concurrencia.db-spec.ts` + `ops/k6/eq03-reserva.js` |

## 5. Limitación de la medición EQ-03

El escenario original habla de "confirmar pedidos". Sin `orders`/`cart`, se mide **la operación que el pedido invocará** (`ReservarInventario`, la misma que ejecutará `CrearPedido`), con clientes distintos (una clave de operación por cliente). Queda pendiente repetir EQ-03 de punta a punta cuando exista `POST /pedidos`. Sustituye a Testcontainers la base `mercado-test-db` (desviación ya declarada).
