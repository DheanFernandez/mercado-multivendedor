# Especificación: Módulo Carrito multivendedor (S-06 · H3)

Derivada de documentación cerrada (RF20–RF24, HU04–HU06, ADR-001, ADR-002, plan S-06). No la modifica ni amplía el alcance.

## 1. Alcance

| Dentro | Fuera (declarado) |
|---|---|
| Carrito por cliente con productos de varios puestos | Pedidos, subpedidos y su código (`orders`, S-07) |
| Agregar, cambiar cantidad, quitar, vaciar y consultar | Reserva de stock: **el carrito no reserva**; la reserva y la reverificación final (RF25) ocurren al crear el pedido con `ReservarInventario` |
| Puesto identificado por producto; subtotales por puesto y total | Pagos y Mercado Pago (`payments`): sin cambios en las reglas aprobadas |
| Validación de publicación y stock por las APIs públicas de Catálogo e Inventario | Pantallas del carrito (frontend), promociones, impuestos, costos de envío |

## 2. Reglas (normativas)

- R1 Solo el rol `CLIENTE` usa el carrito; cada cliente solo ve y modifica el suyo (aislamiento por `usuario_id` de la sesión). Otros roles: 403.
- R2 Un producto es agregable solo si el Catálogo lo expone (publicado, categoría, puesto y comerciante activos); si no: 404 «no disponible».
- R3 Cantidad entera de 1 a 10 000 por producto y hasta 50 productos distintos por carrito (igual al máximo de una reserva). Un mismo producto ocupa una sola línea; agregarlo de nuevo suma.
- R4 Disponible = físico − reservado (Inventario). La cantidad resultante nunca supera el disponible: el tope se comprueba **en la misma sentencia SQL** que suma, y las solicitudes del mismo cliente se serializan sobre su fila de carrito. Exceso: 409.
- R5 El carrito guarda solo producto, puesto y cantidad. **Precio y disponibilidad se leen vigentes** en cada consulta (el importe es estimado, HU06); no se congela ningún precio hasta el pedido.
- R6 Importes en céntimos enteros, formato `"12.50"`, sin coma flotante. Subtotal de puesto = suma de sus líneas vigentes; total = suma de los subtotales.
- R7 Líneas no vigentes se informan pero **no suman**: `NO_DISPONIBLE` (producto ya no comprable, sin precio) y `STOCK_INSUFICIENTE` (cantidad > disponible). Con alguna, `requiereRevision = true`. Quitar una línea no disponible siempre se permite; subir su cantidad no.
- R8 Agregar al carrito no modifica el inventario.

## 3. Superficie

HTTP (cliente, todas devuelven el carrito completo `{ puestos[{ puesto, items[], subtotal }], total, totalProductos, requiereRevision }`):
`GET /api/v1/carrito`, `POST /api/v1/carrito/items {productoId, cantidad}`, `PATCH /api/v1/carrito/items/:productoId {cantidad}`, `DELETE /api/v1/carrito/items/:productoId`, `DELETE /api/v1/carrito`.

Dependencias (solo por API pública, regla `limites-entre-modulos`): `catalog/index.ts` (`ObtenerDetalleCatalogo`) e `inventory/index.ts` (`ConsultarDisponibilidad`), a través de los puertos `ProductoVendiblePort` y `DisponibilidadPort`.

## 4. Trazabilidad requisito → criterio → prueba

| Requisito / HU | Criterio de aceptación | Prueba |
|---|---|---|
| RF20 · HU04 | Productos de distintos puestos en un mismo carrito | `carrito.use-cases.spec.ts`; `test/carrito.e2e-spec.ts`; `carrito.db-spec.ts` (tres puestos) |
| RF21 | El puesto de cada ítem se identifica automáticamente | `calculo.spec.ts`; `carrito.e2e-spec.ts` |
| RF22 · HU06 | Subtotal por puesto exacto | `calculo.spec.ts` (importes exactos, máximos) |
| RF23 · HU06 | Total general = suma de subtotales | `calculo.spec.ts`; `carrito.e2e-spec.ts` |
| RF24 · HU05 | Modificar y quitar productos | `carrito.use-cases.spec.ts`; `carrito.e2e-spec.ts` |
| RF15 · AC07 | Nunca más que el disponible, también con solicitudes simultáneas | `carrito.use-cases.spec.ts`; `carrito.e2e-spec.ts`; `carrito.db-spec.ts` (concurrencia) |
| AC04 | Solo el cliente accede, solo a lo suyo | `test/matriz-autorizacion.e2e-spec.ts` (5 rutas × 6 identidades); `carrito.e2e-spec.ts` |
| AC08 | Integridad del modelo | `carrito.db-spec.ts` (`CHECK`, únicos, clave foránea compuesta) |
