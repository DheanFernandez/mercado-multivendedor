# Base de datos y caché (Sprint 02)

| Campo | Descripción |
|---|---|
| Alcance | Modelo, índices, transacciones y estrategia de caché del backend en `main` |
| Fuentes | [`schema.prisma`](../../backend/prisma/schema.prisma), [`migrations/`](../../backend/prisma/migrations/), repositorios Prisma de `backend/src/modules/*/infrastructure/` |
| Verificado | 25/11/2026 contra el código del repositorio. Lo que no se pudo comprobar se marca «no verificado» |
| Relacionado | [Informe final §9](../07-sprint-02/04-informe-final-sprint-02.md#9-validación-de-atributos-de-calidad) · [Portada del Sprint 02](../sprints/sprint-02/README.md) · [ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md) |

## 1. Modelo y migraciones

PostgreSQL con Prisma. Hay **4 migraciones aplicadas** (`backend/prisma/migrations/`), en este orden:

| # | Migración | Crea |
|---|---|---|
| 1 | `20261105000000_usuarios_comerciantes_puestos` | `usuarios`, `comerciantes`, `puestos` |
| 2 | `20261106000000_productos_categorias` | `categorias`, `productos`, `producto_imagenes` |
| 3 | `20261107000000_inventario` | `inventarios`, `movimientos_inventario`, `reservas_inventario`; restricciones `CHECK` (`0 ≤ stock_reservado ≤ stock_fisico`, `cantidad > 0`) y la clave única `productos(id, puestoId)` |
| 4 | `20261108000000_carrito` | `carritos`, `carrito_items` |

No existen tablas de Pedidos ni de Pagos. Evidencia de que las 4 migraciones se aplican en una base limpia: [`postgresql.txt`](../07-sprint-02/evidencias/2026-11-18/funcional/postgresql.txt) y [evidencia del 23/11](../07-sprint-02/evidencias/2026-11-23/inventario/README.md).

## 2. Tabla de índices

Cada `@@index` y `@@unique` de [`schema.prisma`](../../backend/prisma/schema.prisma), con la consulta del código que lo usa. Rutas relativas a `backend/src/modules/`. «Sin consulta clara» significa que no encontré en el código ninguna consulta que se beneficie de él; no se afirma que sobre.

| Tabla | Índice (columnas) | Consulta o caso de uso al que sirve | Archivo que la usa |
|---|---|---|---|
| `usuarios` | `@@index([rol])` | **Sin consulta clara.** Ninguna consulta filtra por `rol` (el listado de usuarios no tiene `where`, solo ordena por `creadoEn`). Posible uso futuro: listar por rol | `users/infrastructure/persistence/prisma-usuario.repository.ts` (`listar`, línea 55) |
| `puestos` | `@@index([comercianteId])` | Listar los puestos de un comerciante (`where: { comercianteId }`) y la clave foránea hacia `comerciantes` | `merchants/infrastructure/persistence/prisma-merchants.repositories.ts:85-88` |
| `productos` | `@@index([puestoId, estado])` | Catálogo filtrado por puesto sobre productos `PUBLICADO`; panel del comerciante (productos de sus puestos) | `catalog/infrastructure/prisma-catalogo.repository.ts:42`; `products/infrastructure/prisma-products.repositories.ts:101-103` |
| `productos` | `@@index([categoriaId, estado])` | Catálogo filtrado por categoría; listado de productos por categoría | `catalog/infrastructure/prisma-catalogo.repository.ts:41`; `products/infrastructure/prisma-products.repositories.ts:102` |
| `productos` | `@@index([estado, creadoEn])` | Listado del catálogo: `estado = PUBLICADO` ordenado por `creadoEn` descendente (orden por defecto) | `catalog/infrastructure/prisma-catalogo.repository.ts:7-11, 60` |
| `productos` | `@@unique([id, puestoId])` | **No sirve a una consulta de lectura.** Es el destino de las claves foráneas compuestas de `inventarios` y `carrito_items`, para que el puesto no pueda divergir del producto | Restricción de integridad (migración 3) |
| `producto_imagenes` | `@@unique([productoId, orden])` | Impide dos imágenes con el mismo orden por producto; su prefijo `productoId` sirve a la carga de imágenes (`include: imagenes` ordenado por `orden`) | `catalog/infrastructure/prisma-catalogo.repository.ts:16`; `products/infrastructure/prisma-products.repositories.ts:95` |
| `inventarios` | `@@unique([productoId, puestoId])` | Integridad y destino de `ON CONFLICT DO NOTHING` al crear existencias; la consulta por `producto_id` usa además `@unique` de `productoId` | `inventory/infrastructure/prisma-inventario.repository.ts:109-110` (alta), `:144` (`producto_id = ANY(...)`) |
| `inventarios` | `@@index([puestoId])` | Listado de existencias de uno o varios puestos (`puestoId` o `puestoId IN (...)`) | `inventory/infrastructure/prisma-inventario.repository.ts:73-81` |
| `movimientos_inventario` | `@@index([inventarioId, creadoEn])` | Historial de movimientos de un producto, más recientes primero | `inventory/infrastructure/prisma-inventario.repository.ts:83-88` |
| `reservas_inventario` | `@@unique([claveOperacion, inventarioId])` | Base de la idempotencia: `ON CONFLICT (clave_operacion, inventario_id) DO NOTHING`; su prefijo `clave_operacion` sirve a las consultas por clave al reintentar, liberar y confirmar | `inventory/infrastructure/prisma-inventario.repository.ts:129-131, 157, 180, 209` |
| `reservas_inventario` | `@@index([estado, expiraEn])` | Búsqueda de reservas vencidas (`estado = 'RESERVADA' AND expira_en <= ahora`) y liberación por expiración | `inventory/infrastructure/prisma-inventario.repository.ts:97-102, 182` |
| `carrito_items` | `@@unique([carritoId, productoId])` | Un solo renglón por producto y `ON CONFLICT (carrito_id, producto_id) DO UPDATE` al agregar; sirve a las consultas por `carrito_id` | `cart/infrastructure/prisma-carrito.repository.ts:49, 51, 58, 71, 79` |
| `carrito_items` | `@@index([productoId])` | **Sin consulta clara.** Ninguna consulta del carrito busca por `producto_id` sin `carrito_id`. Probablemente respalda la clave foránea compuesta hacia `productos` (`ON DELETE CASCADE`): **no verificado** | — |

Índices de columna única (`@unique`), por completitud:

| Tabla | Columna | Uso |
|---|---|---|
| `usuarios` | `email` | `findUnique({ email })` — `users/.../prisma-usuario.repository.ts:45-46` |
| `usuarios` | `authId` | `findUnique({ authId })`, resolución del usuario en cada solicitud autenticada — `users/.../prisma-usuario.repository.ts:50-51` |
| `comerciantes` | `usuarioId` | `findUnique({ usuarioId })` — `merchants/.../prisma-merchants.repositories.ts:41-42` |
| `puestos` | `codigo` | Unicidad del código del puesto; los listados ordenan por `codigo` (líneas 78 y 88) |
| `categorias` | `slug` | Unicidad (evita categorías duplicadas); **sin consulta de lectura por `slug`** en el código |
| `producto_imagenes` | `ruta` | Unicidad de la ruta en el almacenamiento; sin consulta de lectura por `ruta` |
| `inventarios` | `productoId` | `findUnique({ productoId })` — `inventory/.../prisma-inventario.repository.ts:68-70` |
| `carritos` | `usuarioId` | `ON CONFLICT (usuario_id)` y subconsultas por usuario — `cart/.../prisma-carrito.repository.ts:44-45, 71, 79` |

### EXPLAIN

Se ejecutó **de verdad** el 25/11/2026 sobre un PostgreSQL 17.11 desechable (contenedor Docker `postgres:17-alpine`, sin tocar Supabase), con las 4 migraciones aplicadas con `psql` y datos **sintéticos**: 50 comerciantes, 100 puestos, 20 categorías y 5 000 productos `PUBLICADO` repartidos de forma uniforme (el mismo tamaño que EQ-04). El contenedor se eliminó al terminar. Comando: `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)`.

**Limitaciones.** Las consultas son una **aproximación escrita a mano** del filtro principal; no son el SQL exacto que genera Prisma (que añade uniones con `categorias`, `puestos` y `comerciantes` por el filtro de visibilidad, y la carga de imágenes). Con 5 000 filas todo cabe en memoria (`shared hit`, sin lecturas de disco), así que los tiempos (< 1 ms) **no son extrapolables** a producción ni a Supabase.

| Consulta aproximada | Plan observado | Índice usado |
|---|---|---|
| Listado: `WHERE estado='PUBLICADO' ORDER BY "creadoEn" DESC, id LIMIT 12` | `Incremental Sort` sobre `Index Scan Backward`; 13 filas leídas; 0,249 ms | `productos_estado_creadoEn_idx` |
| Categoría y precio: `WHERE estado='PUBLICADO' AND "categoriaId"=… AND precio BETWEEN 10 AND 200 ORDER BY precio, id LIMIT 12` | `Bitmap Heap Scan` (250 filas del índice) y `top-N heapsort`; 0,733 ms | `productos_categoriaId_estado_idx` |
| Puesto: `WHERE "puestoId"=… AND estado='PUBLICADO'` | `Bitmap Heap Scan`; 50 filas; 0,161 ms | `productos_puestoId_estado_idx` |

Observación: en el filtro por categoría el índice no cubre `precio`; PostgreSQL lee las ~250 filas de la categoría y las ordena. A este tamaño es irrelevante; **no se probó** con un volumen mayor.

**EXPLAIN: pendiente** para el resto de consultas. En particular, para `reservas_inventario(estado, expira_en)` el plan obtenido con la tabla vacía fue `Seq Scan` y **no es representativo** (la tabla no tenía filas). La consulta que habría que analizar con reservas sembradas es:

```sql
SELECT DISTINCT clave_operacion FROM reservas_inventario
WHERE estado = 'RESERVADA' AND expira_en <= now() LIMIT 50;
```

Tampoco se analizó la búsqueda por texto del catálogo (`nombre`/`descripcion`/`categoria.nombre` con `contains … mode: 'insensitive'`, es decir, `ILIKE '%…%'`): ninguno de los índices anteriores la sirve, y no hay índice de texto en el esquema. Consulta pendiente de analizar: `SELECT … FROM productos WHERE estado='PUBLICADO' AND nombre ILIKE '%tomate%' ORDER BY "creadoEn" DESC LIMIT 12;`.

## 3. Transacciones y concurrencia

### 3.1 Dónde hay transacciones

No existe una clase «unidad de trabajo» (véase [patrones de diseño](../03-diseño-de-software/diseño-interno/patrones-de-diseño.md): *Unit of Work* está «Diseñado, no implementado en Sprint 2»). La transacción vive **dentro de cada repositorio Prisma**. Todos los `$transaction` del código fuente (excluido el cliente generado):

| Archivo:línea | Operación | Qué agrupa |
|---|---|---|
| [`prisma-inventario.repository.ts:108`](../../backend/src/modules/inventory/infrastructure/prisma-inventario.repository.ts#L108) | `variarStock` | Alta de existencias (si no existen), `UPDATE` del stock físico y asiento del movimiento |
| [`prisma-inventario.repository.ts:126`](../../backend/src/modules/inventory/infrastructure/prisma-inventario.repository.ts#L126) | `reservar` | Inserta las reservas de todos los productos, descuenta la disponibilidad y asienta los movimientos: todo o nada |
| [`prisma-inventario.repository.ts:177`](../../backend/src/modules/inventory/infrastructure/prisma-inventario.repository.ts#L177) | `liberar` | Cambia reservas a `LIBERADA` y devuelve el stock reservado |
| [`prisma-inventario.repository.ts:207`](../../backend/src/modules/inventory/infrastructure/prisma-inventario.repository.ts#L207) | `confirmarVenta` | Cambia reservas a `CONFIRMADA` y descuenta stock físico y reservado |
| [`prisma-carrito.repository.ts:42`](../../backend/src/modules/cart/infrastructure/prisma-carrito.repository.ts#L42) | `agregar` | Crea el carrito si no existe, comprueba el límite de renglones y suma la cantidad con tope |
| [`prisma-products.repositories.ts:72`](../../backend/src/modules/products/infrastructure/prisma-products.repositories.ts#L72) | `guardar` | `upsert` del producto y sincronización de sus imágenes |

Las transacciones de inventario usan `maxWait` de 20 s y `timeout` de 15 s (`OPCIONES_TX`, línea 27). El nivel de aislamiento **no se fija en el código**: se usa el predeterminado de PostgreSQL.

### 3.2 Reserva atómica de stock (ADR-003) y cómo se evita la sobreventa

La decisión es la de [ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md), tal como la implementa `reservar` (`prisma-inventario.repository.ts:124-173`):

1. **Comprobar y descontar en una sola sentencia.** `UPDATE inventarios SET stock_reservado = stock_reservado + $n WHERE id = … AND stock_fisico - stock_reservado >= $n RETURNING …` (líneas 161-164). Si no devuelve filas, no hay disponibilidad y se lanza `StockInsuficienteError`, lo que **revierte toda la transacción**. No hay un «leer y luego escribir», por lo que dos solicitudes simultáneas nunca ven la misma disponibilidad: la segunda espera el bloqueo de fila de la primera y reevalúa la condición con el valor ya actualizado.
2. **`CHECK` como última barrera.** `inventarios_stock_chk`: `0 ≤ stock_reservado ≤ stock_fisico` (migración 3). Aunque el código fallara, la base rechazaría una fila con más reservado que físico.
3. **Orden estable de bloqueo.** Los renglones se procesan ordenados por id de inventario (línea 150; igual en `liberar` y `confirmarVenta`), de modo que pedidos con varios productos no se bloquean mutuamente en ciclo.
4. **Reintento ante interbloqueo o fallo de serialización.** `conReintento` (líneas 45-54) reintenta hasta 4 veces con espera creciente ante `40P01`, `40001` o `P2034`.
5. **Idempotencia.** La clave única `(clave_operacion, inventario_id)` con `ON CONFLICT DO NOTHING` (línea 157) hace que repetir una operación devuelva el resultado anterior sin tocar el stock; una clave reutilizada con otro contenido lanza `ClaveOperacionReutilizadaError`.
6. **`liberar` y `confirmarVenta` solo actúan sobre reservas en estado `RESERVADA`**: cambiar el estado es lo que impide devolver o descontar dos veces.

### 3.3 Pruebas que lo validan

`npm run test:db` ejecuta 7 archivos contra PostgreSQL real. Resultado del **23/11/2026: 7 archivos, 73 de 73 pruebas correctas** ([evidencia](../07-sprint-02/evidencias/2026-11-23/inventario/README.md), [salida](../07-sprint-02/evidencias/2026-11-23/inventario/test-db.txt), [salida detallada](../07-sprint-02/evidencias/2026-11-23/inventario/test-db-detalle.txt)):

| Archivo de prueba | Pruebas | Qué valida |
|---|---|---|
| [`inventario.db-spec.ts`](../../backend/test/inventario.db-spec.ts) | 25 | Operaciones de inventario sobre PostgreSQL |
| [`inventario-invariantes.db-spec.ts`](../../backend/test/inventario-invariantes.db-spec.ts) | 3 | Invariantes con tres semillas de operaciones aleatorias |
| [`eq03-concurrencia.db-spec.ts`](../../backend/test/eq03-concurrencia.db-spec.ts) | 5 | Reserva simultánea: con stock 1 y N = 2, 5 y 20 clientes, exactamente 1 éxito; con stock 10 y 200 clientes, exactamente 10 éxitos; nunca `stock_reservado > stock_fisico` |
| [`modelo-restricciones.db-spec.ts`](../../backend/test/modelo-restricciones.db-spec.ts) | 13 | Restricciones del modelo (unicidades, `CHECK`) |
| [`productos-persistencia.db-spec.ts`](../../backend/test/productos-persistencia.db-spec.ts) | 15 | Persistencia de productos |
| [`carrito.db-spec.ts`](../../backend/test/carrito.db-spec.ts) | 8 | Persistencia del carrito |
| [`h0-persistencia.db-spec.ts`](../../backend/test/h0-persistencia.db-spec.ts) | 4 | Persistencia base (hito H0) |

Alcance: se probó `ReservarInventario`, no «crear pedido» (Pedidos no existe). La repetición del 23/11 cubre solo la parte Vitest de EQ-03; la parte k6 es del 05/11 y no se repitió ([EQ-03](evidencias/EQ-03/2026-11-05/README.md)).

## 4. Comportamiento observado

Solo se resume lo que dicen las evidencias del 05/11/2026; **no se repitieron** sobre `200675c` y todas son locales.

| Medición | Resultado | Lo que dice sobre la base de datos |
|---|---|---|
| [EQ-03](evidencias/EQ-03/2026-11-05/README.md) · concurrencia | 400 de 400 iteraciones sin reservas incompatibles. Con k6 (200 VUs, stock 10): exactamente 10 reservas aceptadas, 13 933 faltas controladas (409), 0 respuestas inesperadas; SQL final `stock_reservado > stock_fisico` = 0 | La corrección se sostiene bajo contención. La latencia (p95 ≈ 1,2 s con 200 VUs sin espera) **no es criterio de EQ-03 y la evidencia no la interpreta** |
| [EQ-04](evidencias/EQ-04/2026-11-05/README.md) · catálogo, 100 VUs constantes | p95 = **381,4 ms** (con espera ≈ 1 s), mediana 40,9 ms, p99 746,9 ms, 0 % de errores, 10 886 solicitudes (≈ 89,6/s). Esfuerzo máximo (sin espera): p95 = **1 043 ms**, p99 1 278 ms, ≈ 120,7/s, 0 errores | Base de 5 000 productos, PostgreSQL 16 en memoria (tmpfs), pool por defecto de 10 conexiones, sin caché |

**¿Fue la base de datos el cuello de botella?** **No se puede afirmar.** Ninguna evidencia lo mide: no se registró `pg_stat_statements`, ni uso de CPU, ni tiempo en la base frente al del backend, y backend, PostgreSQL y k6 compartieron máquina. Lo único comprobable es que se cumplió el umbral p95 < 2 000 ms con 100 VUs constantes. **No se ejecutó carga progresiva hasta 2000 VUs**; por encima de 100 usuarios concurrentes no hay medición.

## 5. Estrategia de caché

**Estado: no implementada en Sprint 2.** El backend no tiene ninguna caché (no hay Redis ni caché en memoria en el código; EQ-04 se midió «sin caché»).

**Decisión.** Con un catálogo pequeño (5 000 productos en la prueba, mucho menos en un mercado de abastos real) y p95 = 381,4 ms con 100 usuarios, la lectura directa de PostgreSQL cumple el umbral documentado. Además se priorizó la **consistencia del stock**: la disponibilidad que ve el cliente y la que reserva `reservar` deben salir de la misma fuente, y cachear existencias arriesgaría mostrar o aceptar stock obsoleto. El costo de no cachear es una base más expuesta si el tráfico crece; **no se midió** ese escenario.

**Propuesta para después (no es un hecho ni está decidida):**

| Elemento | Propuesta |
|---|---|
| Qué cachear | Solo la **lectura del catálogo** (listado y detalle públicos): categorías, puestos y datos del producto. **No** existencias ni reservas |
| TTL | Corto (por ejemplo, 30 a 60 segundos; valor a definir con mediciones) |
| Invalidación | Al crear, editar, publicar o desactivar un producto, y al cambiar una categoría o un puesto, invalidar las entradas afectadas |
| Dónde | Primero una caché en memoria del proceso; Redis solo si se despliega más de una instancia |
| Cuándo | Solo si una medición en el entorno de despliegue (Sprint 03) muestra que la base es el límite |
| Riesgos a evaluar | Un precio o una disponibilidad desactualizados unos segundos; el carrito ya lee precio y disponibilidad vigentes y no debería usar esta caché |
