# Contrato REST propuesto: `/api/v1/pedidos`

**Estado**: propuesta para revisión con el equipo (Dhean). No implementada. Requiere `Authorization: Bearer <JWT de Supabase>`. **Solo rol `CLIENTE`**; el cliente se toma de la sesión, nunca del cuerpo. Importes siempre como texto con 2 decimales (`"19.50"`); el frontend no los calcula.

| Operación | Método y ruta | Éxito | Criterios |
|---|---|---|---|
| Crear pedido desde mi carrito | `POST /api/v1/pedidos` | **201** (nuevo) · **200** (repetición) + Pedido | CA-O1–O13, O21, O23, O24 |
| Listar mis pedidos | `GET /api/v1/pedidos?pagina=&limite=` | 200 + Página de resúmenes | CA-O14 |
| Detalle de un pedido mío | `GET /api/v1/pedidos/:id` | 200 + Pedido | CA-O14, O15, O25 |
| Historial de estados | `GET /api/v1/pedidos/:id/historial?pagina=&limite=` | 200 + Página de entradas | CA-O17, O18 |

No existen rutas de cancelación, pago, preparación ni expiración en esta fase (FR-023, FR-025, FR-026).

## `POST /api/v1/pedidos`

Cuerpo:

```json
{ "claveIdempotencia": "pedido-2026-11-06-ana-0001" }
```

| Campo | Regla |
|---|---|
| `claveIdempotencia` | **obligatoria**; 1–100 caracteres `A-Za-z0-9:_.-`; pertenece al cliente: la identidad es `(cliente, clave)` (DE-5) |

La solicitud **no** lleva `carritoId` ni líneas: el pedido se construye siempre con el carrito del propio cliente, leído con bloqueo dentro de la operación.

Comportamiento: una creación nueva responde **201**; repetir la misma clave responde **200** con el **mismo** pedido (mismo código e importes) **sin reservar de nuevo**, aunque el carrito esté vacío o tenga otro contenido. **El sistema no compara el contenido de los reintentos** (la solicitud solo expresa la clave): una compra nueva exige una clave nueva. La primera ejecución exitosa guarda la identidad y la huella del carrito procesado solo para trazabilidad.

## Respuesta `Pedido`

```json
{
  "id": "uuid",
  "codigo": "PED-7K3M9QX2",
  "creadoEn": "2026-11-06T16:20:00.000Z",
  "reservaVenceEn": "2026-11-06T16:35:00.000Z",
  "estadoGeneral": "ESPERANDO_PAGO",
  "subpedidos": [
    {
      "id": "uuid",
      "puesto": { "id": "uuid", "codigo": "A-1", "nombre": "Puesto A" },
      "estado": "ESPERANDO_PAGO",
      "subtotal": "19.50",
      "lineas": [
        { "productoId": "uuid", "nombre": "Mango", "unidadVenta": "KILOGRAMO", "presentacion": null,
          "cantidad": 3, "precioUnitario": "6.50", "subtotal": "19.50" }
      ]
    }
  ],
  "total": "79.77",
  "totalProductos": 9
}
```

- `estadoGeneral`: el estado común de los subpedidos, o **`MIXTO`** si difieren. Es solo una representación de consulta (no existe como estado) (Q3).
- `reservaVenceEn`: vencimiento con el que se reservó el stock (informativo; la expiración depende de Pagos).
- **No** hay `urlCheckout` ni datos de pago (FR-017, FR-023).
- Un pedido ajeno o un `:id` que no es UUID responden 404.

## `GET /api/v1/pedidos`

Respuesta `Pagina<ResumenPedido>` (misma forma que el resto de listas: `datos`, `pagina`, `limite`, `total`, `totalPaginas`; `limite` ≤ 50, orden del más reciente al más antiguo):

```json
{ "id": "uuid", "codigo": "PED-7K3M9QX2", "creadoEn": "…", "estadoGeneral": "ESPERANDO_PAGO", "total": "79.77", "cantidadSubpedidos": 3 }
```

## `GET /api/v1/pedidos/:id/historial`

Entradas en orden cronológico ascendente:

```json
{ "subpedidoId": "uuid", "puesto": { "codigo": "A-1", "nombre": "Puesto A" },
  "estadoAnterior": null, "estadoNuevo": "ESPERANDO_PAGO", "origen": "CREAR_PEDIDO", "creadoEn": "…" }
```

## Errores (cuerpo `{ statusCode, codigo, mensaje }`)

| Estado | `codigo` | Cuándo | Cuerpo adicional |
|---|---|---|---|
| 400 | `VALIDACION` | falta o es inválida la `claveIdempotencia` | — |
| 401 | `NO_AUTENTICADO` | sin sesión o token inválido | — |
| 403 | `PROHIBIDO` | rol distinto de cliente | — |
| 404 | `NO_ENCONTRADO` | pedido inexistente, ajeno o id inválido | — |
| 409 | `CONFLICTO` | **stock insuficiente** (nombra el producto), **carrito vacío o inexistente**, **carrito con líneas no vigentes** (producto ya no disponible) | `productoId` cuando aplica |
| 503 | `SERVICIO_NO_DISPONIBLE` | configuración de reserva ausente o inválida **en una creación nueva** (repetir una clave ya confirmada devuelve el pedido con 200 aunque falte la configuración, DI-2); **hasta 5 intentos** ante interbloqueo o fallo de serialización agotados; código no generable | — |

Un 409 por stock, carrito vacío o líneas no vigentes no guarda nada y no consume la clave: el cliente corrige su carrito y repite con la **misma** clave (no hay pedido asociado todavía). Si ya existía un pedido para esa clave, se devuelve ese pedido (200).

## Notas para el frontend (Dhean)

- Generar la `claveIdempotencia` **una vez por intento de compra** (p. ej. un UUID al abrir la confirmación) y reutilizarla solo en los reintentos de ese intento (red caída, doble clic). **Una compra nueva exige una clave nueva**: reutilizar una clave devuelve el pedido anterior aunque el carrito sea otro.
- Tras un 201/200 el carrito ya está vacío: no volver a llamar a `GET /carrito` esperando contenido.
- Mostrar `subpedidos[].subtotal` y `total` tal cual (sin sumar); el estado de cada puesto viene en cada subpedido y `estadoGeneral` puede ser `MIXTO`.
