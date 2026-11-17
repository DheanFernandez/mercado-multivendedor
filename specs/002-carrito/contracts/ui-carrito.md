# Contrato de interfaz: carrito

## Rutas

| Ruta | Acceso | Contenido | Criterios |
|---|---|---|---|
| `/carrito` | solo `CLIENTE`. Sin sesión → `/login`; otro rol → «Acceso restringido» (componente `Acceso`). Título de la página: «Mi carrito» | `CarritoVista` | CA-F2…CA-F9, CA-F11 |
| `/catalogo/[id]` (existente) | público; el bloque de compra depende del rol | `ComprarProducto` sustituye el aviso «La compra se habilitará próximamente» | CA-F1, CA-F8 |

## Componentes

| Componente | Responsabilidad | Entradas / salidas |
|---|---|---|
| `CarritoVista` | carga el carrito, agrupa por puesto, muestra subtotales y total, vacía el carrito (con confirmación), avisa de `requiereRevision`, estado vacío con enlace al catálogo; rotula el total como «Importe estimado» y no ofrece pedido ni pago | sin props; usa `obtenerCarrito`, `vaciarCarrito` |
| `LineaCarrito` | una línea: nombre, precio unitario, cantidad editable, subtotal, estado de disponibilidad, «Actualizar» y «Quitar»; bloquea sus controles mientras envía | props: `linea`, `alCambiar(carrito)`; usa `actualizarCantidadCarrito`, `quitarDelCarrito` |
| `ComprarProducto` | según `useSesion`: cliente → cantidad + «Agregar al carrito» (confirmación con total y enlace a `/carrito`); visitante → «Ingresar para comprar» (enlace a `/login`); otro rol → aviso «Solo los clientes compran» | prop: `productoId`; usa `agregarAlCarrito` |
| `SiteHeader` (modifica) | enlace «Carrito» solo con rol `CLIENTE`; sin contador, sin llamada al carrito | — |

## Estados visibles (CA-F7, CA-F9, CA-F10)

Cargando (`role="status"`) · error de carga (`role="alert"`, con la opción de reintentar) · carrito vacío · operación en curso (controles de la línea deshabilitados y texto «Guardando…») · error de operación junto a la línea o al formulario, sin perder el carrito mostrado.

## Enmienda de presentación (spec 004-catalogo-publico, 2026-11-08)

Solo presentación; el comportamiento, los textos y los roles que verifican CA-F1…CA-F12 no cambian:

- `CarritoVista`: ruta de navegación, lista de grupos a la izquierda y **resumen** a la derecha desde `lg` (`aside` «Resumen del carrito», no es una `region`): productos y puestos, subtotal por puesto si hay más de uno, «Total:», «Importe estimado…» y «Seguir comprando». Sigue sin ofrecer pedido ni pago.
- `LineaCarrito`: miniatura neutra (la API del carrito no devuelve imagen) y botones −/+ que envían la cantidad ±1 con `actualizarCantidadCarrito`; − se deshabilita en 1 y + al alcanzar lo disponible. «Actualizar» y «Quitar» se mantienen (en pantallas estrechas «Quitar» muestra solo el icono; su nombre accesible no cambia).

## Accesibilidad y adaptación

Cada campo de cantidad tiene etiqueta asociada (nombre del producto); botones con texto; mensajes de error en `role="alert"`; diseño en columna única en pantallas estrechas y cuadrícula desde `sm` (patrones de Tailwind ya usados en el catálogo).
