# Especificación: Módulo Carrito multivendedor (S-06 · H3)

Derivada de documentación cerrada (RF20–RF24, HU04–HU06, ADR-001, ADR-002, plan S-06). No la modifica ni amplía el alcance.

## 1. Alcance

| Dentro | Fuera (declarado) |
|---|---|
| Carrito por cliente con productos de varios puestos | Pedidos, subpedidos y su código (`orders`, S-07) |
| Agregar, cambiar cantidad, quitar, vaciar y consultar | Reserva de stock: **el carrito no reserva**; la reserva y la reverificación final (RF25) ocurren al crear el pedido con `ReservarInventario` |
| Puesto identificado por producto; subtotales por puesto y total | Pagos y Mercado Pago (`payments`): sin cambios en las reglas aprobadas |
| Validación de publicación y stock por las APIs públicas de Catálogo e Inventario | Promociones, impuestos, costos de envío |
| Interfaz del carrito (frontend): §5 | Confirmar pedido, pago y Mercado Pago (S-07 en adelante) |

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

## 5. Interfaz del carrito (frontend)

Añadida el 2026-11-06 para el frontend de S-06 (HU04–HU06 «pantallas»). Consume solo la API de §3; no cambia las reglas R1–R8 ni el backend. Constitución: principios III, V, IX, X.

### 5.1 Escenarios y criterios de aceptación

| Id | Criterio de aceptación (Dado / Cuando / Entonces) | RF · HU |
|---|---|---|
| CA-F1 | Dado un cliente con sesión, cuando abre el **detalle** de un producto del catálogo, elige una cantidad y pulsa «Agregar al carrito» (única pantalla desde la que se agrega), entonces el producto queda en su carrito (si ya estaba, se suma) y la pantalla confirma la acción con el nuevo total | RF20 · HU04 |
| CA-F2 | Dado un cliente con sesión, cuando abre «Mi carrito», entonces ve sus productos **agrupados por puesto** (código y nombre del puesto), y por cada línea nombre, precio unitario, cantidad y subtotal | RF20, RF21 · HU04 |
| CA-F3 | La pantalla muestra el **subtotal de cada puesto** y el **total general** exactamente como los entrega la API (texto con 2 decimales, sin recalcular en el navegador) | RF22, RF23 · HU06 |
| CA-F4 | Cuando el cliente cambia la cantidad de una línea, entonces el carrito se actualiza con los nuevos subtotales y total; cantidades inválidas (vacío, cero, negativas, decimales, > 10 000) se rechazan antes de enviar | RF24 · HU05 |
| CA-F5 | Cuando el cliente quita un producto (o vacía el carrito), entonces desaparece y los subtotales y el total se actualizan; un puesto sin productos deja de mostrarse. Vaciar pide confirmación | RF24 · HU05 |
| CA-F6 | Cada línea muestra su disponibilidad: las líneas `STOCK_INSUFICIENTE` indican cuántas unidades quedan («Quedan N»; con 0 unidades, «Agotado»), las `NO_DISPONIBLE` indican que el producto ya no se vende; ambas se destacan, no suman al total y el carrito avisa que requiere revisión | RF15, RF19 · HU04 |
| CA-F7 | Los errores del servidor (409 stock insuficiente con unidades disponibles, 404 producto no disponible, 400, red caída) se muestran junto a la acción que los causó, en lenguaje claro, sin perder lo ya cargado | RF15 · HU04 |
| CA-F8 | Sin sesión, las pantallas del carrito redirigen al inicio de sesión; con sesión de un rol distinto de cliente (comerciante, trabajador, administrador) muestran «acceso restringido». En el detalle de un producto, el visitante sin sesión ve «Ingresar para comprar» (enlace al inicio de sesión) y los demás roles un aviso «solo los clientes compran», sin botón de agregar. La interfaz oculta acciones solo por comodidad: el servidor autoriza cada operación (R1) | AC04 · RF04 |
| CA-F9 | Un carrito vacío muestra un mensaje y un enlace al catálogo | HU04 |
| CA-F10 | Mientras se espera al servidor se indican la carga y las acciones en curso; la interfaz es usable en pantallas estrechas (AC09/AC10) y los controles son accesibles por teclado con etiquetas | AC01, AC09, AC10 |
| CA-F11 | La pantalla **no** ofrece «confirmar pedido» ni «pagar»: el total se rotula como importe estimado | Alcance §1 |
| CA-F12 | El encabezado muestra el enlace «Carrito» solo a clientes con sesión, sin contador de productos y sin consultar el carrito al cargar cada página | AC01 · HU04 |

### 5.2 Reglas de interfaz

- RI-1 Los importes se muestran como texto de la API con el prefijo «S/ »; nunca se suman ni multiplican con números del navegador (constitución III).
- RI-2 El carrito se obtiene siempre de la respuesta de la API tras cada operación (fuente de verdad única); el navegador no guarda copia persistente.
- RI-3 La sesión es la de Supabase Auth ya existente; el rol lo lee el backend de PostgreSQL (constitución V).

## Clarifications

### Session 2026-11-06

- Q: ¿Desde qué pantallas del catálogo se agrega un producto al carrito? → A: Solo desde el detalle del producto (con selector de cantidad); las tarjetas del catálogo no agregan (CA-F1).
- Q: ¿Qué ve en el detalle quien no puede comprar? → A: El visitante sin sesión ve «Ingresar para comprar» con enlace al inicio de sesión; comerciante, trabajador y administrador ven un aviso «solo los clientes compran» sin botón (CA-F8).
- Q: ¿El encabezado muestra contador del carrito? → A: No; solo el enlace «Carrito», visible únicamente para clientes, sin consultar el carrito en cada página (CA-F12).

## 6. Trazabilidad (interfaz)

| HU | RF | ADR / RC / AC | Criterios |
|---|---|---|---|
| HU04 | RF20, RF21 | ADR-001, ADR-002; RC01–RC03; AC09 | CA-F1, CA-F2, CA-F6, CA-F9, CA-F12 |
| HU05 | RF24 | RC06 | CA-F4, CA-F5, CA-F7 |
| HU06 | RF22, RF23 | constitución III (importes exactos) | CA-F3, CA-F11 |
| — | RF04 | AC04, AC10 | CA-F8, CA-F10 |
