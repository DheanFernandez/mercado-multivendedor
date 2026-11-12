# Modelo de datos (Fase 1): Pedidos y subpedidos

Migración **aditiva** prevista `<timestamp>_pedidos` (no se crea ni se aplica en esta fase). Convenciones del repositorio: nombres en `snake_case`, UUID, `timestamptz(3)`, RLS habilitado **sin políticas**, claves foráneas `RESTRICT` (los recursos con historia no se eliminan; constitución IV), importes `NUMERIC`.

## 1. Entidades de dominio

```text
Pedido (raíz)              id · codigo · clienteId · claveIdempotencia · carritoId · huellaCarrito · totalCentimos
 │                         · reservaVenceEn · creadoEn
 └─ 1..n Subpedido         id · puestoId · puesto{codigo,nombre} · estado · subtotalCentimos
     ├─ 1..n LineaPedido   id · productoId · nombre · unidadVenta · presentacion · cantidad
     │                     · precioUnitarioCentimos · subtotalCentimos
     └─ 1..n EntradaHistorial   estadoAnterior | null · estadoNuevo · origen · actorId | null · creadoEn
```

Invariantes del dominio (probadas con pruebas unitarias):

- Una línea pertenece a exactamente un subpedido: el del puesto de su producto (no hay dos subpedidos del mismo puesto).
- `subtotal(línea) = precio × cantidad`; `subtotal(subpedido) = Σ líneas`; `total(pedido) = Σ subpedidos` (céntimos enteros; mismos límites que el carrito: ≤ 50 productos distintos, 1–10 000 unidades).
- El estado inicial de todo subpedido es `ESPERANDO_PAGO` y genera una `EntradaHistorial` con `estadoAnterior = null`.
- Solo las transiciones de la tabla de §4 son válidas; una transición inválida lanza `TransicionEstadoInvalidaError`.
- Las líneas, los importes y el historial son inmutables tras la creación.
- `estadoGeneral` es derivado y **no se persiste** (Q3).

## 2. Tablas

### `pedidos`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `codigo` | TEXT NOT NULL | **UNIQUE**; `CHECK (codigo ~ '^PED-[0-9A-HJKMNP-TV-Z]{8}$')` |
| `cliente_id` | UUID NOT NULL | FK → `usuarios(id)` `RESTRICT` |
| `clave_idempotencia` | TEXT NOT NULL | `CHECK (length BETWEEN 1 AND 100 AND ~ '^[A-Za-z0-9:_.-]+$')` |
| `carrito_id` | UUID NOT NULL | identidad del carrito **realmente procesado** en la primera ejecución exitosa; **sin clave foránea** (trazabilidad histórica, como `actor_id`) |
| `huella_carrito` | CHAR(64) NOT NULL | SHA-256 hexadecimal del contenido bloqueado (`producto_id:cantidad` ordenado por producto); `CHECK (~ '^[0-9a-f]{64}$')`. Solo trazabilidad: **no** se usa para comparar reintentos (DE-5) |
| `total` | NUMERIC(16,2) NOT NULL | `CHECK (total > 0)` |
| `reserva_vence_en` | TIMESTAMPTZ(3) NOT NULL | vencimiento con el que se reservó el stock |
| `creado_en` | TIMESTAMPTZ(3) NOT NULL | default `now()` |

Restricciones: **`UNIQUE (cliente_id, clave_idempotencia)`** (idempotencia por cliente, Q6-a). Índice `(cliente_id, creado_en DESC, id)` para la lista del cliente.

### `subpedidos`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `pedido_id` | UUID NOT NULL | FK → `pedidos(id)` `RESTRICT` |
| `puesto_id` | UUID NOT NULL | FK → `puestos(id)` `RESTRICT` |
| `puesto_codigo`, `puesto_nombre` | TEXT NOT NULL | **instantánea** (Pedidos no lee tablas de Comerciantes) |
| `estado` | enum `EstadoPedidoPuesto` NOT NULL | default `ESPERANDO_PAGO` |
| `subtotal` | NUMERIC(16,2) NOT NULL | `CHECK (subtotal > 0)` |
| `creado_en`, `actualizado_en` | TIMESTAMPTZ(3) | |

Restricciones: `UNIQUE (pedido_id, puesto_id)`; `UNIQUE (id, puesto_id)` (para la clave foránea compuesta de las líneas). Índice `(puesto_id, estado)` (consulta futura por puesto).

### `lineas_pedido`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `subpedido_id`, `puesto_id` | UUID NOT NULL | FK compuesta `(subpedido_id, puesto_id)` → `subpedidos(id, puesto_id)`: la línea no puede declarar otro puesto |
| `producto_id` | UUID NOT NULL | FK compuesta `(producto_id, puesto_id)` → `productos(id, "puestoId")` `RESTRICT`: el producto debe pertenecer a ese puesto (mismo patrón que `inventarios`) |
| `nombre_producto` | TEXT NOT NULL | instantánea |
| `unidad_venta` | enum `UnidadVenta` NOT NULL | instantánea |
| `presentacion` | TEXT NULL | instantánea |
| `cantidad` | INTEGER NOT NULL | `CHECK (cantidad BETWEEN 1 AND 10000)` |
| `precio_unitario` | NUMERIC(10,2) NOT NULL | `CHECK (precio_unitario > 0)` (precio histórico) |
| `subtotal` | NUMERIC(14,2) NOT NULL | **`CHECK (subtotal = precio_unitario * cantidad)`** |

Restricciones: `UNIQUE (subpedido_id, producto_id)`.

### `historial_estados_subpedido`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `subpedido_id` | UUID NOT NULL | FK → `subpedidos(id)` `RESTRICT` |
| `estado_anterior` | enum `EstadoPedidoPuesto` NULL | nulo en el registro inicial |
| `estado_nuevo` | enum `EstadoPedidoPuesto` NOT NULL | `CHECK (estado_anterior IS DISTINCT FROM estado_nuevo)` |
| `origen` | TEXT NOT NULL | `CHECK (length BETWEEN 1 AND 50)`; valor inicial `CREAR_PEDIDO` (origen documentado en C4 N4 §3) |
| `actor_id` | UUID NULL | **sin clave foránea** (libro histórico, como `movimientos_inventario`) |
| `creado_en` | TIMESTAMPTZ(3) NOT NULL | default `now()` |

Índice `(subpedido_id, creado_en)`.

### Enumeración `EstadoPedidoPuesto`

`ESPERANDO_PAGO`, `PAGO_APROBADO`, `EN_PREPARACION`, `LISTO_PARA_RETIRO`, `ENTREGADO`, `EXPIRADO`, `CANCELADO` (C4 N4 §3). `MIXTO` **no** forma parte.

## 3. Integridad reforzada en la base de datos (AC08)

| Mecanismo | Qué garantiza |
|---|---|
| Triggers `BEFORE UPDATE OR DELETE` en `lineas_pedido` y `historial_estados_subpedido` | inmutabilidad de las líneas y del historial (CA-O18) |
| Trigger `BEFORE UPDATE` en `pedidos` | no se puede cambiar código, cliente, clave, carrito, huella, total ni vencimiento |
| Trigger `BEFORE UPDATE` en `subpedidos` | solo pueden cambiar `estado` y `actualizado_en` |
| Restricciones de columna y de tabla (`CHECK`, únicos, claves foráneas compuestas) | el subtotal de cada línea es exactamente `precio × cantidad`; cada línea pertenece al puesto de su subpedido y de su producto |
| RLS habilitado sin políticas | el backend (rol `postgres`) es el único acceso, como el resto de tablas |

**Efecto sobre las pruebas**: los triggers de inmutabilidad también impiden que una prueba borre sus propios datos. La limpieza de las pruebas de base de datos usará `SET LOCAL session_replication_role = replica` dentro de una transacción (el rol de la base aislada de Docker tiene el privilegio) y solo sobre las filas etiquetadas por la prueba; nunca se ejecuta contra una base remota (la guarda `base-aislada` ya lo impide). Ningún código de producción desactiva los triggers.

**Totales sin triggers diferidos** (decisión del equipo): `pedidos.total = Σ subpedidos.subtotal` y `subpedidos.subtotal = Σ lineas_pedido.subtotal` se garantizan en el dominio (una sola construcción atómica) y se verifican con consultas SQL de integridad en las pruebas de base de datos, incluidas las de fallo forzado.

## 4. Máquina de estados (C4 N4 §3)

| Desde | Hacia | Origen documentado | ¿Alcanzable en esta fase? |
|---|---|---|---|
| (inicio) | `ESPERANDO_PAGO` | `CrearPedido` | **Sí** |
| `ESPERANDO_PAGO` | `PAGO_APROBADO` | evento `PagoAprobado` (Pagos) | No (S-08) |
| `ESPERANDO_PAGO` | `EXPIRADO` | proceso de expiración (RF54, Pagos) | No (S-08) |
| `ESPERANDO_PAGO` | `CANCELADO` | pago rechazado o cancelación (Pagos/Incidencias) | No |
| `PAGO_APROBADO` | `EN_PREPARACION` | comerciante o trabajador | No (preparación) |
| `PAGO_APROBADO` | `CANCELADO` | cancelación con reembolso | No |
| `EN_PREPARACION` | `LISTO_PARA_RETIRO` | comerciante o trabajador | No |
| `EN_PREPARACION` | `CANCELADO` | cancelación con reembolso | No |
| `LISTO_PARA_RETIRO` | `ENTREGADO` | comerciante o trabajador | No |
| `EXPIRADO` | `PAGO_APROBADO` | aprobación tardía con nueva reserva | No (S-08) |

Estados finales: `ENTREGADO`, `CANCELADO`, `EXPIRADO` (este último solo sale por aprobación tardía). Cualquier otra transición se rechaza.

## 5. Estado general (derivado)

| Estados de los subpedidos | `estadoGeneral` |
|---|---|
| todos iguales | ese estado (p. ej. `ESPERANDO_PAGO`) |
| al menos dos distintos | `MIXTO` (solo representación de consulta) |

## 6. Datos que **no** modifica esta feature

`carritos`, `carrito_items`, `inventarios`, `movimientos_inventario`, `reservas_inventario`, `productos`, `puestos`, `usuarios`: el esquema de esas tablas no cambia; el schema de Prisma solo añade las **relaciones inversas** necesarias. Las filas de Carrito (vaciado) e Inventario (reserva y movimiento `RESERVA`) se modifican únicamente a través de sus repositorios, dentro de la misma unidad de trabajo.
