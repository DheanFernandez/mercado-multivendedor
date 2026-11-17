# Modelo de datos (Fase 1): carrito en el cliente

No hay esquema de base de datos nuevo (el modelo `carritos`/`carrito_items` ya existe en el backend; ver `spec.md` §2). Esta sección describe solo la forma de los datos que la interfaz recibe y su estado local.

## Entidades recibidas de la API (solo lectura)

**Carrito** — respuesta de todas las operaciones.

| Campo | Tipo | Regla |
|---|---|---|
| `puestos` | `GrupoPuesto[]` | agrupación por puesto (RF21); vacío si no hay productos |
| `total` | `string` | total general `"12.50"` (RF23); no se recalcula |
| `totalProductos` | `number` | unidades vigentes (informativo) |
| `requiereRevision` | `boolean` | `true` si alguna línea no es vigente (R7) |

**GrupoPuesto**: `puesto { id, codigo \| null, nombre \| null }`, `items: LineaCarrito[]`, `subtotal: string` (RF22).

**LineaCarrito**: `productoId`, `nombre \| null`, `unidadVenta \| null`, `presentacion \| null`, `cantidad: number`, `precioUnitario \| null`, `subtotal \| null`, `estado: "OK" \| "NO_DISPONIBLE" \| "STOCK_INSUFICIENTE"`, `disponible: number`.

Reglas de presentación derivadas (sin cálculo monetario):

- `OK`: línea normal, suma al total.
- `STOCK_INSUFICIENTE`: destacar y mostrar «Quedan {disponible}» («Agotado» si es 0); la línea no suma (CA-F6).
- `NO_DISPONIBLE`: sin nombre ni precio; mostrar «Este producto ya no está disponible»; solo se puede quitar (CA-F6).
- Puesto con `codigo`/`nombre` nulos (solo líneas no disponibles): se rotula «Puesto no disponible».

## Estado local de la interfaz (no persistente)

| Pantalla | Estado | Transiciones |
|---|---|---|
| `/carrito` | `cargando → listo(carrito) \| error(mensaje)` | tras cada operación: `listo(nuevo carrito)`; los errores de una operación no borran el carrito mostrado (CA-F7) |
| Línea | `reposo \| enviando \| error(mensaje)` | `reposo → enviando → reposo`; los controles de la línea se deshabilitan en `enviando` (R4) |
| Vaciar | `reposo \| confirmando \| enviando` | confirmación explícita antes de enviar (CA-F5) |
| `ComprarProducto` | `reposo \| enviando \| agregado(carrito) \| error(mensaje)` | `agregado` muestra la confirmación con el total (CA-F1) |
| Sesión (`useSesion`) | `cargando \| visitante \| cliente \| otro` | solo lectura del perfil |

## Validación de entrada (cliente, además de la del servidor)

`cantidad`: texto → entero, 1 ≤ n ≤ 10 000; rechaza vacío, `0`, negativos, decimales, texto, notación exponencial y > 10 000 (CA-F4). El servidor repite la validación (R3).
