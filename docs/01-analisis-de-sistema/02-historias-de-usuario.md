# Historias de Usuario

Las historias de usuario describen las principales necesidades de los actores de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Actor | Historia de usuario |
|---|---|---|
| HU01 | Cliente | Como cliente, quiero consultar productos de diferentes puestos, para encontrar los productos que necesito. |
| HU02 | Cliente | Como cliente, quiero buscar y filtrar productos, para encontrar rápidamente productos según mis necesidades. |
| HU03 | Cliente | Como cliente, quiero consultar el detalle de un producto, para conocer su precio, disponibilidad y puesto de procedencia antes de comprarlo. |
| HU04 | Cliente | Como cliente, quiero agregar productos de diferentes puestos al mismo carrito, para realizar una compra multivendedor. |
| HU05 | Cliente | Como cliente, quiero modificar o eliminar productos del carrito, para ajustar mi compra antes de confirmar el pedido. |
| HU06 | Cliente | Como cliente, quiero visualizar el subtotal de cada puesto y el total general, para conocer el importe estimado de mi compra. |
| HU07 | Cliente | Como cliente, quiero generar un pedido con productos de uno o varios puestos, para iniciar el proceso de compra. |
| HU08 | Cliente | Como cliente, quiero realizar el pago de cada puesto mediante Yape o Plin, para que los comerciantes puedan validarlo y preparar mi pedido. |
| HU09 | Cliente | Como cliente, quiero consultar el estado de mi pedido, para conocer el avance del pago, la preparación y el retiro de los productos de cada puesto. |
| HU10 | Cliente | Como cliente, quiero retirar en cada puesto los productos de mi pedido, para recibir mi compra una vez que estén listos. |
| HU11 | Comerciante | Como comerciante, quiero administrar la información de mi tienda, para mantener actualizados los datos de mi puesto comercial, incluidos sus códigos QR de cobro. |
| HU12 | Comerciante | Como comerciante, quiero registrar y actualizar productos, para mantener actualizado mi catálogo. |
| HU13 | Comerciante | Como comerciante, quiero gestionar precios y presentaciones de mis productos, para ofrecer información comercial correcta a los clientes. |
| HU14 | Comerciante | Como comerciante, quiero gestionar el inventario de mis productos, para conocer el stock disponible. |
| HU15 | Comerciante | Como comerciante, quiero consultar los movimientos de inventario, para controlar ingresos, ventas, devoluciones y ajustes. |
| HU16 | Comerciante | Como comerciante, quiero consultar las operaciones relacionadas con mi puesto, para supervisar las ventas realizadas. |
| HU17 | Comerciante | Como comerciante, quiero validar el pago recibido por los productos de mi puesto, para comenzar la preparación del pedido. |
| HU18 | Comerciante | Como comerciante, quiero registrar variaciones de peso o precio cuando ocurran, para informar correctamente al cliente. |
| HU19 | Comerciante | Como comerciante, quiero marcar los productos de mi puesto como listos para retiro y registrar su entrega al cliente, para mantener actualizado el estado del pedido. |
| HU20 | Trabajador de puesto | Como trabajador de puesto, quiero acceder únicamente a las funciones autorizadas por el comerciante, para apoyar en las operaciones del puesto. |
| HU21 | Administrador | Como administrador, quiero gestionar los usuarios de la plataforma, para controlar quiénes pueden acceder al sistema. |
| HU22 | Administrador | Como administrador, quiero registrar y administrar comerciantes y puestos, para mantener organizada la información del mercado. |
| HU23 | Administrador | Como administrador, quiero consultar pedidos activos e incidencias, para supervisar el funcionamiento de la plataforma. |
| HU24 | Administrador | Como administrador, quiero configurar reglas operativas, para establecer condiciones como tiempos de reserva y tolerancias de peso o precio. |
| HU25 | Administrador | Como administrador, quiero consultar reportes e indicadores, para analizar el funcionamiento general de la plataforma. |
| HU26 | Administrador | Como administrador, quiero consultar registros de auditoría, para mantener la trazabilidad de las operaciones críticas. |

## Historia de usuario, acción y requisito funcional

- **Historia de usuario:** expresa la necesidad de un actor y el beneficio que busca.
- **Acción:** operación concreta que el actor realiza en el sistema para satisfacer esa necesidad.
- **Requisito funcional:** comportamiento que el sistema debe proporcionar para hacer posibles esas acciones.

Por lo tanto, una historia de usuario no es lo mismo que una acción: una historia agrupa una o varias acciones y se concreta en uno o más requisitos funcionales.

Ejemplo con HU17:

| Historia de usuario | Acciones del actor | Requisitos funcionales |
|---|---|---|
| HU17: como comerciante, quiero validar el pago recibido por los productos de mi puesto, para comenzar la preparación del pedido. | Revisa el pago recibido por Yape o Plin del puesto; marca el pago como validado; el trabajador de puesto autorizado puede realizar la misma validación. | RF34: validar el pago del puesto. RF35: impedir la preparación si el pago no fue validado. |
